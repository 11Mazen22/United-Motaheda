-- =============================================================================
-- Product Intelligence — Stage 5: Search session / follow-up context
-- Date: 2026-08-26
--
-- Genuinely new — no session/context table exists anywhere in this project's
-- migration history (confirmed during the Stage 1/4 audit).
--
-- Scope, deliberately: this stores the last few queries per device/user so a
-- follow-up like "للأطفال" can be recognized as modifying "فيتامين د" rather
-- than searched on its own — NOT a chat transcript, NOT a place for storing
-- AI conversation turns. The actual "does this look like a follow-up"
-- judgment is cheap enough (single-word / no-noun-phrase heuristic, or the
-- AI layer when configured) that it lives in search-intelligence, not here;
-- this table is just where the short rolling window persists between calls.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.search_sessions (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Anonymous callers are tracked by a client-generated UUID (stored in
  -- MMKV/AsyncStorage, not a cookie) instead of user_id — same session-scoping
  -- need, no auth requirement, matching how the rest of guest mode works here.
  device_key   text,
  queries      text[]      NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_sessions_owner_chk CHECK (user_id IS NOT NULL OR device_key IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_search_sessions_user ON public.search_sessions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_sessions_device ON public.search_sessions (device_key) WHERE device_key IS NOT NULL;

-- Sessions older than a day are noise, not history — a cheap partial index
-- keeps the "find my active session" lookup fast without a cron job.
CREATE INDEX IF NOT EXISTS idx_search_sessions_recent ON public.search_sessions (updated_at DESC);

ALTER TABLE public.search_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_sessions_owner ON public.search_sessions;
CREATE POLICY search_sessions_owner
  ON public.search_sessions FOR ALL
  USING (user_id = auth.uid() OR (user_id IS NULL AND device_key IS NOT NULL))
  WITH CHECK (user_id = auth.uid() OR (user_id IS NULL AND device_key IS NOT NULL));
-- Note: this intentionally lets any anon caller read/write any device_key
-- row (there's no way to prove device ownership at the RLS layer for
-- unauthenticated clients). The data here is non-sensitive (recent search
-- terms only) and self-correcting (rows roll off after MAX_QUERIES), so this
-- is an acceptable tradeoff — do not store anything sensitive in `queries`.

-- ─── One active row per identity ─────────────────────────────────────────────
-- Must exist BEFORE the upsert function below — its ON CONFLICT DO NOTHING
-- needs a real unique constraint/index to target at execution time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_search_sessions_user
  ON public.search_sessions (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_search_sessions_device
  ON public.search_sessions (device_key) WHERE user_id IS NULL AND device_key IS NOT NULL;

-- ─── Upsert + trim to a short rolling window ────────────────────────────────
-- Appends p_query to the session's array (keyed by user_id when
-- authenticated, else device_key), keeping only the last 3 — enough for
-- "does this look like a follow-up to the previous one" without this ever
-- becoming a search-history feature (recentSearchesStore already owns that,
-- client-side, deliberately separate concern).

CREATE OR REPLACE FUNCTION public.append_search_session_query(
  p_user_id uuid,
  p_device_key text,
  p_query text
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queries text[];
BEGIN
  IF p_user_id IS NULL AND p_device_key IS NULL THEN
    RAISE EXCEPTION 'append_search_session_query requires user_id or device_key';
  END IF;

  INSERT INTO public.search_sessions (user_id, device_key, queries, updated_at)
  VALUES (p_user_id, p_device_key, ARRAY[p_query], now())
  ON CONFLICT DO NOTHING;

  UPDATE public.search_sessions
  SET queries = (
        -- Keep at most the last 3 entries, most recent last.
        SELECT array_agg(q ORDER BY ord)
        FROM (
          SELECT q, ord FROM unnest(queries || ARRAY[p_query]) WITH ORDINALITY AS t(q, ord)
          ORDER BY ord DESC LIMIT 3
        ) recent
      ),
      updated_at = now()
  WHERE (p_user_id IS NOT NULL AND user_id = p_user_id)
     OR (p_user_id IS NULL AND device_key = p_device_key)
  RETURNING queries INTO v_queries;

  RETURN v_queries;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_search_session_query(uuid, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
