-- Fix missing ON DELETE CASCADE on prescriptions -> profiles FK
ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_user_id_profiles_fkey;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
