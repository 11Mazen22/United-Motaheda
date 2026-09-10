-- Driver earnings were never created for deliveries completed through the
-- live driver_accept_assignment / transition_order / mark_delivery_arrival
-- RPC flow -- confirmed by reading both functions in full: neither writes a
-- DriverEarning row, matching the existing comment already in
-- apps/shopper-native/src/features/driver/api.ts above listMyEarnings().
-- The only code that ever wrote DriverEarning rows (apps/api's
-- driver-orders.service.ts, acceptOrder/completeDelivery) is unreachable --
-- shopper-native calls these Postgres RPCs directly, never that REST
-- endpoint -- but its formula is otherwise reused as-is here, just
-- re-hosted as an RPC the live completion path can call:
--   - baseFee = the order's own zone_base_fee (captured at order-creation
--     time from the same DeliveryZone.baseFee this reads), zeroed if the
--     order qualified for that zone's free-delivery threshold, or a flat
--     15 fallback if the order matched no zone at all -- exactly
--     driver-orders.service.ts's getOrderZoneBaseFee().
--   - distanceFee = 2 per km off delivery_distance_km (the branch-to-
--     customer distance already resolved by resolve_delivery_zone at order
--     time), rounded to the nearest cent -- exactly driver-orders.service.ts's
--     distanceFee computation.
--
-- Additive only: does not modify transition_order, mark_delivery_arrival,
-- or driver_accept_assignment. shopper-native's completeDelivery() calls
-- this once, separately, right after it marks the assignment delivered.
CREATE OR REPLACE FUNCTION public.record_driver_earning(p_assignment_id uuid)
RETURNS public."DriverEarning"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment          public.delivery_assignments;
  v_order               public.orders;
  v_driver_profile_id   uuid;
  v_free_above_subtotal numeric;
  v_base_fee            numeric;
  v_distance_fee        numeric;
  v_total               numeric;
  v_row                 public."DriverEarning";
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_assignment
  FROM public.delivery_assignments
  WHERE id = p_assignment_id
    AND driver_id = auth.uid();

  IF v_assignment.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found_or_not_yours' USING ERRCODE = '22023';
  END IF;

  IF v_assignment.delivered_at IS NULL THEN
    RAISE EXCEPTION 'assignment_not_delivered' USING ERRCODE = '22023';
  END IF;

  -- Idempotent: a retried call (dropped response, duplicate tap, etc.)
  -- must not create a second earning row for the same delivery.
  SELECT * INTO v_row FROM public."DriverEarning" WHERE "deliveryId" = p_assignment_id;
  IF v_row.id IS NOT NULL THEN
    RETURN v_row;
  END IF;

  SELECT id INTO v_driver_profile_id FROM public."DriverProfile" WHERE "userId" = auth.uid();
  IF v_driver_profile_id IS NULL THEN
    RAISE EXCEPTION 'driver_profile_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_assignment.order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_order.zone_id IS NULL THEN
    v_base_fee := 15;
  ELSE
    SELECT "freeAboveSubtotal"::numeric INTO v_free_above_subtotal
    FROM public."DeliveryZone" WHERE id = v_order.zone_id;

    IF v_free_above_subtotal IS NOT NULL
       AND v_order.subtotal IS NOT NULL
       AND v_order.subtotal::numeric >= v_free_above_subtotal THEN
      v_base_fee := 0;
    ELSE
      v_base_fee := COALESCE(v_order.zone_base_fee::numeric, 15);
    END IF;
  END IF;

  v_distance_fee := round((COALESCE(v_order.delivery_distance_km, 0)::numeric) * 2, 2);
  v_total        := round(v_base_fee + v_distance_fee, 2);

  INSERT INTO public."DriverEarning" ("driverId", "deliveryId", "baseFee", "distanceFee", "totalAmount", "earnedAt")
  VALUES (v_driver_profile_id, p_assignment_id, v_base_fee, v_distance_fee, v_total, now())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_driver_earning(uuid) TO authenticated;
