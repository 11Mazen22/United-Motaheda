-- Three related, confirmed-live problems in the order-status/cancellation
-- RPC layer, found while verifying the cancellation fix in the sibling
-- migration 20260904130000.
--
-- ── A. Unauthenticated callers could act on arbitrary orders ──────────────
-- Confirmed directly (has_function_privilege): the `anon` role — the public,
-- unauthenticated key baked into every client build by design — holds
-- EXECUTE on execute_order_cancellation, get_order_actions,
-- transition_order, and admin_transition_order. No migration ever revoked
-- the PostgreSQL default (EXECUTE granted to PUBLIC on function creation).
--
-- That alone would only matter if the functions' own auth checks still
-- caught an anonymous caller — they didn't. auth.uid() returns NULL for an
-- anon-key request with no user JWT. Every affected function compared that
-- NULL against an owner/role column with `!=`, `=`, or `NOT IN`:
--   v_order.user_id != v_user_id        -- NULL != NULL is NULL, not TRUE
--   v_order.user_id  = v_user_id        -- NULL  = NULL is NULL, not TRUE
--   v_role NOT IN ('admin', ...)        -- NULL NOT IN (...) is NULL
-- PL/pgSQL's IF treats a NULL condition as false, so every one of these
-- "reject if unauthorized" checks silently did nothing for an anonymous
-- caller — the function then proceeded as if authorized. Net effect: anyone
-- holding the public anon key could call
-- POST /rest/v1/rpc/execute_order_cancellation with any real order id and
-- cancel it, with no login at all. Fixed by adding an explicit
-- `auth.uid() IS NULL` guard as the first statement in each function (the
-- same pattern already used correctly by driver_accept_assignment,
-- driver_decline_assignment, and mark_delivery_arrival — this brings the
-- other RPCs on the same table up to that existing standard), and by
-- revoking EXECUTE from PUBLIC/anon so the class of bug can't resurface by
-- omission on the next function this pattern gets copied to.
--
-- ── B. Admin's status dropdown could cancel an order while skipping every
--       safety check execute_order_cancellation provides ─────────────────
-- admin_transition_order (called by shopper-web's OrdersManager status
-- <select>) was a one-line passthrough to transition_order, which treats
-- 'cancelled' as just another status flip: no inventory release, no refund
-- record, no cancellations audit row, no delivery_assignments cleanup, and
-- — worse — transition_order's own graph allowed out_for_delivery ->
-- cancelled, directly contradicting execute_order_cancellation's explicit
-- "Order is already in physical transit" block. Every other cancel button
-- in this app (customer, pharmacist) already special-cases 'cancelled' to
-- route through execute_order_cancellation instead — only this admin path
-- didn't. Fixed in both places: transition_order's graph no longer allows
-- out_for_delivery -> cancelled at all (closing the gap for every caller,
-- not just this one), and admin_transition_order now redirects a
-- p_next_status of 'cancelled' to execute_order_cancellation (synthesizing
-- a reason/note/idempotency-key, since the dropdown never collected one),
-- then returns the updated order row so the client's existing
-- `.rpc("admin_transition_order", ...)` call site needs no changes.

-- get_order_actions: add the NULL-caller guard (see part A above). Body is
-- otherwise byte-for-byte identical to 20260902160000_fix_cancellation_completely_broken.sql.
CREATE OR REPLACE FUNCTION public.get_order_actions(p_order_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_order RECORD;
    v_role TEXT := 'customer';
    v_user_id UUID := auth.uid();
    v_is_owner BOOLEAN := false;
    v_is_assigned_driver BOOLEAN := false;
    v_can_cancel BOOLEAN := false;
    v_cancel_reason TEXT := NULL;
    v_can_return BOOLEAN := false;
    v_return_reason TEXT := NULL;
    v_cancel_reasons TEXT[] := '{}';
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'cancel', json_build_object('allowed', false, 'reason', 'Unauthorized', 'reasons', '[]'::json),
            'return', json_build_object('allowed', false, 'reason', 'Unauthorized')
        );
    END IF;

    -- Determine Role
    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role IS NULL THEN
        v_role := 'customer';
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN json_build_object(
            'cancel', json_build_object('allowed', false, 'reason', 'Order not found', 'reasons', '[]'::json),
            'return', json_build_object('allowed', false, 'reason', 'Order not found')
        );
    END IF;

    v_is_owner := (v_order.user_id = v_user_id);
    v_is_assigned_driver := (v_order.assigned_driver_id = v_user_id);

    -- Base Authorization Check
    IF v_role = 'customer' AND NOT v_is_owner THEN
        RETURN json_build_object(
            'cancel', json_build_object('allowed', false, 'reason', 'Unauthorized', 'reasons', '[]'::json),
            'return', json_build_object('allowed', false, 'reason', 'Unauthorized')
        );
    END IF;

    -- Cancellation Logic
    IF v_order.status IN ('pending', 'confirmed', 'verification', 'payment_pending', 'payment_approved', 'preparing', 'ready') THEN
        v_can_cancel := true;
    ELSIF v_order.status IN ('driver_assigned', 'driver_accepted') THEN
        v_can_cancel := true;
    ELSIF v_order.status = 'cancelled' THEN
        v_can_cancel := false;
        v_cancel_reason := 'Order is already cancelled.';
    ELSE
        -- picked_up, out_for_delivery, delivered
        v_can_cancel := false;
        v_cancel_reason := 'Order is already out for delivery or delivered. Cancellation is no longer possible.';
    END IF;

    -- Populate Reasons Based on Role
    IF v_role = 'customer' THEN
        v_cancel_reasons := ARRAY['CHANGED_MIND', 'ORDERED_BY_MISTAKE', 'WRONG_ADDRESS', 'DUPLICATE_ORDER', 'PAYMENT_PROBLEM', 'DELIVERY_DELAY', 'FOUND_ELSEWHERE', 'OTHER'];
    ELSIF v_role = 'pharmacist' OR v_role = 'admin' OR v_role = 'manager' THEN
        v_cancel_reasons := ARRAY['PRODUCT_UNAVAILABLE', 'STOCK_MISMATCH', 'PRESCRIPTION_REJECTED', 'PRESCRIPTION_UNCLEAR', 'PHARMACY_CANNOT_FULFILL', 'PHARMACY_CLOSED', 'OTHER'];
    ELSIF v_role = 'driver' THEN
        IF NOT v_is_assigned_driver THEN
            v_can_cancel := false;
            v_cancel_reason := 'Only the assigned driver can cancel this order.';
        END IF;
        v_cancel_reasons := ARRAY['CUSTOMER_UNREACHABLE', 'ADDRESS_UNREACHABLE', 'VEHICLE_ISSUE', 'SAFETY_ISSUE', 'DELIVERY_PROBLEM', 'OTHER'];
    END IF;

    -- Return Logic
    IF v_order.status = 'delivered' THEN
        v_can_return := true;
    ELSE
        v_can_return := false;
        v_return_reason := 'ORDER_NOT_DELIVERED';
    END IF;

    RETURN json_build_object(
        'cancel', json_build_object('allowed', v_can_cancel, 'reason', v_cancel_reason, 'reasons', array_to_json(v_cancel_reasons)),
        'return', json_build_object('allowed', v_can_return, 'reason', v_return_reason)
    );
END;
$function$;

-- transition_order: NULL-caller guard, plus the out_for_delivery ->
-- cancelled loophole closed (see part B above). Everything else identical
-- to 20260827090000_pharmacist_backend_fixes.sql.
CREATE OR REPLACE FUNCTION public.transition_order(p_order_id uuid, p_next_status text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'manager', 'pharmacist', 'driver') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    (v_order.status::text = 'pending' AND p_next_status IN ('verification', 'cancelled')) OR
    (v_order.status::text = 'verification' AND p_next_status IN ('payment_pending', 'payment_approved', 'cancelled')) OR
    (v_order.status::text = 'payment_pending' AND p_next_status IN ('payment_approved', 'cancelled')) OR
    (v_order.status::text = 'payment_approved' AND p_next_status IN ('preparing', 'cancelled')) OR
    (v_order.status::text = 'preparing' AND p_next_status IN ('ready', 'cancelled')) OR
    (v_order.status::text = 'ready' AND p_next_status IN ('driver_assigned', 'cancelled')) OR
    (v_order.status::text = 'driver_assigned' AND p_next_status IN ('driver_accepted', 'cancelled')) OR
    (v_order.status::text = 'driver_accepted' AND p_next_status IN ('out_for_delivery', 'cancelled')) OR
    (v_order.status::text = 'out_for_delivery' AND p_next_status = 'delivered') OR
    (v_order.status::text IN ('delivered', 'cancelled') AND p_next_status = 'archived')
  ) THEN
    RAISE EXCEPTION 'invalid_order_transition' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'driver' THEN
    IF p_next_status NOT IN ('driver_accepted', 'out_for_delivery', 'delivered')
       OR v_order.assigned_driver_id IS DISTINCT FROM auth.uid()
       OR NOT EXISTS (
         SELECT 1
         FROM public.delivery_assignments AS assignment
         WHERE assignment.order_id = p_order_id
           AND assignment.driver_id = auth.uid()
           AND (
             (p_next_status = 'driver_accepted' AND assignment.response_status = 'offered')
             OR (p_next_status IN ('out_for_delivery', 'delivered') AND assignment.response_status = 'accepted')
           )
       ) THEN
      RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'pharmacist' THEN
    IF p_next_status NOT IN ('verification', 'payment_pending', 'payment_approved', 'preparing', 'ready', 'cancelled') THEN
      RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.orders
  SET status = p_next_status::public.order_status,
      last_status_at = now(),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$function$;

-- admin_transition_order: NULL-caller guard, plus redirects a 'cancelled'
-- target through execute_order_cancellation instead of the raw status flip
-- (see part B above). A generic reason/note is synthesized since the admin
-- dropdown never collected one — still a strict improvement (inventory
-- release, refund tracking, audit row, driver-assignment cleanup) over the
-- previous silent bypass, with no client-side change required.
CREATE OR REPLACE FUNCTION public.admin_transition_order(p_order_id uuid, p_next_status text)
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

  IF p_next_status = 'cancelled' THEN
    PERFORM public.execute_order_cancellation(
      p_order_id,
      'OTHER',
      'Cancelled by staff via admin dashboard status control',
      'admin-status-' || p_order_id::text || '-' || extract(epoch from clock_timestamp())::text
    );
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    RETURN v_order;
  END IF;

  RETURN public.transition_order(p_order_id, p_next_status);
END;
$function$;

-- REVOKE ... FROM PUBLIC would be a no-op here: confirmed live (pg_proc.proacl)
-- that this self-hosted Supabase cluster grants EXECUTE directly to anon/
-- authenticated/service_role per-role on function creation, not via a
-- PUBLIC grant these roles inherit — so PUBLIC was never in the ACL to
-- begin with. Revoking from anon specifically is what actually matters.
REVOKE ALL ON FUNCTION public.execute_order_cancellation(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_order_actions(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.transition_order(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_transition_order(uuid, text) FROM anon;

NOTIFY pgrst, 'reload schema';
