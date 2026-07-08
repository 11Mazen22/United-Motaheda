/**
 * pushNotifications.ts — single chokepoint for forwarding a notification to
 * Expo's push gateway so it reaches the OS notification tray (background,
 * minimized, or killed app), not just the in-app realtime feed.
 *
 * Before this file existed, every automated trigger in orderNotificationsApi.ts
 * (order status, payment status, driver assignment/unassignment, issue
 * resolved) only inserted a `notifications` row — visible solely to a user
 * with the app open to catch the realtime INSERT. Only NotificationsManager's
 * admin-composed broadcast forwarded to Expo, via its own inline copy of this
 * logic. That's why real, automatic notifications never reached the tray.
 *
 * Used by both: orderNotificationsApi.ts's insertNotification() (so every
 * automated trigger gets it for free) and NotificationsManager.tsx's compose
 * flow (replacing its former inline duplicate).
 */

import { getSupabaseClient } from "../lib/supabaseClient";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100; // Expo's per-call cap

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function postToExpo(tokens: string[], payload: PushPayload): Promise<void> {
  for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(i, i + EXPO_BATCH_SIZE).map((to) => ({
      to,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      priority: "high",
    }));
    try {
      await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
    } catch (err) {
      // Best-effort — the in-app/realtime delivery path already succeeded by
      // the time this runs; a push-gateway failure must never surface to the
      // caller (order status updates, admin broadcasts, etc. keep working).
      console.error("[pushNotifications] Expo push batch failed:", err);
    }
  }
}

/** Push to every device registered for one user (a user can hold multiple
 *  tokens — multiple devices, or a reinstalled app that re-registered). */
export async function sendExpoPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const { data } = await getSupabaseClient()
    .from("notification_tokens")
    .select("expo_push_token")
    .eq("user_id", userId);

  const tokens = (data ?? [])
    .map((r) => (r as { expo_push_token?: string }).expo_push_token)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  if (tokens.length === 0) return;
  await postToExpo(tokens, payload);
}

/** Broadcast path — every registered token across all users. */
export async function sendExpoPushToAll(payload: PushPayload): Promise<void> {
  const { data } = await getSupabaseClient()
    .from("notification_tokens")
    .select("expo_push_token");

  const tokens = (data ?? [])
    .map((r) => (r as { expo_push_token?: string }).expo_push_token)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  if (tokens.length === 0) return;
  await postToExpo(tokens, payload);
}
