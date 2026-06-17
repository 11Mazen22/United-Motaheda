import { create } from "zustand";

export type RecentProduct = { id: string; name: string; imageUrl?: string; price?: number };

export const useRecentlyViewedStore = create(() => ({ items: [] as RecentProduct[] }));
