-- Persist driver arrival milestones on the assignment ledger without adding
-- competing order lifecycle states.

ALTER TABLE public.delivery_assignments
  ADD COLUMN IF NOT EXISTS arrived_at_pharmacy timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at_customer timestamptz;

CREATE OR REPLACE FUNCTION public.mark_delivery_arrival(
  p_assignment_id uuid,
  p_stage text
)
RETURNS public.delivery_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_assignment public.delivery_assignments%rowtype;
  v_order_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_stage NOT IN ('pharmacy', 'customer') THEN
    RAISE EXCEPTION 'invalid_arrival_stage' USING ERRCODE = '22023';
  END IF;

  SELECT da
    INTO v_assignment
    FROM public.delivery_assignments da
    JOIN public.orders o ON o.id = da.order_id
   WHERE da.id = p_assignment_id
     AND da.driver_id = auth.uid()
   FOR UPDATE OF da;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT o.status::text
    INTO v_order_status
    FROM public.orders o
   WHERE o.id = v_assignment.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_assignment.response_status <> 'accepted' THEN
    RAISE EXCEPTION 'assignment_not_accepted' USING ERRCODE = '42501';
  END IF;
  IF p_stage = 'pharmacy' AND v_order_status <> 'ready' THEN
    RAISE EXCEPTION 'order_not_ready_for_pharmacy_arrival' USING ERRCODE = '22023';
  END IF;
  IF p_stage = 'customer' AND v_order_status <> 'out_for_delivery' THEN
    RAISE EXCEPTION 'order_not_out_for_delivery' USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.mark_delivery_arrival(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_delivery_arrival(uuid, text) TO authenticated;