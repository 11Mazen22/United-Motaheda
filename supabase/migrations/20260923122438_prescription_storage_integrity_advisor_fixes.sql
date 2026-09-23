-- Follow-up from the production advisors after prescription storage integrity
-- was introduced. This is forward-only and does not alter prescription data.

create index if not exists prescription_storage_integrity_events_prescription_id_idx
  on public.prescription_storage_integrity_events (prescription_id)
  where prescription_id is not null;

drop policy if exists "Staff can view prescription storage integrity"
  on public.prescription_storage_integrity_events;

create policy "Staff can view prescription storage integrity"
  on public.prescription_storage_integrity_events for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role::text in ('admin', 'manager', 'pharmacist')
    )
  );
