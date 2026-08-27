-- =============================================================================
-- Reconstruction Stage 1b: reconcile `orders` + add delivery zone/location fields
-- Date: 2026-08-26
--
-- Part 1 documents columns confirmed live (via direct PostgREST probing —
-- `GET /rest/v1/orders?select=customer_lat,customer_lng,idempotency_key,
-- customer_address,subtotal,shipping_fee,total,discount_total,tax_total,
-- payment_method,assigned_driver_id` returned 200) but absent from every
-- tracked migration — the create-order Edge Function
-- (apps/shopper-native/supabase/functions/create-order/index.ts) has been
-- writing to these all along. ADD COLUMN IF NOT EXISTS is a no-op against
-- the live shape; this just brings the migration history back in sync.
--
-- Part 2 adds what's genuinely missing: a branch/zone reference (confirmed
-- absent — `orders.branch_id` errors with 42703 live), so every interface
-- (checkout, pharmacist, driver) can read one authoritative zone decision
-- off the order itself instead of each recomputing it independently.
-- =============================================================================

-- ─── Part 1: document already-live columns (no-op if present) ───────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name     text,
  ADD COLUMN IF NOT EXISTS customer_phone    text,
  ADD COLUMN IF NOT EXISTS customer_address  jsonb,
  ADD COLUMN IF NOT EXISTS customer_lat      numeric(9,6),
  ADD COLUMN IF NOT EXISTS customer_lng      numeric(9,6),
  ADD COLUMN IF NOT EXISTS note              text,
  ADD COLUMN IF NOT EXISTS subtotal          numeric(12,2),
  ADD COLUMN IF NOT EXISTS shipping_fee      numeric(12,2),
  ADD COLUMN IF NOT EXISTS discount_total    numeric(12,2),
  ADD COLUMN IF NOT EXISTS tax_total         numeric(12,2),
  ADD COLUMN IF NOT EXISTS idempotency_key   text,
  ADD COLUMN IF NOT EXISTS payment_method    text,
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid,
  ADD COLUMN IF NOT EXISTS last_status_at    timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

-- Idempotency was previously a SELECT-then-INSERT race in application code
-- (create-order/index.ts checks for an existing row, then inserts — two
-- near-simultaneous requests can both pass the check before either insert
-- lands). A real unique constraint makes a duplicate genuinely impossible at
-- the database level; the Edge Function's own check becomes an optimization
-- (skip a wasted insert attempt), not the actual safety mechanism.
-- Scoped to non-null keys only — historic rows before idempotency_key
-- existed, or any future manual/staff-created order without one, aren't
-- forced into the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_idempotency_key
  ON public.orders (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ─── Part 2: delivery zone — the missing link ───────────────────────────────
-- References the real Branch/DeliveryZone tables (Prisma-managed, confirmed
-- live and seeded with real polygon zones — e.g. "gardenia-zone-2km" exists
-- today) that the checkout flow currently never queries, using a hardcoded
-- static branch list and a flat delivery fee instead. text FK, not uuid:
-- Branch/DeliveryZone use Prisma's cuid() string ids, not Postgres uuids.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS branch_id              text REFERENCES public."Branch"(id),
  ADD COLUMN IF NOT EXISTS zone_id                text REFERENCES public."DeliveryZone"(id),
  ADD COLUMN IF NOT EXISTS zone_name              text,
  ADD COLUMN IF NOT EXISTS zone_base_fee          numeric(12,2),
  ADD COLUMN IF NOT EXISTS zone_surge_applied     boolean NOT NULL DEFAULT false,
  -- 'gps' | 'manual' | 'gps_corrected' — matches addresses.location_source;
  -- carried onto the order because the address row can change after the
  -- order is placed, but this snapshot must not.
  ADD COLUMN IF NOT EXISTS location_source        text
    CHECK (location_source IN ('gps', 'manual', 'gps_corrected')),
  ADD COLUMN IF NOT EXISTS location_accuracy_m    real,
  -- Structured pieces of customer_address, promoted to real columns so
  -- driver/pharmacist screens can query them directly instead of every
  -- consumer independently parsing the jsonb blob (see the three duplicated
  -- parsers found in features/orders/api.ts, features/driver/api.ts, and
  -- features/pharmacist/api/orders.ts — this migration doesn't remove those,
  -- application code will be updated separately to read from here instead).
  ADD COLUMN IF NOT EXISTS address_building       text,
  ADD COLUMN IF NOT EXISTS address_floor          text,
  ADD COLUMN IF NOT EXISTS address_apartment      text,
  ADD COLUMN IF NOT EXISTS address_landmark       text,
  ADD COLUMN IF NOT EXISTS delivery_instructions  text,
  -- Did the customer explicitly confirm the resolved address/pin before
  -- submitting, or was it auto-carried from a saved address without a fresh
  -- look? Matters for support/dispute triage.
  ADD COLUMN IF NOT EXISTS location_confirmed_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON public.orders (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_zone_id ON public.orders (zone_id) WHERE zone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON public.orders (assigned_driver_id) WHERE assigned_driver_id IS NOT NULL;

COMMENT ON COLUMN public.orders.branch_id IS
  'Which Branch fulfills this order — resolved once at checkout via resolve_delivery_zone(), stable for the order''s lifetime regardless of later Branch/DeliveryZone data changes.';
COMMENT ON COLUMN public.orders.zone_id IS
  'Which DeliveryZone (polygon) the delivery coordinate matched — the authoritative source for delivery fee and zone name across checkout, pharmacist, and driver views.';

NOTIFY pgrst, 'reload schema';
