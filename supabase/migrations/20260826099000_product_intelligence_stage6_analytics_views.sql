-- =============================================================================
-- Product Intelligence — Stage 6: Analytics aggregate views
-- Date: 2026-08-26
--
-- Builds on public.search_events, which already exists and is now actually
-- being written to (search.tsx calls log_search_event as of the Stage 1/2
-- client wiring). These are read-only views for an admin dashboard to query
-- directly — no new table, no new write path.
-- =============================================================================

CREATE OR REPLACE VIEW public.search_analytics_top_queries
WITH (security_invoker = true) AS
SELECT
  query,
  count(*) AS search_count,
  avg(result_count)::numeric(10,1) AS avg_result_count,
  max(created_at) AS last_searched_at
FROM public.search_events
WHERE created_at >= now() - interval '30 days'
GROUP BY query
ORDER BY search_count DESC;

CREATE OR REPLACE VIEW public.search_analytics_zero_result_queries
WITH (security_invoker = true) AS
SELECT
  query,
  count(*) AS search_count,
  max(created_at) AS last_searched_at
FROM public.search_events
WHERE result_count = 0
  AND created_at >= now() - interval '30 days'
GROUP BY query
ORDER BY search_count DESC;

CREATE OR REPLACE VIEW public.search_analytics_daily_summary
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', created_at) AS day,
  count(*) AS total_searches,
  count(*) FILTER (WHERE result_count = 0) AS zero_result_searches,
  round(
    100.0 * count(*) FILTER (WHERE result_count = 0) / NULLIF(count(*), 0),
    1
  ) AS zero_result_rate_pct,
  count(DISTINCT user_id) AS unique_signed_in_searchers
FROM public.search_events
GROUP BY date_trunc('day', created_at)
ORDER BY day DESC;

-- These views inherit search_events' own RLS (security_invoker = true means
-- the view runs with the QUERYING user's permissions, not the view owner's)
-- — so the existing search_events_admin policy already restricts these to
-- admin/manager roles. No separate grant needed beyond what search_events
-- already has, but PostgREST needs the views themselves exposed:
GRANT SELECT ON public.search_analytics_top_queries TO authenticated;
GRANT SELECT ON public.search_analytics_zero_result_queries TO authenticated;
GRANT SELECT ON public.search_analytics_daily_summary TO authenticated;

COMMENT ON VIEW public.search_analytics_top_queries IS
  'Admin dashboard: most-searched terms in the last 30 days, with average result count. RLS-inherited from search_events — only admin/manager roles see rows.';
COMMENT ON VIEW public.search_analytics_zero_result_queries IS
  'Admin dashboard: searches that returned nothing, most frequent first — the actionable "add a synonym / fix a typo mapping" worklist.';
COMMENT ON VIEW public.search_analytics_daily_summary IS
  'Admin dashboard: daily search volume and zero-result rate trend.';
