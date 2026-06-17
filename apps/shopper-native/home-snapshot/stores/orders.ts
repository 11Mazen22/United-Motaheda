/**
 * Orders store — snapshot copy.
 */
import { create } from "zustand";

export const useOrderStore = create((set) => ({
  orders: [],
  isHydrated: false,
  loading: false,
  hydrate: async (userId) => { /* snapshot: omitted */ },
  clearOrders: () => set({ orders: [], isHydrated: false, loading: false }),
}));
