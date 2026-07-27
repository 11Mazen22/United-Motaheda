-- Migration: sms_marketing — 2026-07-28
--
-- Adds marketing consent to profiles, and creates the sms_campaigns,
-- sms_campaign_recipients, and sms_audit_log tables for the admin
-- SMS marketing tool (Part 3).
--
-- Design decisions:
--
--   marketing_consent — opt-in flag on profiles. Defaults to false.
--     Used by the targeting query to filter eligible users.
--
--   sms_campaigns — one row per campaign. Tracks status lifecycle:
--     draft → queued → running → completed | failed | cancelled.
--     batch_size is locked to 100 or 200 at creation time (enforced by
--     CHECK constraint). message_template is the raw SMS body.
--
--   sms_campaign_recipients — one row per (campaign, user) pair.
--     status: pending → sending → sent | failed | cancelled.
--     batch_index groups recipients into ordered batches for the worker.
--     sent_at / failed_at are timestamps for audit.
--     error_message stores the SMS provider error code/message on failure.
--     Unique on (campaign_id, user_id) — prevents double-sending.
--
--   sms_audit_log — append-only immutable log of every significant campaign
--     event (created, queued, batch_sent, batch_failed, completed, cancelled).
--     Never deleted, never updated. For compliance and debugging.
--
--   get_marketing_targets RPC — returns paginated users who:
--     • have role = 'customer'
--     • have zero completed orders (status not in cancelled/archived/pending)
--     • optionally filter by marketing_consent
--     • supports name/phone search and sort
--     Used exclusively by the admin marketing page.

-- ─── marketing_consent on profiles ───────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.marketing_consent IS
  'User has opted-in to receive marketing SMS. Set via profile settings or
   import. Required = true for SMS campaigns (enforced by get_marketing_targets
   RPC filter when consent_only = true).';

CREATE INDEX IF NOT EXISTS profiles_marketing_consent_idx
  ON public.profiles (marketing_consent)
  WHERE marketing_consent = true;

-- ─── sms_campaigns ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  message_template text        NOT NULL CHECK (char_length(trim(message_template)) BETWEEN 5 AND 480),
  -- Locked batch size: 100 or 200. No other values permitted.
  batch_size       integer     NOT NULL CHECK (batch_size IN (100, 200)),
  -- Total recipients selected at campaign creation (immutable after queued).
  total_recipients integer     NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  -- Running counters updated by the worker.
  sent_count       integer     NOT NULL DEFAULT 0,
  failed_count     integer     NOT NULL DEFAULT 0,
  -- Lifecycle: draft → queued → running → completed | failed | cancelled
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','queued','running','completed','failed','cancelled')),
  -- Rate limiting: minimum seconds between batches (default 60 s).
  rate_limit_secs  integer     NOT NULL DEFAULT 60 CHECK (rate_limit_secs >= 10),
  -- The admin who created this campaign.
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  queued_at        timestamptz,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_campaigns_status_idx
  ON public.sms_campaigns (status, created_at DESC);

ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_campaigns: manager all"
  ON public.sms_campaigns FOR ALL
  USING (public.is_manager()) WITH CHECK (public.is_manager());

-- ─── sms_campaign_recipients ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sms_campaign_recipients (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid        NOT NULL REFERENCES public.sms_campaigns(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone          text        NOT NULL,
  full_name      text        NOT NULL DEFAULT '',
  -- batch_index: 0-based batch number this recipient belongs to.
  -- Recipients are assigned to batches in order of selection at campaign creation.
  batch_index    integer     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  sent_at        timestamptz,
  failed_at      timestamptz,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS sms_recipients_campaign_status_idx
  ON public.sms_campaign_recipients (campaign_id, status, batch_index);

CREATE INDEX IF NOT EXISTS sms_recipients_campaign_batch_idx
  ON public.sms_campaign_recipients (campaign_id, batch_index, id);

ALTER TABLE public.sms_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_campaign_recipients: manager all"
  ON public.sms_campaign_recipients FOR ALL
  USING (public.is_manager()) WITH CHECK (public.is_manager());

-- ─── sms_audit_log ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sms_audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid        REFERENCES public.sms_campaigns(id) ON DELETE SET NULL,
  event        text        NOT NULL,  -- 'created'|'queued'|'batch_started'|'batch_completed'|'completed'|'failed'|'cancelled'
  actor_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  batch_index  integer,               -- populated for batch events
  detail       jsonb,                 -- arbitrary structured context
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_audit_log_campaign_idx
  ON public.sms_audit_log (campaign_id, created_at DESC);

ALTER TABLE public.sms_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_audit_log: manager read"
  ON public.sms_audit_log FOR SELECT
  USING (public.is_manager());

-- Worker (service-role) inserts via adminClient — no authenticated insert policy needed.

-- ─── get_marketing_targets RPC ───────────────────────────────────────────────
--
-- Returns paginated users eligible for SMS campaigns:
--   • role = 'customer'
--   • zero completed orders (derived; not a stored column)
--   • optionally filtered by marketing_consent = true
--   • supports full-text search on name / phone
--   • supports sort: name_asc | name_desc | registered_asc | registered_desc
--
-- Returns a JSON object: { users: [...], total_count: number }
-- so the client gets both the page and the total for pagination in one call.
--
-- SECURITY DEFINER — only callable by authenticated users; is_manager() is
-- enforced inside the function body for defence-in-depth.

DROP FUNCTION IF EXISTS public.get_marketing_targets(
  integer, integer, text, text, boolean, text
);

CREATE OR REPLACE FUNCTION public.get_marketing_targets(
  p_page          integer  DEFAULT 1,
  p_page_size     integer  DEFAULT 50,
  p_search        text     DEFAULT NULL,
  p_sort          text     DEFAULT 'registered_desc',
  p_consent_only  boolean  DEFAULT false,
  p_status_filter text     DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset     integer := greatest(0, p_page - 1) * greatest(1, least(p_page_size, 200));
  v_limit      integer := greatest(1, least(p_page_size, 200));
  v_search     text    := nullif(btrim(coalesce(p_search, '')), '');
  v_result     jsonb;
BEGIN
  -- Authorization: only managers may call this function.
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  WITH candidates AS (
    SELECT
      p.id,
      p.full_name,
      p.phone,
      p.email,
      p.created_at                                  AS registered_at,
      p.marketing_consent,
      p.status                                      AS account_status,
      -- Derive completed order count at query time — no stale cached value.
      count(o.id) FILTER (
        WHERE o.status NOT IN ('cancelled', 'archived', 'pending', 'pending_payment')
      )                                             AS completed_order_count
    FROM public.profiles p
    LEFT JOIN public.orders o ON o.user_id = p.id
    WHERE
      p.role = 'customer'
      -- Search filter: matches full_name or phone (case-insensitive prefix/contain).
      AND (
        v_search IS NULL
        OR p.full_name ILIKE '%' || v_search || '%'
        OR p.phone     ILIKE '%' || v_search || '%'
      )
      -- Consent filter.
      AND (NOT p_consent_only OR p.marketing_consent = true)
    GROUP BY p.id
  ),
  filtered AS (
    SELECT *
    FROM candidates
    WHERE
      -- Zero-order filter: the whole point of the marketing tool.
      completed_order_count = 0
      -- Optional status filter for account_status column.
      AND (p_status_filter = 'all' OR account_status = p_status_filter)
  ),
  counted AS (
    SELECT count(*) AS total FROM filtered
  ),
  paged AS (
    SELECT
      f.id,
      f.full_name,
      f.phone,
      f.email,
      f.registered_at,
      f.marketing_consent,
      f.account_status,
      f.completed_order_count
    FROM filtered f
    ORDER BY
      CASE WHEN p_sort = 'name_asc'          THEN lower(f.full_name) END ASC  NULLS LAST,
      CASE WHEN p_sort = 'name_desc'         THEN lower(f.full_name) END DESC NULLS LAST,
      CASE WHEN p_sort = 'registered_asc'    THEN f.registered_at   END ASC  NULLS LAST,
      CASE WHEN p_sort = 'registered_desc'   THEN f.registered_at   END DESC NULLS LAST,
      f.id ASC
    LIMIT  v_limit
    OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'users',       coalesce(jsonb_agg(row_to_json(paged.*)), '[]'::jsonb),
    'total_count', (SELECT total FROM counted)
  )
  INTO v_result
  FROM paged;

  RETURN coalesce(v_result, jsonb_build_object('users', '[]'::jsonb, 'total_count', 0));
END;
$$;

REVOKE ALL ON FUNCTION public.get_marketing_targets(integer, integer, text, text, boolean, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_marketing_targets(integer, integer, text, text, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
