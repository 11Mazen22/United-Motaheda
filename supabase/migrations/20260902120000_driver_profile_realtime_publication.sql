-- Adds DriverProfile to the supabase_realtime publication so the app can
-- subscribe to approval/online-status changes (e.g. an admin approving a
-- driver application, or toggling status) and reflect them live instead of
-- relying only on polling (useMyDriverProfilePolling) or the 15s staleTime
-- on useMyDriverProfile.
--
-- Mirrors the exact guarded pattern used for driver_locations in
-- 20260727120000_driver_locations.sql. Quoted identifier because the table
-- is Prisma-managed (PascalCase), unlike the plain snake_case tables already
-- in the publication.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname    = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'DriverProfile'
  ) then
    alter publication supabase_realtime add table public."DriverProfile";
  end if;
end $$;
