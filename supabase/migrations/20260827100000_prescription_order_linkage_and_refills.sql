-- Prescription <-> order linkage, and a proper staff review path for refill
-- requests. Both close gaps confirmed live:
--
--   1. create-order (supabase/functions/create-order/index.ts) already
--      validates body.prescriptionIds against public.prescriptions before
--      accepting an order that contains a requires_prescription product --
--      but the validated ids were never persisted anywhere. A prescription
--      and the order it unblocks were two completely disconnected records
--      once the request finished. This adds the join table the edge
--      function now writes to (see the accompanying create-order edit).
--
--   2. public.refill_requests already carries reviewed_by/reviewed_at/
--      admin_notes/rejection_reason (20260705120000), but nothing ever
--      wrote to them -- there was no RPC, so approving/rejecting/advancing
--      a refill would have meant an unrestricted raw UPDATE from the
--      client. Mirrors review_prescription()/transition_order()'s pattern:
--      SECURITY DEFINER, role-gated, validates the transition server-side.

-- ─── order_prescriptions: proper many-to-many linkage ───────────────────────

CREATE TABLE IF NOT EXISTS public.order_prescriptions (
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, prescription_id)
);

CREATE INDEX IF NOT EXISTS idx_order_prescriptions_prescription
  ON public.order_prescriptions (prescription_id);

ALTER TABLE public.order_prescriptions ENABLE ROW LEVEL SECURITY;

-- No INSERT policy for authenticated: exactly like orders/order_items, the
-- only writer is create-order's service-role client. Read-only from here.

DROP POLICY IF EXISTS order_prescriptions_select_own ON public.order_prescriptions;
CREATE POLICY order_prescriptions_select_own
  ON public.order_prescriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_prescriptions.order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS order_prescriptions_select_staff ON public.order_prescriptions;
CREATE POLICY order_prescriptions_select_staff
  ON public.order_prescriptions FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'pharmacist')
  );

DROP POLICY IF EXISTS order_prescriptions_select_driver ON public.order_prescriptions;
CREATE POLICY order_prescriptions_select_driver
  ON public.order_prescriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_prescriptions.order_id AND o.assigned_driver_id = auth.uid())
  );

-- ─── refill_requests: reviewed/advanced through a real RPC ──────────────────

CREATE OR REPLACE FUNCTION public.review_refill_request(
  p_refill_id uuid,
  p_decision text,
  p_admin_notes text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.refill_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row public.refill_requests;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'manager', 'pharmacist') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_review_decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.refill_requests WHERE id = p_refill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refill_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'refill_already_reviewed' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'rejected' AND coalesce(trim(p_rejection_reason), '') = '' THEN
    RAISE EXCEPTION 'rejection_reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.refill_requests
  SET status = CASE p_decision WHEN 'approved' THEN 'preparing' ELSE 'cancelled' END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = coalesce(p_admin_notes, admin_notes),
      rejection_reason = CASE p_decision WHEN 'rejected' THEN p_rejection_reason ELSE rejection_reason END
  WHERE id = p_refill_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.review_refill_request(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_refill_request(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_refill_request(p_refill_id uuid, p_next_status text)
RETURNS public.refill_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row public.refill_requests;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'manager', 'pharmacist') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.refill_requests WHERE id = p_refill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refill_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    (v_row.status = 'preparing' AND p_next_status IN ('ready', 'cancelled')) OR
    (v_row.status = 'ready' AND p_next_status IN ('on_the_way', 'cancelled')) OR
    (v_row.status = 'on_the_way' AND p_next_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'invalid_refill_transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.refill_requests
  SET status = p_next_status,
      delivered_at = CASE WHEN p_next_status = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = p_refill_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_refill_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_refill_request(uuid, text) TO authenticated;
