/**
 * useNotificationSync — single global realtime subscription per user.
 *
 * Mount once at the app root (inside <AuthProvider>). When a new
 * notification arrives:
 *   1. Push it onto the banner toast queue (for the floating banner UI)
 *   2. Invalidate the TanStack caches for the notification list AND
 *      the unread count so any mounted screen / badge re-renders.
 *
 * Built on the shared useRealtimeInvalidate (see shared/hooks) — exactly one
 * channel for the lifetime of the auth session, same as before.
 */

import { useEffect } from "react";
import { useRealtimeInvalidate } from "@/shared/hooks/useRealtimeInvalidate";
import { useBannerStore } from "../banner-store";
import type { AppNotification } from "../types";

type NotificationRow = {
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
};

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

export function useNotificationSync(userId: string | undefined): void {
  const pushBanner = useBannerStore((s) => s.pushBanner);
  const resetBanner = useBannerStore((s) => s.reset);

  useRealtimeInvalidate<NotificationRow>({
    enabled: Boolean(userId),
    channelName: `notifs-${userId}`,
    table: "notifications",
    event: "INSERT",
    filter: `user_id=eq.${userId}`,
    onEvent: (payload) => {
      pushBanner(toAppNotification(payload.new as NotificationRow));
    },
    queryKeys: [["notifications", userId], ["notification-unread-count", userId]],
  });

  // Preserve the original behavior of clearing the banner queue as soon as
  // there is no signed-in user (sign-out), not just on unmount.
  useEffect(() => {
    if (!userId) resetBanner();
  }, [userId, resetBanner]);
}
