-- Phase 1: Centralized Notification Hub Schema
-- Upgrades the existing notification system to support multi-channel, templating, and batching.

-- 1. user_devices: Enhanced token management (replaces/augments notification_tokens)
CREATE TABLE IF NOT EXISTS public.user_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id text NOT NULL,
    push_token text NOT NULL,
    platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    app_version text,
    is_active boolean NOT NULL DEFAULT true,
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS user_devices_user_id_active_idx ON public.user_devices (user_id) WHERE is_active = true;

-- 2. notification_templates: Multilingual templates with Handlebars-style variables
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    supported_channels text[] NOT NULL DEFAULT '{push,in_app}',
    required_data_keys text[] NOT NULL DEFAULT '{}',
    default_priority text NOT NULL DEFAULT 'normal' CHECK (default_priority IN ('low', 'normal', 'high')),
    title_ar text NOT NULL,
    body_ar text NOT NULL,
    title_en text NOT NULL,
    body_en text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. notifications: The central Inbox for all users (In-App)
CREATE TABLE IF NOT EXISTS public.inbox_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- ON DELETE RESTRICT, not CASCADE: this FK points at a *template*
    -- (configuration), while this table holds each recipient's historical
    -- record of what they were actually sent. A template getting cleaned up
    -- or renamed must never silently wipe out real delivery history for
    -- every user who received that type -- RESTRICT forces whoever deletes
    -- a template to deal with its history on purpose (retype it, archive
    -- these rows, or leave the template in place) instead of losing it by
    -- accident.
    type text NOT NULL REFERENCES public.notification_templates(type) ON DELETE RESTRICT,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    priority text NOT NULL DEFAULT 'normal',
    status text NOT NULL DEFAULT 'delivered',
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- For idempotency
    event_id text,
    UNIQUE (recipient_id, type, event_id)
);

CREATE INDEX IF NOT EXISTS inbox_notifications_recipient_idx ON public.inbox_notifications (recipient_id, created_at DESC);

-- 4. notification_deliveries: Detailed logs per channel
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid REFERENCES public.inbox_notifications(id) ON DELETE SET NULL,
    recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id uuid REFERENCES public.user_devices(id) ON DELETE SET NULL,
    channel text NOT NULL CHECK (channel IN ('push', 'in_app', 'email', 'sms')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
    provider_message_id text,
    error_code text,
    error_message text,
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx ON public.notification_deliveries (status);

-- 5. notification_batches: Handling Admin blasts
CREATE TABLE IF NOT EXISTS public.notification_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid NOT NULL REFERENCES auth.users(id),
    target_audience text NOT NULL,
    template_type text REFERENCES public.notification_templates(type),
    custom_title text,
    custom_body text,
    channels text[] NOT NULL DEFAULT '{push,in_app}',
    total_recipients integer NOT NULL DEFAULT 0,
    processed_count integer NOT NULL DEFAULT 0,
    failed_count integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

-- RLS Policies
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_batches ENABLE ROW LEVEL SECURITY;

-- Allow users to read/update their own devices
CREATE POLICY user_devices_owner ON public.user_devices FOR ALL USING (auth.uid() = user_id);

-- Allow users to read their own inbox
CREATE POLICY inbox_notifications_select ON public.inbox_notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY inbox_notifications_update ON public.inbox_notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- Everyone can read templates
CREATE POLICY notification_templates_select ON public.notification_templates FOR SELECT USING (true);

-- Nothing above grants staff visibility into any of these tables -- every
-- one of them was enabled for RLS with either no policy at all
-- (notification_deliveries, notification_batches) or a recipient-only
-- policy (inbox_notifications), which silently returns zero rows to an
-- admin/manager client query rather than an error (the same failure class
-- documented elsewhere in this project's history: a query that "just
-- shows nothing" instead of visibly failing). Nothing in the app queries
-- these three from a client yet, so this isn't live-broken today, but
-- there is no reason to leave the landmine for whoever builds the admin
-- monitoring UI this schema is clearly meant to support.
CREATE POLICY inbox_notifications_manager_select ON public.inbox_notifications FOR SELECT USING (public.is_manager());
CREATE POLICY notification_deliveries_manager_select ON public.notification_deliveries FOR SELECT USING (public.is_manager());
CREATE POLICY notification_batches_manager_all ON public.notification_batches FOR ALL USING (public.is_manager()) WITH CHECK (public.is_manager());
