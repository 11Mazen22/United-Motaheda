-- Migration: delivery workflow — assignment ledger + issue reports - 2026-07-08
--
-- Part of the "advanced delivery workflow" feature (driver accept/decline,
-- pickup confirmation, in-transit tracking, delivery completion, issue
-- reporting, manual reassignment). Scoped and built as its own release per
-- the plan at proud-growing-storm.md, on top of the already-unified order
-- lifecycle (packages/contracts/src/orderStatus.ts).
--
-- public.orders.assigned_driver_id is kept exactly as-is — every existing
-- query/index (listOpsOrders, listDriverManifest, orders_assigned_driver_
-- status_idx) already depends on it as the fast "who is currently
-- responsible" pointer. delivery_assignments below is the audit/history
-- ledger behind it: one row per assignment attempt (initial offer, decline,
-- reassignment), so staff can see the full story, not just the current
-- state. The "current" assignment for an order is its most recent row.

-- ─── delivery_assignments ────────────────────────────────────────────────────

create table if not exists public.delivery_assignments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  driver_id       uuid not null references auth.users(id),
  assigned_by     uuid references auth.users(id),
  assignment_kind text not null default 'assigned'
    check (assignment_kind in ('assigned', 'reassigned')),
  response_status text not null default 'offered'
    check (response_status in ('offered', 'accepted', 'declined', 'superseded', 'completed')),
  decline_reason  text,
  offered_at      timestamptz not null default now(),
  responded_at    timestamptz,
  picked_up_at    timestamptz,
  delivered_at    timestamptz,
  superseded_at   timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists delivery_assignments_order_idx
  on public.delivery_assignments (order_id, created_at desc);
create index if not exists delivery_assignments_driver_idx
  on public.delivery_assignments (driver_id, response_status, offered_at desc);

comment on table public.delivery_assignments is
  'Append-only assignment/accept/decline/reassignment ledger. orders.assigned_driver_id remains the fast "current driver" pointer; this table is the audit trail behind it. The current assignment for an order is its most recent row by created_at.';
comment on column public.delivery_assignments.response_status is
  'offered = staff assigned, awaiting driver response. accepted/declined = driver acted. superseded = staff reassigned before/after driver response. completed = delivery finished under this assignment.';

-- ─── delivery_issues ──────────────────────────────────────────────────────────
-- Driver-reported delivery problems. Reason-code UI pattern borrowed from the
-- customer-facing Returns.tsx picker, vocabulary scoped to delivery attempts
-- (not post-delivery returns).

create table if not exists public.delivery_issues (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  driver_id       uuid not null references auth.users(id),
  reason_code     text not null
    check (reason_code in (
      'customer_unreachable', 'wrong_address', 'customer_refused',
      'item_damaged', 'item_missing', 'access_issue', 'vehicle_breakdown', 'other'
    )),
  note            text,
  status          text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  resolved_by     uuid references auth.users(id),
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now()
);

create index if not exists delivery_issues_order_idx  on public.delivery_issues (order_id, created_at desc);
create index if not exists delivery_issues_status_idx on public.delivery_issues (status, created_at desc);
create index if not exists delivery_issues_driver_idx on public.delivery_issues (driver_id, created_at desc);

comment on column public.delivery_issues.reason_code is
  'Driver-facing reason taxonomy. Distinct from Returns.tsx''s customer-facing return reasons (damaged/wrong-item/expired) — these describe why a DELIVERY ATTEMPT failed, not why a product is being returned.';

-- ─── RLS: delivery_assignments ───────────────────────────────────────────────
-- Staff (admin/manager) see and insert everything; drivers see and update
-- only their own row. Inline role-check style (not is_manager(), which is
-- not defined anywhere in this repo's tracked migrations).

alter table public.delivery_assignments enable row level security;

drop policy if exists "delivery_assignments: staff select all" on public.delivery_assignments;
create policy "delivery_assignments: staff select all"
  on public.delivery_assignments for select
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

drop policy if exists "delivery_assignments: driver select own" on public.delivery_assignments;
create policy "delivery_assignments: driver select own"
  on public.delivery_assignments for select
  using (driver_id = auth.uid());

drop policy if exists "delivery_assignments: staff insert" on public.delivery_assignments;
create policy "delivery_assignments: staff insert"
  on public.delivery_assignments for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

drop policy if exists "delivery_assignments: driver update own response" on public.delivery_assignments;
create policy "delivery_assignments: driver update own response"
  on public.delivery_assignments for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists "delivery_assignments: staff update all" on public.delivery_assignments;
create policy "delivery_assignments: staff update all"
  on public.delivery_assignments for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

-- ─── RLS: delivery_issues ─────────────────────────────────────────────────────

alter table public.delivery_issues enable row level security;

drop policy if exists "delivery_issues: staff select all" on public.delivery_issues;
create policy "delivery_issues: staff select all"
  on public.delivery_issues for select
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

drop policy if exists "delivery_issues: driver select own" on public.delivery_issues;
create policy "delivery_issues: driver select own"
  on public.delivery_issues for select
  using (driver_id = auth.uid());

drop policy if exists "delivery_issues: driver insert own" on public.delivery_issues;
create policy "delivery_issues: driver insert own"
  on public.delivery_issues for insert
  with check (driver_id = auth.uid());

drop policy if exists "delivery_issues: staff update (resolve)" on public.delivery_issues;
create policy "delivery_issues: staff update (resolve)"
  on public.delivery_issues for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

-- ─── Realtime publication ─────────────────────────────────────────────────────
-- Required for postgres_changes subscriptions to fire on these tables — this
-- feature introduces the first-ever realtime subscription on orders too, so
-- that table is added here as well (idempotent: skip if already present).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_assignments'
  ) then
    alter publication supabase_realtime add table public.delivery_assignments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_issues'
  ) then
    alter publication supabase_realtime add table public.delivery_issues;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ─── Done ─────────────────────────────────────────────────────────────────────
