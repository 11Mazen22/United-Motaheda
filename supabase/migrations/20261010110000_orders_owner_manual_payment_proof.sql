-- public.orders has never had an UPDATE policy for the order's own customer
-- (confirmed live: only "Admins and managers can update orders" exists,
-- identically on both self-hosted and old-cloud). The manual-wallet checkout
-- flow (Vodafone Cash / InstaPay) relies on the customer being able to
-- attach their own payment proof to their own order after create-order
-- returns -- apps/shopper-native/src/features/checkout/patchManualPayment.ts
-- already references a policy named "orders owner manual payment proof" as
-- if it existed, and an abandoned, never-fully-applied migration at
-- apps/shopper-native/supabase/migrations/20260535_manual_payment_apply.sql
-- defines exactly this policy -- but it was never actually created on either
-- database. Every such update is silently rejected by RLS, which is the
-- other half of why Vodafone Cash / InstaPay checkout failed (the first half
-- was a client-side string typo fixed separately: "payment_pending" vs the
-- real enum value "pending_payment").
--
-- Reusing that original policy's name and intent, with a WITH CHECK that
-- restricts which VALUES this policy can write, so a customer can't reuse
-- it to push their own order into an arbitrary status via a raw REST PATCH.
--
-- A column-level GRANT was tried here as a second layer (limiting which
-- columns this policy's rows-can-be-touched applies to) but confirmed live
-- to be a no-op: `authenticated` (and even `anon`) already hold a blanket
-- UPDATE grant on every column of orders (Supabase's default -- RLS is
-- meant to be the only real gate, not table/column GRANTs), so adding a
-- narrower GRANT doesn't narrow anything already broader. Not included.
--
-- Verified live -- and this is the part that matters -- that adding this
-- policy's WITH CHECK alone was NOT sufficient: "Admins and managers can
-- update orders" has WITH CHECK (true), unconditionally. Postgres ORs
-- together the WITH CHECK of every applicable PERMISSIVE policy for the
-- same command, not just the one whose USING happened to admit the row --
-- so that unconditional true leaked through and let a plain customer set
-- status to 'delivered' through THIS policy's USING, confirmed by a live
-- test that only stopped doing that once the admin policy's WITH CHECK
-- below was tightened to match its own USING. Before this migration that
-- policy was harmless on its own (a customer's row was never selectable via
-- its admin/manager-only USING in the first place) -- it only became
-- reachable once a second, customer-passable USING (this one) existed
-- alongside it. Requiring admins/managers to still BE admins/managers for
-- the result to land is not a capability reduction for them; it just closes
-- the escape hatch this combination opened for everyone else.

DROP POLICY IF EXISTS "Admins and managers can update orders" ON public.orders;
CREATE POLICY "Admins and managers can update orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

DROP POLICY IF EXISTS "orders owner manual payment proof" ON public.orders;
CREATE POLICY "orders owner manual payment proof"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'pending_payment'
    AND payment_method IN ('vodafone', 'instapay')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending_payment'
    AND payment_status = 'pending_verification'
    AND payment_method IN ('vodafone', 'instapay')
  );
