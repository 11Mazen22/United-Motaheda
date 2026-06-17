import { create } from "zustand";
import type { ProductSortMode } from "../types";

interface FiltersState {
  search: string;
  categoryId: string | null;
  inStock: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: ProductSortMode;
  viewMode: "grid" | "list";
  setSearch: (v: string) => void;
  setCategory: (id: string | null) => void;
  toggleInStock: () => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setSort: (s: ProductSortMode) => void;
  setViewMode: (m: "grid" | "list") => void;
  reset: () => void;
}

const INITIAL = {
  search: "",
  categoryId: null,
  inStock: false,
  minPrice: null,
  maxPrice: null,
  sortBy: "newest" as ProductSortMode,
  viewMode: "grid" as const,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...INITIAL,
  setSearch: (search) => set({ search }),
  setCategory: (categoryId) => set({ categoryId }),
  toggleInStock: () => set((s) => ({ inStock: !s.inStock })),
  setPriceRange: (minPrice, maxPrice) => set({ minPrice, maxPrice }),
  setSort: (sortBy) => set({ sortBy }),
  setViewMode: (viewMode) => set({ viewMode }),
  reset: () => set(INITIAL),
}));

export const selectSearch = (s: FiltersState) => s.search;
export const selectCategory = (s: FiltersState) => s.categoryId;
export const selectInStock = (s: FiltersState) => s.inStock;
export const selectSort = (s: FiltersState) => s.sortBy;
export const selectViewMode = (s: FiltersState) => s.viewMode;
