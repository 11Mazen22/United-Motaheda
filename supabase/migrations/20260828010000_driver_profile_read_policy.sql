-- =============================================================================
-- Confirmed live on a real approved driver account: getMyDriverProfile()'s
-- query against "DriverProfile" (a simple select-by-unique-userId lookup,
-- already backed by the column's own unique index) was hanging past a 10s
-- abort timeout. This table's SELECT policy for the driver themselves isn't
-- defined in any tracked migration -- same undocumented-policy gap already
-- found and fixed today for the driver-documents and receipts storage
-- buckets. Whatever policy exists today may be doing something expensive
-- (a subquery/join RLS has to re-evaluate per row) rather than the simple
-- own-row check this actually needs. Replacing it with a known-minimal one
-- removes that as a possible cause regardless of what was there before.
-- =============================================================================

ALTER TABLE public."DriverProfile" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers read own profile" ON public."DriverProfile";
CREATE POLICY "drivers read own profile"
  ON public."DriverProfile"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = "userId");

DROP POLICY IF EXISTS "staff read all driver profiles" ON public."DriverProfile";
CREATE POLICY "staff read all driver profiles"
  ON public."DriverProfile"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

NOTIFY pgrst, 'reload schema';
