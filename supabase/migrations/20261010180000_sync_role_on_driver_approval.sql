-- Closes the reverse gap left open by 20260902150000_ensure_driver_profile_on_role_change.sql.
-- That migration guarantees "role = 'driver' implies a DriverProfile row
-- exists" but never the reverse. Confirmed live: 2 of 5 accounts with
-- DriverProfile.status = 'APPROVED' still have profiles.role = 'customer'
-- (yossra900@gmail.com, mazenshazly011@gmail.com) -- these are real driver
-- accounts that sign into the app and land in the customer interface,
-- because every role-gated screen/navigator reads profiles.role, not
-- DriverProfile.status.
--
-- apps/api's approveDriver()/createDriver() (admin-operations.service.ts)
-- already write both fields together in one transaction when used -- but
-- driver rows have also been created via direct hand-written SQL (see
-- commit 69488523's own message: "driver accounts were only ever made by
-- hand"), bypassing that transactional path entirely, and nothing ever
-- backfilled profiles.role for rows approved before commit 5cd02854
-- (2026-08-24) added the role write to the forward path.
--
-- Fixed the same way as the other direction: a trigger on the table that
-- actually changes, so it holds regardless of whether a DriverProfile row
-- is approved via the API, the admin panel, or by hand.

CREATE OR REPLACE FUNCTION public.sync_role_on_driver_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APPROVED') THEN
    UPDATE public.profiles
    SET role = 'driver'::public.app_role, updated_at = now()
    WHERE id = NEW."userId"
      AND role IS DISTINCT FROM 'driver'::public.app_role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_profile_sync_role_trg ON public."DriverProfile";
CREATE TRIGGER driver_profile_sync_role_trg
  AFTER INSERT OR UPDATE OF status ON public."DriverProfile"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_on_driver_approval();

-- One-time backfill for rows already approved before this trigger existed.
UPDATE public.profiles p
SET role = 'driver'::public.app_role, updated_at = now()
FROM public."DriverProfile" dp
WHERE dp."userId" = p.id
  AND dp.status = 'APPROVED'
  AND p.role IS DISTINCT FROM 'driver'::public.app_role;
