-- Profile-photo uploads (edit-profile screen, both apps) had no backing
-- storage. There was no "avatars" bucket, no policy, and the edit-profile
-- screen's "Edit Photo" button had no handler wired up at all -- confirmed
-- live: the screen only ever rendered initials, never a real photo, and
-- tapping the button did nothing.
--
-- Public bucket (mirrors "brand"/"receipts" -- an avatar is meant to be
-- directly displayable everywhere the user's profile shows up, same as the
-- avatar_url/picture Google OAuth already hands us, with no backend round-
-- trip needed to view it). Path convention {userId}/{timestamp}.{ext},
-- matching driver-documents/receipts -- each upload is a new object, so only
-- INSERT is needed, scoped to the caller's own folder.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "users upload own avatar" ON storage.objects;
CREATE POLICY "users upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
