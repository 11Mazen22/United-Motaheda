-- =============================================================================
-- Driver reconstruction, backend fix 3 of 4: the driver online/offline
-- toggle the reconstruction directive asks for ("Am I online or offline? Am
-- I available for deliveries?") has real backing columns already —
-- DriverProfile.isOnline/currentLat/currentLng/lastLocationAt
-- (apps/api/prisma/schema.prisma) — but shopper-native never reads or
-- writes any of them, and DriverProfile's only RLS policies are
-- self-SELECT/self-INSERT (see 20260824105530_driver_profile_self_access_rls
-- — deliberately no UPDATE policy at all, since vehicle/document fields
-- must not be self-editable after submission).
--
-- A blanket UPDATE policy would also let a driver rewrite status/vehicle
-- fields, which is exactly what that migration was written to prevent.
-- Instead: a narrow SECURITY DEFINER RPC that can only ever touch the
-- specific availability/location columns, nothing else, for the caller's
-- own row.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_driver_availability(
  p_is_online boolean,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  "isOnline"       boolean,
  "currentLat"     double precision,
  "currentLng"     double precision,
  "lastLocationAt" timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public."DriverProfile"
  SET "isOnline" = p_is_online,
      "currentLat" = COALESCE(p_lat, "DriverProfile"."currentLat"),
      "currentLng" = COALESCE(p_lng, "DriverProfile"."currentLng"),
      "lastLocationAt" = CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN now() ELSE "DriverProfile"."lastLocationAt" END,
      "updatedAt" = now()
  WHERE "userId" = auth.uid()
  RETURNING "DriverProfile"."isOnline", "DriverProfile"."currentLat", "DriverProfile"."currentLng", "DriverProfile"."lastLocationAt";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'driver_profile_not_found' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_driver_availability(boolean, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_driver_availability(boolean, double precision, double precision) TO authenticated;

COMMENT ON FUNCTION public.set_driver_availability IS
  'Column-safe toggle for DriverProfile.isOnline (+ optional last-known position) for the caller''s own row only — DriverProfile intentionally has no general UPDATE policy so status/vehicle/document fields stay non-self-editable; this RPC is the one narrow, safe exception.';
