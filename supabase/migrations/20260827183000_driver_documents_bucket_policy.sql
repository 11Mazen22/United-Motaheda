-- =============================================================================
-- Driver document uploads (license/id/vehicle/insurance photos, submitted
-- from the customer-to-driver application flow) were failing with a 400 from
-- Supabase Storage on every upload. Root cause: the "driver-documents"
-- bucket's storage.objects RLS policy was never defined in any tracked
-- migration (already flagged as a known gap in
-- 20260827010000_delivery_issue_photos.sql's own header comment) — it was
-- either created ad-hoc with no INSERT policy for applicants, or the bucket
-- itself never existed. Either way, an authenticated driver applicant had no
-- policy granting them permission to write to it.
--
-- uploadDriverDocument() (apps/shopper-native/src/features/driver/api.ts)
-- writes to path {userId}/{documentType}/{timestamp}.{ext} and never reads
-- back through the client (display always goes through apps/api's
-- service-role-backed getSignedUrl()), so only INSERT is needed for the
-- applicant. Staff SELECT mirrors the same reviewer pattern used for
-- delivery-issue-photos.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "drivers upload own documents" ON storage.objects;
CREATE POLICY "drivers upload own documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "drivers read own documents" ON storage.objects;
CREATE POLICY "drivers read own documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "staff read all driver documents" ON storage.objects;
CREATE POLICY "staff read all driver documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- =============================================================================
-- Same gap, same fix, for the "receipts" bucket (manual Vodafone Cash /
-- InstaPay transfer proof screenshots — apps/shopper-native/src/features/
-- payment/receiptUpload.ts). Also never had a tracked bucket/policy
-- migration, and is about to get its first real traffic now that checkout
-- actually wires up the manual-payment flow. Path convention:
-- {userId}/{timestamp}.{ext} — first segment is the uploader's auth.uid().
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "customers upload own receipts" ON storage.objects;
CREATE POLICY "customers upload own receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "customers read own receipts" ON storage.objects;
CREATE POLICY "customers read own receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "staff read all receipts" ON storage.objects;
CREATE POLICY "staff read all receipts"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

NOTIFY pgrst, 'reload schema';
