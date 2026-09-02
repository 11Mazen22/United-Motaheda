-- Closes a real, confirmed gap found while auditing staff-creation paths:
-- setting profiles.role = 'driver' has NEVER also created the linked
-- DriverProfile row a driver actually needs (vehicleType is the one NOT
-- NULL column DriverProfile has) -- confirmed in BOTH of the two places
-- that set this role today:
--   - admin-privileged-actions Edge Function's create_staff action
--     (apps/shopper-web's already-deployed StaffManager "Add employee"
--     flow) upserts profiles with role='driver' and never touches
--     DriverProfile at all.
--   - admin_update_profile_access() RPC (apps/shopper-web's "Set as
--     Driver" role-change menu) only ever updates profiles.
-- Without DriverProfile, the driver app doesn't recognize the account as
-- an approved driver (client apps gate actual driver-screen access on
-- DriverProfile.status, not on role alone -- see driver/api.ts's own
-- comments). This is almost certainly the exact experience behind "I
-- couldn't create a driver except by some commands" -- role flipped,
-- driver app still didn't work, so the only path left was hand-writing
-- both rows directly.
--
-- Fixed at the database layer with a trigger rather than patching both
-- call sites (and any future one) individually: the real invariant is
-- "role = 'driver' implies a DriverProfile row exists", so it belongs on
-- the table, not duplicated into every piece of code that can set a role.
-- This also means a role flipped by hand via direct SQL -- exactly how
-- driver accounts have been created so far -- now gets the same
-- guarantee for free.

-- Prerequisite: the trigger's ON CONFLICT needs a real unique constraint,
-- and the app already assumes one-DriverProfile-per-user everywhere
-- (every query is userId = X .maybeSingle()) without it ever being
-- enforced. Confirmed live: zero existing duplicate userIds.
ALTER TABLE public."DriverProfile"
  ADD CONSTRAINT "DriverProfile_userId_key" UNIQUE ("userId");

CREATE OR REPLACE FUNCTION public.ensure_driver_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'driver' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'driver') THEN
    INSERT INTO public."DriverProfile" (id, "userId", "vehicleType", status, "approvedAt", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), NEW.id, 'motorcycle', 'APPROVED', now(), now(), now())
    ON CONFLICT ("userId") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_driver_profile_trg ON public.profiles;
CREATE TRIGGER profiles_ensure_driver_profile_trg
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_driver_profile();
