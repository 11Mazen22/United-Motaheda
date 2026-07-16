/**
 * useInfiniteProducts — server-paginated, debounced infinite-query hook.
 *
 *  - Wraps the `search_products` RPC via fetchProductsPage.
 *  - Search input is debounced 300 ms before triggering a new query so typing
 *    doesn't fire a request per keystroke; existing queries are cancelled via
 *    the React Query signal.
 *  - placeholderData = keepPreviousData → smooth filter/sort transitions with
 *    zero empty-grid flash when the user changes sort order or filters.
 *  - staleTime: 90 s for browse (category page stays fresh across navigation
 *    back/forward), 30 s for search (results must feel live).
 *  - retry: 2 attempts for transient errors, never for terminal ones (4xx).
 *  - signal forwarded from React Query so cancellation works end-to-end.
 */

import { useEffect, useMemo } from "react";
import {
  useInfiniteQuery,
  keepPreviousData,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { prefetchImages } from "@/lib/imagePrefetch";
import { fetchProductsPage } from "../api/productsApi";
import { productKeys } from "../api/queryKeys";
import { isRetryable } from "@/lib/supabaseRequest";
import type { NativeProduct, ProductFilters, ProductPage } from "../types";

const DEFAULT_PAGE_SIZE  = 15;
const SEARCH_DEBOUNCE_MS = 300;
// Hard cap: never accumulate more than this many pages in memory.
// At 15 items/page this is 150 items max — enough for comfortable browsing
// without choking the UI thread with thousands of mounted Reanimated nodes.
// Each ProductCard holds 3 useSharedValue instances; 150 cards = 450 nodes.
// The old cap of 100 pages (2 000 cards = 6 000 nodes) was the primary
// cause of JS-thread lag during extended scroll sessions.
const DEFAULT_MAX_PAGES  = 10;

// Separate stale windows: browsing a category is low-churn and should survive
// back-navigation without re-fetching; live search results need to feel fresh.
const BROWSE_STALE_MS = 90_000;  // 90 s
const SEARCH_STALE_MS = 30_000;  // 30 s

export interface UseInfiniteProductsArgs {
  categoryId?: string;
  search?:     string;
  inStock?:    boolean;
  minPrice?:   number;
  maxPrice?:   number;
  sortBy?:     ProductFilters["sortBy"];
  pageSize?:   number;
  /** Maximum pages to keep in memory. Defaults to 10 (≈150 items at 15/page). */
  maxPages?:   number;
  /** If false, the query is disabled. Defaults to true. */
  enabled?:    boolean;
  /** Restrict results to products with an active canonical promotion. */
  isSale?:     boolean;
}

export interface UseInfiniteProductsResult {
  products:           NativeProduct[];
  totalCount:         number;
  isLoading:          boolean;
  isFetching:         boolean;
  isFetchingNextPage: boolean;
  isRefreshing:       boolean;
  isError:            boolean;
  hasNextPage:        boolean;
  fetchNextPage:      () => void;
  refetch:            () => void;
  raw:                UseInfiniteQueryResult<InfiniteData<ProductPage>, Error>;
}

export function useInfiniteProducts(args: UseInfiniteProductsArgs = {}): UseInfiniteProductsResult {
  const {
    categoryId,
    search,
    inStock,
    minPrice,
    maxPrice,
    sortBy   = "newest",
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = DEFAULT_MAX_PAGES,
    enabled  = true,
    isSale   = false,
  } = args;

  const debouncedSearch = useDebounce(search?.trim() ?? "", SEARCH_DEBOUNCE_MS);
  const isSearchMode    = debouncedSearch.length > 0;

  const query = useInfiniteQuery({
    queryKey: productKeys.list({
      categoryId,
      search:   debouncedSearch,
      inStock,
      minPrice,
      maxPrice,
      sortBy,
      isSale,
    }),
    initialPageParam: 1 as number,
    queryFn: ({ pageParam, signal }) =>
      fetchProductsPage({
        categoryId,
        search:    debouncedSearch || undefined,
        inStock,
        minPrice,
        maxPrice,
        sortBy,
        isSale,
        page:      pageParam as number,
        pageSize,
        signal,
      }),
    getNextPageParam: (last, allPages) => {
      if (allPages.length >= maxPages) return undefined;
      return last.hasNextPage ? last.currentPage + 1 : undefined;
    },
    placeholderData:  keepPreviousData,
    enabled,
    staleTime: isSearchMode ? SEARCH_STALE_MS : BROWSE_STALE_MS,
    gcTime:    2 * 60_000,   // release pages 2 min after unmount (was 5 min)
    retry:     (failureCount, error) => {
      // Never retry terminal errors (bad request, permissions). Retry
      // transient ones (network, 5xx) up to 2 times.
      if (!isRetryable(error)) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 5000),
  });

  // Flatten pages once per data change; dedupe by id so overlapping page
  // responses from race conditions never produce duplicate keys in the list.
  const products = useMemo(() => {
    const seen = new Set<string>();
    const out: NativeProduct[] = [];
    for (const p of query.data?.pages.flatMap((page) => page.products) ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }, [query.data]);

  // Warm the image cache for the latest page. The prefetcher is bounded by
  // a concurrency cap so this never saturates the network.
  useEffect(() => {
    const lastPage = query.data?.pages.at(-1);
    if (!lastPage) return;
    prefetchImages(lastPage.products.map((p) => p.imageUrl ?? null));
  }, [query.data]);

  return {
    products,
    totalCount:         query.data?.pages[0]?.totalCount ?? 0,
    isLoading:          query.isLoading,
    isFetching:         query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefreshing:       query.isFetching && !query.isFetchingNextPage && !query.isLoading,
    isError:            query.isError,
    hasNextPage:        Boolean(query.hasNextPage),
    fetchNextPage:      () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    refetch:            () => { void query.refetch(); },
    raw:                query,
  };
}
