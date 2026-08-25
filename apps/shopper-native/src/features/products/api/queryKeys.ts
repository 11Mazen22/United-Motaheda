/**
 * Stable React Query keys for the products feature.
 *
 * Centralising the keys means a refactor of the key shape (e.g. adding a
 * locale segment) touches one file. The first segment ("products") matches
 * the SENSITIVE_PREFIXES list in queryPersister so persistence behaves
 * predictably — products ARE persisted (anonymous, public data), the
 * exclusion list is for user-scoped keys.
 */

import type { ProductFilters } from "../types";

const ROOT = "products" as const;

export const productKeys = {
  all:        [ROOT] as const,

  /** Single product detail. */
  detail: (id: string) =>
    [ROOT, "detail", id] as const,

  /** Featured / homepage rail. */
  featured: (limit: number) =>
    [ROOT, "featured", limit] as const,

  /** On-sale products / homepage flash-sale rail. */
  flashSale: (limit: number) =>
    [ROOT, "flashSale", limit] as const,

  /** Infinite list keyed by the discriminating filters. */
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
        isSale:     filters.isSale ?? false,   // must be in key — different data source
      },
    ] as const,

  /** Quick search-autocomplete results (smaller page, includes ranking). */
  search: (q: string) =>
    [ROOT, "search", q.trim().toLowerCase()] as const,
};

/**
 * Category keys — separate root so category data isn't entangled with the
 * products invalidation surface.
 */
export const categoryKeys = {
  all:    ["categories"] as const,
  list:   () => ["categories", "list"] as const,
};
