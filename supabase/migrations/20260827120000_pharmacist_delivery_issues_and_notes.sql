-- Pharmacist visibility + resolution on delivery_issues, and a proper RPC
-- for adding an order note — both close real gaps found while deepening the
-- order detail screen's production capability:
--
--   1. delivery_issues (driver-reported delivery problems: customer
--      unreachable, wrong address, item damaged, etc.) only ever granted
--      admin/manager SELECT/UPDATE, matching the same pre-existing gap this
--      session already fixed on delivery_assignments. A pharmacist working
--      an order has no visibility into a driver-reported problem blocking
--      it, and no way to acknowledge/resolve one.
--
--   2. order_notes already had staff INSERT/SELECT RLS (20260715090000) —
--      a plain client insert is safe here (no server-side transition to
--      validate, it's just an append-only log), so no RPC is strictly
--      required, but resolve_delivery_issue() needs one: resolving is a
--      real state transition (open/acknowledged -> resolved) that should be
--      validated server-side, not trusted from a raw client UPDATE.

DROP POLICY IF EXISTS delivery_issues_select_pharmacist ON public.delivery_issues;
CREATE POLICY delivery_issues_select_pharmacist
  ON public.delivery_issues FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'pharmacist'
  );

CREATE OR REPLACE FUNCTION public.resolve_delivery_issue(p_issue_id uuid, p_resolution_note text)
RETURNS public.delivery_issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row public.delivery_issues;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'manager', 'pharmacist') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF coalesce(trim(p_resolution_note), '') = '' THEN
    RAISE EXCEPTION 'resolution_note_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.delivery_issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'issue_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status = 'resolved' THEN
    RAISE EXCEPTION 'issue_already_resolved' USING ERRCODE = '22023';
  END IF;

  UPDATE public.delivery_issues
  SET status = 'resolved',
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = p_resolution_note
  WHERE id = p_issue_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_delivery_issue(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_delivery_issue(uuid, text) TO authenticated;
