-- resolve_delivery_zone() -- the RPC create-order actually calls to price
-- every order, any payment method -- had two independent bugs, both only
-- reachable through code paths that had apparently never been successfully
-- exercised end-to-end before:
--
-- 1. "round(double precision, integer) does not exist" whenever a matched
--    zone's surge window is active. DeliveryZone.surgeMultiplier is
--    `double precision`; v_fee is `numeric`; numeric * double precision
--    promotes to double precision, and round(double precision, integer) has
--    no overload (only round(numeric, integer) does). Confirmed live:
--    gardenia's zones all have surgeStartHour=0/surgeEndHour=6, and calling
--    the function directly during that window reproduces the exact error.
--
-- 2. "structure of query does not match function result type" for every
--    branch whose loadFactor is >= the 0.85 "overloaded" threshold --
--    confirmed live: gardenia's loadFactor is 1, which is the same value
--    apps/api's ETA calculation treats as "normal load" (a different,
--    unrelated use of this same column with an incompatible 0-1-saturation
--    vs 1.0-is-normal-multiplier interpretation -- a real product/data
--    question, not something fixed here). The fallback-remembering branch
--    stored its match in an untyped `record` via a bare ROW(...)
--    constructor, then read it back by field name
--    (v_fallback.branch_id, ...) in the final RETURN QUERY -- a record
--    built from an unnamed ROW() doesn't reliably carry those names through
--    to a later RETURN QUERY's own column-type resolution. Since gardenia's
--    loadFactor makes it "overloaded" by this function's own threshold,
--    this broken path was the ONLY path being taken for it -- every order
--    to gardenia was one attempted RPC call away from this crash outside
--    surge hours too, masked until now by (1) above always firing first
--    during the hours this was tested.
--
-- create-order/index.ts only logs the RPC error and treats a null result as
-- "address_not_deliverable" -- so both bugs surfaced to the customer as a
-- misleading "this address isn't deliverable" error that had nothing to do
-- with the address.
--
-- Fix: cast the surge product to numeric before rounding (bug 1), and
-- replace the untyped record + ROW() fallback with explicit, correctly
-- typed scalar variables matching each RETURNS TABLE column exactly (bug
-- 2). Loop/matching logic is otherwise unchanged.
CREATE OR REPLACE FUNCTION public.resolve_delivery_zone(p_lat double precision, p_lng double precision, p_subtotal numeric DEFAULT 0)
 RETURNS TABLE(branch_id text, branch_name_ar text, branch_name_en text, zone_id text, zone_name text, base_fee numeric, effective_fee numeric, surge_applied boolean, free_above_subtotal numeric, distance_km double precision)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_branch  record;
  v_zone    record;
  v_hour    integer := extract(hour FROM now())::integer;
  v_surge   boolean;
  v_fee     numeric;
  v_overloaded_threshold constant double precision := 0.85;
  -- Explicit, correctly typed fallback slots -- matches RETURNS TABLE
  -- column-for-column, so RETURN QUERY SELECT below can't hit a
  -- structural mismatch the way an untyped record + ROW() did.
  v_fb_branch_id            text;
  v_fb_branch_name_ar       text;
  v_fb_branch_name_en       text;
  v_fb_zone_id              text;
  v_fb_zone_name            text;
  v_fb_base_fee             numeric;
  v_fb_effective_fee        numeric;
  v_fb_surge_applied        boolean;
  v_fb_free_above_subtotal  numeric;
  v_fb_distance_km          double precision;
  v_have_fallback boolean := false;
BEGIN
  FOR v_branch IN
    SELECT b.id, b."nameAr", b."nameEn", b.lat, b.lng, b."loadFactor",
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

        v_fee := v_zone."baseFee";
        IF v_surge THEN
          v_fee := round((v_fee * COALESCE(v_zone."surgeMultiplier", 1))::numeric, 2);
        END IF;
        IF v_zone."freeAboveSubtotal" IS NOT NULL AND p_subtotal >= v_zone."freeAboveSubtotal" THEN
          v_fee := 0;
        END IF;

        IF COALESCE(v_branch."loadFactor", 0) < v_overloaded_threshold THEN
          RETURN QUERY SELECT
            v_branch.id, v_branch."nameAr", v_branch."nameEn",
            v_zone.id, v_zone.name,
            v_zone."baseFee"::numeric, v_fee, v_surge, v_zone."freeAboveSubtotal"::numeric,
            v_branch.dist;
          RETURN;
        END IF;

        IF NOT v_have_fallback THEN
          v_fb_branch_id           := v_branch.id;
          v_fb_branch_name_ar      := v_branch."nameAr";
          v_fb_branch_name_en      := v_branch."nameEn";
          v_fb_zone_id             := v_zone.id;
          v_fb_zone_name           := v_zone.name;
          v_fb_base_fee            := v_zone."baseFee";
          v_fb_effective_fee       := v_fee;
          v_fb_surge_applied       := v_surge;
          v_fb_free_above_subtotal := v_zone."freeAboveSubtotal";
          v_fb_distance_km         := v_branch.dist;
          v_have_fallback := true;
        END IF;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  IF v_have_fallback THEN
    RETURN QUERY SELECT
      v_fb_branch_id, v_fb_branch_name_ar, v_fb_branch_name_en,
      v_fb_zone_id, v_fb_zone_name, v_fb_base_fee, v_fb_effective_fee,
      v_fb_surge_applied, v_fb_free_above_subtotal, v_fb_distance_km;
    RETURN;
  END IF;

  RETURN;
END;
$function$;
