/**
 * useNotificationSync — single global realtime subscription per user.
 *
 * Mount once at the app root (inside <AuthProvider>). When a new
 * notification arrives:
 *   1. Push it onto the banner toast queue (for the floating banner UI)
 *   2. Invalidate the TanStack caches for the notification list AND
 *      the unread count so any mounted screen / badge re-renders.
 *
 * This replaces the legacy `NotificationSync` + separate realtime
 * subscription inside `useNotifications`. Previously the app could
 * end up with TWO active realtime channels (one global from the
 * legacy store + one from the screen-mounted hook). Now there's
 * exactly one channel for the lifetime of the auth session.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToNotifications } from "../realtime";
import { useBannerStore } from "../banner-store";

export function useNotificationSync(userId: string | undefined): void {
  const qc = useQueryClient();
  const pushBanner = useBannerStore((s) => s.pushBanner);
  const resetBanner = useBannerStore((s) => s.reset);

  useEffect(() => {
    if (!userId) {
      resetBanner();
      return;
    }

    const sub = subscribeToNotifications(userId, (notif) => {
      // Surface as a banner toast
      pushBanner(notif);

      // Invalidate any queries that depend on this user's notifications
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
      qc.invalidateQueries({ queryKey: ["notification-unread-count", userId] });
    });

    return () => sub.unsubscribe();
  }, [userId, qc, pushBanner, resetBanner]);
}
