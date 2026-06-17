import { useEffect, useMemo } from "react";
import {
  useInfiniteQuery,
  keepPreviousData,
  type UseInfiniteQueryResult,
  type InfiniteData,
} from "@tanstack/react-query";
import { useDebounce } from "../helpers/useDebounce";
import { prefetchImages } from "../helpers/imagePrefetch";
import { fetchProductsPage } from "../api/productsApi";
import { productKeys } from "../api/queryKeys";
import { isRetryable } from "../supabaseRequest";
import type { NativeProduct, ProductFilters, ProductPage } from "../types";

const DEFAULT_PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_MAX_PAGES = 10;
const BROWSE_STALE_MS = 90_000;
const SEARCH_STALE_MS = 30_000;

export interface UseInfiniteProductsArgs {
  categoryId?: string;
  search?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: ProductFilters["sortBy"];
  pageSize?: number;
  maxPages?: number;
  enabled?: boolean;
  isSale?: boolean;
}

export interface UseInfiniteProductsResult {
  products: NativeProduct[];
  totalCount: number;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isRefreshing: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  raw: UseInfiniteQueryResult<InfiniteData<ProductPage>, Error>;
}

export function useInfiniteProducts(args: UseInfiniteProductsArgs = {}): UseInfiniteProductsResult {
  const {
    categoryId,
    search,
    inStock,
    minPrice,
    maxPrice,
    sortBy = "newest",
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = DEFAULT_MAX_PAGES,
    enabled = true,
    isSale = false,
  } = args;

  const debouncedSearch = useDebounce(search?.trim() ?? "", SEARCH_DEBOUNCE_MS);
  const isSearchMode = debouncedSearch.length > 0;

  const query = useInfiniteQuery({
    queryKey: productKeys.list({
      categoryId,
      search: debouncedSearch,
      inStock,
      minPrice,
      maxPrice,
      sortBy,
      isSale,
    }),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchProductsPage({
        categoryId,
        search: debouncedSearch || undefined,
        inStock,
        minPrice,
        maxPrice,
        sortBy,
        isSale,
        page: pageParam as number,
        pageSize,
        signal,
      }),
    getNextPageParam: (last, allPages) => {
      if (allPages.length >= maxPages) return undefined;
      return last.hasNextPage ? last.currentPage + 1 : undefined;
    },
    placeholderData: keepPreviousData,
    enabled,
    staleTime: isSearchMode ? SEARCH_STALE_MS : BROWSE_STALE_MS,
    gcTime: 2 * 60_000,
    retry: (failureCount, error) => {
      if (!isRetryable(error)) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 5000),
  });

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

  useEffect(() => {
    const lastPage = query.data?.pages.at(-1);
    if (!lastPage) return;
    prefetchImages(lastPage.products.map((p) => p.imageUrl ?? null));
  }, [query.data]);

  return {
    products,
    totalCount: query.data?.pages[0]?.totalCount ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefreshing: query.isFetching && !query.isFetchingNextPage && !query.isLoading,
    isError: query.isError,
    hasNextPage: Boolean(query.hasNextPage),
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    refetch: () => {
      void query.refetch();
    },
    raw: query,
  };
}
