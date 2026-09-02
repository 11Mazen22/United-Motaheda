-- Fixes the 4 issues Supabase's security advisor flagged as CRITICAL.
--
-- 1. _prisma_migrations had RLS disabled while being visible to PostgREST,
--    meaning the anon/authenticated API roles could read Prisma's internal
--    migration ledger (names/checksums/timestamps) over the REST API. No
--    policies are added — nothing should ever read this table through the
--    API, so default-deny is correct. Prisma's own tooling connects as the
--    table owner, which bypasses RLS regardless (RLS restricts non-owner
--    roles unless FORCE ROW LEVEL SECURITY is also set, which this doesn't
--    set), so `prisma migrate` keeps working unchanged.
--
-- 2-4. available_inventory, product_effective_prices, and
--    product_review_stats were all marked SECURITY DEFINER, meaning they
--    ran with the view owner's privileges rather than the querying user's --
--    bypassing RLS on their underlying tables entirely. Confirmed against
--    live policies before touching this: inventory_state, products, and
--    product_reviews each already have an unconditional "public read"
--    policy (qual = true), and promotion_products/promotions already allow
--    public SELECT of exactly the active-promotion rows these views compute
--    over. SECURITY DEFINER was granting these views no visibility the
--    underlying tables didn't already grant directly -- so switching to
--    SECURITY INVOKER (Postgres 15+ view option, no need to drop/recreate)
--    closes the advisor finding with zero functional change for anon/
--    authenticated callers.
--
-- Also revokes the INSERT/UPDATE/DELETE/TRUNCATE grants Supabase's default
-- schema privileges left on these three views for anon/authenticated. Each
-- view joins multiple relations, so Postgres already rejects any actual
-- write through them ("view is not simple") regardless of the grant --
-- these were inert, not exploitable -- but there's no reason to keep
-- write grants on read-only reporting views once noticed.

ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

ALTER VIEW public.available_inventory SET (security_invoker = true);
ALTER VIEW public.product_effective_prices SET (security_invoker = true);
ALTER VIEW public.product_review_stats SET (security_invoker = true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.available_inventory FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.product_effective_prices FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.product_review_stats FROM anon, authenticated;
