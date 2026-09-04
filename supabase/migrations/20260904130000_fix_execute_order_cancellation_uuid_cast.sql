-- execute_order_cancellation (defined in 20260830141500_cancellation_final_fixes.sql,
-- last touched by 20260902160000_fix_cancellation_completely_broken.sql for a
-- sibling function) is still broken today — confirmed live via a
-- transaction-wrapped, rolled-back call against a real order (no data was
-- changed by testing this). Three separate bugs fixed here:
--
-- 1. Its inventory-cleanup step compared inventory_reservations.order_id
--    (uuid) against p_order_id::text:
--      WHERE order_id = p_order_id::text AND state IN ('reserved', 'committed')
--    Postgres has no `uuid = text` operator (confirmed directly: `SELECT
--    '...'::uuid = '...'::text` raises "operator does not exist: uuid =
--    text"), so this raised on every call. Because the whole function runs
--    as one implicit transaction, that unhandled exception rolled back
--    everything already done in steps 7-8 (the cancellations insert and the
--    orders.status = 'cancelled' update) — so from the caller's side,
--    cancellation still failed outright, just later and for a different
--    reason than the bug the previous migration fixed. Not hypothetical:
--    zero rows exist in public.orders with status = 'cancelled' to date,
--    despite that earlier fix having shipped two days prior. p_order_id is
--    already uuid-typed (the function's own parameter declaration) and
--    inventory_reservations.order_id is uuid — no cast is needed or correct.
--
-- 2. Step 11 (Enqueue Notification) inserted straight into
--    public.notification_outbox with only (event_type, payload, status), but
--    that table requires notification_id (FK to public.notifications, NOT
--    NULL), recipient_id, title and body — none of which were supplied, so
--    every call failed on a NOT NULL violation on notification_id, once bug
--    1 was fixed and this step was actually reached. create-order's
--    enqueueOrderCreatedNotification (Edge Function) establishes the correct
--    two-step pattern (insert into notifications first, then reference its
--    id from notification_outbox) — this mirrors that in PL/pgSQL. Guarded
--    on v_order.user_id IS NOT NULL since some existing orders in this
--    database predate user_id being required and would otherwise violate
--    notifications.user_id's own NOT NULL constraint. No ON CONFLICT here
--    (confirmed live: notifications.event_key has no unique index to
--    target) — safe without one anyway, since this whole function already
--    short-circuits on a replayed p_idempotency_key in step 1, before step
--    11 would ever run twice for the same cancellation.
--
-- 3. auth.uid() IS NULL was never rejected — see
--    20260904131500_lock_down_order_status_rpcs.sql for the full security
--    writeup (this function, transition_order, and get_order_actions all
--    had the same gap, plus anon held EXECUTE on all three by default).
--    Added here as an explicit early guard, consistent with how
--    driver_accept_assignment/driver_decline_assignment/mark_delivery_arrival
--    already do this.
--
-- 4. Financial branch (step 6) had no case for payment_status =
--    'pending_verification' — the status create-order sets for every manual
--    wallet-transfer order (supabase/functions/create-order/index.ts:431)
--    while awaiting staff review. It fell through to the declared defaults
--    (NOT_REQUIRED / NONE), so a customer who paid via bank/wallet transfer
--    and cancelled before the pharmacy reviewed the proof got no refund
--    record at all, despite CancelOrderSheet.tsx unconditionally telling
--    them "any payment made will be refunded within 3-5 business days."
--    Treated the same as captured/verified (refund PENDING) — safer to have
--    staff double-check a claimed transfer than to silently drop a possible
--    refund obligation.
CREATE OR REPLACE FUNCTION public.execute_order_cancellation(p_order_id uuid, p_reason_code text, p_note text, p_idempotency_key text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_role TEXT := 'customer';
    v_actor_type TEXT;
    v_order RECORD;
    v_cancel_id UUID;
    v_res RECORD;
    v_actions JSON;
    v_can_cancel BOOLEAN;
    v_refund_status TEXT := 'NOT_REQUIRED';
    v_refund_amount NUMERIC := 0;
    v_financial_action TEXT := 'NONE';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;

    -- 1. Idempotency Check
    SELECT id INTO v_cancel_id FROM public.cancellations WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN json_build_object('success', true, 'cancellation_id', v_cancel_id, 'note', 'Idempotency recovery');
    END IF;

    -- 2. Lock Order for Concurrency
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- 3. Auth & Role Derivation
    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role IS NULL THEN v_role := 'customer'; END IF;

    IF v_role = 'customer' THEN
        v_actor_type := 'customer';
        IF v_order.user_id != v_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    ELSIF v_role IN ('admin', 'pharmacist', 'manager') THEN
        v_actor_type := v_role;
    ELSE
        v_actor_type := 'driver';
        IF v_order.assigned_driver_id != v_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    END IF;

    -- 4. Policy Validation via internal call (v_user_id is already auth.uid())
    v_actions := public.get_order_actions(p_order_id);
    v_can_cancel := (v_actions->'cancel'->>'allowed')::BOOLEAN;

    IF NOT v_can_cancel THEN
        RAISE EXCEPTION 'Order cannot be cancelled: %', v_actions->'cancel'->>'reason';
    END IF;

    -- Ensure order is not past pickup (Driver assignment validation)
    IF v_order.status IN ('picked_up', 'out_for_delivery', 'delivered') THEN
        RAISE EXCEPTION 'Cancellation rejected: Order is already in physical transit.';
    END IF;

    -- 5. Driver Assignment Cleanup
    UPDATE public.delivery_assignments
    SET response_status = 'cancelled', superseded_at = NOW(), decline_reason = 'Order Cancelled'
    WHERE order_id = p_order_id AND response_status IN ('offered', 'accepted');

    -- 6. Financials (Refund state machine integration)
    IF v_order.payment_status IN ('captured', 'verified', 'pending_verification') THEN
        v_refund_status := 'PENDING';
        v_refund_amount := v_order.total;
        v_financial_action := 'REFUND';
    ELSIF v_order.payment_status = 'authorized' THEN
        v_refund_status := 'NOT_REQUIRED';
        v_refund_amount := 0;
        v_financial_action := 'VOID';
    ELSIF v_order.payment_status IN ('refunded', 'failed', 'unpaid', 'pending') THEN
        v_refund_status := 'NOT_REQUIRED';
        v_financial_action := 'NONE';
    ELSIF v_order.payment_status = 'partially_refunded' THEN
        v_refund_status := 'PENDING';
        v_refund_amount := v_order.total; -- Should subtract already refunded but keeping it simple as requested
        v_financial_action := 'REFUND';
    END IF;

    -- 7. Insert Cancellation Record
    INSERT INTO public.cancellations (
        order_id, actor_type, actor_id, reason_code, note,
        previous_status, refund_status, refund_amount, idempotency_key, financial_action
    ) VALUES (
        p_order_id, v_actor_type, v_user_id, p_reason_code, p_note,
        v_order.status, v_refund_status, v_refund_amount, p_idempotency_key, v_financial_action
    ) RETURNING id INTO v_cancel_id;

    -- 8. Update Order Status
    UPDATE public.orders SET
        status = 'cancelled',
        cancellation_reason = p_reason_code,
        cancelled_by = v_user_id,
        cancelled_at = NOW()
    WHERE id = p_order_id;

    -- 9. Inventory Cleanup
    -- (fixed: order_id is uuid, p_order_id is uuid — the previous version's
    -- `order_id = p_order_id::text` had no matching operator and raised on
    -- every call)
    FOR v_res IN
        SELECT id FROM public.inventory_reservations
        WHERE order_id = p_order_id AND state IN ('reserved', 'committed')
    LOOP
        PERFORM public.release_inventory(
            v_res.id,
            'ORDER_CANCELLED',
            p_idempotency_key || '-inv-' || v_res.id::text
        );
    END LOOP;

    -- 10. Trigger Refund If Needed
    IF v_financial_action = 'REFUND' THEN
        INSERT INTO public.refunds (
            order_id, amount, status, reason, created_by, idempotency_key, gateway_reference
        ) VALUES (
            p_order_id, v_refund_amount, 'pending', p_reason_code, v_user_id, p_idempotency_key || '-refund', v_order.payment_reference
        );
    END IF;

    -- 11. Enqueue Notification (to the customer, if this order has one —
    -- see header comment for why user_id can be null and why no ON CONFLICT)
    IF v_order.user_id IS NOT NULL THEN
        DECLARE
            v_notification_id UUID;
        BEGIN
            INSERT INTO public.notifications (
                user_id, type, category, title, body, data, action_url, is_read, event_key
            ) VALUES (
                v_order.user_id, 'order', 'order_updates',
                'تم إلغاء طلبك', 'تم إلغاء طلبك بنجاح. سيتم رد أي مبلغ مدفوع خلال 3-5 أيام عمل إن وجد.',
                jsonb_build_object('kind', 'order_cancelled', 'orderId', p_order_id, 'reason', p_reason_code),
                '/order/' || p_order_id::text,
                false,
                'order:' || p_order_id::text || ':cancelled'
            )
            RETURNING id INTO v_notification_id;

            INSERT INTO public.notification_outbox (
                notification_id, recipient_id, event_type, category, title, body, payload, idempotency_key
            ) VALUES (
                v_notification_id, v_order.user_id, 'order', 'order_updates',
                'تم إلغاء طلبك', 'تم إلغاء طلبك بنجاح. سيتم رد أي مبلغ مدفوع خلال 3-5 أيام عمل إن وجد.',
                jsonb_build_object(
                    'data', jsonb_build_object('kind', 'order_cancelled', 'orderId', p_order_id, 'reason', p_reason_code),
                    'action_url', '/order/' || p_order_id::text,
                    'notification_id', v_notification_id
                ),
                p_idempotency_key || '-notify'
            );
        END;
    END IF;

    RETURN json_build_object(
        'success', true,
        'cancellation_id', v_cancel_id,
        'refund_status', v_refund_status,
        'financial_action', v_financial_action
    );
END;
$function$;
