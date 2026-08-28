-- Re-apply the prescription image storage bucket + RLS policies. Given
-- today's confirmed pattern (the DriverProfile policy and the prescriptions
-- table policy both existed as tracked migrations that were never actually
-- run against the live database), the prescription CAMERA/upload flow
-- "completely doesn't work" almost certainly has the same cause: either the
-- 'prescriptions' storage bucket doesn't exist live, or its RLS policies
-- were never created, so every upload attempt from the customer app fails
-- (and the pharmacist-side signed-URL read would fail too, even for any
-- prescription that did get an image through some other path).
--
-- Identical to 20260817100000_prescription_image_upload.sql -- re-running
-- it here since the original may never have executed live. Fully
-- idempotent: bucket insert no-ops on conflict, every policy is
-- drop-if-exists before create. Safe to run even if already applied.

INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "prescriptions: customer upload own" ON storage.objects;
CREATE POLICY "prescriptions: customer upload own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'prescriptions'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "prescriptions: customer update own" ON storage.objects;
CREATE POLICY "prescriptions: customer update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'prescriptions'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'prescriptions'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "prescriptions: customer read own" ON storage.objects;
CREATE POLICY "prescriptions: customer read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'prescriptions'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "prescriptions: customer delete own" ON storage.objects;
CREATE POLICY "prescriptions: customer delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'prescriptions'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "prescriptions: staff read all" ON storage.objects;
CREATE POLICY "prescriptions: staff read all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'prescriptions'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'pharmacist')
  );

NOTIFY pgrst, 'reload schema';
