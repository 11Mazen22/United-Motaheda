-- Driver ranking — the first real driver-matching intelligence in the
-- system. Confirmed via full repo inspection: driver assignment today is
-- purely manual (staff pick from an alphabetical dropdown of every
-- role=driver profile, no distance/availability/workload signal at all) in
-- both admin surfaces, and the one "browse & rank" implementation that does
-- exist (apps/api's driver-orders.service.ts getAvailableOrders()) is dead
-- code the live driver app never calls, and even it only sorts by distance
-- to a hardcoded fake pharmacy location, not the real Branch table.
--
-- This gives staff a real, explainable ranking of ELIGIBLE drivers for a
-- given order: online, approved/active, ordered by a transparent score
-- combining distance-to-branch and current workload. Reuses haversine_km()
-- (already defined in 20260826956000_delivery_zone_resolution_rpc.sql) and
-- reads the real Branch table instead of a hardcoded coordinate.
--
-- Deliberately does NOT auto-assign anything -- staff still makes the final
-- call (per the existing assignOrder/assignDriver flow); this only ranks
-- the candidates so that choice is informed instead of alphabetical.

CREATE OR REPLACE FUNCTION public.rank_available_drivers(p_order_id uuid)
RETURNS TABLE (
  driver_user_id       uuid,
  driver_profile_id    uuid,
  full_name            text,
  phone                text,
  vehicle_type         text,
  rating               double precision,
  distance_to_branch_km double precision,
  active_deliveries    integer,
  score                double precision,
  is_recommended       boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_lat double precision;
  v_branch_lng double precision;
BEGIN
  -- Only staff (admin/manager) may call this — same role gate the rest of
  -- the dispatch surface uses. SECURITY DEFINER is required because it
  -- reads DriverProfile rows across all drivers, which no driver-facing RLS
  -- policy grants to a caller who isn't that driver.
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Not authorized to rank drivers';
  END IF;

  SELECT b.lat, b.lng INTO v_branch_lat, v_branch_lng
  FROM public.orders o
  JOIN public."Branch" b ON b.id = o.branch_id
  WHERE o.id = p_order_id;

  IF v_branch_lat IS NULL THEN
    -- Order has no resolved branch (shouldn't happen for a real order past
    -- create-order, but a bad/legacy row must not crash the whole ranking
    -- with a null-coordinate distance calculation) -- return no candidates
    -- rather than a misleading distance-free ranking.
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      dp."userId"                                AS driver_user_id,
      dp.id                                       AS driver_profile_id,
      COALESCE(p."full_name", p.email, 'Driver')  AS full_name,
      p.phone                                     AS phone,
      dp."vehicleType"                            AS vehicle_type,
      dp.rating                                   AS rating,
      CASE
        WHEN dp."currentLat" IS NOT NULL AND dp."currentLng" IS NOT NULL
        THEN public.haversine_km(v_branch_lat, v_branch_lng, dp."currentLat", dp."currentLng")
        ELSE NULL
      END AS distance_to_branch_km,
      (
        SELECT count(*)::integer FROM public.delivery_assignments da
        WHERE da.driver_id = dp."userId" AND da.response_status IN ('offered', 'accepted')
      ) AS active_deliveries
    FROM public."DriverProfile" dp
    JOIN public.profiles p ON p.id = dp."userId"
    WHERE dp.status IN ('APPROVED', 'ACTIVE')
      AND dp."isOnline" = true
  )
  SELECT
    c.driver_user_id, c.driver_profile_id, c.full_name, c.phone, c.vehicle_type, c.rating,
    c.distance_to_branch_km, c.active_deliveries,
    -- Explainable, deterministic score: start at 100, lose points for
    -- distance (2 pts/km, capped so a far driver never goes negative) and
    -- for each active delivery already in hand (15 pts -- a driver with
    -- zero active deliveries should almost always outrank one with two,
    -- even if slightly farther). Unknown distance (no live GPS fix) is
    -- penalized like a moderate-distance driver rather than either winning
    -- by default or being excluded outright -- the driver is still online
    -- and eligible, just less precisely placed.
    round(
      (100
        - LEAST(COALESCE(c.distance_to_branch_km, 8) * 2, 60)
        - (c.active_deliveries * 15)
      )::numeric, 1
    )::double precision AS score,
    false AS is_recommended
  FROM candidates c
  ORDER BY score DESC, distance_to_branch_km ASC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.rank_available_drivers IS
  'Ranks online, approved/active drivers for a given order by an explainable score (distance to the order''s resolved branch, current active-delivery workload). Staff-only (admin/manager). Does not assign -- purely advisory, feeding the existing manual assignDriver()/assignOrder() flow with a ranked candidate list instead of an alphabetical one.';

GRANT EXECUTE ON FUNCTION public.rank_available_drivers(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
