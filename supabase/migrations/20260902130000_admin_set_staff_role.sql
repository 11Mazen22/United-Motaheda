-- Lets an admin/manager directly promote an existing signed-up profile to
-- pharmacist (with a branch) or demote a driver/pharmacist back to
-- customer, in one call. Closes a real gap: before this, there was no path
-- anywhere in the product to create a pharmacist account -- the only
-- pharmacist RPC (set_pharmacist_branch) requires the target to already
-- have the pharmacist role, so it could reassign a branch but never
-- promote anyone in the first place.
--
-- Deliberately excludes 'admin'/'manager' from the allowed p_role values --
-- granting platform-admin privilege is a much more sensitive action than
-- staff-role assignment and should stay a manual operation, not a button.
--
-- Driver creation is intentionally NOT handled here -- DriverProfile is a
-- second, Prisma-managed table with its own required column (vehicleType),
-- so an admin-created driver goes through apps/api's POST /admin/drivers
-- instead (admin-operations.service.ts createDriver), which does both
-- writes in one Prisma transaction.
--
-- Safe to call for role/status changes despite profiles_guard_role_status_trg
-- silently reverting role/status writes from non-privileged callers:
-- confirmed live (read the actual trigger + is_manager() function bodies,
-- not assumed) that the trigger's exemption is is_manager(), which
-- resolves against auth.uid() -- the CALLER, i.e. this function's invoker.
-- Since this function already requires the caller to be admin/manager
-- before doing anything, the trigger's exemption is already satisfied by
-- the time the UPDATE below runs, so the write goes through as intended.

CREATE OR REPLACE FUNCTION public.admin_set_staff_role(
  p_user_id uuid,
  p_role text,
  p_branch_id text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('pharmacist', 'customer') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  IF p_role = 'pharmacist' AND (p_branch_id IS NULL OR btrim(p_branch_id) = '') THEN
    RAISE EXCEPTION 'branch_required_for_pharmacist' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET role       = p_role::public.app_role,
      branch_id  = CASE WHEN p_role = 'pharmacist' THEN p_branch_id ELSE NULL END,
      status     = 'Active',
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_staff_role(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_role(uuid, text, text) TO authenticated;
