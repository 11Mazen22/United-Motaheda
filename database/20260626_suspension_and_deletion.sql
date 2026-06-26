-- Migration: suspension and deletion system - 2026-06-26

-- ─── user_suspensions ────────────────────────────────────────────────────────
-- Tracks active and historical suspensions for user accounts.

create table if not exists public.user_suspensions (
  id              uuid          default gen_random_uuid() primary key,
  user_id         uuid          not null references auth.users(id) on delete cascade,
  suspended_by    uuid          references auth.users(id),
  reason_codes    text[]        not null default '{}',
  admin_notes     text,
  duration_type   text          not null default 'permanent'
                                check (duration_type in ('permanent', 'temporary')),
  expires_at      timestamptz,
  is_active       boolean       not null default true,
  unsuspended_at  timestamptz,
  unsuspended_by  uuid          references auth.users(id),
  created_at      timestamptz   not null default now()
);

create index if not exists user_suspensions_user_active_idx
  on public.user_suspensions (user_id, is_active);

create index if not exists user_suspensions_user_created_idx
  on public.user_suspensions (user_id, created_at desc);

-- ─── user_deletion_log ───────────────────────────────────────────────────────
-- Permanent log of deleted accounts. deleted_user_id is not a FK because
-- the auth.users row may already be gone by the time this is queried.

create table if not exists public.user_deletion_log (
  id                  uuid        default gen_random_uuid() primary key,
  deleted_user_id     uuid        not null,
  deleted_user_email  text,
  deleted_user_name   text,
  deleted_by          uuid        references auth.users(id),
  deletion_type       text        not null default 'admin'
                                  check (deletion_type in ('admin', 'self')),
  reason              text,
  admin_notes         text,
  deleted_at          timestamptz not null default now()
);

-- ─── admin_audit_log ─────────────────────────────────────────────────────────
-- Immutable record of all privileged admin actions.

create table if not exists public.admin_audit_log (
  id                uuid        default gen_random_uuid() primary key,
  admin_id          uuid        not null references auth.users(id),
  action            text        not null,
  target_user_id    uuid,
  target_user_email text,
  details           jsonb,
  created_at        timestamptz not null default now()
);

-- ─── Enable RLS ──────────────────────────────────────────────────────────────

alter table public.user_suspensions    enable row level security;
alter table public.user_deletion_log   enable row level security;
alter table public.admin_audit_log     enable row level security;

-- ─── RLS: user_suspensions ───────────────────────────────────────────────────

drop policy if exists "suspensions: admin/manager insert" on public.user_suspensions;
create policy "suspensions: admin/manager insert"
  on public.user_suspensions for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

drop policy if exists "suspensions: admin/manager update" on public.user_suspensions;
create policy "suspensions: admin/manager update"
  on public.user_suspensions for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

drop policy if exists "suspensions: admin/manager select all" on public.user_suspensions;
create policy "suspensions: admin/manager select all"
  on public.user_suspensions for select
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

drop policy if exists "suspensions: user select own" on public.user_suspensions;
create policy "suspensions: user select own"
  on public.user_suspensions for select
  using (user_id = auth.uid());

-- ─── RLS: user_deletion_log ──────────────────────────────────────────────────

drop policy if exists "deletion_log: admin/manager insert" on public.user_deletion_log;
create policy "deletion_log: admin/manager insert"
  on public.user_deletion_log for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

drop policy if exists "deletion_log: admin/manager select" on public.user_deletion_log;
create policy "deletion_log: admin/manager select"
  on public.user_deletion_log for select
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

-- ─── RLS: admin_audit_log ────────────────────────────────────────────────────

drop policy if exists "audit_log: admin/manager insert" on public.admin_audit_log;
create policy "audit_log: admin/manager insert"
  on public.admin_audit_log for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager')
  );

drop policy if exists "audit_log: admin select" on public.admin_audit_log;
create policy "audit_log: admin select"
  on public.admin_audit_log for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );
