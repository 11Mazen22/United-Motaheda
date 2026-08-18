-- Migration: prescription image upload pipeline - 2026-08-17
--
-- Adds a secure document submission pipeline:
--   1. public.prescriptions   — adds an image_path column
--   2. storage.buckets        — creates a private 'prescriptions' bucket
--   3. storage.objects        — enforces RLS so users can only upload/read their own files,
--                               and staff can review the documents.

-- ─── 1. prescriptions table: add image_path ─────────────────────────────────
alter table public.prescriptions
  add column if not exists image_path text;

comment on column public.prescriptions.image_path is
  'Path in the prescriptions storage bucket where the original uploaded document is stored. Null for historical or text-only submissions.';

-- ─── 2. Create the storage bucket ───────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('prescriptions', 'prescriptions', false)
on conflict (id) do nothing;

-- ─── 3. Storage Object RLS Policies ─────────────────────────────────────────

-- A) Customer upload policy
drop policy if exists "prescriptions: customer upload own" on storage.objects;
create policy "prescriptions: customer upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'prescriptions'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- B) Customer update policy (for retries replacing the same file)
drop policy if exists "prescriptions: customer update own" on storage.objects;
create policy "prescriptions: customer update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'prescriptions'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'prescriptions'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- C) Customer read policy
drop policy if exists "prescriptions: customer read own" on storage.objects;
create policy "prescriptions: customer read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'prescriptions'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- D) Customer delete policy (for cleanup of failed submissions)
drop policy if exists "prescriptions: customer delete own" on storage.objects;
create policy "prescriptions: customer delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'prescriptions'
    and (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- E) Staff read policy
drop policy if exists "prescriptions: staff read all" on storage.objects;
create policy "prescriptions: staff read all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'prescriptions'
    and (select role from public.profiles where id = auth.uid()) in ('admin', 'manager', 'pharmacist')
  );

-- ─── Done ─────────────────────────────────────────────────────────────────────
