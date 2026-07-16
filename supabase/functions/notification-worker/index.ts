import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 100;

type Outbox = {
  id: string;
  recipient_id: string;
  title: string;
  body: string;
  payload: { data?: Record<string, unknown>; action_url?: string | null; notification_id?: string };
  attempts: number;
};
type Token = { id: string; expo_push_token: string };
type Preferences = { channels?: { push?: boolean }; categories?: Record<string, boolean> };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function retryAt(attempts: number): string {
  return new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(attempts, 7))).toISOString();
}

async function expoPost(url: string, body: unknown): Promise<{ data?: Array<Record<string, unknown>> | Record<string, Record<string, unknown>> }> {
  const result = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!result.ok) throw new Error(`Expo HTTP ${result.status}`);
  return await result.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const workerSecret = Deno.env.get("NOTIFICATION_WORKER_SECRET");
  if (!workerSecret || req.headers.get("x-notification-worker-secret") !== workerSecret) return json({ error: "Unauthorized" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: jobs, error: claimError } = await db.rpc("claim_notification_outbox", { p_limit: BATCH_SIZE });
  if (claimError) return json({ error: claimError.message }, 500);

  let sent = 0;
  for (const job of (jobs ?? []) as Outbox[]) {
    const { data: profile } = await db.from("profiles").select("notification_preferences")
      .eq("id", job.recipient_id).maybeSingle();
    const preferences = profile?.notification_preferences as Preferences | null;
    if (preferences?.channels?.push === false || (job.category && preferences?.categories?.[job.category] === false)) {
      await db.from("notification_outbox").update({ status: "skipped", completed_at: new Date().toISOString(), locked_until: null, last_error: "Push disabled by recipient preferences" }).eq("id", job.id);
      continue;
    }
    const { data: tokens, error: tokensError } = await db.from("notification_tokens")
      .select("id, expo_push_token").eq("user_id", job.recipient_id).is("invalidated_at", null);
    if (tokensError) {
      await db.from("notification_outbox").update({ status: "retrying", last_error: tokensError.message, next_attempt_at: retryAt(job.attempts), locked_until: null }).eq("id", job.id);
      continue;
    }
    const activeTokens = (tokens ?? []) as Token[];
    if (!activeTokens.length) {
      await db.from("notification_outbox").update({ status: "skipped", completed_at: new Date().toISOString(), locked_until: null, last_error: "No active device token" }).eq("id", job.id);
      continue;
    }
    try {
      const provider = await expoPost(EXPO_SEND_URL, activeTokens.map((token) => ({
        to: token.expo_push_token, title: job.title, body: job.body, sound: "default", priority: "high", channelId: "orders",
        data: { ...(job.payload.data ?? {}), action_url: job.payload.action_url, notification_id: job.payload.notification_id },
      })));
      const tickets = Array.isArray(provider.data) ? provider.data : [];
      const attempts = activeTokens.map((token, index) => {
        const ticket = tickets[index] ?? {};
        const accepted = ticket.status === "ok";
        const details = ticket.details as { error?: string } | undefined;
        return {
          outbox_id: job.id, token_id: token.id, expo_ticket_id: accepted ? ticket.id as string : null,
          status: accepted ? "accepted" : "failed", provider_response: ticket,
          error_code: accepted ? null : details?.error ?? "provider_error",
          error_message: accepted ? null : String(ticket.message ?? "Expo rejected push"),
        };
      });
      await db.from("notification_delivery_attempts").insert(attempts);
      const anyAccepted = attempts.some((attempt) => attempt.status === "accepted");
      await db.from("notification_outbox").update({
        status: anyAccepted ? "sent" : job.attempts >= MAX_ATTEMPTS ? "failed" : "retrying",
        next_attempt_at: anyAccepted ? new Date(Date.now() + 60_000).toISOString() : retryAt(job.attempts),
        locked_until: null, completed_at: anyAccepted ? new Date().toISOString() : null,
        last_error: anyAccepted ? null : "Expo rejected every token",
      }).eq("id", job.id);
      await db.from("notification_tokens").update({ last_push_at: new Date().toISOString() }).in("id", activeTokens.map((token) => token.id));
      if (anyAccepted) sent++;
    } catch (error) {
      await db.from("notification_outbox").update({
        status: job.attempts >= MAX_ATTEMPTS ? "failed" : "retrying",
        last_error: error instanceof Error ? error.message : "Unexpected delivery error",
        next_attempt_at: retryAt(job.attempts), locked_until: null,
      }).eq("id", job.id);
    }
  }

  const { data: pending } = await db.from("notification_delivery_attempts")
    .select("id, outbox_id, token_id, expo_ticket_id").eq("status", "accepted").not("expo_ticket_id", "is", null)
    .lt("created_at", new Date(Date.now() - 45_000).toISOString()).limit(300);
  const ids = (pending ?? []).map((row) => row.expo_ticket_id as string);
  if (ids.length) {
    try {
      const provider = await expoPost(EXPO_RECEIPTS_URL, { ids });
      const receipts = !Array.isArray(provider.data) ? provider.data ?? {} : {};
      for (const attempt of pending ?? []) {
        const receipt = receipts[attempt.expo_ticket_id as string];
        if (!receipt) continue;
        const details = receipt.details as { error?: string } | undefined;
        const failed = receipt.status === "error";
        await db.from("notification_delivery_attempts").update({
          status: failed ? "failed" : "delivered", provider_response: receipt, error_code: details?.error ?? null,
          error_message: failed ? String(receipt.message ?? "Expo receipt failed") : null, receipt_checked_at: new Date().toISOString(),
        }).eq("id", attempt.id);
        if (details?.error === "DeviceNotRegistered" && attempt.token_id) {
          await db.from("notification_tokens").update({ invalidated_at: new Date().toISOString(), invalid_reason: "DeviceNotRegistered" }).eq("id", attempt.token_id);
        }
      }
    } catch { /* Receipt checks are retried on the next scheduled invocation. */ }
  }
  return json({ claimed: jobs?.length ?? 0, sent });
});
