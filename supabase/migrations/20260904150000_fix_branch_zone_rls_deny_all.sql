-- Root cause of essentially every "delivery not available" report this
-- session, confirmed live and directly on the physical test device — not
-- the branch-coordinate drift fixed earlier (real, but not this bug).
--
-- public."Branch" and public."DeliveryZone" both have row_security = true
-- but zero policies (confirmed: `SELECT * FROM pg_policies WHERE
-- tablename IN ('Branch','DeliveryZone')` returns nothing). In Postgres,
-- RLS enabled with no policies means deny-all for every role except the
-- table owner / a role with BYPASSRLS — which includes ordinary
-- `authenticated` sessions. resolve_delivery_zone() (the RPC
-- shopper-native's real checkout screen calls — useDeliveryQuote.ts) is a
-- plain function, not SECURITY DEFINER (confirmed: prosecdef = false), so
-- it runs as the calling role and its `FOR v_branch IN SELECT ... FROM
-- public."Branch"` loop silently iterates zero rows for any real customer
-- — not because their coordinates are outside a zone, but because they
-- can't see any branch or zone at all. It always returns an empty result,
-- unconditionally, for every address, for every authenticated customer.
--
-- Confirmed directly: the exact same call
-- (resolve_delivery_zone(30.0648669, 31.3964037, 48.50), the "family"
-- address from earlier in this session) returns a full match as
-- supabase_admin (superuser — bypasses RLS unconditionally, which is why
-- every verification this session using a direct superuser connection
-- reported success) and returns zero rows under `SET LOCAL ROLE
-- authenticated` with a real user's JWT claim — the exact role/path the
-- live app actually uses. This has nothing to do with which address or
-- which branch; it fails identically for every coordinate.
--
-- (The Railway /delivery/quote REST endpoint, apps/api's DeliveryService,
-- was unaffected — it reads Branch/DeliveryZone through Prisma over a
-- direct, privileged database connection that never goes through
-- PostgREST/RLS at all. But shopper-native's live checkout screen
-- [usePremiumCheckout.ts -> useDeliveryQuote.ts] calls the Supabase RPC
-- directly, not that endpoint, so that working path never protected real
-- checkout traffic from this bug.)
--
-- Branch/zone names, locations, hours, and zone boundaries are exactly
-- the kind of public reference data every other genuinely public table in
-- this schema (e.g. products_select_all) grants to `public` outright —
-- there's no reason to withhold "which pharmacies exist and where" from
-- either anonymous browsing or authenticated checkout.
CREATE POLICY branch_select_all
  ON public."Branch" FOR SELECT
  TO public
  USING (true);

CREATE POLICY delivery_zone_select_all
  ON public."DeliveryZone" FOR SELECT
  TO public
  USING (true);

NOTIFY pgrst, 'reload schema';
