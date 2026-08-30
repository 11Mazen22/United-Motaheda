-- State Machine for Return Transitions

CREATE OR REPLACE FUNCTION transition_return_status(
    p_request_id UUID,
    p_new_status return_status,
    p_actor_type TEXT,
    p_actor_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSON AS $$
DECLARE
    v_req RECORD;
    v_order RECORD;
    v_total_refund NUMERIC := 0;
    v_item RECORD;
BEGIN
    -- 1. Lock the return request
    SELECT * INTO v_req FROM return_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;

    -- 2. Basic validation: Do not allow transitioning to the same state
    IF v_req.status = p_new_status THEN
        RETURN json_build_object('success', true, 'status', p_new_status, 'note', 'Already in this state');
    END IF;

    -- 3. Load order
    SELECT * INTO v_order FROM orders WHERE id = v_req.order_id;

    -- 4. State Machine Guards
    -- Examples of enforcement:
    IF v_req.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Cannot transition from COMPLETED';
    END IF;

    IF p_new_status = 'APPROVED_FOR_REFUND' THEN
        -- Only transition here from INSPECTION or APPROVED (if REFUND_ONLY)
        IF v_req.status NOT IN ('INSPECTION', 'APPROVED') THEN
            RAISE EXCEPTION 'Must inspect items before approving refund';
        END IF;

        -- Calculate final refund amount based on approved_quantity
        FOR v_item IN SELECT ri.id, ri.approved_quantity, oi.unit_price, oi.line_total 
                      FROM return_items ri 
                      JOIN order_items oi ON ri.order_item_id = oi.id 
                      WHERE ri.request_id = p_request_id
        LOOP
            -- For simplicity, refund_amount = approved * unit_price 
            -- (In a real system, you'd distribute order-level discounts here)
            UPDATE return_items 
            SET refund_amount = v_item.approved_quantity * v_item.unit_price
            WHERE id = v_item.id;

            v_total_refund := v_total_refund + (v_item.approved_quantity * v_item.unit_price);
        END LOOP;

        -- If physical return, ensure all items have a disposition other than PENDING_INSPECTION
        IF v_req.resolution_type = 'PHYSICAL_RETURN' THEN
            IF EXISTS (SELECT 1 FROM return_items WHERE request_id = p_request_id AND disposition = 'PENDING_INSPECTION') THEN
                RAISE EXCEPTION 'All items must have a disposition before refund approval';
            END IF;
        END IF;
    END IF;

    IF p_new_status = 'REFUND_PENDING' THEN
        -- Insert into refunds table
        SELECT SUM(refund_amount) INTO v_total_refund FROM return_items WHERE request_id = p_request_id;
        IF v_total_refund > 0 THEN
            INSERT INTO refunds (order_id, amount, status, reason, created_by, idempotency_key)
            VALUES (v_req.order_id, v_total_refund, 'PENDING', p_reason, p_actor_id, 'return-' || p_request_id);
        END IF;
    END IF;

    IF p_new_status = 'COMPLETED' THEN
        -- Process inventory RESTOCK
        FOR v_item IN SELECT ri.product_id, ri.received_quantity, ri.disposition 
                      FROM return_items ri 
                      WHERE ri.request_id = p_request_id AND ri.disposition = 'RESTOCK'
        LOOP
            -- adjust_inventory RPC must exist, or we can just update products directly if this is a simple schema
            UPDATE products 
            SET "Stock" = "Stock" + v_item.received_quantity 
            WHERE id = v_item.product_id::uuid OR "Code" = v_item.product_id OR "Barcode" = v_item.product_id;
        END LOOP;
    END IF;

    -- 5. Update Status
    UPDATE return_requests SET status = p_new_status WHERE id = p_request_id;

    -- 6. Insert Audit Timeline
    INSERT INTO return_timeline (return_id, order_id, actor_type, actor_id, action, previous_status, new_status, reason, metadata)
    VALUES (p_request_id, v_req.order_id, p_actor_type, p_actor_id, 'status_transition', v_req.status, p_new_status, p_reason, p_metadata);

    RETURN json_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
