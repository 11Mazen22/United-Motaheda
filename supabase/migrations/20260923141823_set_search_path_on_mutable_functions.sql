-- Defense-in-depth: 35 application-owned plpgsql/sql functions had no
-- explicit search_path, so Postgres resolves unqualified identifiers
-- inside them against whatever search_path the calling session has set
-- (mutable). Pinning search_path closes the classic search_path-hijack
-- vector (a caller creating a same-named object earlier in their search
-- path to shadow a table/function the trigger or RPC expects) without
-- changing any function's behavior for a normal caller. Scoped to
-- application functions only -- excludes pg_trgm/pgvector/unaccent
-- extension-owned C functions, which are a different, already-safe
-- category the advisor doesn't actually flag.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND l.lanname IN ('plpgsql','sql')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp', 'public', r.proname, pg_get_function_identity_arguments(r.oid));
  END LOOP;
END;
$$;
