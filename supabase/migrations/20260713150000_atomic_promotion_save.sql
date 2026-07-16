-- Keeps promotion definition and its product assignments transactional.
CREATE OR REPLACE FUNCTION public.admin_save_promotion(
  p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric,
  p_starts_at timestamptz, p_ends_at timestamptz, p_is_enabled boolean, p_product_ids uuid[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  IF cardinality(p_product_ids) IS NULL OR cardinality(p_product_ids) = 0 THEN RAISE EXCEPTION 'promotion_requires_products' USING ERRCODE = '22023'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.promotions (name, description, discount_type, discount_value, starts_at, ends_at, is_enabled, created_by)
    VALUES (p_name, nullif(trim(p_description), ''), p_discount_type, p_discount_value, p_starts_at, p_ends_at, p_is_enabled, auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.promotions SET name = p_name, description = nullif(trim(p_description), ''), discount_type = p_discount_type,
      discount_value = p_discount_value, starts_at = p_starts_at, ends_at = p_ends_at, is_enabled = p_is_enabled, updated_at = now()
    WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'promotion_not_found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  DELETE FROM public.promotion_products WHERE promotion_id = v_id;
  INSERT INTO public.promotion_products (promotion_id, product_id)
  SELECT v_id, product_id FROM unnest(p_product_ids) AS product_id GROUP BY product_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_promotion(uuid, text, text, text, numeric, timestamptz, timestamptz, boolean, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_promotion(uuid, text, text, text, numeric, timestamptz, timestamptz, boolean, uuid[]) TO authenticated;

-- ─── Single-row delete ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_promotion(promotion_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.promotions WHERE id = promotion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'promotion_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_promotion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_promotion(uuid) TO authenticated;

-- ─── Bulk mutations ──────────────────────────────────────────────────────────
-- All three take the promotion PK array (uuid[], not product ids) and return
-- the number of rows actually affected so the caller can reconcile optimistic
-- UI state against what really changed.

CREATE OR REPLACE FUNCTION public.admin_bulk_enable_promotions(promotion_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  UPDATE public.promotions SET is_enabled = true, updated_at = now() WHERE id = ANY(promotion_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_bulk_enable_promotions(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_enable_promotions(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_bulk_disable_promotions(promotion_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  UPDATE public.promotions SET is_enabled = false, updated_at = now() WHERE id = ANY(promotion_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_bulk_disable_promotions(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_disable_promotions(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_bulk_delete_promotions(promotion_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.promotions WHERE id = ANY(promotion_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_bulk_delete_promotions(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_delete_promotions(uuid[]) TO authenticated;
