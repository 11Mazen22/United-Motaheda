/**
 * Public surface of the notifications feature.
 * Consumers should import from "@/features/notifications" exclusively.
 */

// ─── Domain types ──────────────────────────────────────────────────────────
export * from "./types";

// ─── Server API ────────────────────────────────────────────────────────────
export {
  fetchNotificationsPage,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  registerPushToken,
  unregisterPushToken,
  unregisterAllPushTokensForUser,
} from "./api";

// ─── Hooks (component-facing) ──────────────────────────────────────────────
export { useNotifications } from "./hooks/useNotifications";
export { useNotificationPreferences } from "./hooks/useNotificationPreferences";
export { usePushNotificationRegistration } from "./hooks/usePushNotificationRegistration";
export { useUnreadCount } from "./hooks/useUnreadCount";
export { useNotificationSync } from "./hooks/useNotificationSync";

// ─── Banner toast (single canonical source for incoming notification toast) ─
export { useBannerStore } from "./banner-store";
export { NotificationBanner } from "./components/NotificationBanner";
