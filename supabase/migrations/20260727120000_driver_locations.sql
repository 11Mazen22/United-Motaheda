-- Migration: driver_locations — 2026-07-27
--
-- Creates the public.driver_locations table that the driver-location Edge
-- Function writes to on every location broadcast and that the track-order
-- Edge Function reads from to serve live driver position to customers.
--
-- Design decisions (consistent with existing repository conventions):
--
--   • order_id FK → orders.id  (same pattern as delivery_assignments,
--     delivery_issues — ties a location ping to one specific delivery).
--   • driver_id → auth.users(id)  (same pattern as delivery_assignments
--     and delivery_issues — the driver's auth UID, not a driverProfile id,
--     because shopper-native sessions are Supabase auth sessions and the
--     Edge Function receives a Supabase JWT).
--   • INSERT-only: rows are never updated — each location ping creates a
--     new row. "Current" position is always MAX(captured_at) for an order.
--   • captured_at (not created_at) is the authoritative timestamp: it
--     reflects the device clock at GPS read time, matching the payload
--     field already sent by both clients (DriverLocationPayload.captured_at).
--     created_at tracks DB insertion time for housekeeping.
--   • RLS: drivers insert their own rows; customers read rows for their
--     own orders; staff (admin/manager) read everything.
--   • Realtime publication: added so customers can subscribe to INSERT
--     events on their order's rows — mirrors the orders table addition in
--     database/20260708_delivery_assignments_and_issues.sql.

-- ─── Table ────────────────────────────────────────────────────────────────────

create table if not exists public.driver_locations (
  id               uuid        primary key default gen_random_uuid(),
  order_id         uuid        not null references public.orders(id) on delete cascade,
  driver_id        uuid        not null references auth.users(id),
  lat              double precision not null,
  lng              double precision not null,
  accuracy_meters  double precision,
  heading          double precision,
  speed_kmh        double precision,
  captured_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Primary query: latest ping for a given order (used by track-order).
create index if not exists driver_locations_order_captured_idx
  on public.driver_locations (order_id, captured_at desc);

-- Secondary: housekeeping / admin queries by driver.
create index if not exists driver_locations_driver_captured_idx
  on public.driver_locations (driver_id, captured_at desc);

-- ─── Comments ─────────────────────────────────────────────────────────────────

comment on table public.driver_locations is
  'Append-only GPS ping log written by the driver-location Edge Function on every '
  'location broadcast. Current position = most recent row by captured_at for a '
  'given order_id. Read by the track-order Edge Function to serve live driver '
  'position to customers via qr_token-authenticated requests.';

comment on column public.driver_locations.captured_at is
  'Device clock at GPS read time (from DriverLocationPayload.captured_at). '
  'This is the authoritative timestamp for ordering pings, not created_at.';

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.driver_locations enable row level security;

-- Drivers: insert pings for orders they are currently assigned to.
-- The Edge Function enforces this more strictly (checks delivery_assignments),
-- but RLS is defense-in-depth: even a mis-configured function cannot write
-- a location for an order the driver has no accepted assignment for.
drop policy if exists "driver_locations: driver insert own" on public.driver_locations;
create policy "driver_locations: driver insert own"
  on public.driver_locations for insert
  with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.delivery_assignments da
      where da.order_id      = driver_locations.order_id
        and da.driver_id     = auth.uid()
        and da.response_status = 'accepted'
    )
  );

-- Customers: read pings for their own orders (same pattern as orders_select_own).
drop policy if exists "driver_locations: customer select own order" on public.driver_locations;
create policy "driver_locations: customer select own order"
  on public.driver_locations for select
  using (
    exists (
      select 1 from public.orders o
      where o.id      = driver_locations.order_id
        and o.user_id = auth.uid()
    )
  );

-- Staff: read all pings (same role check used throughout the repo).
drop policy if exists "driver_locations: staff select all" on public.driver_locations;
create policy "driver_locations: staff select all"
  on public.driver_locations for select
  using (
    (select role from public.profiles where id = auth.uid())
      in ('admin', 'manager')
  );

-- ─── Realtime publication ─────────────────────────────────────────────────────
-- Allows customers to subscribe to INSERT events on their order's pings via
-- supabase.channel(...).on('postgres_changes', { event: 'INSERT', ... }).
-- Mirrors the pattern used for orders/delivery_assignments in
-- database/20260708_delivery_assignments_and_issues.sql.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname    = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'driver_locations'
  ) then
    alter publication supabase_realtime add table public.driver_locations;
  end if;
end $$;
