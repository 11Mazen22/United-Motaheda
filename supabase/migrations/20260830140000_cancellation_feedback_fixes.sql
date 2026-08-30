-- 1. Drop UNIQUE constraint on cancellations.order_id
ALTER TABLE public.cancellations DROP CONSTRAINT IF EXISTS ux_cancellations_order;

-- 2. get_order_actions RPC
CREATE OR REPLACE FUNCTION get_order_actions(p_order_id UUID)
RETURNS JSON AS $$
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
    IF v_order.status IN ('pending', 'confirmed', 'pharmacy_review', 'payment_pending', 'payment_approved', 'preparing', 'ready') THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. execute_order_cancellation RPC
CREATE OR REPLACE FUNCTION execute_order_cancellation(
    p_order_id UUID,
    p_reason_code TEXT,
    p_note TEXT,
    p_idempotency_key TEXT
) RETURNS JSON AS $$
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
BEGIN
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
    IF v_order.payment_status IN ('captured', 'verified') THEN
        v_refund_status := 'PENDING';
        v_refund_amount := v_order.total;
    ELSIF v_order.payment_status = 'authorized' THEN
        v_refund_status := 'PROCESSING'; -- Void
        v_refund_amount := v_order.total;
    ELSIF v_order.payment_status IN ('refunded', 'failed', 'unpaid', 'pending') THEN
        v_refund_status := 'NOT_REQUIRED';
    ELSIF v_order.payment_status = 'partially_refunded' THEN
        -- Simplified for now, just mark pending review or processing
        v_refund_status := 'PROCESSING';
        v_refund_amount := v_order.total; -- In reality, subtract already refunded
    END IF;

    -- 7. Insert Cancellation Record
    INSERT INTO public.cancellations (
        order_id, actor_type, actor_id, reason_code, note, 
        previous_status, refund_status, refund_amount, idempotency_key
    ) VALUES (
        p_order_id, v_actor_type, v_user_id, p_reason_code, p_note, 
        v_order.status, v_refund_status, v_refund_amount, p_idempotency_key
    ) RETURNING id INTO v_cancel_id;

    -- 8. Update Order Status
    UPDATE public.orders SET 
        status = 'cancelled',
        cancellation_reason = p_reason_code,
        cancelled_by = v_user_id,
        cancelled_at = NOW()
    WHERE id = p_order_id;

    -- 9. Inventory Cleanup
    FOR v_res IN 
        SELECT id FROM public.inventory_reservations 
        WHERE order_id = p_order_id::text AND state IN ('reserved', 'committed')
    LOOP
        PERFORM public.release_inventory(
            v_res.id,
            'ORDER_CANCELLED',
            p_idempotency_key || '-inv-' || v_res.id::text
        );
    END LOOP;

    -- 10. Trigger Refund If Needed
    IF v_refund_status = 'PENDING' OR v_refund_status = 'PROCESSING' THEN
        INSERT INTO public.refunds (
            order_id, amount, status, reason, created_by, idempotency_key, gateway_reference
        ) VALUES (
            p_order_id, v_refund_amount, 'pending', p_reason_code, v_user_id, p_idempotency_key || '-refund', v_order.payment_reference
        );
    END IF;

    -- 11. Enqueue Notification
    INSERT INTO public.notification_outbox (event_type, payload, status)
    VALUES (
        'ORDER_CANCELLED', 
        jsonb_build_object('order_id', p_order_id, 'reason', p_reason_code, 'actor_type', v_actor_type, 'actor_id', v_user_id),
        'pending'
    );

    RETURN json_build_object(
        'success', true, 
        'cancellation_id', v_cancel_id,
        'refund_status', v_refund_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
