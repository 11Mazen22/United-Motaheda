-- Enable Row-Level Security on the driver tables created by
-- 20260726042623_add_driver_tables. These were created via prisma migrate
-- but had never actually been deployed to the live Supabase project until
-- this session (driver-app-consolidation plan, Phase 0) -- confirmed via
-- direct query that relrowsecurity was false with zero policies defined,
-- meaning any client holding the anon/authenticated key would have had
-- unrestricted access the moment shopper-native started reading/writing
-- these tables directly. No client code touches these tables yet (all
-- tables are empty), so this is a pure hardening change with no functional
-- impact today. apps/api's own Prisma connection uses the `postgres` role
-- (table owner), which bypasses RLS regardless, so its existing behavior
-- is unaffected.
--
-- No policies are added yet -- RLS-enabled with zero policies is a safe
-- default-deny posture for every non-owner role. Real policies (driver
-- reads/writes own DriverProfile, staff reads all, etc.) get added
-- alongside the vetting-flow and earnings-ledger client code that
-- actually needs them (driver-app-consolidation plan, Phase 3/4), once
-- the concrete access patterns are known.

ALTER TABLE "public"."DriverProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DriverLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DeliveryAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DriverSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DriverEarning" ENABLE ROW LEVEL SECURITY;
