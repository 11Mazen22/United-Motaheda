-- ============================================================
-- Central Notification Hub - Database Architecture
-- ============================================================
-- This migration creates the complete notification system:
-- - user_devices: tracks user devices for push notifications
-- - notification_templates: multilingual templates
-- - notifications: central inbox for all users
-- - notification_deliveries: delivery logs per channel
-- - notification_batches: admin broadcast management
-- ============================================================

-- ============================================================
-- 1. USER DEVICES (upgrade from notification_tokens)
-- ============================================================

-- Drop existing table if it exists (with caution)
DROP TABLE IF EXISTS notification_tokens CASCADE;

CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    app_version TEXT,
    device_model TEXT,
    os_version TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_token ON user_devices(device_token);
CREATE INDEX idx_user_devices_active ON user_devices(is_active) WHERE is_active = TRUE;

-- ============================================================
-- 2. NOTIFICATION TEMPLATES
-- ============================================================

CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    locale TEXT DEFAULT 'ar',
    subject_template TEXT, -- For email/SMS
    body_template TEXT NOT NULL,
    data_schema JSONB, -- Defines required variables
    default_priority TEXT DEFAULT 'normal' CHECK (default_priority IN ('high', 'normal', 'low')),
    default_channels TEXT[] DEFAULT ARRAY['in_app', 'push'],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO notification_templates (type, name, description, locale, body_template, data_schema, default_priority) VALUES
('order.ready', 'Order Ready', 'Order is ready for pickup', 'ar', 
 'مرحباً {{user_name}}، طلبك رقم #{{order_number}} جاهز للاستلام 🎉',
 '{"user_name": "string", "order_number": "string"}', 'high'),
('order.ready', 'Order Ready', 'Order is ready for pickup', 'en',
 'Hello {{user_name}}, your order #{{order_number}} is ready for pickup 🎉',
 '{"user_name": "string", "order_number": "string"}', 'high'),
('order.accepted', 'Order Accepted', 'Driver accepted the order', 'ar',
 '✅ تم قبول طلبك رقم #{{order_number}} بواسطة السائق {{driver_name}}',
 '{"user_name": "string", "order_number": "string", "driver_name": "string"}', 'high'),
('order.out_for_delivery', 'Out for Delivery', 'Order is on the way', 'ar',
 '🚚 طلبك رقم #{{order_number}} في الطريق إليك! السائق {{driver_name}} سيكون خلال {{eta}} دقائق',
 '{"user_name": "string", "order_number": "string", "driver_name": "string", "eta": "number"}', 'high'),
('order.delivered', 'Order Delivered', 'Order has been delivered', 'ar',
 '🎉 تم توصيل طلبك رقم #{{order_number}} بنجاح! نشكرك لتسوقك معنا',
 '{"user_name": "string", "order_number": "string"}', 'normal'),
('payment.success', 'Payment Success', 'Payment was successful', 'ar',
 '✅ تم تأكيد الدفع للطلب رقم #{{order_number}} بقيمة {{amount}}',
 '{"user_name": "string", "order_number": "string", "amount": "string"}', 'normal'),
('system.announcement', 'System Announcement', 'System wide announcement', 'ar',
 '📢 {{message}}',
 '{"message": "string"}', 'normal');

-- ============================================================
-- 3. NOTIFICATIONS (Central Inbox)
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'sms')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);

-- ============================================================
-- 4. NOTIFICATION DELIVERIES (Channel Logs)
-- ============================================================

CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'sms')),
    recipient_id UUID NOT NULL,
    device_token TEXT,
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX idx_deliveries_recipient ON notification_deliveries(recipient_id);
CREATE INDEX idx_deliveries_status ON notification_deliveries(status);

-- ============================================================
-- 5. NOTIFICATION BATCHES (Admin Blasts)
-- ============================================================

CREATE TABLE notification_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    template_type TEXT REFERENCES notification_templates(type),
    targeting JSONB NOT NULL, -- { "user_type": "customers", "branch_id": "uuid", "zone": "cairo" }
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_batches_status ON notification_batches(status);
CREATE INDEX idx_batches_created_at ON notification_batches(created_at DESC);

-- ============================================================
-- 6. HELPER FUNCTIONS
-- ============================================================

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET read_at = NOW()
    WHERE id = p_notification_id 
      AND user_id = p_user_id 
      AND read_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread count for user
CREATE OR REPLACE FUNCTION get_unread_notification_count(
    p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM notifications
    WHERE user_id = p_user_id AND read_at IS NULL;
    
    RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

-- Update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_devices_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_batches ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON notifications
    FOR UPDATE
    USING (user_id = auth.u      id());

-- Users can see only their own devices
CREATE POLICY "Users can view own devices"
    ON user_devices
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own devices"      
    ON user_devices
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own devices"
    ON user_devices
    FOR UPDATE
    USING (user_id = auth.uid());

-- Admins can see all templates
CREATE POLICY "Admins can manage templates"
    ON notification_templates
    FOR ALL
    USING (auth.role() = 'admin' OR auth.role() = 'super_admin');

-- Everyone can see active templates
CREATE POLICY "Everyone can view active templates"
    ON notification_templates
    FOR SELECT
    USING (is_active = TRUE);