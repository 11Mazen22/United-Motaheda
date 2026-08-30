Two complementary sub-trees under `supabase/` and `database/` form the server-side of the application.

- `supabase/functions/` — Deno-based Supabase Edge Functions, each a single `index.ts` entry point served via `Deno.serve`. Two auth patterns are used consistently:
  - JWT-authenticated functions (`driver-location`, `admin-privileged-actions`) create a caller-scoped client with the anon key + Authorization header to verify identity, then switch to a service-role client for privileged writes. Authorization is enforced in code before any service-role DB access.
  - Token-authenticated functions (`track-order`) accept no JWT; a QR token acts as a bearer capability and the function uses only the service-role client to return a narrow DTO.
  - Background workers (`notification-worker`, `sms-campaign-worker`) are invoked by Supabase scheduled jobs and implement an outbox/retry pattern against Expo Push, using exponential backoff and delivery receipt polling.
- `supabase/migrations/` — versioned SQL migrations (timestamp-prefixed) that evolve the schema and expose PL/pgSQL `SECURITY DEFINER` functions gated on `public.is_manager()`, with `REVOKE ALL ... GRANT EXECUTE TO authenticated` to restrict privilege escalation.
- `supabase/remote-public-schema.sql` — a snapshot of the public-facing schema surface.
- `database/` — ad-hoc SQL scripts not managed by the migration tool: per-feature DDL fixes, `performance_indexes.sql` and `supabase_indexes_v2.sql` (with and without soft-delete `deleted_at` filters), seed data (`seed_branches_and_zones.sql`), and index/statistics maintenance scripts.

Dependency direction is one-way: Edge Functions depend on the database schema defined by migrations; migrations never import code. Cross-cutting concerns (RBAC via `is_manager()`, audit logging via `admin_audit_log`, notification outbox tables) are shared through stored functions and tables rather than module imports.