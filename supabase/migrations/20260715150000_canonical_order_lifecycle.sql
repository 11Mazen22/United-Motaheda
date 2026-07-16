-- Canonical, persisted order lifecycle. The transition RPC is the only admin
-- mutation path; it validates the state graph and writes the audit timeline.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'verification';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_pending';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_approved';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'driver_assigned';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'driver_accepted';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'archived';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_transition_order(p_order_id uuid, p_next_status text)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders; v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin','manager','pharmacist') THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;
  IF NOT ((v_order.status::text='pending' AND p_next_status IN ('verification','cancelled'))
    OR (v_order.status::text='verification' AND p_next_status IN ('payment_pending','payment_approved','cancelled'))
    OR (v_order.status::text='payment_pending' AND p_next_status IN ('payment_approved','cancelled'))
    OR (v_order.status::text='payment_approved' AND p_next_status IN ('preparing','cancelled'))
    OR (v_order.status::text IN ('preparing','processing') AND p_next_status IN ('ready','cancelled'))
    OR (v_order.status::text='ready' AND p_next_status IN ('driver_assigned','cancelled'))
    OR (v_order.status::text='driver_assigned' AND p_next_status IN ('driver_accepted','cancelled'))
    OR (v_order.status::text='driver_accepted' AND p_next_status IN ('out_for_delivery','cancelled'))
    OR (v_order.status::text IN ('out_for_delivery','picked_up','shipped') AND p_next_status IN ('delivered','cancelled'))
    OR (v_order.status::text IN ('delivered','cancelled') AND p_next_status='archived')) THEN
    RAISE EXCEPTION 'invalid_order_transition' USING ERRCODE='22023';
  END IF;
  UPDATE public.orders SET status=p_next_status::public.order_status, last_status_at=now(), updated_at=now() WHERE id=p_order_id RETURNING * INTO v_order;
  RETURN v_order;
END $$;
REVOKE ALL ON FUNCTION public.admin_transition_order(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_transition_order(uuid,text) TO authenticated;
