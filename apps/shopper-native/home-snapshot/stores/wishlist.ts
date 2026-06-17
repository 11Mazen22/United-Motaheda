import { create } from "zustand";

export const useWishlistStore = create((set) => ({
  items: [] as string[],
  toggle: (product: any) => set((s: any) => {
    const exists = s.items.includes(product.id);
    return { items: exists ? s.items.filter((id: string) => id !== product.id) : [...s.items, product.id] };
  }),
  has: (id: string) => false,
}));
