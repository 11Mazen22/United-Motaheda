-- Promotion workflow and manager catalog API.
-- `status` is the persisted workflow intent. Scheduled/active/expired are also
-- reconciled against the time window by clients and pricing queries.

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.promotions
SET status = CASE
  WHEN NOT is_enabled THEN 'paused'
  WHEN ends_at <= now() THEN 'expired'
  WHEN starts_at > now() THEN 'scheduled'
  ELSE 'active'
END
WHERE status IS NULL;

ALTER TABLE public.promotions
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_status_check;
ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_status_check
  CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived'));

CREATE INDEX IF NOT EXISTS promotions_status_window_idx
  ON public.promotions (status, starts_at, ends_at);

-- Only active catalog products are eligible for new assignments. This preserves
-- historical assignments while preventing unpublished/inactive products from
-- being discounted by a new or edited campaign.
CREATE OR REPLACE FUNCTION public.admin_search_promotion_products(
  p_query text DEFAULT NULL,
  p_category text DEFAULT NULL,
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
  stock numeric,
  category text,
  category_name text,
  category_name_en text,
  image_url text,
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
      product."Stock"::numeric AS stock,
      product."Category" AS category,
      product."Category_Name" AS category_name,
      product."Category_Name_En" AS category_name_en,
      product.image_url
    FROM public.products AS product
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
      AND (
        coalesce(btrim(p_category), '') = ''
        OR product."Category" = p_category
      )
  )
  SELECT eligible.*, count(*) over () AS total_count
  FROM eligible
  ORDER BY lower(coalesce(name_en, name_ar, name)), id
  LIMIT greatest(1, least(p_page_size, 100))
  OFFSET greatest(0, p_page - 1) * greatest(1, least(p_page_size, 100));
$$;

REVOKE ALL ON FUNCTION public.admin_search_promotion_products(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_promotion_products(text, text, integer, integer) TO authenticated;

-- Promotion mutations are transactional and validate that every new assignment
-- remains in the active catalog. Existing legacy inactive assignments may be
-- removed, but may not be retained on a subsequent save.
--
-- Drop both known overloads before recreating. PostgreSQL's CREATE OR REPLACE
-- cannot change parameter defaults on an existing function signature — it must
-- be dropped first. Both overloads are dropped here for idempotency:
--   • 9-param: created by 20260713150000 (no p_status)
--   • 10-param: may exist on remote with a defaulted p_status from a prior
--     manual or out-of-band deployment; dropping it ensures a clean replace.
-- (20260716130000 repeats both drops for belt-and-suspenders idempotency.)
DROP FUNCTION IF EXISTS public.admin_save_promotion(
  uuid, text, text, text, numeric, timestamptz, timestamptz, boolean, uuid[]
);
DROP FUNCTION IF EXISTS public.admin_save_promotion(
  uuid, text, text, text, numeric, timestamptz, timestamptz, boolean, uuid[], text
);
CREATE OR REPLACE FUNCTION public.admin_save_promotion(
  p_id uuid, p_name text, p_description text, p_discount_type text, p_discount_value numeric,
  p_starts_at timestamptz, p_ends_at timestamptz, p_is_enabled boolean, p_product_ids uuid[],
  p_status text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Status changes use the same server-side authorization and preserve the
-- scheduling window. Re-enabling a nonterminal promotion derives active vs.
-- scheduled from the current time.
CREATE OR REPLACE FUNCTION public.admin_set_promotion_status(p_promotion_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE promotion public.promotions%ROWTYPE; v_status text;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  SELECT * INTO promotion FROM public.promotions WHERE id = p_promotion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'promotion_not_found' USING ERRCODE = 'P0002'; END IF;
  IF p_status NOT IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived') THEN RAISE EXCEPTION 'invalid_promotion_status' USING ERRCODE = '22023'; END IF;
  v_status := CASE
    WHEN p_status IN ('draft', 'paused', 'archived') THEN p_status
    WHEN promotion.ends_at <= now() THEN 'expired'
    WHEN promotion.starts_at > now() THEN 'scheduled'
    ELSE 'active'
  END;
  UPDATE public.promotions
  SET status = v_status, is_enabled = v_status IN ('scheduled', 'active'), updated_at = now()
  WHERE id = p_promotion_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_promotion_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_promotion_status(uuid, text) TO authenticated;

-- Canonical pricing only considers promotions that are active by workflow and
-- time window. (Scheduled rows become applicable at starts_at.)
CREATE OR REPLACE VIEW public.product_effective_prices
WITH (security_invoker = true) AS
SELECT
  product.id, product."Code" AS code, product."Barcode" AS barcode,
  product."Name_Ar" AS name_ar, product."Name_En" AS name_en,
  product."Price"::numeric AS base_price, product."Stock"::numeric AS stock,
  product."Category_Name" AS category_name, product."Category_Name_En" AS category_name_en,
  product.is_active, product.image_url, product.rating_avg, product.rating_count,
  product.is_new, product.is_bestseller,
  active_promotion.id AS promotion_id, active_promotion.name AS promotion_name,
  active_promotion.discount_type AS promotion_discount_type,
  active_promotion.discount_value AS promotion_discount_value,
  active_promotion.ends_at AS promotion_ends_at,
  COALESCE(active_promotion.effective_price, product."Price"::numeric) AS effective_price,
  active_promotion.id IS NOT NULL AS has_active_promotion
FROM public.products AS product
LEFT JOIN LATERAL (
  SELECT promotion.id, promotion.name, promotion.discount_type, promotion.discount_value, promotion.ends_at,
    public.promotion_effective_price(product."Price"::numeric, promotion.discount_type, promotion.discount_value) AS effective_price
  FROM public.promotion_products AS assignment
  JOIN public.promotions AS promotion ON promotion.id = assignment.promotion_id
  WHERE assignment.product_id = product.id
    AND promotion.is_enabled
    AND promotion.status IN ('scheduled', 'active')
    AND promotion.starts_at <= now()
    AND promotion.ends_at > now()
  ORDER BY public.promotion_effective_price(product."Price"::numeric, promotion.discount_type, promotion.discount_value) ASC,
    promotion.starts_at DESC, promotion.id ASC
  LIMIT 1
) AS active_promotion ON true;

-- Keep bulk operations aligned with the lifecycle invariant.
CREATE OR REPLACE FUNCTION public.admin_bulk_enable_promotions(promotion_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  UPDATE public.promotions
  SET status = CASE WHEN ends_at <= now() THEN 'expired' WHEN starts_at > now() THEN 'scheduled' ELSE 'active' END,
      is_enabled = ends_at > now(), updated_at = now()
  WHERE id = ANY(promotion_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_bulk_disable_promotions(promotion_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501'; END IF;
  UPDATE public.promotions SET status = 'paused', is_enabled = false, updated_at = now() WHERE id = ANY(promotion_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
