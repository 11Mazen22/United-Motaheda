-- Complete manager catalog workspace for promotion product assignment.
-- Search, filters and sorting stay server-side so pagination counts remain exact.

-- Require every writer to provide an explicit lifecycle status. Both historical
-- overloads are replaced so an eight-argument client cannot silently create a
-- disabled draft through a defaulted status parameter.
DROP FUNCTION IF EXISTS public.admin_save_promotion(
  uuid, text, text, text, numeric, timestamptz, timestamptz, boolean, uuid[]
);
DROP FUNCTION IF EXISTS public.admin_save_promotion(
  uuid, text, text, text, numeric, timestamptz, timestamptz, boolean, uuid[], text
);

CREATE FUNCTION public.admin_save_promotion(
  p_id uuid,
  p_name text,
  p_description text,
  p_discount_type text,
  p_discount_value numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_is_enabled boolean,
  p_product_ids uuid[],
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; v_status text;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  IF cardinality(p_product_ids) IS NULL OR cardinality(p_product_ids) = 0 THEN RAISE EXCEPTION 'promotion_requires_products' USING ERRCODE = '22023'; END IF;
  IF p_ends_at <= p_starts_at THEN RAISE EXCEPTION 'invalid_promotion_window' USING ERRCODE = '22023'; END IF;
  IF p_discount_type NOT IN ('percentage', 'fixed_amount') OR p_discount_value <= 0 OR (p_discount_type = 'percentage' AND p_discount_value > 100) THEN RAISE EXCEPTION 'invalid_promotion_discount' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived') THEN RAISE EXCEPTION 'invalid_promotion_status' USING ERRCODE = '22023'; END IF;
  IF p_status = 'expired' AND p_ends_at > now() THEN RAISE EXCEPTION 'expired_promotion_requires_past_end' USING ERRCODE = '22023'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_product_ids) AS assigned(product_id)
    LEFT JOIN public.products product ON product.id = assigned.product_id
    WHERE product.id IS NULL OR product.is_active IS NOT TRUE
  ) THEN RAISE EXCEPTION 'promotion_products_must_be_active' USING ERRCODE = '22023'; END IF;

  v_status := CASE
    WHEN p_status IN ('draft', 'paused', 'archived') THEN p_status
    WHEN p_ends_at <= now() THEN 'expired'
    WHEN p_starts_at > now() THEN 'scheduled'
    ELSE 'active'
  END;

  IF p_id IS NULL THEN
    INSERT INTO public.promotions (name, description, discount_type, discount_value, starts_at, ends_at, is_enabled, status, created_by)
    VALUES (trim(p_name), nullif(trim(p_description), ''), p_discount_type, p_discount_value, p_starts_at, p_ends_at,
      v_status IN ('scheduled', 'active'), v_status, auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.promotions SET name = trim(p_name), description = nullif(trim(p_description), ''), discount_type = p_discount_type,
      discount_value = p_discount_value, starts_at = p_starts_at, ends_at = p_ends_at,
      is_enabled = v_status IN ('scheduled', 'active'), status = v_status, updated_at = now()
    WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'promotion_not_found' USING ERRCODE = 'P0002'; END IF;
  END IF;

  DELETE FROM public.promotion_products WHERE promotion_id = v_id;
  INSERT INTO public.promotion_products (promotion_id, product_id)
  SELECT v_id, product_id FROM unnest(p_product_ids) AS product_id GROUP BY product_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_promotion(uuid, text, text, text, numeric, timestamptz, timestamptz, boolean, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_promotion(uuid, text, text, text, numeric, timestamptz, timestamptz, boolean, uuid[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_search_promotion_products_v2(
  p_query text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_stock_status text DEFAULT 'all',
  p_sort text DEFAULT 'name_asc',
  p_locale text DEFAULT 'en',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  code text,
  barcode text,
  name text,
  name_ar text,
  name_en text,
  price numeric,
  effective_price numeric,
  stock numeric,
  category text,
  category_name text,
  category_name_en text,
  image_url text,
  promotion_id uuid,
  promotion_name text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT
      product.id,
      product."Code" AS code,
      product."Barcode" AS barcode,
      coalesce(nullif(product."Name_En", ''), product."Name_Ar", product."Name") AS name,
      product."Name_Ar" AS name_ar,
      product."Name_En" AS name_en,
      product."Price"::numeric AS price,
      coalesce(active_promotion.effective_price, product."Price"::numeric) AS effective_price,
      product."Stock"::numeric AS stock,
      product."Category" AS category,
      product."Category_Name" AS category_name,
      product."Category_Name_En" AS category_name_en,
      product.image_url,
      active_promotion.id AS promotion_id,
      active_promotion.name AS promotion_name
    FROM public.products AS product
    LEFT JOIN LATERAL (
      SELECT
        promotion.id,
        promotion.name,
        public.promotion_effective_price(
          product."Price"::numeric,
          promotion.discount_type,
          promotion.discount_value
        ) AS effective_price
      FROM public.promotion_products AS assignment
      JOIN public.promotions AS promotion ON promotion.id = assignment.promotion_id
      WHERE assignment.product_id = product.id
        AND promotion.is_enabled
        AND promotion.status IN ('scheduled', 'active')
        AND promotion.starts_at <= now()
        AND promotion.ends_at > now()
      ORDER BY
        public.promotion_effective_price(
          product."Price"::numeric,
          promotion.discount_type,
          promotion.discount_value
        ) ASC,
        promotion.starts_at DESC,
        promotion.id ASC
      LIMIT 1
    ) AS active_promotion ON true
    WHERE public.is_manager()
      AND product.is_active = true
      AND (
        coalesce(btrim(p_query), '') = ''
        OR coalesce(product."Name", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Name_Ar", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Name_En", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Code", '') ILIKE '%' || btrim(p_query) || '%'
        OR coalesce(product."Barcode", '') ILIKE '%' || btrim(p_query) || '%'
      )
      AND (coalesce(btrim(p_category), '') = '' OR product."Category" = p_category)
      AND CASE p_stock_status
        WHEN 'in_stock' THEN product."Stock" > 0
        WHEN 'low_stock' THEN product."Stock" > 0 AND product."Stock" < 10
        WHEN 'out_of_stock' THEN product."Stock" <= 0
        ELSE true
      END
  )
  SELECT eligible.*, count(*) over () AS total_count
  FROM eligible
  ORDER BY
    CASE WHEN p_sort = 'name_asc' AND p_locale = 'ar' THEN lower(coalesce(nullif(name_ar, ''), nullif(name_en, ''), name)) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name_desc' AND p_locale = 'ar' THEN lower(coalesce(nullif(name_ar, ''), nullif(name_en, ''), name)) END DESC NULLS LAST,
    CASE WHEN p_sort = 'name_asc' AND p_locale <> 'ar' THEN lower(coalesce(nullif(name_en, ''), nullif(name_ar, ''), name)) END ASC NULLS LAST,
    CASE WHEN p_sort = 'name_desc' AND p_locale <> 'ar' THEN lower(coalesce(nullif(name_en, ''), nullif(name_ar, ''), name)) END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc' THEN price END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN price END DESC NULLS LAST,
    CASE WHEN p_sort = 'stock_asc' THEN stock END ASC NULLS LAST,
    CASE WHEN p_sort = 'stock_desc' THEN stock END DESC NULLS LAST,
    id ASC
  LIMIT greatest(1, least(p_page_size, 100))
  OFFSET greatest(0, p_page - 1) * greatest(1, least(p_page_size, 100));
$$;

REVOKE ALL ON FUNCTION public.admin_search_promotion_products_v2(text, text, text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_promotion_products_v2(text, text, text, text, text, integer, integer) TO authenticated;

-- Returns every overlapping enabled campaign for the selected products and
-- editor time window. The current promotion is excluded while editing.
CREATE OR REPLACE FUNCTION public.admin_detect_promotion_conflicts(
  p_product_ids uuid[],
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_promotion_id uuid DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  promotion_id uuid,
  promotion_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    assignment.product_id,
    promotion.id,
    promotion.name,
    promotion.starts_at,
    promotion.ends_at,
    promotion.status
  FROM public.promotion_products AS assignment
  JOIN public.promotions AS promotion ON promotion.id = assignment.promotion_id
  WHERE public.is_manager()
    AND assignment.product_id = ANY(coalesce(p_product_ids, '{}'::uuid[]))
    AND promotion.is_enabled = true
    AND promotion.status IN ('scheduled', 'active')
    AND promotion.starts_at < p_ends_at
    AND promotion.ends_at > p_starts_at
    AND (p_exclude_promotion_id IS NULL OR promotion.id <> p_exclude_promotion_id)
  ORDER BY promotion.starts_at ASC, promotion.id ASC, assignment.product_id ASC;
$$;

REVOKE ALL ON FUNCTION public.admin_detect_promotion_conflicts(uuid[], timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_detect_promotion_conflicts(uuid[], timestamptz, timestamptz, uuid) TO authenticated;
