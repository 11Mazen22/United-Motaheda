-- Root cause of the Prescriptions Queue / Workbench 400 error, confirmed via
-- the browser console: PostgREST rejects the client's
-- `profiles(full_name, phone)` embed on prescriptions with "Bad Request"
-- because no foreign key exists from public.prescriptions to public.profiles
-- -- prescriptions.user_id only references auth.users(id), and auth.users is
-- not exposed to the REST API, so PostgREST has no relationship to embed
-- through. This was never an RLS/permissions issue (confirmed: the error was
-- 400, not 401/403) -- the earlier RLS-policy migration was still a real,
-- separate gap worth having fixed, just not the cause of this one.
--
-- public.profiles.id already equals auth.users.id for every real account
-- (the standard Supabase profile-row-per-auth-user pattern), so adding this
-- FK is safe and non-breaking: it doesn't replace the existing FK to
-- auth.users, it just gives PostgREST a second, directly-embeddable path to
-- the richer profiles table the client actually wants (full_name, phone).
--
-- Safe to re-run.

ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_user_id_profiles_fkey;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

NOTIFY pgrst, 'reload schema';
