-- Defense-in-depth: admin_* RPCs are SECURITY DEFINER and already enforce
-- is_admin()/is_manager()/role checks internally (verified by reading every
-- definition), so this was not an exploitable privilege-escalation bug.
-- But Postgres grants EXECUTE to PUBLIC on new functions by default, which
-- left these admin-only RPCs directly callable by the fully unauthenticated
-- `anon` Postgres role via PostgREST. No legitimate anon (unauthenticated)
-- caller should ever invoke an admin_* RPC, so this closes that surface
-- without changing behavior for any real admin/manager caller (they hit
-- PostgREST as `authenticated`, which keeps EXECUTE).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'admin\_%' ESCAPE '\'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', 'public', r.proname, pg_get_function_identity_arguments(r.oid));
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', 'public', r.proname, pg_get_function_identity_arguments(r.oid));
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', 'public', r.proname, pg_get_function_identity_arguments(r.oid));
  END LOOP;
END;
$$;
