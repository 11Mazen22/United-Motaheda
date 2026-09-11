-- 20261010200000's restore UPDATE hit the exact same profiles_guard_role_status_trg
-- guard (it wasn't wrapped in the set_config bypass, same mistake as
-- 20261010180000's original backfill) -- confirmed live: both accounts still
-- showed role='driver' after that migration ran. Retrying with the bypass.

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  UPDATE public.profiles
  SET role = 'admin'::public.app_role, updated_at = now()
  WHERE id IN (
    'c9ca0ba9-f4c8-41a4-98ce-64b0394ccac2',
    'df4c117e-38af-44a3-a227-77c883b74c10'
  );
END;
$$;
