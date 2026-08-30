-- Hardened Returns System Schema

-- 1. Clean up previous rudimentary schema
DROP TABLE IF EXISTS return_items CASCADE;
DROP TABLE IF EXISTS return_requests CASCADE;
DROP TYPE IF EXISTS return_status CASCADE;

-- 2. Define new Enums
CREATE TYPE return_status AS ENUM (
    'REQUESTED', 
    'UNDER_REVIEW', 
    'APPROVED', 
    'REJECTED', 
    'AWAITING_PICKUP', 
    'DRIVER_ASSIGNED', 
    'PICKUP_IN_PROGRESS', 
    'PICKUP_FAILED', 
    'PICKED_UP', 
    'RETURN_IN_TRANSIT', 
    'RECEIVED', 
    'INSPECTION', 
    'RETURN_REJECTED', 
    'APPROVED_FOR_REFUND', 
    'REFUND_PENDING', 
    'COMPLETED'
);

CREATE TYPE inventory_disposition AS ENUM (
    'PENDING_INSPECTION', 
    'RESTOCK', 
    'QUARANTINE', 
    'DAMAGED', 
    'EXPIRED', 
    'NON_RESELLABLE', 
    'DISPOSED'
);

CREATE TYPE return_resolution AS ENUM (
    'PHYSICAL_RETURN', 
    'REFUND_ONLY', 
    'REPLACEMENT', 
    'PARTIAL_REFUND'
);

-- Note: refund_status is currently a TEXT column in public.refunds. 
-- We will add a CHECK constraint to enforce the strict statuses without altering the type if possible, or leave it as application-level for now.
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_status_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'FAILED', 'COMPLETED', 'pending', 'succeeded', 'failed'));

-- 3. Domain Tables
CREATE TABLE return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status return_status NOT NULL DEFAULT 'REQUESTED',
    resolution_type return_resolution NOT NULL DEFAULT 'PHYSICAL_RETURN',
    idempotency_key TEXT UNIQUE,
    reason TEXT NOT NULL,
    customer_notes TEXT,
    pharmacist_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    requested_quantity NUMERIC NOT NULL CHECK (requested_quantity > 0),
    approved_quantity NUMERIC DEFAULT 0,
    received_quantity NUMERIC DEFAULT 0,
    rejected_quantity NUMERIC DEFAULT 0,
    reason_code TEXT,
    disposition inventory_disposition NOT NULL DEFAULT 'PENDING_INSPECTION',
    refund_amount NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE return_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'customer', 'driver', 'pharmacist', 'admin')),
    actor_id UUID,
    action TEXT NOT NULL,
    previous_status return_status,
    new_status return_status,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RLS Policies
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_timeline ENABLE ROW LEVEL SECURITY;

-- Customers
CREATE POLICY "Customers can view own return requests" ON return_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Customers can insert own return requests" ON return_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Customers can view own return items" ON return_items FOR SELECT TO authenticated USING (request_id IN (SELECT id FROM return_requests WHERE user_id = auth.uid()));
CREATE POLICY "Customers can insert own return items" ON return_items FOR INSERT TO authenticated WITH CHECK (request_id IN (SELECT id FROM return_requests WHERE user_id = auth.uid()));
CREATE POLICY "Customers can view own return timeline" ON return_timeline FOR SELECT TO authenticated USING (return_id IN (SELECT id FROM return_requests WHERE user_id = auth.uid()));

-- Staff
CREATE POLICY "Staff can view all returns" ON return_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'pharmacist', 'manager')));
CREATE POLICY "Staff can view all return items" ON return_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'pharmacist', 'manager')));
CREATE POLICY "Staff can view all return timelines" ON return_timeline FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'pharmacist', 'manager')));

-- Drivers
CREATE POLICY "Drivers can view assigned return requests" ON return_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.order_id = return_requests.order_id AND da.driver_id = auth.uid()));

-- 5. Triggers
CREATE TRIGGER handle_updated_at_return_requests BEFORE UPDATE ON return_requests FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
