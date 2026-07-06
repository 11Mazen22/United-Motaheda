-- Migration: prescriptions admin review system - 2026-07-05
--
-- Adds a staff-reviewable workflow to two customer-facing flows that were
-- previously invisible to pharmacy staff:
--   1. public.prescriptions   — manually-submitted Rx numbers + WhatsApp
--      submissions (new: submission_source='whatsapp' placeholder rows)
--   2. public.refill_requests — refill requests placed against an existing
--      prescription
--
-- Neither table has a prior formal migration in this repo (both were created
-- ad-hoc via the Supabase dashboard) — this migration only ADDS columns/
-- policies on top of whatever already exists; it does not redefine or drop
-- any pre-existing customer-facing policy.
--
-- Pattern follows 20260626_suspension_and_deletion.sql (role-gated RLS,
-- audit log via public.admin_audit_log, which already exists).

-- ─── prescriptions: review workflow columns ─────────────────────────────────

alter table public.prescriptions
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('pending_review', 'approved', 'rejected')),
  add column if not exists submission_source text not null default 'manual'
    check (submission_source in ('manual', 'whatsapp')),
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists admin_notes text,
  add column if not exists rejection_reason text;

-- Default is 'approved' (not 'pending_review') so this migration is a no-op
-- for every pre-existing row — those were already implicitly accepted before
-- this system existed. The app sets 'pending_review' explicitly on NEW
-- inserts going forward; only new submissions enter the review queue.

comment on column public.prescriptions.review_status is
  'Staff review workflow. App sets pending_review on new submissions; only admin/manager/pharmacist may set approved/rejected.';
comment on column public.prescriptions.submission_source is
  'manual = customer typed an Rx number in-app. whatsapp = customer chose "Send via WhatsApp"; this is a lightweight tracking placeholder, not the actual photo.';

create index if not exists prescriptions_review_status_idx
  on public.prescriptions (review_status, added_at desc);

-- ─── refill_requests: review/audit columns ──────────────────────────────────
-- Reuses the EXISTING `status` column's values (pending/preparing/ready/
-- on_the_way/delivered/cancelled): staff approval moves pending -> preparing,
-- rejection moves pending -> cancelled. No new status enum needed here.

alter table public.refill_requests
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists admin_notes text,
  add column if not exists rejection_reason text;

create index if not exists refill_requests_status_idx
  on public.refill_requests (status, created_at desc);

-- ─── RLS: prescriptions — staff visibility + review action ──────────────────
-- Additive only. Existing customer-scoped select/insert policies (not defined
-- in this repo) are untouched.

alter table public.prescriptions enable row level security;

drop policy if exists "prescriptions: staff select all" on public.prescriptions;
create policy "prescriptions: staff select all"
  on public.prescriptions for select
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager', 'pharmacist')
  );

drop policy if exists "prescriptions: staff update review" on public.prescriptions;
create policy "prescriptions: staff update review"
  on public.prescriptions for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager', 'pharmacist')
  );

-- ─── RLS: refill_requests — staff visibility + review action ────────────────

alter table public.refill_requests enable row level security;

drop policy if exists "refill_requests: staff select all" on public.refill_requests;
create policy "refill_requests: staff select all"
  on public.refill_requests for select
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager', 'pharmacist')
  );

drop policy if exists "refill_requests: staff update review" on public.refill_requests;
create policy "refill_requests: staff update review"
  on public.refill_requests for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'manager', 'pharmacist')
  );

-- ─── Done ─────────────────────────────────────────────────────────────────────
