-- Confirmed live on a real pharmacist account: the Prescriptions Queue
-- screen fails to load entirely ("تعذّر تحميل الوصفات") and the Workbench
-- dashboard shows a full error screen, because useAllPrescriptions()'s
-- underlying query (SELECT ... FROM public.prescriptions) errors out for
-- this pharmacist. 20260705120000_prescriptions_admin_review.sql already
-- defines a "prescriptions: staff select all" policy including 'pharmacist'
-- in its role list, and on paper this should already work -- but this
-- repo's own migration 20260827090000_pharmacist_backend_fixes.sql notes
-- "Two copies of 20260705120000_prescriptions_admin_review.sql disagree",
-- meaning what's actually live in the database may not match this repo's
-- copy of that file. Re-applying idempotently (drop-if-exists + create)
-- guarantees the correct policy regardless of whatever is live right now,
-- same pattern as the DriverProfile RLS fix earlier today.
--
-- Safe to re-run. No-op if the policies already match.

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescriptions: staff select all" ON public.prescriptions;
CREATE POLICY "prescriptions: staff select all"
  ON public.prescriptions FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'pharmacist')
  );

DROP POLICY IF EXISTS "prescriptions: staff update review" ON public.prescriptions;
CREATE POLICY "prescriptions: staff update review"
  ON public.prescriptions FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'pharmacist')
  );

ALTER TABLE public.refill_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refill_requests: staff select all" ON public.refill_requests;
CREATE POLICY "refill_requests: staff select all"
  ON public.refill_requests FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'pharmacist')
  );

DROP POLICY IF EXISTS "refill_requests: staff update review" ON public.refill_requests;
CREATE POLICY "refill_requests: staff update review"
  ON public.refill_requests FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'pharmacist')
  );

NOTIFY pgrst, 'reload schema';
