-- Migration: add public.profiles to the realtime publication - 2026-07-10
--
-- Required for postgres_changes subscriptions to fire on this table.
-- Discovered while building live role/status propagation for the admin
-- panel (an admin changing someone's role/status must reach that user's
-- open session immediately, without a manual reload/re-login): profiles
-- was never added to supabase_realtime, so a correctly-written subscription
-- filtered to a user's own row would connect successfully but never
-- receive a single event — the exact silent-failure shape already hit
-- twice before in this codebase (notifications, delivery_assignments/orders).
-- Idempotent, following the same pattern as 20260708_delivery_assignments_and_issues.sql.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;

-- ─── Done ─────────────────────────────────────────────────────────────────────
