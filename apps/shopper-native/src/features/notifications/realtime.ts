/**
 * Realtime channel subscription for notifications.
 */

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AppNotification } from "./types";

interface NotificationRow {
  id:         string;
  user_id:    string;
  type:       string;
  category:   string | null;
  title:      string;
  body:       string;
  data:       unknown;
  action_url: string | null;
  is_read:    boolean;
  created_at: string;
}

function toAppNotification(row: NotificationRow): AppNotification {
  return {
    id:        row.id,
    userId:    row.user_id,
    type:      (row.type as AppNotification["type"]) ?? "system",
    category:  (row.category as AppNotification["category"]) ?? null,
    title:     row.title,
    body:      row.body,
    data:      (row.data as Record<string, unknown>) ?? {},
    actionUrl: row.action_url,
    isRead:    row.is_read,
    createdAt: row.created_at,
  };
}

export interface NotificationSubscription {
  unsubscribe: () => void;
}

/**
 * Subscribes to INSERTs on this user's notifications, retrying the channel
 * join on CHANNEL_ERROR/TIMED_OUT.
 *
 * Found live 2026-07-08: a directly-inserted row was correctly returned by a
 * normal fetch (REST/PostgREST) but never reached this subscription
 * (WebSocket/Phoenix channel) — no error anywhere, because .subscribe() was
 * previously called with no status callback at all. supabase-js does not
 * retry a channel that fails to join; without a status callback the app has
 * no way to even notice, so one flaky connection attempt silently broke
 * realtime notifications for the rest of the session.
 *
 * Returns a stable handle rather than the raw channel: a retry swaps in a
 * new underlying RealtimeChannel object, so a caller holding onto the first
 * channel reference for cleanup would unsubscribe the wrong (already
 * replaced) channel and leak the retried one past unmount/sign-out.
 * `stopped` additionally guards against a retry's setTimeout firing after
 * the caller already unsubscribed.
 */
export function subscribeToNotifications(
  userId: string,
  onNew: (n: AppNotification) => void,
): NotificationSubscription {
  let current: RealtimeChannel | null = null;
  let stopped = false;

  const join = (attempt: number) => {
    if (stopped) return;
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => onNew(toAppNotification(payload.new as NotificationRow)),
      )
      .subscribe((status, err) => {
        if (stopped) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (__DEV__) console.warn(`[notifications/realtime] channel ${status}, retrying:`, err?.message);
          supabase.removeChannel(channel);
          const delay = Math.min(30_000, 1_000 * 2 ** attempt);
          setTimeout(() => join(attempt + 1), delay);
        } else if (status === "SUBSCRIBED" && __DEV__) {
          console.log("[notifications/realtime] subscribed for user", userId);
        }
      });
    current = channel;
  };

  join(0);

  return {
    unsubscribe: () => {
      stopped = true;
      if (current) supabase.removeChannel(current);
    },
  };
}
