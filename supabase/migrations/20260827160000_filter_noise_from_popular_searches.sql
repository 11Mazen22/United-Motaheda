-- get_popular_searches() surfaced garbage like random 6-char strings
-- ("tpkmbw", "ddwztc") as "trending" because a single logged occurrence
-- was enough to qualify. Those are one-off bot/test noise in search_events,
-- not something multiple real users actually searched for. Require at
-- least 2 distinct sessions (distinct user_id, or distinct anon rows) to
-- have searched a term before it counts as trending.

CREATE OR REPLACE FUNCTION public.get_popular_searches(
  p_limit  integer DEFAULT 10,
  p_days   integer DEFAULT 7
)
RETURNS TABLE (
  query        text,
  search_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    se.query,
    COUNT(*) AS search_count
  FROM public.search_events se
  WHERE
    se.created_at >= now() - (p_days || ' days')::interval
    AND char_length(se.query) >= 2
    -- Exclude pure-numeric queries (barcode scans, not useful for trending)
    AND se.query ~ '[^0-9]'
  GROUP BY se.query
  -- A term searched only once (one bot/test hit) isn't "trending" — real
  -- popularity means multiple distinct searchers, or the same signed-in
  -- user searching it repeatedly across sessions.
  HAVING COUNT(*) >= 2 AND COUNT(DISTINCT COALESCE(se.user_id::text, se.id::text)) >= 2
  ORDER BY search_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_searches(integer, integer)
  TO anon, authenticated;

-- One-time cleanup: purge the specific garbage rows already logged so they
-- can't resurface even if this filter is ever loosened later. Matches
-- random-looking short alphanumeric strings with no vowel-consonant
-- structure typical of a real search term (heuristic, not exhaustive —
-- the HAVING clause above is the actual, durable fix).
DELETE FROM public.search_events
WHERE char_length(query) <= 8
  AND query ~ '^[a-z]+$'
  AND query !~ '[aeiou]'
  AND (SELECT COUNT(*) FROM public.search_events se2 WHERE se2.query = search_events.query) < 2;
