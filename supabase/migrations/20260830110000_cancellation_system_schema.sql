-- Migration: Order Cancellation System Schema
-- Adds refunds, order status history tracking, and cancellation context to orders

-- 1. Add cancellation context to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Order Status History Table
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status order_status,
    new_status order_status NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast timeline queries
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);

-- 3. Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, succeeded, failed
    gateway_reference TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);

-- 4. Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for order_status_history
-- Customers can view their own order history
CREATE POLICY "Users can view history for their own orders" 
ON public.order_status_history FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = order_status_history.order_id 
        AND orders.user_id = auth.uid()
    )
);

-- Staff (admins, pharmacists, drivers assigned) can view history
CREATE POLICY "Staff can view order history"
ON public.order_status_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'pharmacist', 'manager')
    ) OR EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_status_history.order_id
        AND orders.assigned_driver_id = auth.uid()
    )
);

-- Edge functions / Service role handles inserts, no INSERT policy for anon/authenticated

-- 6. RLS Policies for refunds
-- Customers can view their own refunds
CREATE POLICY "Users can view their own refunds"
ON public.refunds FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = refunds.order_id 
        AND orders.user_id = auth.uid()
    )
);

-- Staff can view refunds
CREATE POLICY "Staff can view refunds"
ON public.refunds FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'pharmacist', 'manager')
    )
);

-- 7. Trigger to auto-log status changes
-- Instead of relying solely on the application layer, a DB trigger guarantees 
-- we never miss a status change.
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.order_status_history (
            order_id, 
            previous_status, 
            new_status, 
            actor_id,
            reason
        ) VALUES (
            NEW.id, 
            OLD.status, 
            NEW.status, 
            coalesce(NEW.cancelled_by, auth.uid()), -- Use cancelled_by if set, else current user
            CASE WHEN NEW.status = 'cancelled' THEN NEW.cancellation_reason ELSE NULL END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_order_status_change ON public.orders;
CREATE TRIGGER trigger_log_order_status_change
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.log_order_status_change();
