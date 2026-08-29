-- resolve_delivery_zone() already orders branches nearest-first and returns
-- the first zone-polygon match -- which is only equivalent to "always pick
-- the single correct branch" when zones never overlap between adjacent
-- branches. Where two nearby branches' delivery circles DO overlap (a
-- realistic case for closely-spaced branches), the nearest one always won
-- outright, even when Branch.loadFactor -- a column that has existed since
-- the original schema but was never read anywhere in the codebase -- shows
-- it's overloaded relative to a further branch that could also reach the
-- point.
--
-- This makes that column meaningful: if the nearest matching branch is
-- heavily loaded (loadFactor >= 0.85) and a further branch's zone ALSO
-- covers the point, prefer the further-but-lighter branch instead. This is
-- deliberately conservative -- it only ever overrides distance when there's
-- a genuine second eligible candidate; a branch with no competing coverage
-- is picked exactly as before, so the common case (most points only fall
-- inside one branch's zone) is unaffected.

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
  v_overloaded_threshold constant double precision := 0.85;
  -- The first match found, kept in case every other candidate is also
  -- overloaded (or there simply is no other candidate) -- the customer
  -- still needs an answer, a busy branch is still a valid, deliverable one.
  v_fallback record;
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
          v_fee := round(v_fee * COALESCE(v_zone."surgeMultiplier", 1), 2);
        END IF;
        IF v_zone."freeAboveSubtotal" IS NOT NULL AND p_subtotal >= v_zone."freeAboveSubtotal" THEN
          v_fee := 0;
        END IF;

        -- This branch isn't overloaded (or workload data doesn't exist for
        -- it) -- take it immediately, exactly as before the workload check
        -- existed. This is the common path.
        IF COALESCE(v_branch."loadFactor", 0) < v_overloaded_threshold THEN
          RETURN QUERY SELECT
            v_branch.id, v_branch."nameAr", v_branch."nameEn",
            v_zone.id, v_zone.name,
            v_zone."baseFee", v_fee, v_surge, v_zone."freeAboveSubtotal",
            v_branch.dist;
          RETURN;
        END IF;

        -- Overloaded branch matched -- remember it as the answer of last
        -- resort, but keep looking for a lighter alternative that can also
        -- reach this point before committing to it.
        IF NOT v_have_fallback THEN
          v_fallback := ROW(
            v_branch.id, v_branch."nameAr", v_branch."nameEn",
            v_zone.id, v_zone.name,
            v_zone."baseFee", v_fee, v_surge, v_zone."freeAboveSubtotal",
            v_branch.dist
          );
          v_have_fallback := true;
        END IF;
        -- Don't RETURN here -- keep scanning remaining branches/zones for a
        -- non-overloaded match before falling back to this one.
        EXIT; -- this branch's cheapest-matching zone is decided; move on to the next branch
      END IF;
    END LOOP;
  END LOOP;

  IF v_have_fallback THEN
    RETURN QUERY SELECT
      v_fallback.branch_id, v_fallback.branch_name_ar, v_fallback.branch_name_en,
      v_fallback.zone_id, v_fallback.zone_name, v_fallback.base_fee, v_fallback.effective_fee,
      v_fallback.surge_applied, v_fallback.free_above_subtotal, v_fallback.distance_km;
    RETURN;
  END IF;

  -- No active branch's zone polygon contains this point at all.
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.resolve_delivery_zone IS
  'The single source of truth for "which branch/zone serves this coordinate, and what does delivery cost". Nearest active branch whose zone covers the point wins, UNLESS it is overloaded (Branch.loadFactor >= 0.85) and a further branch''s zone also covers the point -- in that case the further-but-lighter branch is preferred. Falls back to the overloaded branch if it is the only match. Empty result = undeliverable to that point.';

GRANT EXECUTE ON FUNCTION public.resolve_delivery_zone(double precision, double precision, numeric) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
