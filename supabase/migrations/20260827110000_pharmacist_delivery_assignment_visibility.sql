-- Pharmacist visibility into delivery_assignments — needed for the order
-- detail screen's new "Driver" section (assigned/accepted/picked up/
-- delivered handoff state). Confirmed live: "delivery_assignments: staff
-- select all" only covers admin/manager, not pharmacist, unlike orders
-- (which this session already fixed separately).

DROP POLICY IF EXISTS delivery_assignments_select_pharmacist ON public.delivery_assignments;
CREATE POLICY delivery_assignments_select_pharmacist
  ON public.delivery_assignments FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'pharmacist'
  );
