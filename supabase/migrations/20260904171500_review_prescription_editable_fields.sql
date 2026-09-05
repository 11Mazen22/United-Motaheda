-- Scanned prescriptions are inserted with a placeholder name ("Uploaded
-- Prescription" / "وصفة مرفوعة") and empty dose/doctor/rx_number by
-- design — this app never ran OCR on the photo, a human pharmacist reads
-- it during review. Confirmed live: every scan-sourced row has these
-- fields empty/placeholder, and the admin review dialog only ever
-- displayed them read-only — there was no way for the reviewer to actually
-- record what they saw in the photo, so the data stayed permanently blank
-- (or permanently wrong, showing the literal placeholder as if it were the
-- real medication name) even after review. Adding optional correction
-- params here so the web dialog can turn those fields into real inputs and
-- save them in the same call as the approve/reject decision, atomically.
-- NULL means "leave as-is" so refill-request review and any other caller
-- of this same RPC pattern elsewhere are unaffected.
create or replace function public.review_prescription(
  p_prescription_id uuid,
  p_decision text,
  p_admin_notes text default null::text,
  p_rejection_reason text default null::text,
  p_name text default null::text,
  p_dose text default null::text,
  p_doctor text default null::text,
  p_rx_number text default null::text
)
returns prescriptions
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_row public.prescriptions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager', 'pharmacist')
  ) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_review_decision' using errcode = '22023';
  end if;

  select * into v_row
    from public.prescriptions
   where id = p_prescription_id
   for update;
  if not found then
    raise exception 'prescription_not_found' using errcode = 'P0002';
  end if;
  if v_row.review_status <> 'pending_review' then
    raise exception 'prescription_already_reviewed' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and coalesce(nullif(trim(p_rejection_reason), ''), '') = '' then
    raise exception 'rejection_reason_required' using errcode = '22023';
  end if;

  update public.prescriptions
     set review_status = p_decision,
         admin_notes = p_admin_notes,
         rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_rejection_reason), '') else null end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now(),
         name = coalesce(nullif(trim(p_name), ''), name),
         dose = coalesce(p_dose, dose),
         doctor = coalesce(p_doctor, doctor),
         rx_number = coalesce(nullif(trim(p_rx_number), ''), rx_number)
   where id = p_prescription_id
   returning * into v_row;
  return v_row;
end;
$function$;
