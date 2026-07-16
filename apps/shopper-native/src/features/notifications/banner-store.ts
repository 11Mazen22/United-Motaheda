/**
 * Banner toast queue.
 *
 * Replaces the legacy store's banner state. A single canonical place
 * for the latest incoming notification to surface as a toast, separate
 * from the TanStack notification cache (which handles list state).
 *
 * Lifecycle:
 *   - On a new realtime notification, NotificationSync calls pushBanner()
 *   - NotificationBanner renders the current banner with a swipe-to-dismiss
 *   - User taps or auto-timeout fires dismissBanner()
 */

import { create } from "zustand";
import type { AppNotification } from "./types";

interface BannerState {
  banner: AppNotification | null;
  queue: AppNotification[];
  pushBanner:    (notif: AppNotification) => void;
  dismissBanner: () => void;
  reset:         () => void;
}

export const useBannerStore = create<BannerState>((set) => ({
  banner: null,
  queue: [],
  // Realtime bursts are common when an order changes state. Queue them rather
  // than replacing the visible banner, which previously made notifications
  // appear to disappear before a driver could read them.
  pushBanner: (notif) => set((state) => {
    if (state.banner?.id === notif.id || state.queue.some((item) => item.id === notif.id)) return state;
    return state.banner ? { queue: [...state.queue, notif] } : { banner: notif };
  }),
  dismissBanner: () => set((state) => ({ banner: state.queue[0] ?? null, queue: state.queue.slice(1) })),
  reset: () => set({ banner: null, queue: [] }),
}));
