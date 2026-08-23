/**
 * Wishlist store — Supabase-backed with optimistic local mirror.
 *
 * Same pattern as cart: local AsyncStorage cache for anonymous users + speed;
 * server `wishlist_items` table is canonical for authed users; mutations
 * write through to the server in the background.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addWishlistItem,
  clearUserWishlist,
  fetchUserWishlist,
  mergeWishlists,
  removeWishlistItem,
  replaceUserWishlist,
} from "@/features/wishlist/api";
import type { NativeProduct } from "@/services/productsApi";

const WISHLIST_KEY = "um_wishlist_v1";

export interface WishlistState {
  items:       NativeProduct[];
  isHydrated:  boolean;
  userId:      string | null;

  hydrate:     (userId: string | null) => Promise<void>;
  toggle:      (product: NativeProduct) => void;
  has:         (productId: string) => boolean;
  clear:       () => void;
}

function mirror(label: string, fn: () => Promise<unknown>): void {
  void fn().catch((e) => {
    if (__DEV__) console.warn(`[wishlist] ${label} sync failed:`, e);
  });
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items:      [],
  isHydrated: false,
  userId:     null,

  hydrate: async (userId) => {
    if (userId === null) {
      try {
        const raw = await AsyncStorage.getItem(WISHLIST_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        set({
          items:      Array.isArray(parsed) ? (parsed as NativeProduct[]) : [],
          isHydrated: true,
          userId:     null,
        });
      } catch {
        set({ isHydrated: true, userId: null });
      }
      return;
    }

    const localItems = get().items;
    try {
      const serverItems = await fetchUserWishlist(userId);
      const merged = mergeWishlists(localItems, serverItems);
      if (localItems.length > 0) {
        await replaceUserWishlist(userId, merged);
      }
      set({ items: merged, isHydrated: true, userId });
      AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(merged)).catch(() => {});
    } catch (e) {
      if (__DEV__) console.warn("[wishlist.hydrate] failed, using local cache:", e);
      set({ isHydrated: true, userId });
    }
  },

  toggle: (product) => {
    set((s) => {
      const exists = s.items.some((p) => p.id === product.id);
      const next   = exists
        ? s.items.filter((p) => p.id !== product.id)
        : [product, ...s.items];
      AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(next)).catch(() => {});

      if (s.userId) {
        if (exists) {
          mirror("remove", () => removeWishlistItem(s.userId as string, product.id));
        } else {
          mirror("add", () => addWishlistItem(s.userId as string, product));
        }
      }

      return { items: next };
    });
  },

  has: (productId) => get().items.some((p) => p.id === productId),

  /** Clears LOCAL wishlist + cache. Server is left alone — sign-out wipe uses
   *  this so re-sign-in restores. If you genuinely want to wipe the server-
   *  side wishlist (rare; user-initiated "clear all" button), call
   *  `clearUserWishlist(userId)` from the screen directly. */
  clear: () => {
    set({ items: [], userId: null });
    AsyncStorage.removeItem(WISHLIST_KEY).catch(() => {});
  },
}));

// Re-export server-clear for the user-facing "clear all" button on the
// wishlist screen (it should wipe both local and server, since the user
// explicitly asked).
export { clearUserWishlist };
