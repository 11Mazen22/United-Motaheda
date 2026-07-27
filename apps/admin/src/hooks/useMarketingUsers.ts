/**
 * useMarketingUsers — TanStack Query hook for the marketing targets table.
 *
 * Wraps marketingApi.getTargets() with pagination, search, sort, and
 * consent-filter state. Returns everything the MarketingPage table needs.
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState, useCallback, useTransition } from 'react';
import { marketingApi, type MarketingUser, type MarketingSortKey } from '@/lib/api';

export const MARKETING_PAGE_SIZES = [50, 100, 200] as const;
export type  MarketingPageSize = typeof MARKETING_PAGE_SIZES[number];

interface UseMarketingUsersOptions {
  pageSize?: MarketingPageSize;
}

export function useMarketingUsers(opts?: UseMarketingUsersOptions) {
  const defaultPageSize: MarketingPageSize = opts?.pageSize ?? 50;

  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState<MarketingPageSize>(defaultPageSize);
  const [search,       setSearchRaw]    = useState('');
  const [sort,         setSort]         = useState<MarketingSortKey>('registered_desc');
  const [consentOnly,  setConsentOnly]  = useState(false);
  const [, startTransition]             = useTransition();

  const setSearch = useCallback((v: string) => {
    startTransition(() => {
      setSearchRaw(v);
      setPage(1);
    });
  }, []);

  const query = useQuery({
    queryKey: ['marketing', 'targets', { page, pageSize, search, sort, consentOnly }],
    queryFn:  () => marketingApi.getTargets({ page, pageSize, search, sort, consentOnly }),
    placeholderData: keepPreviousData,
    staleTime:  30_000,
    gcTime:     5 * 60_000,
    retry:      2,
  });

  const totalCount = query.data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    // Data
    users:       (query.data?.users ?? []) as MarketingUser[],
    totalCount,
    totalPages,
    // Pagination
    page,
    pageSize,
    setPage,
    setPageSize: (s: MarketingPageSize) => { setPageSize(s); setPage(1); },
    // Filters
    search,
    setSearch,
    sort,
    setSort:     (s: MarketingSortKey) => { setSort(s); setPage(1); },
    consentOnly,
    setConsentOnly: (v: boolean) => { setConsentOnly(v); setPage(1); },
    // Query state
    isLoading:   query.isLoading,
    isFetching:  query.isFetching,
    isError:     query.isError,
    refetch:     query.refetch,
  };
}
