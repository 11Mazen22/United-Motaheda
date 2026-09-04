-- mark_delivery_arrival has never worked, for either arrival stage,
-- confirmed via a minimal isolated reproduction (a bare DO block running
-- just its lookup pattern against the real table). Root cause is a classic
-- PL/pgSQL gotcha:
--
--   SELECT da INTO v_assignment FROM public.delivery_assignments da ...
--
-- `SELECT da` (a bare table alias, no `.*`) selects ONE expression whose
-- value is the whole row packed as a single composite value — not "all of
-- da's columns" the way `SELECT da.*` would. With exactly one source
-- expression against a multi-column `%ROWTYPE` INTO target, PL/pgSQL does
-- not unpack it column-by-column; it tries to coerce that single composite
-- value into the target's first field's type, which for
-- delivery_assignments is `id uuid` — producing exactly the error seen:
-- "invalid input syntax for type uuid" with the full composite row's text
-- representation as the value. Confirmed live and unconditionally
-- reproducible, completely independent of which assignment/coordinates
-- were passed in — every call to mark_delivery_arrival, for either
-- 'pharmacy' or 'customer', has always hit this on its very first lookup,
-- before the geofence check or anything else in the function ever runs.
-- Net effect: no driver has ever been able to mark arrival at the pharmacy
-- or at the customer through this RPC — the entire arrival-marking step of
-- the real delivery-execution flow has been dead on arrival.
--
-- Fixed with the one-character-class change PL/pgSQL actually requires
-- for this idiom: `SELECT da.*` instead of `SELECT da`, which does unpack
-- column-by-column into the %ROWTYPE target correctly.
--
-- Second bug, found immediately after re-testing with the above fixed:
-- the pharmacy-stage precondition required orders.status = 'ready', which
-- can never be true at that point in the call — this same function
-- unconditionally requires v_assignment.response_status = 'accepted'
-- first (the check right below the lookup), and the only way an
-- assignment reaches 'accepted' is via driver_accept_assignment(), which
-- itself calls transition_order(..., 'driver_accepted') in the same
-- transaction — advancing the order past 'ready' as a side effect of the
-- very precondition this function already demands. So the pharmacy-stage
-- status check, as written, could never pass for any call that got this
-- far: proven by re-running the real sequence end to end (pharmacist ready
-- -> admin assigns -> driver accepts -> arrive at pharmacy) against a real
-- test order, which reached this exact check and failed with
-- order_not_ready_for_pharmacy_arrival every time. Corrected to
-- 'driver_accepted' — the state that actually holds once a driver has
-- accepted and is physically en route to collect the order, which is
-- what "arrived at pharmacy" is supposed to represent.
CREATE OR REPLACE FUNCTION public.mark_delivery_arrival(p_assignment_id uuid, p_stage text, p_lat numeric, p_lng numeric)
 RETURNS delivery_assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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

  SELECT da.*
    INTO v_assignment
    FROM public.delivery_assignments da
   WHERE da.id = p_assignment_id
     AND da.driver_id = auth.uid()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT o.* INTO v_order FROM public.orders o WHERE o.id = v_assignment.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.response_status <> 'accepted' THEN
    RAISE EXCEPTION 'assignment_not_accepted' USING ERRCODE = '42501';
  END IF;
  IF p_stage = 'pharmacy' AND v_order.status::text <> 'driver_accepted' THEN
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
$function$;
