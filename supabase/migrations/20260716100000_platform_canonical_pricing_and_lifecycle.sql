-- Platform-wide canonical pricing and order-lifecycle cutover.
-- Promotions are the only discount authority. Product Price remains the catalog
-- base price; effective prices are resolved at query/order creation time.

CREATE OR REPLACE VIEW public.product_effective_prices
WITH (security_invoker = true) AS
SELECT
  product.id,
  product."Code" AS code,
  product."Barcode" AS barcode,
  product."Name_Ar" AS name_ar,
  product."Name_En" AS name_en,
  product."Price"::numeric AS base_price,
  product."Stock"::numeric AS stock,
  product."Category_Name" AS category_name,
  product."Category_Name_En" AS category_name_en,
  product.is_active,
  product.image_url,
  product.rating_avg,
  product.rating_count,
  product.is_new,
  product.is_bestseller,
  active_promotion.id AS promotion_id,
  active_promotion.name AS promotion_name,
  active_promotion.discount_type AS promotion_discount_type,
  active_promotion.discount_value AS promotion_discount_value,
  active_promotion.ends_at AS promotion_ends_at,
  COALESCE(active_promotion.effective_price, product."Price"::numeric) AS effective_price,
  active_promotion.id IS NOT NULL AS has_active_promotion
FROM public.products AS product
LEFT JOIN LATERAL (
  SELECT
    promotion.id,
    promotion.name,
    promotion.discount_type,
    promotion.discount_value,
    promotion.ends_at,
    public.promotion_effective_price(
      product."Price"::numeric,
      promotion.discount_type,
      promotion.discount_value
    ) AS effective_price
  FROM public.promotion_products AS assignment
  JOIN public.promotions AS promotion ON promotion.id = assignment.promotion_id
  WHERE assignment.product_id = product.id
    AND promotion.is_enabled
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
) AS active_promotion ON true;

CREATE OR REPLACE FUNCTION public.search_effective_products(
  p_query text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_in_stock boolean DEFAULT false,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_is_sale boolean DEFAULT false,
  p_sort text DEFAULT 'newest',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  code text,
  barcode text,
  name_ar text,
  name_en text,
  base_price numeric,
  effective_price numeric,
  stock numeric,
  category_name text,
  category_name_en text,
  image_url text,
  rating_avg numeric,
  rating_count integer,
  is_new boolean,
  is_bestseller boolean,
  promotion_id uuid,
  promotion_name text,
  promotion_discount_type text,
  promotion_discount_value numeric,
  promotion_ends_at timestamptz,
  has_active_promotion boolean,
  discount_amount numeric,
  discount_percent numeric,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      product.*,
      greatest(0, product.base_price - product.effective_price) AS discount_amount,
      CASE
        WHEN product.base_price > 0 THEN round(
          100 * greatest(0, product.base_price - product.effective_price) / product.base_price,
          2
        )
        ELSE 0
      END AS discount_percent
    FROM public.product_effective_prices AS product
    WHERE product.is_active = true
      AND (p_query IS NULL OR btrim(p_query) = '' OR (
        coalesce(product.name_ar, '') ILIKE '%' || p_query || '%'
        OR coalesce(product.name_en, '') ILIKE '%' || p_query || '%'
        OR coalesce(product.code, '') ILIKE '%' || p_query || '%'
        OR coalesce(product.barcode, '') ILIKE '%' || p_query || '%'
      ))
      AND (p_category IS NULL OR btrim(p_category) = '' OR product.category_name = p_category OR product.category_name_en = p_category)
      AND (NOT p_in_stock OR product.stock > 0)
      AND (p_min_price IS NULL OR product.effective_price >= p_min_price)
      AND (p_max_price IS NULL OR product.effective_price <= p_max_price)
      AND (NOT p_is_sale OR product.has_active_promotion)
  )
  SELECT
    filtered.id,
    filtered.code,
    filtered.barcode,
    filtered.name_ar,
    filtered.name_en,
    filtered.base_price,
    filtered.effective_price,
    filtered.stock,
    filtered.category_name,
    filtered.category_name_en,
    filtered.image_url,
    filtered.rating_avg,
    filtered.rating_count,
    filtered.is_new,
    filtered.is_bestseller,
    filtered.promotion_id,
    filtered.promotion_name,
    filtered.promotion_discount_type,
    filtered.promotion_discount_value,
    filtered.promotion_ends_at,
    filtered.has_active_promotion,
    filtered.discount_amount,
    filtered.discount_percent,
    count(*) over () AS total_count
  FROM filtered
  ORDER BY
    CASE WHEN p_sort = 'price_asc' THEN filtered.effective_price END ASC,
    CASE WHEN p_sort = 'price_desc' THEN filtered.effective_price END DESC,
    CASE WHEN p_sort = 'name_asc' THEN filtered.name_en END ASC,
    filtered.name_en ASC NULLS LAST,
    filtered.id
  LIMIT greatest(1, least(p_limit, 100))
  OFFSET greatest(0, p_offset);
$$;

CREATE OR REPLACE FUNCTION public.get_effective_product(p_product_id uuid)
RETURNS SETOF public.product_effective_prices
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.product_effective_prices
  WHERE id = p_product_id AND is_active = true;
$$;

REVOKE ALL ON FUNCTION public.search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_effective_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_product(uuid) TO anon, authenticated;

-- Normalize all persisted historical states before runtime writers are changed.
UPDATE public.orders
SET status = CASE status::text
  WHEN 'pending_payment' THEN 'payment_pending'::public.order_status
  WHEN 'confirmed' THEN 'payment_approved'::public.order_status
  WHEN 'processing' THEN 'preparing'::public.order_status
  WHEN 'shipped' THEN 'out_for_delivery'::public.order_status
  WHEN 'picked_up' THEN 'out_for_delivery'::public.order_status
  ELSE status
END
WHERE status::text IN ('pending_payment', 'confirmed', 'processing', 'shipped', 'picked_up');

-- Canonical transitions are the sole mutation path for staff and drivers.
CREATE OR REPLACE FUNCTION public.transition_order(p_order_id uuid, p_next_status text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'manager', 'pharmacist', 'driver') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    (v_order.status::text = 'pending' AND p_next_status IN ('verification', 'cancelled')) OR
    (v_order.status::text = 'verification' AND p_next_status IN ('payment_pending', 'payment_approved', 'cancelled')) OR
    (v_order.status::text = 'payment_pending' AND p_next_status IN ('payment_approved', 'cancelled')) OR
    (v_order.status::text = 'payment_approved' AND p_next_status IN ('preparing', 'cancelled')) OR
    (v_order.status::text = 'preparing' AND p_next_status IN ('ready', 'cancelled')) OR
    (v_order.status::text = 'ready' AND p_next_status IN ('driver_assigned', 'cancelled')) OR
    (v_order.status::text = 'driver_assigned' AND p_next_status IN ('driver_accepted', 'cancelled')) OR
    (v_order.status::text = 'driver_accepted' AND p_next_status IN ('out_for_delivery', 'cancelled')) OR
    (v_order.status::text = 'out_for_delivery' AND p_next_status IN ('delivered', 'cancelled')) OR
    (v_order.status::text IN ('delivered', 'cancelled') AND p_next_status = 'archived')
  ) THEN
    RAISE EXCEPTION 'invalid_order_transition' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'driver' THEN
    IF p_next_status NOT IN ('driver_accepted', 'out_for_delivery', 'delivered')
       OR v_order.assigned_driver_id IS DISTINCT FROM auth.uid()
       OR NOT EXISTS (
         SELECT 1
         FROM public.delivery_assignments AS assignment
         WHERE assignment.order_id = p_order_id
           AND assignment.driver_id = auth.uid()
           AND (
             (p_next_status = 'driver_accepted' AND assignment.response_status = 'offered')
             OR (p_next_status IN ('out_for_delivery', 'delivered') AND assignment.response_status = 'accepted')
           )
       ) THEN
      RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.orders
  SET status = p_next_status::public.order_status,
      last_status_at = now(),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.transition_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order(uuid, text) TO authenticated;

-- Keep the previous admin RPC as a compatibility entry point, but make it
-- delegate to the single canonical transition implementation above.
CREATE OR REPLACE FUNCTION public.admin_transition_order(p_order_id uuid, p_next_status text)
RETURNS public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.transition_order(p_order_id, p_next_status);
$$;
REVOKE ALL ON FUNCTION public.admin_transition_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_transition_order(uuid, text) TO authenticated;
