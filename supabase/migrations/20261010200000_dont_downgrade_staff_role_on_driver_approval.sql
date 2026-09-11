-- 20261010190000 correctly synced role='driver' for approved DriverProfile
-- rows, but did so unconditionally -- which silently downgraded two
-- accounts that had role='admin' (abdelbakey.ibrahem15@gmail.com,
-- youssefengineer1300@gmail.com) to role='driver', since this schema holds
-- exactly one role per account. Confirmed with the user: restore their
-- admin access, and going forward this trigger should only ever *promote*
-- an account into the driver role, never silently demote an existing
-- higher-privilege staff role -- the same precedence
-- admin_update_profile_access() already enforces for manager-vs-admin.

UPDATE public.profiles
SET role = 'admin'::public.app_role, updated_at = now()
WHERE id IN (
  'c9ca0ba9-f4c8-41a4-98ce-64b0394ccac2',
  'df4c117e-38af-44a3-a227-77c883b74c10'
);

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
      AND role NOT IN ('driver'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role);
  END IF;
  RETURN NEW;
END;
$$;
