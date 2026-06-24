/**
 * useInfiniteProducts.ts — Server-paginated product feed with Infinite Scroll
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHY THIS HOOK EXISTS (the 30-second hang problem)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The previous architecture loaded ALL 52 000 products into the client on every
 * page visit:
 *
 *   fetchAllProductRows()          // 53 Supabase HTTP calls (52K ÷ 1000, 6 concurrent)
 *     → normalise + sort 52K rows  // ~4 s of JS on low-end devices
 *     → store in memory            // ~80 MB RAM
 *     → initialise fuzzy worker    // structured-clone of 52K objects
 *
 * Total: 25–35 seconds on a typical connection. The UI was frozen the whole time.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEW ARCHITECTURE: Server-side everything
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   User types query
 *     ↓  300ms debounce (no network call until the user pauses)
 *   Supabase .ilike('%query%') + .range(0, 23)   ← 1 HTTP call, <200ms
 *     ↓
 *   Display 24 results in VirtuosoGrid
 *     ↓
 *   User scrolls to bottom → VirtuosoGrid fires endReached
 *     ↓
 *   Supabase .range(24, 47)                       ← 1 more HTTP call
 *     ↓
 *   Append 24 more results … repeat
 *
 * Benefits:
 *   • Sub-second first paint (24 rows instead of 52 000)
 *   • Search results in <200ms (DB ilike with GIN trigram index vs. client fuzzy)
 *   • Minimal memory (~2 KB per page × pages loaded, not 80 MB)
 *   • DOM stays small — VirtuosoGrid only mounts visible cards
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * FOR BARA'A — how to trace the data flow
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   useInfiniteProducts(filters)
 *     → fetchProductsPage(page, filters)   ← services/shopperCatalogApi.ts
 *       → buildSupabaseQuery(...)          ← constructs .ilike / .range / .order
 *         → Supabase REST API → PostgreSQL products table
 *
 * To add a new filter (e.g., brand), add the field to ProductFilters in
 * shopperCatalogApi.ts and add the Supabase clause inside buildSupabaseQuery.
 * No changes needed in this hook — it passes filters through transparently.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProductsPage,
  type PageResult,
  type ProductFilters,
} from "../../services/shopperCatalogApi";
import type { CatalogProduct } from "../catalog";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InfiniteProductsFilters {
  /** Raw search query — debounced 300ms before hitting the server. */
  query?: string;
  /** Category slug, e.g. "medications" or "skin-care". */
  categoryId?: string;
  /**
   * When true, only rows where `is_active = true` are returned.
   * `undefined` means no stock filter (show all).
   */
  inStock?: boolean;
  /**
   * Upper price bound passed to Supabase as `.lte("Price", maxPrice)`.
   * `undefined` or `0` means no upper limit.
   */
  maxPrice?: number;
  /**
   * Server-side sort order — translated to Supabase `.order()` calls inside
   * `buildSupabaseQuery`. Defaults to "relevant" (in-stock first, then name A–Z).
   */
  sortBy?: "relevant" | "price_asc" | "price_desc" | "name";
  /** When true, only rows where `is_sale = true` are returned. */
  isSale?: boolean;
}

export interface UseInfiniteProductsResult {
  /** All products loaded so far across every fetched page. */
  products: CatalogProduct[];
  /** True only during the very first fetch — nothing to show yet. */
  isLoading: boolean;
  /** True while fetching page 2+. Existing results stay visible. */
  isFetchingNext: boolean;
  /**
   * Load the next page. Wire this to VirtuosoGrid's `endReached` prop.
   * Calling it when already fetching or when `hasNextPage` is false is safe — it no-ops.
   */
  fetchNextPage: () => void;
  /** False once the last page has been loaded. */
  hasNextPage: boolean;
  /** Server-reported total matching the current filters (for result-count badge). */
  totalCount: number;
  /** The debounced query the server actually searched — use this for empty-state messages. */
  activeQuery: string;
  /** Non-null when the last request failed. Cleared on the next successful fetch. */
  error: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Milliseconds to wait after the last keystroke before sending a search request.
 * 220ms: slightly faster than the original 300ms — still avoids firing on every
 * intermediate character on a fast typist while feeling more responsive.
 */
const SEARCH_DEBOUNCE_MS = 220;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInfiniteProducts(
  filters: InfiniteProductsFilters,
): UseInfiniteProductsResult {
  const { query = "", categoryId, inStock, maxPrice, sortBy, isSale } = filters;

  // ── 1. Debounce the raw query ─────────────────────────────────────────────
  //
  // `debouncedQuery` is the query the server has actually seen.
  // We only update it (and therefore retrigger the fetch effect) after the
  // user has stopped typing for SEARCH_DEBOUNCE_MS milliseconds.
  // Clearing the search field bypasses the debounce so the grid resets instantly.
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();

    if (!trimmed) {
      // Clearing is instant — no delay needed.
      setDebouncedQuery("");
      return;
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ── 2. Pagination state ───────────────────────────────────────────────────

  const [pages, setPages] = useState<PageResult[]>([]);
  const [currentPage, setCurrentPage] = useState(0); // 0 = initial state, not yet fetched
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: prevents overlapping fetches triggered by rapid scroll events.
  const isFetchingRef = useRef(false);

  // Cooldown: after each page lands, VirtuosoGrid re-measures and can fire
  // endReached again immediately (all new items fit in viewport + overscan).
  // Holding this ref true for 800 ms after append breaks the cascade loop.
  const fetchCooldownRef = useRef(false);

  // Generation counter: each filter change increments this, letting async
  // callbacks detect that they belong to a now-stale request and self-discard.
  const generationRef = useRef(0);

  // ── 3. Reset & fetch page 1 on filter / debounced query change ────────────
  //
  // Any time the committed search query, category, stock flag, or price cap
  // changes, we throw away all loaded pages and start from scratch.
  // The Supabase in-memory page cache in shopperCatalogApi.ts ensures that
  // re-requesting the same query+page combination costs zero network calls.
  useEffect(() => {
    const generation = ++generationRef.current;

    // Reset display state immediately so the skeleton appears before the
    // network response arrives.
    setPages([]);
    setCurrentPage(0);
    setHasNextPage(false);
    setTotalCount(0);
    setIsLoading(true);
    setError(null);
    isFetchingRef.current = false;
    fetchCooldownRef.current = false;

    // Build the filter object for shopperCatalogApi.
    // Only include fields that are actually set — undefined fields are ignored
    // by buildSupabaseQuery, which avoids adding unnecessary WHERE clauses.
    const serverFilters: ProductFilters = {
      searchQuery: debouncedQuery || undefined,
      categoryId: categoryId || undefined,
      inStock: inStock === true ? true : undefined,
      maxPrice: maxPrice && maxPrice > 0 ? maxPrice : undefined,
      sortBy: sortBy || undefined,
      isSale: isSale === true ? true : undefined,
    };

    void fetchProductsPage(1, serverFilters)
      .then((result) => {
        // Discard responses that belong to a superseded filter state.
        if (generation !== generationRef.current) return;

        setPages([result]);
        setCurrentPage(1);
        setHasNextPage(result.hasNextPage);
        setTotalCount(result.totalCount);
        setIsLoading(false);
        setError(null);
      })
      .catch((err: unknown) => {
        if (generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load products");
        setIsLoading(false);
      });
  }, [debouncedQuery, categoryId, inStock, maxPrice, sortBy, isSale]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4. fetchNextPage — called by VirtuosoGrid's endReached ───────────────
  //
  // VirtuosoGrid calls `endReached` when the last rendered item enters the
  // viewport. This function loads the next page and appends it to `pages`.
  //
  // Guard conditions prevent duplicate fetches:
  //   • isFetchingRef.current  — a request is already in-flight
  //   • !hasNextPage           — no more data to load
  //   • currentPage === 0      — page-1 hasn't arrived yet (race on first render)
  const fetchNextPage = useCallback(() => {
    if (isFetchingRef.current || fetchCooldownRef.current || !hasNextPage || currentPage === 0) return;

    isFetchingRef.current = true;
    fetchCooldownRef.current = true; // held until 800ms after items are appended
    setIsFetchingNext(true);

    const generation = generationRef.current;
    const nextPage = currentPage + 1;

    const serverFilters: ProductFilters = {
      searchQuery: debouncedQuery || undefined,
      categoryId: categoryId || undefined,
      inStock: inStock === true ? true : undefined,
      maxPrice: maxPrice && maxPrice > 0 ? maxPrice : undefined,
    };

    void fetchProductsPage(nextPage, serverFilters)
      .then((result) => {
        // Discard if the user changed filters while this request was in-flight.
        if (generation !== generationRef.current) {
          isFetchingRef.current = false;
          return;
        }

        setPages((prev) => [...prev, result]);
        setCurrentPage(nextPage);
        setHasNextPage(result.hasNextPage);
        setTotalCount(result.totalCount);
        setIsFetchingNext(false);
        isFetchingRef.current = false;
        // Release the cascade guard after VirtuosoGrid has time to re-measure
        // its new height. Without this delay, endReached fires again immediately
        // after append (all new items still fit in viewport + overscan → cascade).
        // Reduced from 800ms → 450ms: VirtuosoGrid re-measures faster on modern
        // devices; 450ms is enough to break the cascade without making the user
        // wait noticeably before the next page triggers.
        setTimeout(() => { fetchCooldownRef.current = false; }, 450);
      })
      .catch((err: unknown) => {
        if (generation !== generationRef.current) {
          isFetchingRef.current = false;
          fetchCooldownRef.current = false;
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load more products");
        setIsFetchingNext(false);
        isFetchingRef.current = false;
        fetchCooldownRef.current = false;
      });
  }, [currentPage, hasNextPage, debouncedQuery, categoryId, inStock, maxPrice, sortBy]);

  // ── 5. Flatten pages → single product array ───────────────────────────────
  //
  // `pages` is an array of PageResult objects. Each result has a `products`
  // array of 24 items. We flatten them all into one list for VirtuosoGrid.
  const products = pages.flatMap((p) => p.products);

  return {
    products,
    isLoading,
    isFetchingNext,
    fetchNextPage,
    hasNextPage,
    totalCount,
    activeQuery: debouncedQuery,
    error,
  };
}
