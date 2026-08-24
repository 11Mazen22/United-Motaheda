-- Driver-app-consolidation plan, Phase 3. mark_delivery_arrival took no
-- coordinates at all -- arrival was purely self-reported. Adds a geofence
-- check for the customer-arrival stage only: orders.customer_lat/lng is a
-- real, reliable per-order coordinate (confirmed against the live schema).
-- The pharmacy-arrival stage is deliberately left self-reported -- orders
-- has no pharmacy/branch reference column at all (confirmed: this business
-- has a real multi-branch Branch table, but orders don't record which
-- branch prepared them), so there is no reliable per-order pharmacy
-- coordinate to check against. apps/api's own driver-orders.service.ts
-- works around this with a single hardcoded DEFAULT_PHARMACY constant;
-- that doesn't match the real data model and isn't worth porting as-is.
--
-- p_lat/p_lng are now required (not optional) so a caller can't silently
-- skip the check by omitting them.

CREATE OR REPLACE FUNCTION public.mark_delivery_arrival(
  p_assignment_id uuid,
  p_stage text,
  p_lat numeric,
  p_lng numeric
)
RETURNS public.delivery_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_assignment public.delivery_assignments%rowtype;
  v_order public.orders%rowtype;
  v_distance_meters double precision;
  v_radius_meters constant double precision := 200;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_stage NOT IN ('pharmacy', 'customer') THEN
    RAISE EXCEPTION 'invalid_arrival_stage' USING ERRCODE = '22023';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'coordinates_required' USING ERRCODE = '22023';
  END IF;

  SELECT da
    INTO v_assignment
    FROM public.delivery_assignments da
   WHERE da.id = p_assignment_id
     AND da.driver_id = auth.uid()
   FOR UPDATE OF da;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT o INTO v_order FROM public.orders o WHERE o.id = v_assignment.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.response_status <> 'accepted' THEN
    RAISE EXCEPTION 'assignment_not_accepted' USING ERRCODE = '42501';
  END IF;
  IF p_stage = 'pharmacy' AND v_order.status::text <> 'ready' THEN
    RAISE EXCEPTION 'order_not_ready_for_pharmacy_arrival' USING ERRCODE = '22023';
  END IF;
  IF p_stage = 'customer' AND v_order.status::text <> 'out_for_delivery' THEN
    RAISE EXCEPTION 'order_not_out_for_delivery' USING ERRCODE = '22023';
  END IF;

  -- Geofence check: customer stage only (see header comment for why
  -- pharmacy stage is skipped). Haversine distance in metres.
  IF p_stage = 'customer' AND v_order.customer_lat IS NOT NULL AND v_order.customer_lng IS NOT NULL THEN
    v_distance_meters := 6371000 * 2 * asin(sqrt(
      power(sin(radians(v_order.customer_lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(v_order.customer_lat)) *
      power(sin(radians(v_order.customer_lng - p_lng) / 2), 2)
    ));
    IF v_distance_meters > v_radius_meters THEN
      RAISE EXCEPTION 'too_far_from_destination: %m from customer, must be within %m', round(v_distance_meters), v_radius_meters
        USING ERRCODE = '22023', HINT = 'too_far_from_destination';
    END IF;
  END IF;

  IF p_stage = 'pharmacy' THEN
    UPDATE public.delivery_assignments
       SET arrived_at_pharmacy = coalesce(arrived_at_pharmacy, now())
     WHERE id = p_assignment_id
     RETURNING * INTO v_assignment;
  ELSE
    UPDATE public.delivery_assignments
       SET arrived_at_customer = coalesce(arrived_at_customer, now())
     WHERE id = p_assignment_id
     RETURNING * INTO v_assignment;
  END IF;
  RETURN v_assignment;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_delivery_arrival(uuid, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_delivery_arrival(uuid, text, numeric, numeric) TO authenticated;

-- Drop the old 2-arg overload now that every caller must be updated to pass
-- coordinates -- keeping both around would let a stale client bypass the
-- geofence entirely by calling the old signature.
DROP FUNCTION IF EXISTS public.mark_delivery_arrival(uuid, text);
