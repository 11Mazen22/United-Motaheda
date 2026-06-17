/**
 * Stable React Query keys for the products feature.
 */

import type { ProductFilters } from "../types";

const ROOT = "products" as const;

export const productKeys = {
  all:        [ROOT] as const,
  detail: (id: string) => [ROOT, "detail", id] as const,
  featured: (limit: number) => [ROOT, "featured", limit] as const,
  list: (filters: Pick<ProductFilters, "categoryId" | "search" | "inStock" | "minPrice" | "maxPrice" | "sortBy" | "isSale">) =>
    [
      ROOT,
      "list",
      {
        categoryId: filters.categoryId ?? null,
        search:     (filters.search ?? "").trim().toLowerCase() || null,
        inStock:    filters.inStock ?? false,
        minPrice:   filters.minPrice ?? null,
        maxPrice:   filters.maxPrice ?? null,
        sortBy:     filters.sortBy ?? "newest",
        isSale:     filters.isSale ?? false,
      },
    ] as const,
  search: (q: string) => [ROOT, "search", q.trim().toLowerCase()] as const,
};

export const categoryKeys = {
  all:  ["categories"] as const,
  list: () => ["categories", "list"] as const,
};
