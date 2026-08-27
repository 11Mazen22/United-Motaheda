/**
 * Search analytics — wraps the already-deployed log_search_event() and
 * get_popular_searches() RPCs (database/20260601_search_analytics.sql).
 * These existed and worked before this file did; nothing in the app called
 * them, so search submissions went unlogged and "trending searches" was a
 * static translated list instead of real query data.
 */
import { supabase } from "@/lib/supabase";

/** Fire-and-forget: logs a search submission. Never throws — a failed log
 *  must never block or error out the search the user is actually trying to do. */
export function logSearchEvent(query: string, resultCount: number): void {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  void supabase
    .rpc("log_search_event", { p_query: trimmed, p_result_count: resultCount, p_source: "native" })
    .then(({ error }) => {
      if (error && __DEV__) console.warn("[search] log_search_event failed:", error.message);
    });
}

export interface PopularSearch {
  query: string;
  searchCount: number;
}

export async function fetchPopularSearches(limit = 6): Promise<PopularSearch[]> {
  const { data, error } = await supabase.rpc("get_popular_searches", { p_limit: limit, p_days: 7 });
  if (error || !Array.isArray(data)) return [];
  return data.map((row: { query: string; search_count: number }) => ({
    query: row.query,
    searchCount: row.search_count,
  }));
}
