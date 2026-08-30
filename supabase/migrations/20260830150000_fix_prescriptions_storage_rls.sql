-- Fix Storage RLS for prescriptions bucket
-- Bucket is private (public: false) which is correct.
-- But there are zero RLS policies, so all writes are blocked.

-- Allow authenticated users to upload their own prescriptions
-- Path format: {userId}/{prescriptionId}/image.{ext}
-- We enforce that the first path segment equals the user's own uid.

CREATE POLICY "Users can upload own prescriptions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update (upsert) their own prescription images
CREATE POLICY "Users can update own prescriptions"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own prescription images
CREATE POLICY "Users can read own prescriptions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow pharmacists and admins to read ALL prescription images (for review)
CREATE POLICY "Staff can read all prescriptions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('pharmacist', 'admin', 'manager')
  )
);

-- Allow users to delete their own prescription images
CREATE POLICY "Users can delete own prescriptions"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Set a reasonable file size limit on the bucket (10MB)
UPDATE storage.buckets
SET 
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'prescriptions';
