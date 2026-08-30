-- Request Return RPC

CREATE OR REPLACE FUNCTION request_return(
    p_order_id UUID,
    p_reason TEXT,
    p_resolution_type return_resolution,
    p_idempotency_key TEXT,
    p_items JSONB -- Array of { order_item_id: BIGINT, quantity: NUMERIC }
) RETURNS JSON AS $$
DECLARE
    v_req_id UUID;
    v_item JSONB;
    v_oi RECORD;
    v_already_returned NUMERIC;
    v_eligibility JSON;
    v_is_eligible BOOLEAN;
BEGIN
    -- 1. Check idempotency
    SELECT id INTO v_req_id FROM return_requests WHERE idempotency_key = p_idempotency_key AND user_id = auth.uid();
    IF FOUND THEN
        RETURN json_build_object('success', true, 'request_id', v_req_id, 'note', 'Recovered from idempotency key');
    END IF;

    -- 2. Validate Eligibility Atomically
    v_eligibility := get_return_eligibility(p_order_id);
    v_is_eligible := (v_eligibility->>'eligible')::BOOLEAN;

    IF NOT v_is_eligible THEN
        RAISE EXCEPTION 'Order is not eligible for return: %', v_eligibility->>'reason';
    END IF;

    -- 3. Create Request
    INSERT INTO return_requests (order_id, user_id, status, resolution_type, idempotency_key, reason)
    VALUES (p_order_id, auth.uid(), 'REQUESTED', p_resolution_type, p_idempotency_key, p_reason)
    RETURNING id INTO v_req_id;

    -- 4. Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Re-verify specific item
        SELECT oi.id, oi.quantity INTO v_oi
        FROM order_items oi WHERE oi.id = (v_item->>'order_item_id')::BIGINT AND oi.order_id = p_order_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Order item % not found', v_item->>'order_item_id';
        END IF;

        SELECT COALESCE(SUM(requested_quantity), 0)
        INTO v_already_returned
        FROM return_items ri
        JOIN return_requests rr ON ri.request_id = rr.id
        WHERE ri.order_item_id = v_oi.id
          AND rr.status NOT IN ('REJECTED', 'RETURN_REJECTED');

        IF v_already_returned + (v_item->>'quantity')::NUMERIC > v_oi.quantity THEN
            RAISE EXCEPTION 'Requested quantity exceeds available returnable quantity for item %', v_oi.id;
        END IF;

        INSERT INTO return_items (request_id, order_item_id, requested_quantity, reason_code)
        VALUES (v_req_id, v_oi.id, (v_item->>'quantity')::NUMERIC, 'CUSTOMER_REQUEST');
    END LOOP;

    -- 5. Audit
    INSERT INTO return_timeline (return_id, order_id, actor_type, actor_id, action, new_status, reason)
    VALUES (v_req_id, p_order_id, 'customer', auth.uid(), 'return_requested', 'REQUESTED', p_reason);

    RETURN json_build_object('success', true, 'request_id', v_req_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
