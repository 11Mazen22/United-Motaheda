/**
 * MMKV-backed React Query persister.
 *
 * Persists the query cache across cold starts so the next boot paints from
 * disk while the network refreshes. Mutations and queries tagged "sensitive"
 * are excluded — auth tokens, PII, and anything user-specific stays in
 * Supabase's own AsyncStorage session, not in the rehydratable cache.
 *
 * Cache schema is versioned via QUERY_CACHE_BUSTER. Bump it whenever query
 * keys or response DTOs change shape in a backwards-incompatible way.
 */

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { queryCacheStorage } from "./mmkv";
import { QUERY_CACHE_BUSTER } from "./queryClient";

/** Query key prefixes that should NEVER be persisted. */
const SENSITIVE_PREFIXES = new Set([
  "auth",
  "profile",
  "loyalty",
  "orders",
  "cart",
  "payment-methods",
  "addresses",
  "notifications",
  "prescriptions",
  "health-profile",
]);

function isSensitive(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  return typeof head === "string" && SENSITIVE_PREFIXES.has(head);
}

/** Maximum serialised size we'll write to MMKV (bytes).
 *  Parsing a huge JSON blob blocks the JS thread on cold start. */
const MAX_CACHE_BYTES = 2 * 1024 * 1024; // 2 MB

export const queryPersister = createSyncStoragePersister({
  storage: queryCacheStorage,
  key:     "rq-cache",
  throttleTime: 1000,
  serialize(client) {
    try {
      const filtered: PersistedClient = {
        ...client,
        clientState: {
          ...client.clientState,
          queries: client.clientState.queries.filter(
            (q) => !isSensitive(q.queryKey) && q.state.status === "success",
          ),
          mutations: [],
        },
      };
      const json = JSON.stringify(filtered);
      // Drop the cache entirely if it's too large — better than blocking the
      // JS thread or writing a payload that crashes the next cold-start parse.
      if (json.length > MAX_CACHE_BYTES) {
        if (__DEV__) console.warn("[queryPersister] cache too large, skipping persist:", json.length);
        return JSON.stringify({ ...filtered, clientState: { queries: [], mutations: [] } });
      }
      return json;
    } catch (e) {
      if (__DEV__) console.warn("[queryPersister] serialize failed:", e);
      return "{}";
    }
  },
  deserialize(raw) {
    try {
      return JSON.parse(raw) as PersistedClient;
    } catch (e) {
      // Corrupted or incompatible cache (e.g. after an OTA update that changed
      // the data shape). Wipe it and return an empty-but-valid PersistedClient
      // so PersistQueryClientProvider boots with a clean slate instead of
      // propagating the exception. Re-throwing here was previously masking the
      // real error and causing the root ErrorBoundary to fire in some edge cases.
      if (__DEV__) console.warn("[queryPersister] deserialize failed, clearing cache:", e);
      try { queryCacheStorage.removeItem("rq-cache"); } catch { /* ignore */ }
      return {
        buster:      "",
        timestamp:   0,
        clientState: { queries: [], mutations: [] },
      } as unknown as PersistedClient;
    }
  },
});

export const persistOptions = {
  persister: queryPersister,
  /** Max age before cache is considered too stale to rehydrate at all. */
  maxAge: 24 * 60 * 60 * 1000,
  buster: QUERY_CACHE_BUSTER,
} as const;
