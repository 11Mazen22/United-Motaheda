-- Defense-in-depth: these 8 tables are RLS-enabled with zero policies, so
-- Postgres already denies every anon/authenticated SELECT/INSERT/UPDATE/
-- DELETE by default (confirmed: only the owner / BYPASSRLS roles, i.e.
-- postgres/service_role, can touch them today). They are Prisma-managed,
-- service-role-only tables (delivery assignments, driver sessions/
-- locations, notification pipeline internals, loyalty award ledger) with
-- no legitimate PostgREST caller. This revokes the underlying table
-- grants too, removing them from the API surface entirely instead of
-- relying on RLS's default-deny as the only safety net. No behavior
-- change for any real caller -- nothing succeeds through anon/
-- authenticated on these tables today, and nothing is supposed to.
REVOKE ALL ON TABLE public."DeliveryAssignment" FROM anon, authenticated;
REVOKE ALL ON TABLE public."DriverLocation" FROM anon, authenticated;
REVOKE ALL ON TABLE public."DriverSession" FROM anon, authenticated;
REVOKE ALL ON TABLE public."NotificationLog" FROM anon, authenticated;
REVOKE ALL ON TABLE public."NotificationToken" FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_point_awards FROM anon, authenticated;
REVOKE ALL ON TABLE public.notification_delivery_attempts FROM anon, authenticated;
REVOKE ALL ON TABLE public.notification_outbox FROM anon, authenticated;
