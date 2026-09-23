-- Prescription image integrity and recovery guardrails.
-- Historical rows are preserved even when their original object is gone.

alter table public.prescriptions
  add column if not exists image_integrity_status text not null default 'not_applicable',
  add column if not exists image_integrity_checked_at timestamptz,
  add column if not exists image_integrity_error text;

alter table public.prescriptions
  drop constraint if exists prescriptions_image_integrity_status_check;
alter table public.prescriptions
  add constraint prescriptions_image_integrity_status_check
  check (image_integrity_status in ('not_applicable', 'pending', 'available', 'missing', 'invalid_path'));

comment on column public.prescriptions.image_integrity_status is
  'Integrity state of image_path. missing preserves a historical DB record whose storage object no longer exists.';

create table if not exists public.prescription_storage_integrity_events (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid references public.prescriptions(id) on delete set null,
  issue_type text not null check (issue_type in ('missing_object', 'orphan_object', 'invalid_path')),
  object_path text not null,
  detail jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists prescription_storage_open_issue_unique
  on public.prescription_storage_integrity_events (
    issue_type,
    object_path,
    coalesce(prescription_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where resolved_at is null;

alter table public.prescription_storage_integrity_events enable row level security;
drop policy if exists "Staff can view prescription storage integrity" on public.prescription_storage_integrity_events;
create policy "Staff can view prescription storage integrity"
  on public.prescription_storage_integrity_events for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role::text in ('admin', 'manager', 'pharmacist')
    )
  );

create or replace function public.refresh_prescription_storage_integrity()
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_missing integer := 0;
  v_orphan integer := 0;
begin
  update public.prescriptions p
  set image_integrity_status = case
        when p.image_path is null or btrim(p.image_path) = '' then 'not_applicable'
        when p.image_path like 'http://%' or p.image_path like 'https://%' then 'invalid_path'
        when exists (
          select 1 from storage.objects o
          where o.bucket_id = 'prescriptions' and o.name = p.image_path
        ) then 'available'
        else 'missing'
      end,
      image_integrity_checked_at = now(),
      image_integrity_error = case
        when p.image_path is null or btrim(p.image_path) = '' then null
        when p.image_path like 'http://%' or p.image_path like 'https://%' then 'Stored value is not a canonical private-bucket object path.'
        when exists (
          select 1 from storage.objects o
          where o.bucket_id = 'prescriptions' and o.name = p.image_path
        ) then null
        else 'The referenced prescription image object does not exist in storage.'
      end;

  insert into public.prescription_storage_integrity_events
    (prescription_id, issue_type, object_path, detail)
  select p.id,
         case when p.image_integrity_status = 'invalid_path' then 'invalid_path' else 'missing_object' end,
         p.image_path,
         jsonb_build_object('user_id', p.user_id, 'submission_source', p.submission_source)
  from public.prescriptions p
  where p.image_path is not null
    and p.image_integrity_status in ('missing', 'invalid_path')
  on conflict (issue_type, object_path, (coalesce(prescription_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    where resolved_at is null
  do update set last_seen_at = now(), detail = excluded.detail;

  update public.prescription_storage_integrity_events e
  set resolved_at = now(), last_seen_at = now()
  where e.resolved_at is null
    and e.issue_type in ('missing_object', 'invalid_path')
    and not exists (
      select 1 from public.prescriptions p
      where p.id = e.prescription_id
        and p.image_path = e.object_path
        and p.image_integrity_status in ('missing', 'invalid_path')
    );

  insert into public.prescription_storage_integrity_events
    (prescription_id, issue_type, object_path, detail)
  select null, 'orphan_object', o.name,
         jsonb_build_object('bucket_id', o.bucket_id, 'created_at', o.created_at)
  from storage.objects o
  where o.bucket_id = 'prescriptions'
    and not exists (
      select 1 from public.prescriptions p where p.image_path = o.name
    )
  on conflict (issue_type, object_path, (coalesce(prescription_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    where resolved_at is null
  do update set last_seen_at = now(), detail = excluded.detail;

  update public.prescription_storage_integrity_events e
  set resolved_at = now(), last_seen_at = now()
  where e.resolved_at is null
    and e.issue_type = 'orphan_object'
    and (
      not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'prescriptions' and o.name = e.object_path
      )
      or exists (
        select 1 from public.prescriptions p
        where p.image_path = e.object_path
      )
    );

  select count(*) into v_missing
  from public.prescriptions
  where image_integrity_status in ('missing', 'invalid_path');

  select count(*) into v_orphan
  from public.prescription_storage_integrity_events
  where issue_type = 'orphan_object' and resolved_at is null;

  return jsonb_build_object(
    'missing_references', v_missing,
    'orphan_objects', v_orphan,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.refresh_prescription_storage_integrity() from public, anon, authenticated;
grant execute on function public.refresh_prescription_storage_integrity() to service_role;

create or replace function public.audit_prescription_storage_integrity()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  select role::text into v_role from public.profiles where id = auth.uid();
  if auth.uid() is null or v_role is null or v_role not in ('admin', 'manager', 'pharmacist') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  return public.refresh_prescription_storage_integrity();
end;
$$;

revoke all on function public.audit_prescription_storage_integrity() from public, anon;
grant execute on function public.audit_prescription_storage_integrity() to authenticated;

create or replace function public.guard_prescription_image_reference()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if new.image_path is null or btrim(new.image_path) = '' then
    new.image_path := null;
    new.image_integrity_status := 'not_applicable';
    new.image_integrity_checked_at := now();
    new.image_integrity_error := null;
    return new;
  end if;

  if new.image_path like 'http://%'
     or new.image_path like 'https://%'
     or split_part(new.image_path, '/', 1) <> new.user_id::text
     or split_part(new.image_path, '/', 2) <> new.id::text
     or new.image_path like '%..%'
     or position(chr(92) in new.image_path) > 0 then
    raise exception 'invalid_prescription_image_path' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'prescriptions' and o.name = new.image_path
  ) then
    raise exception 'prescription_image_object_missing' using errcode = '23503';
  end if;

  new.image_integrity_status := 'available';
  new.image_integrity_checked_at := now();
  new.image_integrity_error := null;
  return new;
end;
$$;

revoke all on function public.guard_prescription_image_reference() from public, anon, authenticated;

drop trigger if exists prescriptions_guard_image_reference on public.prescriptions;
create trigger prescriptions_guard_image_reference
before insert or update of image_path on public.prescriptions
for each row execute function public.guard_prescription_image_reference();

create or replace function public.replace_prescription_image_reference(
  p_prescription_id uuid,
  p_image_path text
)
returns public.prescriptions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_result public.prescriptions;
begin
  select role::text into v_role from public.profiles where id = auth.uid();
  if auth.uid() is null or v_role is null or v_role not in ('admin', 'manager', 'pharmacist') then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  update public.prescriptions
  set image_path = p_image_path,
      updated_at = now()
  where id = p_prescription_id
  returning * into v_result;

  if v_result.id is null then
    raise exception 'prescription_not_found' using errcode = 'P0002';
  end if;
  return v_result;
end;
$$;

revoke all on function public.replace_prescription_image_reference(uuid, text) from public, anon;
grant execute on function public.replace_prescription_image_reference(uuid, text) to authenticated;

create or replace function public.prevent_referenced_prescription_object_delete()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if old.bucket_id = 'prescriptions' and exists (
    select 1 from public.prescriptions p where p.image_path = old.name
  ) then
    raise exception 'prescription_image_still_referenced' using errcode = '23503';
  end if;
  return old;
end;
$$;

revoke all on function public.prevent_referenced_prescription_object_delete() from public, anon, authenticated;

drop trigger if exists prescriptions_prevent_referenced_object_delete on storage.objects;
create trigger prescriptions_prevent_referenced_object_delete
before delete on storage.objects
for each row execute function public.prevent_referenced_prescription_object_delete();

-- Staff may restore a missing image, but only below the canonical owner/prescription path.
drop policy if exists "Staff can restore prescription images" on storage.objects;
create policy "Staff can restore prescription images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'prescriptions'
    and exists (
      select 1
      from public.prescriptions rx
      join public.profiles staff on staff.id = auth.uid()
      where staff.role::text in ('admin', 'manager', 'pharmacist')
        and rx.user_id::text = (storage.foldername(name))[1]
        and rx.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "Staff can replace prescription images" on storage.objects;
create policy "Staff can replace prescription images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'prescriptions'
    and exists (
      select 1 from public.profiles staff
      where staff.id = auth.uid() and staff.role::text in ('admin', 'manager', 'pharmacist')
    )
  )
  with check (
    bucket_id = 'prescriptions'
    and exists (
      select 1
      from public.prescriptions rx
      join public.profiles staff on staff.id = auth.uid()
      where staff.role::text in ('admin', 'manager', 'pharmacist')
        and rx.user_id::text = (storage.foldername(name))[1]
        and rx.id::text = (storage.foldername(name))[2]
    )
  );

select public.refresh_prescription_storage_integrity();

-- Daily non-destructive audit when pg_cron is available. Existing objects/rows are never deleted.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null
     and not exists (select 1 from cron.job where jobname = 'audit-prescription-storage-integrity') then
    perform cron.schedule(
      'audit-prescription-storage-integrity',
      '17 3 * * *',
      'select public.refresh_prescription_storage_integrity();'
    );
  end if;
exception when undefined_table or invalid_schema_name then
  null;
end;
$$;
