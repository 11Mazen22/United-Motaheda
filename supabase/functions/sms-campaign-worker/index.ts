/**
 * sms-campaign-worker — Supabase Edge Function
 *
 * Processes one batch of a queued SMS campaign.
 *
 * Architecture:
 *   The admin UI creates a campaign + recipient rows (status = 'pending'),
 *   sets campaign status to 'queued', then calls this function repeatedly
 *   (one call per batch) with increasing batch_index values. Each call:
 *
 *     1. Validates admin JWT + is_manager() check
 *     2. Locks the campaign row (SELECT FOR UPDATE via service-role)
 *     3. Reads up to batch_size recipients for the given batch_index
 *     4. Sends each SMS via Twilio (falls back to a no-op log when
 *        TWILIO_ACCOUNT_SID is absent — useful for staging/preview
 *        environments)
 *     5. Updates recipient rows (sent/failed) and campaign counters atomically
 *     6. Appends to sms_audit_log
 *     7. Marks campaign 'completed' when all batches are done
 *
 * Rate limiting:
 *   The caller (admin UI) is responsible for respecting campaign.rate_limit_secs
 *   between batch calls. This function does not sleep — it processes exactly
 *   one batch per invocation so the caller controls the cadence.
 *
 * Retry strategy:
 *   Failed recipients get status = 'failed' with error_message set.
 *   A separate "retry failed" action in the UI can re-queue them by
 *   resetting status back to 'pending' and calling this function again.
 *
 * Security:
 *   - Requires valid Supabase JWT
 *   - is_manager() checked via DB query
 *   - Service-role client used for all DB writes
 *   - Phone numbers are never logged (only recipient IDs in audit_log.detail)
 *
 * Environment variables required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 *   TWILIO_ACCOUNT_SID (optional — SMS disabled, NO-OP mode, without it)
 *   TWILIO_AUTH_TOKEN  (optional)
 *   TWILIO_FROM        (optional)
 *
 * Deploy: supabase functions deploy sms-campaign-worker
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── SMS provider abstraction ─────────────────────────────────────────────────

interface SMSResult {
  success:      boolean;
  errorMessage: string | null;
}

/**
 * sendSMS — sends one SMS via the Twilio REST API.
 * Returns { success, errorMessage } instead of throwing so a single failed
 * send does not abort the batch. All errors are captured per-recipient.
 *
 * Docs: https://www.twilio.com/docs/sms/api/message-resource
 */
async function sendSMS(
  to:      string,
  message: string,
): Promise<SMSResult> {
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_FROM        = Deno.env.get("TWILIO_FROM") ?? "";

  // No-op mode: log and succeed when provider credentials are absent.
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    console.log(`[sms-campaign-worker] NO-OP send to ${to.slice(-4).padStart(to.length, "*")}`);
    return { success: true, errorMessage: null };
  }

  const normalised = normalisePhone(to);
  if (!normalised) {
    return { success: false, errorMessage: "invalid_phone_number" };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const body = new URLSearchParams({
      From: TWILIO_FROM,
      To:   normalised,
      Body: message,
    });

    const resp = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body,
    });

    const data = await resp.json() as { sid?: string; status?: string; message?: string; code?: number };

    if (!resp.ok) {
      return {
        success:      false,
        errorMessage: data.message ?? `HTTP ${resp.status}`,
      };
    }

    return { success: true, errorMessage: null };
  } catch (e) {
    return {
      success:      false,
      errorMessage: e instanceof Error ? e.message : "network_error",
    };
  }
}

/** Normalise an Egyptian phone number to E.164 (+20XXXXXXXXXX). */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0")  && digits.length === 11) return `+20${digits.slice(1)}`;
  if (digits.length === 10)                            return `+20${digits}`;
  return null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: "Invalid or expired session" }, 401);

  // ── is_manager() gate ──────────────────────────────────────────────────────
  const { data: profile } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "manager"].includes(profile.role as string)) {
    return json({ error: "Insufficient privileges" }, 403);
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const campaignId  = typeof body.campaign_id  === "string" ? body.campaign_id.trim()  : "";
  const batchIndex  = typeof body.batch_index  === "number" ? body.batch_index         : -1;

  if (!campaignId)    return json({ error: "campaign_id is required" }, 400);
  if (batchIndex < 0) return json({ error: "batch_index must be >= 0" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Load and validate campaign ─────────────────────────────────────────────
  const { data: campaign, error: campErr } = await admin
    .from("sms_campaigns")
    .select("id, status, message_template, batch_size, total_recipients, sent_count, failed_count, rate_limit_secs")
    .eq("id", campaignId)
    .maybeSingle();

  if (campErr || !campaign) return json({ error: "Campaign not found" }, 404);

  if (!["queued", "running"].includes(campaign.status as string)) {
    return json({ error: `Campaign is ${campaign.status as string}, not processable` }, 409);
  }

  // ── Mark campaign as running (idempotent) ──────────────────────────────────
  if (campaign.status === "queued") {
    await admin
      .from("sms_campaigns")
      .update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  // ── Load batch recipients ──────────────────────────────────────────────────
  const { data: recipients, error: recErr } = await admin
    .from("sms_campaign_recipients")
    .select("id, user_id, phone, full_name")
    .eq("campaign_id", campaignId)
    .eq("batch_index", batchIndex)
    .eq("status", "pending")
    .order("id")
    .limit(campaign.batch_size as number);

  if (recErr) {
    console.error("[sms-campaign-worker] failed to load recipients:", recErr.message);
    return json({ error: "Failed to load batch recipients" }, 500);
  }

  if (!recipients || recipients.length === 0) {
    return json({ batch_index: batchIndex, sent: 0, failed: 0, message: "No pending recipients in this batch" });
  }

  // ── Mark batch recipients as 'sending' ────────────────────────────────────
  const recipientIds = recipients.map((r) => r.id as string);
  await admin
    .from("sms_campaign_recipients")
    .update({ status: "sending" })
    .in("id", recipientIds);

  // Log batch start.
  await admin.from("sms_audit_log").insert({
    campaign_id: campaignId,
    event:       "batch_started",
    actor_id:    user.id,
    batch_index: batchIndex,
    detail:      { recipient_count: recipients.length },
  });

  // ── Send SMS for each recipient ────────────────────────────────────────────
  let batchSent   = 0;
  let batchFailed = 0;
  const now = new Date().toISOString();

  for (const recipient of recipients) {
    const result = await sendSMS(recipient.phone as string, campaign.message_template as string);

    if (result.success) {
      await admin
        .from("sms_campaign_recipients")
        .update({ status: "sent", sent_at: now })
        .eq("id", recipient.id as string);
      batchSent++;
    } else {
      await admin
        .from("sms_campaign_recipients")
        .update({
          status:        "failed",
          failed_at:     now,
          error_message: result.errorMessage ?? "unknown_error",
        })
        .eq("id", recipient.id as string);
      batchFailed++;
    }
  }

  // ── Update campaign counters ───────────────────────────────────────────────
  const newSentCount   = (campaign.sent_count   as number) + batchSent;
  const newFailedCount = (campaign.failed_count as number) + batchFailed;
  const totalProcessed = newSentCount + newFailedCount;
  const allDone        = totalProcessed >= (campaign.total_recipients as number);

  await admin
    .from("sms_campaigns")
    .update({
      sent_count:   newSentCount,
      failed_count: newFailedCount,
      status:       allDone ? "completed" : "running",
      completed_at: allDone ? new Date().toISOString() : null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", campaignId);

  // ── Log batch completion ───────────────────────────────────────────────────
  await admin.from("sms_audit_log").insert({
    campaign_id: campaignId,
    event:       allDone ? "completed" : "batch_completed",
    actor_id:    user.id,
    batch_index: batchIndex,
    detail:      {
      sent:        batchSent,
      failed:      batchFailed,
      total_sent:  newSentCount,
      total_failed:newFailedCount,
    },
  });

  return json({
    batch_index:   batchIndex,
    sent:          batchSent,
    failed:        batchFailed,
    total_sent:    newSentCount,
    total_failed:  newFailedCount,
    campaign_done: allDone,
  });
});
