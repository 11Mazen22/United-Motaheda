-- Add execute_order_cancellation RPC

CREATE OR REPLACE FUNCTION execute_order_cancellation(
    p_order_id UUID,
    p_actor_type TEXT,
    p_actor_id UUID,
    p_reason_code TEXT,
    p_note TEXT,
    p_idempotency_key TEXT
) RETURNS JSON AS $$
DECLARE
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

    -- 3. Policy Validation
    v_actions := public.get_order_actions(p_order_id);
    v_can_cancel := (v_actions->>'canCancel')::BOOLEAN;

    -- Admins/System can force bypass, but for this strict machine, everyone adheres or we add a force flag.
    -- For now, if it's already cancelled, we block it. If it's delivered/out for delivery, we block.
    IF NOT v_can_cancel AND p_actor_type != 'admin' THEN
        RAISE EXCEPTION 'Order cannot be cancelled: %', v_actions->>'cancellationMessage';
    END IF;

    -- 4. Financials (Refund state machine integration)
    -- Evaluate payment status
    IF v_order.payment_status = 'captured' OR v_order.payment_status = 'verified' THEN
        v_refund_status := 'PENDING';
        v_refund_amount := v_order.total;
    ELSIF v_order.payment_status = 'authorized' THEN
        v_refund_status := 'PROCESSING'; -- Represents Voiding
        v_refund_amount := v_order.total;
    END IF;

    -- 5. Insert Cancellation Record
    INSERT INTO public.cancellations (
        order_id, actor_type, actor_id, reason_code, note, 
        previous_status, refund_status, refund_amount, idempotency_key
    ) VALUES (
        p_order_id, p_actor_type, p_actor_id, p_reason_code, p_note, 
        v_order.status, v_refund_status, v_refund_amount, p_idempotency_key
    ) RETURNING id INTO v_cancel_id;

    -- 6. Update Order Status
    UPDATE public.orders SET 
        status = 'cancelled',
        cancellation_reason = p_reason_code,
        cancelled_by = p_actor_id,
        cancelled_at = NOW()
    WHERE id = p_order_id;

    -- 7. Driver Assignment Cleanup
    -- Supersede or mark any active assignments as cancelled
    UPDATE public.delivery_assignments 
    SET response_status = 'superseded', superseded_at = NOW(), decline_reason = 'Order Cancelled'
    WHERE order_id = p_order_id AND response_status IN ('offered', 'accepted');

    -- 8. Inventory Cleanup
    -- Find active reservations for this order and release them safely
    FOR v_res IN 
        SELECT id FROM public.inventory_reservations 
        WHERE order_id = p_order_id::text AND state IN ('reserved', 'committed')
    LOOP
        -- Rely on the existing release_inventory logic safely
        PERFORM public.release_inventory(
            v_res.id,
            'ORDER_CANCELLED',
            p_idempotency_key || '-inv-' || v_res.id::text
        );
    END LOOP;

    -- 9. Trigger Refund If Needed
    IF v_refund_status = 'PENDING' THEN
        INSERT INTO public.refunds (
            order_id, amount, status, reason, created_by, idempotency_key, gateway_reference
        ) VALUES (
            p_order_id, v_refund_amount, 'pending', p_reason_code, p_actor_id, p_idempotency_key || '-refund', v_order.payment_reference
        );
    END IF;

    -- (Logging happens via trigger on orders status update)

    RETURN json_build_object(
        'success', true, 
        'cancellation_id', v_cancel_id,
        'refund_status', v_refund_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
