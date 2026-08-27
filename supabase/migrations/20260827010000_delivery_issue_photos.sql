-- =============================================================================
-- Delivery issue reports (`delivery_issues`) had no way to attach a photo —
-- a driver reporting "item damaged" or "wrong address" could only submit
-- free text, which the pharmacist/ops review team on the other end has to
-- take on faith. This adds a photo column plus a dedicated, driver-scoped
-- storage bucket for it.
--
-- A new bucket rather than reusing the existing driver-documents bucket:
-- that bucket's own storage.objects RLS policy isn't defined in any tracked
-- migration (confirmed absent from both supabase/migrations and database/
-- during the driver-system audit) — its real path-scoping rules are
-- unknown, so building a new feature on top of an undocumented policy would
-- be guessing. This bucket's policy is fully defined here instead.
-- =============================================================================

ALTER TABLE public.delivery_issues
  ADD COLUMN IF NOT EXISTS photo_url text;

COMMENT ON COLUMN public.delivery_issues.photo_url IS
  'Optional driver-attached photo evidence (delivery-issue-photos bucket, path {driver_id}/{order_id}/{timestamp}.jpg). Null when the driver submitted text-only.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-issue-photos', 'delivery-issue-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {driver_id}/{order_id}/{filename} — (storage.foldername(name))[1]
-- is the first path segment, i.e. the uploading driver's own auth.uid().
CREATE POLICY "drivers upload own issue photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-issue-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "drivers read own issue photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'delivery-issue-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "staff read all issue photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'delivery-issue-photos'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

NOTIFY pgrst, 'reload schema';
