-- Atomic pharmacist stock adjustment.
-- inventory_state remains the source of truth; the existing trigger mirrors
-- available stock to products."Stock" for catalog consumers.

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id text,
  p_delta integer,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_state public.inventory_state%rowtype;
  v_total integer;
  v_key text;
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

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'invalid_delta' USING ERRCODE = '22023';
  END IF;

  v_key := NULLIF(trim(p_idempotency_key), '');
  IF v_key IS NULL OR length(v_key) < 16 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '22023';
  END IF;

  PERFORM public._inventory_lock(p_product_id);
  v_state := public._inventory_ensure_state(p_product_id);

  IF EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE product_id = p_product_id AND idempotency_key = v_key
  ) THEN
    SELECT * INTO v_state FROM public.inventory_state WHERE product_id = p_product_id;
    RETURN jsonb_build_object(
      'product_id', p_product_id, 'delta', p_delta, 'total', v_state.total,
      'reserved', v_state.reserved, 'committed', v_state.committed,
      'available', v_state.total - v_state.reserved - v_state.committed,
      'replay', true
    );
  END IF;

  v_total := v_state.total + p_delta;
  IF v_total < v_state.reserved + v_state.committed THEN
    RAISE EXCEPTION 'adjustment_below_committed_stock' USING ERRCODE = '22023';
  END IF;

  UPDATE public.inventory_state SET total = v_total WHERE product_id = p_product_id;

  INSERT INTO public.stock_movements (
    product_id, delta_total, total_after, reserved_after, committed_after,
    kind, actor_id, idempotency_key, metadata
  ) VALUES (
    p_product_id, p_delta, v_total, v_state.reserved, v_state.committed,
    'adjust', auth.uid(), v_key,
    jsonb_build_object('reason', NULLIF(trim(coalesce(p_reason, '')), ''))
  );

  RETURN jsonb_build_object(
    'product_id', p_product_id, 'delta', p_delta, 'total', v_total,
    'reserved', v_state.reserved, 'committed', v_state.committed,
    'available', v_total - v_state.reserved - v_state.committed,
    'replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_inventory(text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(text, integer, text, text) TO authenticated;