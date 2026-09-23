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
;
