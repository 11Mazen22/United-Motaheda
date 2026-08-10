-- Canonical pharmacist prescription review mutation.
-- Review decisions are only valid from pending_review and are role-gated.

CREATE OR REPLACE FUNCTION public.review_prescription(
  p_prescription_id uuid,
  p_decision text,
  p_admin_notes text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.prescriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row public.prescriptions%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager', 'pharmacist')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_review_decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
    FROM public.prescriptions
   WHERE id = p_prescription_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'prescription_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.review_status <> 'pending_review' THEN
    RAISE EXCEPTION 'prescription_already_reviewed' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'rejected' AND coalesce(nullif(trim(p_rejection_reason), ''), '') = '' THEN
    RAISE EXCEPTION 'rejection_reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.prescriptions
     SET review_status = p_decision,
         admin_notes = p_admin_notes,
         rejection_reason = CASE WHEN p_decision = 'rejected' THEN nullif(trim(p_rejection_reason), '') ELSE NULL END,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         updated_at = now()
   WHERE id = p_prescription_id
   RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.review_prescription(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_prescription(uuid, text, text, text) TO authenticated;