-- A live test of the previous migration's RLS policy exposed a real gap:
-- WITH CHECK only constrains the specific columns it references (user_id,
-- status, payment_status, payment_method) -- it has no way to say "and
-- nothing else changed." A customer could still smuggle an unrelated column
-- (total, assigned_driver_id, ...) into the same UPDATE as long as the
-- checked columns end up with allowed values. A column-level GRANT can't
-- close this either -- confirmed live that `authenticated` already holds a
-- blanket UPDATE grant on every column of orders (Supabase's default), so a
-- narrower GRANT on top of it restricts nothing.
--
-- The idiomatic fix: a SECURITY DEFINER RPC whose body only ever writes
-- exactly the five columns this flow needs. There is no column list for a
-- caller to smuggle anything through -- the function's own SQL is the only
-- thing that can touch the row, and it never touches anything but these
-- five. This becomes the actual write path; the RLS policy from the
-- previous migration stays in place as a second-layer backstop for the
-- specific case of a caller going around the RPC and hitting the REST
-- update directly (it still correctly blocks tampering with status /
-- payment_status / payment_method in that case, which is the risk that
-- actually matters -- pushing an order into a fulfillment state it hasn't
-- earned).
CREATE OR REPLACE FUNCTION public.submit_manual_payment_proof(
  p_order_id uuid,
  p_transfer_number text,
  p_payment_proof_url text,
  p_payment_method text
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF p_payment_method NOT IN ('vodafone', 'instapay') THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '22023';
  END IF;
  IF p_transfer_number IS NULL OR length(trim(p_transfer_number)) = 0 THEN
    RAISE EXCEPTION 'transfer_number_required' USING ERRCODE = '22023';
  END IF;
  IF p_payment_proof_url IS NULL OR length(trim(p_payment_proof_url)) = 0 THEN
    RAISE EXCEPTION 'payment_proof_url_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET
    status = 'pending_payment',
    payment_status = 'pending_verification',
    transfer_number = trim(p_transfer_number),
    payment_proof_url = p_payment_proof_url,
    payment_method = p_payment_method
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'pending_payment'
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found_or_not_eligible' USING ERRCODE = '42501';
  END IF;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_manual_payment_proof(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_manual_payment_proof(uuid, text, text, text) TO authenticated;
