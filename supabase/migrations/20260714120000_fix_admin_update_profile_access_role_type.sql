-- Fix admin role updates to use a single RPC signature and avoid PostgREST
-- overload ambiguity while still casting to the app_role enum safely.

DROP FUNCTION IF EXISTS public.admin_update_profile_access(uuid, public.app_role, text);

CREATE OR REPLACE FUNCTION public.admin_update_profile_access(
  p_target_user_id uuid,
  p_next_role text DEFAULT NULL,
  p_next_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_target_status text;
  v_updated_role text;
  v_updated_status text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;

  SELECT role::text INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id;

  IF v_actor_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = v_actor_id THEN
    RAISE EXCEPTION 'self_access_change_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_next_role IS NULL AND p_next_status IS NULL THEN
    RAISE EXCEPTION 'no_access_change_requested' USING ERRCODE = '22023';
  END IF;

  IF p_next_role IS NOT NULL AND p_next_role NOT IN ('admin', 'manager', 'pharmacist', 'driver', 'customer') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  IF p_next_status IS NOT NULL AND p_next_status NOT IN ('Active', 'Inactive', 'Suspended') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT role::text, status INTO v_target_role, v_target_status
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role = 'manager' AND (v_target_role = 'admin' OR p_next_role = 'admin') THEN
    RAISE EXCEPTION 'administrator_access_requires_admin' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    role = CASE WHEN p_next_role IS NULL THEN role ELSE p_next_role::public.app_role END,
    status = COALESCE(p_next_status, status),
    is_active = CASE
      WHEN p_next_status IS NULL THEN is_active
      WHEN p_next_status = 'Active' THEN true
      ELSE false
    END
  WHERE id = p_target_user_id
  RETURNING role::text, status INTO v_updated_role, v_updated_status;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (
    v_actor_id,
    CASE
      WHEN p_next_role IS NOT NULL AND p_next_status IS NOT NULL THEN 'change_role_and_status'
      WHEN p_next_role IS NOT NULL THEN 'change_role'
      ELSE 'change_status'
    END,
    p_target_user_id,
    jsonb_strip_nulls(jsonb_build_object(
      'fromRole', v_target_role,
      'toRole', p_next_role,
      'fromStatus', v_target_status,
      'toStatus', p_next_status
    ))
  );

  RETURN jsonb_build_object(
    'id', p_target_user_id,
    'role', v_updated_role,
    'status', v_updated_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_profile_access(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_access(uuid, text, text) TO authenticated;
