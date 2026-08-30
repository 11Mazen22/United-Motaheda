-- Return Eligibility RPC

CREATE OR REPLACE FUNCTION get_return_eligibility(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_items JSON := '[]'::JSON;
    v_is_eligible BOOLEAN := true;
    v_order_reason TEXT := NULL;
    v_return_window_days INT := 14; -- Configurable policy
    v_already_returned NUMERIC;
    v_item_eligible BOOLEAN;
    v_item_reason TEXT;
BEGIN
    -- 1. Load the order
    SELECT status, delivered_at 
    INTO v_order
    FROM orders
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN json_build_object('eligible', false, 'reason', 'Order not found', 'items', '[]'::JSON);
    END IF;

    -- 2. Check basic order status
    IF v_order.status != 'delivered' THEN
        v_is_eligible := false;
        v_order_reason := 'Order must be delivered to be returned';
    END IF;

    -- 3. Check return window
    IF v_order.delivered_at IS NULL THEN
        v_is_eligible := false;
        v_order_reason := 'Delivery timestamp is missing';
    ELSIF v_order.delivered_at + (v_return_window_days || ' days')::INTERVAL < NOW() THEN
        v_is_eligible := false;
        v_order_reason := 'Return window (' || v_return_window_days || ' days) has expired';
    END IF;

    -- 4. Check each item
    FOR v_item IN 
        SELECT oi.id, oi.product_id, oi.quantity, p.requires_prescription 
        FROM order_items oi
        LEFT JOIN products p ON (oi.product_id = p.id::text OR oi.product_id = p."Code" OR oi.product_id = p."Barcode")
        WHERE oi.order_id = p_order_id
    LOOP
        v_item_eligible := true;
        v_item_reason := NULL;

        -- Sum requested quantities for active returns
        SELECT COALESCE(SUM(requested_quantity), 0)
        INTO v_already_returned
        FROM return_items ri
        JOIN return_requests rr ON ri.request_id = rr.id
        WHERE ri.order_item_id = v_item.id
          AND rr.status NOT IN ('REJECTED', 'RETURN_REJECTED');

        IF v_already_returned >= v_item.quantity THEN
            v_item_eligible := false;
            v_item_reason := 'Fully returned or requested';
        END IF;

        IF v_item.requires_prescription THEN
            v_item_eligible := false;
            v_item_reason := 'Prescription items cannot be returned (requires support review)';
        END IF;

        v_items := v_items || json_build_object(
            'order_item_id', v_item.id,
            'product_id', v_item.product_id,
            'purchased_quantity', v_item.quantity,
            'already_returned', v_already_returned,
            'available_quantity', GREATEST(0, v_item.quantity - v_already_returned),
            'eligible', v_item_eligible,
            'reason', v_item_reason
        )::JSONB;
    END LOOP;

    RETURN json_build_object(
        'eligible', v_is_eligible,
        'reason', v_order_reason,
        'items', v_items
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
