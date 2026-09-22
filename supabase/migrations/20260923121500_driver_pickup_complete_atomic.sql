-- Driver pickup/complete atomicity, closing the same class of gap
-- 20260902162000_driver_accept_assignment_atomic.sql already fixed for
-- acceptAssignment(): confirmPickup() and completeDelivery() in
-- apps/shopper-native/src/features/driver/api.ts each do their work as two
-- separate client calls -- transition_order() RPC, then a separate client
-- UPDATE of delivery_assignments (picked_up_at / delivered_at +
-- response_status). If the app dies between the two, the order advances
-- (out_for_delivery / delivered) while the assignment row's own timestamps
-- never get set, and there is no self-healing retry: transition_order's
-- state graph only allows driver_accepted -> out_for_delivery -> delivered
-- once, so a retry against an order that already advanced fails with
-- invalid_order_transition.
--
-- Same fix as driver_accept_assignment: reuse transition_order() from
-- inside a single SECURITY DEFINER function so both writes share one
-- transaction -- if the delivery_assignments update fails, the order
-- transition rolls back with it instead of leaving the two out of sync.

CREATE OR REPLACE FUNCTION public.driver_confirm_pickup(p_assignment_id uuid)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order public.orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT order_id INTO v_order_id
  FROM public.delivery_assignments
  WHERE id = p_assignment_id
    AND driver_id = auth.uid()
    AND response_status = 'accepted'
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found_or_already_resolved' USING ERRCODE = '22023';
  END IF;

  -- Raises the same errors transition_order already would
  -- (invalid_order_transition, insufficient_privilege) if this driver/
  -- order/assignment combination isn't actually eligible.
  v_order := public.transition_order(v_order_id, 'out_for_delivery');

  UPDATE public.delivery_assignments
  SET picked_up_at = now()
  WHERE id = p_assignment_id
    AND driver_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_found_or_already_resolved' USING ERRCODE = '22023';
  END IF;

  RETURN v_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.driver_complete_delivery(p_assignment_id uuid)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order public.orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT order_id INTO v_order_id
  FROM public.delivery_assignments
  WHERE id = p_assignment_id
    AND driver_id = auth.uid()
    AND response_status = 'accepted'
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found_or_already_resolved' USING ERRCODE = '22023';
  END IF;

  v_order := public.transition_order(v_order_id, 'delivered');

  UPDATE public.delivery_assignments
  SET delivered_at = now(),
      response_status = 'completed'
  WHERE id = p_assignment_id
    AND driver_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_found_or_already_resolved' USING ERRCODE = '22023';
  END IF;

  RETURN v_order;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.driver_confirm_pickup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_complete_delivery(uuid) TO authenticated;
