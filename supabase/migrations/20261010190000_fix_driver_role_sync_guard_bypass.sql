-- Corrects 20261010180000_sync_role_on_driver_approval.sql, whose trigger and
-- backfill both silently had zero effect on profiles.role -- confirmed live:
-- after that migration ran, the same 2 accounts still showed role='customer'.
--
-- Root cause, traced (not guessed): public.profiles_guard_role_status_trg
-- (20260715130000_fix_staff_onboarding_service_role.sql), a BEFORE trigger,
-- reverts any UPDATE to profiles.role/status back to OLD.role/OLD.status
-- unless auth.jwt()->>'role' = 'service_role' (set only by PostgREST when a
-- request is authenticated with the Supabase service-role key) or
-- is_manager() is true (requires auth.uid() to resolve, which also needs a
-- PostgREST-set JWT context). auth.jwt() reads current_setting('request.jwt.claims'),
-- a GUC that is never set on a raw Postgres connection.
--
-- This means EVERY direct-Postgres-connection write to profiles.role has been
-- silently reverted since 2026-07-15 -- including this migration's own
-- backfill (run via `supabase db push`, a raw connection) AND, more
-- significantly, apps/api's approveDriver()/createDriver() (Prisma, also a
-- raw Postgres connection) since commit 5cd02854 added that write on
-- 2026-08-24. That "fix" has very likely never actually taken effect in
-- production for a single approval -- explaining why brand-new driver
-- approvals can still end up with role='customer' even after that commit.
--
-- Fixed by having the trigger function set the request.jwt.claims GUC
-- locally (transaction-scoped via set_config(..., true), reverts
-- automatically at commit/rollback) before writing, so its own UPDATE is
-- correctly recognized as a trusted, system-level write by the guard --
-- without weakening the guard itself for any other caller. This makes the
-- DriverProfile-status trigger the sole authoritative writer of
-- profiles.role for this invariant, so it is now correct regardless of
-- whether DriverProfile.status was approved via apps/api, the admin panel,
-- or hand-written SQL -- matching the same "fix belongs on the table, not
-- every call site" reasoning as the trigger it mirrors.

CREATE OR REPLACE FUNCTION public.sync_role_on_driver_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APPROVED') THEN
    PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

    UPDATE public.profiles
    SET role = 'driver'::public.app_role, updated_at = now()
    WHERE id = NEW."userId"
      AND role IS DISTINCT FROM 'driver'::public.app_role;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-run the backfill with the same bypass -- the first attempt silently
-- affected zero rows for the same reason.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE public.profiles p
  SET role = 'driver'::public.app_role, updated_at = now()
  FROM public."DriverProfile" dp
  WHERE dp."userId" = p.id
    AND dp.status = 'APPROVED'
    AND p.role IS DISTINCT FROM 'driver'::public.app_role;
END;
$$;
