-- Driver-app-consolidation plan, Phase 3. DriverProfile had RLS enabled
-- with zero policies (20260824105038_enable_driver_tables_rls) -- correct
-- as a default-deny starting point, but shopper-native's driver
-- registration wizard and its (driver) route gate both need an
-- authenticated user to read/create their own row.
--
-- Scope is deliberately narrow: a user can see and create only their own
-- DriverProfile (matching how every other user-owned table in this schema
-- is policed), and can never set or change `status` themselves -- that
-- column is only ever written by apps/api's admin approval endpoints,
-- which connect as the `postgres` role and bypass RLS entirely. There is
-- no client-side UPDATE policy here on purpose: once submitted, an
-- application's vehicle/document fields are not self-editable by the
-- driver (a resubmit-after-rejection flow, if ever built, is a separate,
-- deliberate addition, not an accidental side effect of a broad policy).

CREATE POLICY "drivers can read own profile"
  ON "public"."DriverProfile"
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid());

-- status also constrained to PENDING_APPROVAL (not just userId) -- an
-- INSERT policy's WITH CHECK restricts which rows can be inserted, not
-- which columns; without this a client could insert with status set
-- directly to APPROVED/ACTIVE and self-approve, defeating the whole
-- point of admin review. The column defaults to PENDING_APPROVAL, so a
-- legitimate insert that omits status entirely still passes this check.
CREATE POLICY "drivers can create own profile"
  ON "public"."DriverProfile"
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = auth.uid() AND "status" = 'PENDING_APPROVAL');
