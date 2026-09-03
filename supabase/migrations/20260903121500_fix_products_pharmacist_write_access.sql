-- Second regression from 20260902140000_close_anon_write_and_auth_gaps.sql,
-- same root cause as 20260903120000_fix_orders_dashboard_pharmacist_access.sql:
-- that migration correctly enabled RLS on products (previously wide open to
-- anon), but gated writes on is_manager() alone. ProductManager.tsx's own
-- header comment documents pharmacist as "Full CRUD" minus bulk import
-- (canBulkImport is a UI-only gate, admin/manager) -- confirmed live: a
-- pharmacist's product edit silently affected 0 rows (RLS filters the row
-- out of the UPDATE ... WHERE match rather than erroring), which surfaces
-- to the pharmacist as a save failure.
DROP POLICY IF EXISTS products_write_staff ON public.products;
CREATE POLICY products_write_staff
  ON public.products FOR ALL
  TO authenticated
  USING (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  )
  WITH CHECK (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  );

NOTIFY pgrst, 'reload schema';
