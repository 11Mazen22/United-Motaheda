-- Migration: coupons + coupon_redemptions — 2026-07-28
--
-- Implements a first-class server-side coupon system to replace the
-- client-side UNITED10 hard-code in pricing.ts.
--
-- Design decisions:
--
--   coupon_batches  — optional campaign grouping (referenced by the permanent
--                     user-deletion anonymisation migration already in prod).
--   coupons         — one row per coupon code. discount_type mirrors the
--                     promotions table convention (percentage / fixed_amount).
--                     first_order_only enforces the "zero prior orders" rule.
--                     max_redemptions NULL = unlimited.
--   coupon_redemptions — append-only; one row per redemption. Unique on
--                     (coupon_id, user_id) so a user cannot redeem the same
--                     coupon twice regardless of race conditions.
--
--   validate_coupon RPC — SECURITY DEFINER, read-only, returns a typed JSON
--   object that the Edge Function mirrors. Called only by the native client
--   to preview a discount BEFORE order submission; the actual redemption row
--   is written inside the create-order Edge Function (service-role) after the
--   order is committed, so the redemption is always atomic with the order.
--
--   first_order_only enforcement:
--     A user's order count is derived from orders WHERE status NOT IN
--     ('cancelled', 'archived') to exclude failed/void orders. This matches
--     the natural business intent: a cancelled test order should not consume
--     the first-order slot.

-- ─── coupon_batches ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupon_batches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  description text,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupon_batches: manager all" ON public.coupon_batches;
CREATE POLICY "coupon_batches: manager all"
  ON public.coupon_batches FOR ALL
  USING (public.is_manager()) WITH CHECK (public.is_manager());

-- ─── coupons ──────────────────────────────────────────────────────────────────

-- ─── coupons ──────────────────────────────────────────────────────────────────
-- Drop and recreate: the remote table exists from a prior incomplete migration
-- and is missing core columns (discount_type, discount_value, is_active, etc.).
-- It contains no production data (no coupon_redemptions rows reference it) so
-- a clean drop+recreate is safe and avoids complex ALTER column logic.

DROP TABLE IF EXISTS public.coupons CASCADE;

CREATE TABLE public.coupons (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text        NOT NULL
                               CHECK (char_length(trim(code)) BETWEEN 2 AND 64),
  batch_id         uuid        REFERENCES public.coupon_batches(id) ON DELETE SET NULL,
  discount_type    text        NOT NULL
                               CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value   numeric(12,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount numeric(12,2)             DEFAULT NULL,
  max_redemptions  integer                   DEFAULT NULL CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  per_user_limit   integer      NOT NULL     DEFAULT 1 CHECK (per_user_limit > 0),
  first_order_only boolean      NOT NULL     DEFAULT false,
  is_active        boolean      NOT NULL     DEFAULT true,
  expires_at       timestamptz               DEFAULT NULL,
  created_by       uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz  NOT NULL     DEFAULT now(),
  updated_at       timestamptz  NOT NULL     DEFAULT now()
);

-- Enforce case-insensitive uniqueness on the code column so 'first100' and
-- 'FIRST100' are the same coupon. The validate_coupon RPC normalises the
-- incoming code with upper() before lookup.
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_idx
  ON public.coupons (upper(trim(code)));

CREATE INDEX IF NOT EXISTS coupons_batch_idx
  ON public.coupons (batch_id);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons: authenticated read active" ON public.coupons;
CREATE POLICY "coupons: authenticated read active"
  ON public.coupons FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

DROP POLICY IF EXISTS "coupons: manager all" ON public.coupons;
CREATE POLICY "coupons: manager all"
  ON public.coupons FOR ALL
  USING (public.is_manager()) WITH CHECK (public.is_manager());

-- ─── coupon_redemptions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   uuid        NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id    uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- Discount amount applied at time of redemption (snapshot — coupon may
  -- change after the fact, but the applied discount is immutable).
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  redeemed_at timestamptz NOT NULL DEFAULT now(),

  -- Each user can only redeem a given coupon once (per_user_limit=1 default).
  -- Per-user limits > 1 are enforced inside the validate_coupon RPC by
  -- counting existing redemptions, not by this constraint.
  UNIQUE (coupon_id, user_id)
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
  ON public.coupon_redemptions (coupon_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx
  ON public.coupon_redemptions (user_id, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS coupon_redemptions_order_idx
  ON public.coupon_redemptions (order_id);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Users may read their own redemptions (for order history UI).
CREATE POLICY "coupon_redemptions: user read own"
  ON public.coupon_redemptions FOR SELECT
  USING (user_id = auth.uid());

-- Redemption inserts are done by the create-order Edge Function using the
-- service-role key — no anon/authenticated INSERT policy needed.

CREATE POLICY "coupon_redemptions: manager read all"
  ON public.coupon_redemptions FOR SELECT
  USING (public.is_manager());

-- ─── validate_coupon RPC ──────────────────────────────────────────────────────
--
-- Returns a typed JSON object with one of:
--   { valid: true,  code, discount_type, discount_value, discount_amount,
--                   min_order_amount, description }
--   { valid: false, reason: 'not_found' | 'inactive' | 'expired' |
--                            'limit_reached' | 'already_redeemed' |
--                            'first_order_only' | 'min_order_not_met' }
--
-- p_order_subtotal is the cart subtotal BEFORE the coupon discount — used to
-- validate min_order_amount and to compute the concrete discount_amount.
--
-- SECURITY: SECURITY DEFINER so the function can read coupon_redemptions
-- (which has no per-user SELECT RLS beyond own rows) to count total
-- redemptions without needing broad table grants. auth.uid() is used to
-- scope the "already redeemed" and "first order" checks — callers without a
-- session get a 'not_found' (rather than leaking whether the code exists).
--
-- NOTE: This RPC is READ-ONLY. It does NOT insert a coupon_redemptions row.
-- The redemption is written inside the create-order Edge Function (service-role)
-- atomically after the order is committed. This prevents a redemption being
-- counted for an order that subsequently fails to commit.

DROP FUNCTION IF EXISTS public.validate_coupon(text, numeric);

CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code          text,
  p_order_subtotal numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_coupon     public.coupons%ROWTYPE;
  v_redemption_count integer;
  v_user_redemption_count integer;
  v_prior_order_count integer;
  v_discount_amount numeric(12,2);
BEGIN
  -- Must be authenticated — anonymous users cannot redeem coupons.
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  -- Normalise: upper-case, trim whitespace.
  SELECT * INTO v_coupon
    FROM public.coupons
   WHERE upper(trim(code)) = upper(trim(p_code))
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  -- Active check.
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;

  -- Expiry check.
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  -- Global redemption limit check.
  IF v_coupon.max_redemptions IS NOT NULL THEN
    SELECT count(*) INTO v_redemption_count
      FROM public.coupon_redemptions
     WHERE coupon_id = v_coupon.id;
    IF v_redemption_count >= v_coupon.max_redemptions THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'limit_reached');
    END IF;
  END IF;

  -- Per-user redemption limit check.
  SELECT count(*) INTO v_user_redemption_count
    FROM public.coupon_redemptions
   WHERE coupon_id = v_coupon.id
     AND user_id   = v_caller_id;

  IF v_user_redemption_count >= v_coupon.per_user_limit THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_redeemed');
  END IF;

  -- First-order-only check: caller must have zero prior completed orders.
  -- Cancelled and archived orders are excluded — a test order that was
  -- cancelled should not block the user's first real order discount.
  IF v_coupon.first_order_only THEN
    SELECT count(*) INTO v_prior_order_count
      FROM public.orders
     WHERE user_id = v_caller_id
       AND status NOT IN ('cancelled', 'archived', 'pending');

    IF v_prior_order_count > 0 THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'first_order_only');
    END IF;
  END IF;

  -- Minimum order amount check (applied to the subtotal before discount).
  IF v_coupon.min_order_amount IS NOT NULL
     AND p_order_subtotal < v_coupon.min_order_amount THEN
    RETURN jsonb_build_object(
      'valid',            false,
      'reason',           'min_order_not_met',
      'min_order_amount', v_coupon.min_order_amount
    );
  END IF;

  -- Compute the concrete discount amount.
  v_discount_amount := CASE v_coupon.discount_type
    WHEN 'percentage'   THEN round(p_order_subtotal * v_coupon.discount_value / 100, 2)
    WHEN 'fixed_amount' THEN least(v_coupon.discount_value, p_order_subtotal)
    ELSE 0
  END;

  -- Discount must be positive.
  IF v_discount_amount <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'valid',            true,
    'coupon_id',        v_coupon.id,
    'code',             upper(trim(v_coupon.code)),
    'discount_type',    v_coupon.discount_type,
    'discount_value',   v_coupon.discount_value,
    'discount_amount',  v_discount_amount,
    'min_order_amount', v_coupon.min_order_amount,
    'first_order_only', v_coupon.first_order_only,
    'description',      v_coupon.id::text  -- opaque; front-end uses i18n key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO authenticated;

-- ─── record_coupon_redemption RPC ─────────────────────────────────────────────
--
-- Called by the create-order Edge Function (service-role) AFTER the order row
-- has been committed. Inserts the coupon_redemptions row atomically.
-- If the coupon has already been redeemed by this user (race condition on
-- double-submit), raises an exception so the Edge Function can decide whether
-- to abort or proceed with zero discount.
--
-- Parameters:
--   p_code          — normalised coupon code
--   p_user_id       — the ordering user (passed explicitly since service-role
--                     context has no auth.uid())
--   p_order_id      — the newly committed order UUID
--   p_subtotal      — order subtotal used to compute the applied amount
--
-- Returns: the discount amount that was applied (for the Edge Function to log).

DROP FUNCTION IF EXISTS public.record_coupon_redemption(text, uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION public.record_coupon_redemption(
  p_code      text,
  p_user_id   uuid,
  p_order_id  uuid,
  p_subtotal  numeric
)
RETURNS numeric
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon          public.coupons%ROWTYPE;
  v_discount_amount numeric(12,2);
BEGIN
  SELECT * INTO v_coupon
    FROM public.coupons
   WHERE upper(trim(code)) = upper(trim(p_code))
   LIMIT 1;

  IF NOT FOUND OR NOT v_coupon.is_active THEN
    RAISE EXCEPTION 'coupon_invalid' USING ERRCODE = '22023';
  END IF;

  v_discount_amount := CASE v_coupon.discount_type
    WHEN 'percentage'   THEN round(p_subtotal * v_coupon.discount_value / 100, 2)
    WHEN 'fixed_amount' THEN least(v_coupon.discount_value, p_subtotal)
    ELSE 0
  END;

  IF v_discount_amount <= 0 THEN
    RAISE EXCEPTION 'coupon_no_discount' USING ERRCODE = '22023';
  END IF;

  -- ON CONFLICT DO NOTHING handles the idempotent-replay case (same order
  -- submitted twice via idempotency key — the second call is a no-op).
  INSERT INTO public.coupon_redemptions
    (coupon_id, user_id, order_id, amount)
  VALUES
    (v_coupon.id, p_user_id, p_order_id, v_discount_amount)
  ON CONFLICT (coupon_id, user_id) DO NOTHING;

  RETURN v_discount_amount;
END;
$$;

-- Service-role only — no anon/authenticated grant.
REVOKE ALL ON FUNCTION public.record_coupon_redemption(text, uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_coupon_redemption(text, uuid, uuid, numeric) FROM authenticated;

-- ─── Seed: first-order coupon FIRST100 ───────────────────────────────────────
--
-- 100 EGP off the first order. Active, no expiry, 1 redemption per user,
-- unlimited total redemptions. Idempotent — DO NOTHING if already seeded
-- (safe to re-run migration).

INSERT INTO public.coupons
  (code, discount_type, discount_value, first_order_only, per_user_limit,
   max_redemptions, min_order_amount, is_active)
VALUES
  ('FIRST100', 'fixed_amount', 100.00, true, 1, NULL, 150.00, true)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
