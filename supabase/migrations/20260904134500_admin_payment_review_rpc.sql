-- adminVerifyPayment/adminRejectPayment (apps/shopper-web/src/services/adminOrdersApi.ts)
-- wrote directly to public.orders via the PostgREST client:
--   .from("orders").update({ payment_status: "verified" }).eq("id", orderId)
-- with no .select() to confirm a row actually changed. orders' only UPDATE
-- policy ("Admins and managers can update orders") gates on role IN
-- ('admin','manager') — but OrdersManager.tsx's "Verify Payment"/"Reject"
-- buttons (lines ~584-590) render for any order needing review with no
-- role check of their own, and AdminLayout.tsx already lets 'pharmacist'
-- into the whole admin panel (the same gap the sibling migrations
-- 20260903120000/20260903121500 fixed for the dashboard RPC and products
-- RLS). Under RLS, an UPDATE that matches zero rows is not an error — it's
-- a silent no-op, so a pharmacist clicking "Verify Payment" gets a success
-- toast and an optimistic UI update while nothing is written; the order
-- reverts to "pending verification" on the next reload for anyone.
--
-- Fixed the same way every other order mutation in this codebase already
-- is: a SECURITY DEFINER RPC with its own explicit role check (matching
-- the sibling migrations' precedent exactly), rather than depending on RLS
-- for a mutation that already has a client-side gate assuming pharmacist
-- access works. This also fixes the silent-no-op class of bug structurally
-- — a role check that fails now RAISEs instead of quietly filtering rows.
CREATE OR REPLACE FUNCTION public.admin_review_payment(
  p_order_id uuid,
  p_decision text, -- 'verified' | 'failed'
  p_failure_reason text DEFAULT NULL
)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('verified', 'failed') THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET payment_status = p_decision,
      failure_reason = CASE WHEN p_decision = 'failed'
        THEN COALESCE(NULLIF(trim(p_failure_reason), ''), 'تم رفض الإيصال من قِبَل الإدارة')
        ELSE failure_reason
      END,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_order;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_review_payment(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_payment(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_review_payment(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
