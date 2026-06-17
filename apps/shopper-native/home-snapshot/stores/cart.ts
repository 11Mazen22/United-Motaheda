/**
 * Simplified Cart store — snapshot-friendly, no external deps.
 */
import { create } from "zustand";

export const useCartStore = create((set, get) => ({
  items: [] as any[],
  promoCode: "",
  shippingFee: 0,
  isHydrated: false,
  userId: null as string | null,
  hydrate: async (userId?: string | null) => { set({ isHydrated: true, userId: userId ?? null }); },
  addItem: (product: any, qty = 1) => set((s: any) => ({ items: [...s.items, { productId: product.id, quantity: qty, product }] })),
  removeItem: (productId: string) => set((s: any) => ({ items: s.items.filter((i: any) => i.productId !== productId) })),
  updateQty: (productId: string, qty: number) => set((s: any) => ({ items: s.items.map((i: any) => i.productId === productId ? { ...i, quantity: qty } : i) })),
  clearCart: () => set({ items: [], promoCode: "", userId: null }),
  setPromoCode: (code: string) => set({ promoCode: code.trim() }),
  setShippingFee: (fee: number) => set({ shippingFee: Math.max(0, fee) }),
  clearReservationError: () => {},
  ensureReservations: async () => [] as any[],
  commitReservations: async (orderId: string) => ({ committed: 0, failed: 0 }),
  itemCount: () => get().items.reduce((acc: number, i: any) => acc + (i.quantity || 0), 0),
  subtotal: () => ({ subtotal: get().items.reduce((acc: number, i: any) => acc + ((i.product?.price ?? 0) * (i.quantity ?? 1)), 0) }),
}));

export const selectItemCount = (s: any) => s.items.reduce((acc: number, i: any) => acc + (i.quantity || 0), 0);

