-- Returns System Schema

CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA extensions;

CREATE TYPE return_status AS ENUM ('pending_review', 'approved', 'rejected', 'driver_assigned', 'picked_up', 'completed');

CREATE TABLE return_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    status return_status NOT NULL DEFAULT 'pending_review',
    reason TEXT NOT NULL,
    customer_notes TEXT,
    pharmacist_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0)
);

-- RLS
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

-- Customers can view and insert their own returns
CREATE POLICY "Customers can view own return requests"
    ON return_requests FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Customers can insert own return requests"
    ON return_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Customers can view own return items"
    ON return_items FOR SELECT
    TO authenticated
    USING (
        request_id IN (
            SELECT id FROM return_requests WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Customers can insert own return items"
    ON return_items FOR INSERT
    TO authenticated
    WITH CHECK (
        request_id IN (
            SELECT id FROM return_requests WHERE user_id = auth.uid()
        )
    );

-- Staff can view and manage all returns
CREATE POLICY "Staff can view all return requests"
    ON return_requests FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'pharmacist', 'manager')
        )
    );

CREATE POLICY "Staff can update all return requests"
    ON return_requests FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'pharmacist', 'manager')
        )
    );

CREATE POLICY "Staff can view all return items"
    ON return_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'pharmacist', 'manager')
        )
    );

-- Also allow drivers to view return requests if assigned
CREATE POLICY "Drivers can view assigned return requests"
    ON return_requests FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM delivery_assignments da
            WHERE da.order_id = return_requests.order_id
            AND da.driver_id = auth.uid()
        )
    );

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at_return_requests
    BEFORE UPDATE ON return_requests
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime (updated_at);
