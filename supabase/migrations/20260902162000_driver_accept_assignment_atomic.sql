-- Found by the transaction-integrity audit: acceptAssignment() in
-- apps/shopper-native/src/features/driver/api.ts does its work as 3
-- separate client calls -- SELECT the offer, transition_order RPC, then
-- a separate UPDATE of delivery_assignments.response_status. If the app
-- dies between the second and third, the order sits at driver_accepted
-- while the assignment row still says 'offered' -- and retrying doesn't
-- self-heal, since transition_order's own state machine only allows
-- driver_assigned -> driver_accepted, so a retry against an order
-- already at driver_accepted fails with invalid_order_transition and the
-- driver is stuck. The sibling declineAssignment() was already rewritten
-- into one atomic RPC (driver_decline_assignment, see its own comment)
-- for exactly this reason; the same fix was never applied to accept.
--
-- Reuses transition_order() internally rather than duplicating its state
-- machine and role/ownership checks -- calling it from inside this
-- function keeps everything in the one outer transaction, so if the
-- delivery_assignments update below fails for any reason, the order
-- transition rolls back with it instead of leaving the two out of sync.
CREATE OR REPLACE FUNCTION public.driver_accept_assignment(p_assignment_id uuid)
RETURNS delivery_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_row public.delivery_assignments;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT order_id INTO v_order_id
  FROM public.delivery_assignments
  WHERE id = p_assignment_id
    AND driver_id = auth.uid()
    AND response_status = 'offered'
  FOR UPDATE;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found_or_already_resolved' USING ERRCODE = '22023';
  END IF;

  -- Raises the same errors transition_order already would
  -- (invalid_order_transition, insufficient_privilege) if this driver/
  -- order/assignment combination isn't actually eligible.
  PERFORM public.transition_order(v_order_id, 'driver_accepted');

  UPDATE public.delivery_assignments
  SET response_status = 'accepted',
      responded_at = now()
  WHERE id = p_assignment_id
    AND driver_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found_or_already_resolved' USING ERRCODE = '22023';
  END IF;

  RETURN v_row;
END;
$function$;
