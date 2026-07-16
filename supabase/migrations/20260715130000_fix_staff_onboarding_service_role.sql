-- Allow trusted service-role onboarding to set staff role/status while keeping
-- browser users unable to escalate their own profile.

CREATE OR REPLACE FUNCTION public.profiles_guard_role_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- service_role is a signed JWT claim available only to trusted server-side
  -- clients. Admin/manager browser calls remain authorized through is_manager.
  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
     OR public.is_manager() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'customer';
    NEW.status := 'Active';
    RETURN NEW;
  END IF;

  NEW.role := OLD.role;
  NEW.status := OLD.status;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.profiles_guard_role_status() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.profiles_guard_role_status() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
