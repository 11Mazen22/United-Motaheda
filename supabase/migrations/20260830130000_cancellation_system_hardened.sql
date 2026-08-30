-- Hardened Order Cancellation Schema

-- 1. Create Cancellations Table
CREATE TABLE IF NOT EXISTS public.cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'pharmacist', 'driver', 'admin', 'system')),
    actor_id UUID REFERENCES auth.users(id),
    reason_code TEXT NOT NULL,
    note TEXT,
    previous_status public.order_status,
    refund_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (refund_status IN ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    refund_amount NUMERIC(12,2) DEFAULT 0,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_cancellations_order UNIQUE(order_id)
);

ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own cancellations" ON public.cancellations FOR SELECT TO authenticated
USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

CREATE POLICY "Staff can view all cancellations" ON public.cancellations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'pharmacist', 'manager')));

-- 2. Get Order Actions RPC
CREATE OR REPLACE FUNCTION get_order_actions(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
    v_order RECORD;
    v_can_cancel BOOLEAN := false;
    v_cancel_msg TEXT := NULL;
    v_can_return BOOLEAN := false;
    v_return_msg TEXT := NULL;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN json_build_object('canCancel', false, 'canRequestReturn', false);
    END IF;

    -- Cancellation Logic
    IF v_order.status IN ('pending', 'confirmed', 'pharmacy_review', 'payment_pending', 'payment_approved', 'preparing', 'ready') THEN
        v_can_cancel := true;
    ELSIF v_order.status = 'cancelled' THEN
        v_can_cancel := false;
        v_cancel_msg := 'Order is already cancelled.';
    ELSE
        -- picked_up, out_for_delivery, delivered
        v_can_cancel := false;
        v_cancel_msg := 'Order is already out for delivery or delivered. Cancellation is no longer possible.';
    END IF;

    -- Return Logic
    IF v_order.status = 'delivered' THEN
        v_can_return := true;
    ELSE
        v_can_return := false;
        v_return_msg := 'Returns are only available for delivered orders.';
    END IF;

    RETURN json_build_object(
        'canCancel', v_can_cancel,
        'cancellationMessage', v_cancel_msg,
        'canRequestReturn', v_can_return,
        'returnMessage', v_return_msg
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
