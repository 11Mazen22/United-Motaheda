-- Two gaps found auditing the product catalog:
--
-- 1. No CHECK constraint anywhere stops a negative price or stock on
--    products — confirmed via Prisma introspection (the products model
--    carries no "check constraints" doc-comment the way sibling tables do)
--    and directly against the live schema. The only guard was client-side
--    Zod validation, trivially bypassed by any direct Supabase call from an
--    authenticated staff session. A negative price would flow straight into
--    effective_price / checkout totals with nothing to catch it.
--
-- 2. products_write_staff (20260903121500_fix_products_pharmacist_write_access.sql)
--    correctly added pharmacist to INSERT/UPDATE via a single `FOR ALL`
--    policy, but FOR ALL also covers DELETE — so it accidentally granted
--    pharmacists delete access too. ProductManager.tsx documents "pharmacist:
--    view and edit (no bulk import)" with no mention of delete, and enforces
--    that boundary only client-side (`canDelete = ["admin","manager"]`) — a
--    pharmacist calling supabase.from('products').delete() directly bypasses
--    it entirely, since RLS (the real boundary) was more permissive than the
--    UI. Split into two policies: one for insert/update (admin, manager,
--    pharmacist — unchanged from the fix this replaces), one for delete
--    (admin, manager only).

ALTER TABLE public.products
  ADD CONSTRAINT products_price_non_negative CHECK ("Price" IS NULL OR "Price" >= 0),
  ADD CONSTRAINT products_stock_non_negative CHECK ("Stock" IS NULL OR "Stock" >= 0);

DROP POLICY IF EXISTS products_write_staff ON public.products;

CREATE POLICY products_write_staff
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  );

CREATE POLICY products_update_staff
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  )
  WITH CHECK (
    public.is_manager()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist')
  );

CREATE POLICY products_delete_managers_only
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_manager());

NOTIFY pgrst, 'reload schema';
