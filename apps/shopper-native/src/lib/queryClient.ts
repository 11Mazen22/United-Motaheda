/**
 * Single QueryClient for the app, with retry/timeout policy tuned for mobile.
 *
 *  - staleTime 5 min : most reads (categories, product detail) can be stale that long.
 *  - gcTime  24 h    : cache survives backgrounding + persists to MMKV.
 *  - retry policy    : exponential backoff, but only for transient errors. 4xx
 *                      from PostgREST is treated as terminal — retrying a
 *                      schema/permission error is wasted bandwidth.
 *  - networkMode     : "online" — queries pause when offline rather than
 *                      hammering retries on a dead connection. Mutations are
 *                      "offlineFirst" so optimistic flows still queue.
 */

import { QueryClient, type DefaultOptions } from "@tanstack/react-query";
import { classifyError, isRetryable } from "@/lib/supabaseRequest";

/** Errors a PostgREST 4xx response throws — terminal, don't retry. */
function isTerminalError(error: unknown): boolean {
  const kind = classifyError(error);
  if (kind === "terminal" || kind === "aborted") return true;
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: string };
  if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
    return true;
  }
  // PostgREST sometimes returns a code without an http status when called via
  // the JS client. PGRST116 (no rows) and 23505 (unique violation) are terminal.
  if (e.code === "PGRST116" || e.code === "23505") return true;
  return false;
}

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime:            5 * 60 * 1000,
    gcTime:              24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount:       false,
    refetchOnReconnect:   true,
    networkMode:          "online",
    retry: (failureCount, error) => {
      if (isTerminalError(error)) return false;
      if (!isRetryable(error)) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  },
  mutations: {
    networkMode: "offlineFirst",
    retry: (failureCount, error) => {
      if (isTerminalError(error)) return false;
      if (!isRetryable(error)) return false;
      return failureCount < 1;
    },
  },
};

export const queryClient = new QueryClient({ defaultOptions });

/** Bump when query key shape or persisted DTOs change — wipes stale cache.
 *  v2: wiped after ProductCard TDZ crash-fix + i18n addressForm refactor.
 *  v3: wiped after the get_effective_product RPC outage (Supabase
 *      self-host cutover) — every product detail query hit during the
 *      outage persisted a `null` result via queryPersister's MMKV storage,
 *      and with refetchOnMount:false + 24h gcTime that null never
 *      revalidated on its own even after the RPC was restored. */
export const QUERY_CACHE_BUSTER = "v3";
