-- =============================================================================
-- Reconstruction Stage 2: Supabase-native delivery zone resolution
-- Date: 2026-08-26
--
-- Ports the real branch/zone matching logic (previously only implemented in
-- apps/api's NestJS DeliveryService, on a separate Railway-hosted backend
-- the shopper-native checkout flow doesn't call) into a Postgres RPC in the
-- same database the Branch/DeliveryZone tables already live in — so
-- checkout, driver, and pharmacist can all resolve the exact same zone
-- decision from one place, with zero network hop to a separate service.
--
-- Algorithm matches the NestJS version (delivery.service.ts): among active
-- branches ordered by distance (nearest first), for each branch check its
-- zones ordered by baseFee ascending, return the first zone whose polygon
-- contains the point. This means "cheapest deliverable zone at the nearest
-- branch that can actually reach this point" — not just literally-nearest.
--
-- No PostGIS dependency — polygons are stored as plain
-- {"points": [{"lat":.., "lng":..}, ...]} jsonb (see DeliveryZone.polygon,
-- confirmed live), so point-in-polygon is a self-contained ray-casting
-- implementation rather than requiring the postgis extension.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.point_in_polygon(
  p_lat double precision,
  p_lng double precision,
  p_polygon jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  pts   jsonb;
  n     integer;
  i     integer;
  j     integer;
  xi    double precision;
  yi    double precision;
  xj    double precision;
  yj    double precision;
  inside boolean := false;
BEGIN
  pts := p_polygon -> 'points';
  IF pts IS NULL THEN RETURN false; END IF;
  n := jsonb_array_length(pts);
  IF n < 3 THEN RETURN false; END IF;

  j := n - 1;
  FOR i IN 0 .. n - 1 LOOP
    xi := (pts -> i ->> 'lng')::double precision;
    yi := (pts -> i ->> 'lat')::double precision;
    xj := (pts -> j ->> 'lng')::double precision;
    yj := (pts -> j ->> 'lat')::double precision;
    IF ((yi > p_lat) <> (yj > p_lat))
       AND (p_lng < (xj - xi) * (p_lat - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;
    j := i;
  END LOOP;

  RETURN inside;
END;
$$;

COMMENT ON FUNCTION public.point_in_polygon IS
  'Ray-casting point-in-polygon test over a {"points":[{"lat","lng"},...]} jsonb shape — no PostGIS dependency.';

-- ─── Haversine distance (km) — same formula the client-side geofencing.ts
-- and the old NestJS service both used, so branch ordering matches what
-- users have seen historically. ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;

-- ─── The zone resolver ───────────────────────────────────────────────────────

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
        -- Surge window may wrap past midnight (e.g. 22..6) — handle both.
        v_surge := v_zone."surgeStartHour" IS NOT NULL AND v_zone."surgeEndHour" IS NOT NULL AND (
          CASE WHEN v_zone."surgeStartHour" <= v_zone."surgeEndHour"
            THEN v_hour >= v_zone."surgeStartHour" AND v_hour < v_zone."surgeEndHour"
            ELSE v_hour >= v_zone."surgeStartHour" OR  v_hour < v_zone."surgeEndHour"
          END
        );

        v_fee := v_zone."baseFee";
        IF v_surge THEN
          v_fee := round(v_fee * COALESCE(v_zone."surgeMultiplier", 1), 2);
        END IF;
        IF v_zone."freeAboveSubtotal" IS NOT NULL AND p_subtotal >= v_zone."freeAboveSubtotal" THEN
          v_fee := 0;
        END IF;

        RETURN QUERY SELECT
          v_branch.id, v_branch."nameAr", v_branch."nameEn",
          v_zone.id, v_zone.name,
          v_zone."baseFee", v_fee, v_surge, v_zone."freeAboveSubtotal",
          v_branch.dist;
        RETURN;
      END IF;
    END LOOP;
  END LOOP;

  -- No active branch's zone polygon contains this point — genuinely out of
  -- delivery range. Return zero rows; callers must treat that as
  -- "undeliverable" rather than falling back to a guessed flat fee.
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.resolve_delivery_zone IS
  'The single source of truth for "which branch/zone serves this coordinate, and what does delivery cost". Replaces the client-side hardcoded branch list + flat fee (apps/shopper-native/src/features/delivery/geofencing.ts) and the separate Railway-hosted NestJS /delivery/quote endpoint — same polygon data, same algorithm, now callable from checkout, driver, and pharmacist alike via one Postgres function. Empty result = undeliverable to that point.';

GRANT EXECUTE ON FUNCTION public.point_in_polygon(double precision, double precision, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_delivery_zone(double precision, double precision, numeric) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
