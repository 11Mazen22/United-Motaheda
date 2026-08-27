-- =============================================================================
-- Fix: resolve_delivery_zone failed on every real call
-- Date: 2026-08-26
--
-- Bug found by directly testing the RPC against real branch coordinates
-- (all 6 live branches) right after deploying it: every single call failed
-- with "structure of query does not match function result type" /
-- "Returned type integer does not match expected type numeric in column 6."
--
-- Root cause: DeliveryZone."baseFee" and "freeAboveSubtotal" are Prisma Int
-- columns (Postgres `integer`), but the function's RETURNS TABLE declares
-- base_fee/free_above_subtotal as `numeric`. Assigning them to the
-- v_fee plpgsql variable (declared numeric) implicitly cast fine, but
-- selecting the raw column values directly into the RETURN QUERY output list
-- does not get the same implicit widening — RETURN QUERY requires an exact
-- (or explicitly cast) type match per output column.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_delivery_zone(
  p_lat      double precision,
  p_lng      double precision,
  p_subtotal numeric DEFAULT 0
)
RETURNS TABLE (
  branch_id         text,
  branch_name_ar    text,
  branch_name_en    text,
  zone_id           text,
  zone_name         text,
  base_fee          numeric,
  effective_fee     numeric,
  surge_applied     boolean,
  free_above_subtotal numeric,
  distance_km       double precision
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_branch  record;
  v_zone    record;
  v_hour    integer := extract(hour FROM now())::integer;
  v_surge   boolean;
  v_fee     numeric;
BEGIN
  FOR v_branch IN
    SELECT b.id, b."nameAr", b."nameEn", b.lat, b.lng,
           public.haversine_km(p_lat, p_lng, b.lat, b.lng) AS dist
    FROM public."Branch" b
    WHERE b."isActive" = true
    ORDER BY dist ASC
  LOOP
    FOR v_zone IN
      SELECT z.id, z.name, z."baseFee", z."freeAboveSubtotal",
             z."surgeStartHour", z."surgeEndHour", z."surgeMultiplier", z.polygon
      FROM public."DeliveryZone" z
      WHERE z."branchId" = v_branch.id
      ORDER BY z."baseFee" ASC
    LOOP
      IF public.point_in_polygon(p_lat, p_lng, v_zone.polygon) THEN
        v_surge := v_zone."surgeStartHour" IS NOT NULL AND v_zone."surgeEndHour" IS NOT NULL AND (
          CASE WHEN v_zone."surgeStartHour" <= v_zone."surgeEndHour"
            THEN v_hour >= v_zone."surgeStartHour" AND v_hour < v_zone."surgeEndHour"
            ELSE v_hour >= v_zone."surgeStartHour" OR  v_hour < v_zone."surgeEndHour"
          END
        );

        v_fee := v_zone."baseFee"::numeric;
        IF v_surge THEN
          v_fee := round(v_fee * COALESCE(v_zone."surgeMultiplier", 1), 2);
        END IF;
        IF v_zone."freeAboveSubtotal" IS NOT NULL AND p_subtotal >= v_zone."freeAboveSubtotal" THEN
          v_fee := 0;
        END IF;

        RETURN QUERY SELECT
          v_branch.id, v_branch."nameAr", v_branch."nameEn",
          v_zone.id, v_zone.name,
          v_zone."baseFee"::numeric, v_fee, v_surge, v_zone."freeAboveSubtotal"::numeric,
          v_branch.dist;
        RETURN;
      END IF;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_delivery_zone(double precision, double precision, numeric) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
