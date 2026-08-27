-- =============================================================================
-- Reconstruction Stage 1a: reconcile the `addresses` table with reality
-- Date: 2026-08-26
--
-- Audit finding: apps/shopper-native/src/features/addresses/api.ts has queried
-- `public.addresses` all along and it works (confirmed live via a direct
-- PostgREST probe: `GET /rest/v1/addresses?select=*` returns 200), but no
-- CREATE TABLE for it exists in ANY tracked migration file (checked
-- apps/shopper-native/supabase/migrations, supabase/migrations, and
-- database/*.sql). It was created out-of-band (Supabase Studio) and never
-- migrated. This file brings the migration history back in sync with the
-- live table (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
-- throughout — a no-op against the already-live shape) and adds the two
-- fields the live table is missing relative to the product spec:
-- `governorate` and `delivery_instructions`.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.addresses (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label          text        NOT NULL DEFAULT 'home',
  recipient_name text        NOT NULL DEFAULT '',
  phone          text        NOT NULL DEFAULT '',
  city           text        NOT NULL DEFAULT '',
  district       text        NOT NULL DEFAULT '',
  street         text        NOT NULL DEFAULT '',
  building       text        NOT NULL DEFAULT '',
  floor          text,
  apartment      text,
  landmark       text,
  lat            double precision,
  lng            double precision,
  is_default     boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- New fields the live table doesn't have yet — nullable, so this is additive
-- and safe against however many rows already exist.
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS governorate           text,
  ADD COLUMN IF NOT EXISTS delivery_instructions  text,
  -- GPS accuracy at capture time, in meters — lets the app/driver judge how
  -- much to trust `lat`/`lng` versus the human-entered fields.
  ADD COLUMN IF NOT EXISTS location_accuracy_m    real,
  -- 'gps' | 'manual' | 'gps_corrected' — how these coordinates were obtained,
  -- so downstream consumers (checkout, driver) know whether lat/lng came
  -- from the device or were typed/dragged by the customer.
  ADD COLUMN IF NOT EXISTS location_source        text
    CHECK (location_source IN ('gps', 'manual', 'gps_corrected'));

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_default ON public.addresses (user_id) WHERE is_default;

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS addresses_owner_all ON public.addresses;
CREATE POLICY addresses_owner_all
  ON public.addresses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.addresses_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_addresses_updated_at ON public.addresses;
CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.addresses_set_updated_at();

-- Only one default address per user — enforced at the DB level rather than
-- trusted to client logic (setDefault() in the client currently unsets
-- others manually; this constraint makes that a guarantee, not a convention).
-- Defensively clear any pre-existing double-defaults first (possible if a
-- client race ever set two rows before this constraint existed) so the
-- unique index below can't fail to create against live data.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC) AS rn
  FROM public.addresses
  WHERE is_default
)
UPDATE public.addresses a
SET is_default = false
FROM ranked
WHERE a.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_addresses_one_default_per_user
  ON public.addresses (user_id) WHERE is_default;

COMMENT ON TABLE public.addresses IS
  'Customer saved delivery addresses. Was live and in active use before this migration existed — this file documents the real shape rather than introducing a new one. Orders never reference this table by FK (see orders.customer_address); it is the mutable address book, not the immutable per-order snapshot.';

NOTIFY pgrst, 'reload schema';
