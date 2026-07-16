/**
 * Orders store — read-only view of the production public.orders table.
 *
 * Order creation goes through the create-order Edge Function (called from
 * checkout). The Edge Function handles uuid + qr_token + idempotency_key +
 * all NOT NULL columns + business logic. The client never inserts directly.
 *
 * This store:
 *   - holds the user's orders in memory for fast list rendering
 *   - hydrate(userId) fetches from Supabase via fetchUserOrders, which now
 *     joins order_items and hydrates product images
 *   - clearOrders() clears the local cache (no server-side delete)
 *
 * AsyncStorage keeps a write-through cache so the orders list paints
 * instantly on next launch (offline-first).
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchUserOrders } from "@/features/orders/api";

const ORDERS_KEY = "um_orders_v2";

export interface OrderItem {
  productId: string;
  name:      string;
  price:     number;
  quantity:  number;
  imageUrl?: string;
}

// Full canonical set (see packages/contracts/src/orderStatus.ts for the
// shared lifecycle doc — not imported directly here to avoid wiring this
// Expo app into the npm workspace's Metro resolution). "processing" and
// "shipped" are legacy synonyms of "preparing"/"picked_up" still present in
// historical rows; "confirmed"/"preparing"/"ready"/"picked_up" are written
// by the web admin's Operations Hub and must render correctly here too.
export type OrderStatus =
  | "pending"
  | "pending_payment"
  | "confirmed"
  | "processing"
  | "preparing"
  | "ready"
  | "driver_assigned"
  | "driver_accepted"
  | "out_for_delivery"
  | "shipped"
  | "picked_up"
  | "delivered"
  | "cancelled"
  | "archived";

export interface Order {
  id:        string;
  createdAt: string;
  items:     OrderItem[];
  subtotal:  number;
  delivery:  number;
  total:     number;
  discountTotal?: number;
  taxTotal?:      number;
  address: {
    name:       string;
    phone:      string;
    city:       string;
    street:     string;
    building?:  string;
    floor?:     string;
    apartment?: string;
    notes?:     string;
    formatted?: string;
  };
  status:          OrderStatus;
  paymentMethod:   string | null;
  paymentStatus:   string;
  externalRef:     string | null;
  paymentProofUrl: string | null;
  transferNumber:  string | null;
}

interface OrdersState {
  orders:      Order[];
  isHydrated:  boolean;
  loading:     boolean;

  /** Fetch from Supabase + populate local cache. Pass null on sign-out
   *  to clear both. Call from PharmacyBootstrap on user.id change, and
   *  manually from checkout success to pick up the new order. */
  hydrate:     (userId: string | null) => Promise<void>;

  /** Clears LOCAL cache only. Server rows are immutable history. */
  clearOrders: () => void;
}

export const useOrderStore = create<OrdersState>((set) => ({
  orders:     [],
  isHydrated: false,
  loading:    false,

  hydrate: async (userId) => {
    if (userId === null) {
      set({ orders: [], isHydrated: true, loading: false });
      await AsyncStorage.removeItem(ORDERS_KEY).catch(() => {});
      return;
    }

    set({ loading: true });
    try {
      const orders = await fetchUserOrders(userId);
      set({ orders, isHydrated: true, loading: false });
      AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders)).catch(() => {});
    } catch (e) {
      if (__DEV__) console.warn("[orders.hydrate] fetch failed, falling back to cache:", e);
      try {
        const raw = await AsyncStorage.getItem(ORDERS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) set({ orders: parsed as Order[] });
        }
      } catch { /* swallow */ }
      set({ isHydrated: true, loading: false });
    }
  },

  clearOrders: () => {
    set({ orders: [], isHydrated: false, loading: false });
    AsyncStorage.removeItem(ORDERS_KEY).catch(() => {});
  },
}));
