-- Add is_active column to profiles table.
-- This column gates staff access (adminStaffApi) and account activation status.
-- Customer accounts have NULL (not set); staff default to true.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT NULL;

-- Force PostgREST to reload its schema cache so the new column is immediately usable.
NOTIFY pgrst, 'reload schema';
