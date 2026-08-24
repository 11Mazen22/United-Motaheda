-- Driver-app-consolidation plan, Phase 4. Same reasoning as
-- 20260824105530_driver_profile_self_access_rls: DriverEarning had RLS
-- enabled with zero policies, so a driver could never read their own
-- earnings once any exist. No INSERT/UPDATE policy -- earning rows are
-- only ever written by trusted backend logic (a future RPC/trigger tied to
-- delivery completion, or apps/api's own service-role connection), never
-- directly by a client.

CREATE POLICY "drivers can read own earnings"
  ON "public"."DriverEarning"
  FOR SELECT
  TO authenticated
  USING ("driverId" IN (SELECT id FROM "public"."DriverProfile" WHERE "userId" = auth.uid()));
