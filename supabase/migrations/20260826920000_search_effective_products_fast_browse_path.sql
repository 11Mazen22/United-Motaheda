-- =============================================================================
-- Fix: search_effective_products became ~10s+ for plain browse/featured calls
-- (p_query = NULL) after the Stage 1 hybrid-ranking rewrite
-- (20260826090000_product_intelligence_stage1_core.sql) — even though the
-- relevance_score CASE already short-circuited to a constant 0 for that case,
-- the query still carried the added `JOIN public.products p` (needed only for
-- p.search_vector, which only the search path uses) and the single combined
-- CTE shape apparently prevented the planner from pushing the LIMIT down the
-- way the pre-Stage-1 version did. Net effect: DailyEdit/FlashSaleSection and
-- any other "featured"/no-query listing timed out client-side and silently
-- rendered nothing.
--
-- Fix: split into two genuinely separate query bodies — a plain filtered
-- browse query (no join to products, no ranking, matches the pre-Stage-1
-- shape) when there's no search term, and the full hybrid-ranking query only
-- when there is one. Same signature, same return shape, same ranking logic
-- for the search path — nothing about actual search behavior changes.
-- =============================================================================

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
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_q      text := nullif(trim(coalesce(p_query, '')), '');
  v_expanded text;
  v_uq     text;
  v_tsq    tsquery;
BEGIN
  -- ── Fast path: no search term — plain filtered browse/listing ──────────────
  IF v_q IS NULL THEN
    RETURN QUERY
    WITH filtered AS (
      SELECT
        product.*,
        GREATEST(0, product.base_price - product.effective_price) AS d_amount,
        CASE
          WHEN product.base_price > 0 THEN round(
            100 * GREATEST(0, product.base_price - product.effective_price) / product.base_price, 2
          )
          ELSE 0
        END AS d_percent
      FROM public.product_effective_prices AS product
      WHERE product.is_active = true
        AND (p_category IS NULL OR btrim(p_category) = '' OR product.category_name = p_category OR product.category_name_en = p_category)
        AND (NOT p_in_stock OR product.stock > 0)
        AND (p_min_price IS NULL OR product.effective_price >= p_min_price)
        AND (p_max_price IS NULL OR product.effective_price <= p_max_price)
        AND (NOT p_is_sale OR product.has_active_promotion)
    ),
    counted AS (
      SELECT filtered.*, count(*) OVER () AS row_total FROM filtered
    )
    SELECT
      counted.id, counted.code, counted.barcode, counted.name_ar, counted.name_en,
      counted.base_price, counted.effective_price, counted.stock,
      counted.category_name, counted.category_name_en, counted.image_url,
      counted.rating_avg, counted.rating_count, counted.is_new, counted.is_bestseller,
      counted.promotion_id, counted.promotion_name, counted.promotion_discount_type,
      counted.promotion_discount_value, counted.promotion_ends_at, counted.has_active_promotion,
      counted.d_amount, counted.d_percent, counted.row_total
    FROM counted
    ORDER BY
      CASE WHEN p_sort = 'price_asc' THEN counted.effective_price END ASC,
      CASE WHEN p_sort = 'price_desc' THEN counted.effective_price END DESC,
      CASE WHEN p_sort = 'name_asc' THEN counted.name_en END ASC,
      CASE WHEN p_sort = 'newest' THEN counted.id END DESC NULLS LAST,
      counted.name_en ASC NULLS LAST,
      counted.id
    LIMIT greatest(1, least(p_limit, 100))
    OFFSET greatest(0, p_offset);
    RETURN;
  END IF;

  -- ── Search path: real query — full hybrid ranking ───────────────────────────
  v_expanded := public.expand_search_query(v_q);
  v_uq := public.normalize_arabic(public.immutable_unaccent(v_expanded));

  BEGIN
    v_tsq := websearch_to_tsquery('simple', v_uq);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_tsq := plainto_tsquery('simple', v_uq);
    EXCEPTION WHEN OTHERS THEN
      v_tsq := NULL;
    END;
  END;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      product.*,
      GREATEST(0, product.base_price - product.effective_price) AS d_amount,
      CASE
        WHEN product.base_price > 0 THEN round(
          100 * GREATEST(0, product.base_price - product.effective_price) / product.base_price, 2
        )
        ELSE 0
      END AS d_percent,
      (
        (CASE
          WHEN lower(product.code)    = lower(v_q) THEN 1000.0
          WHEN lower(product.barcode) = lower(v_q) THEN 1000.0
          ELSE 0.0
        END)
        + (CASE
            WHEN public.normalize_arabic(coalesce(product.name_ar, '')) = v_uq THEN 80.0
            WHEN coalesce(product.name_en, '') ILIKE v_uq THEN 80.0
            WHEN public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE v_uq || ' %' THEN 40.0
            WHEN coalesce(product.name_en, '') ILIKE v_uq || ' %' THEN 40.0
            WHEN public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE v_uq || '%' THEN 20.0
            WHEN coalesce(product.name_en, '') ILIKE v_uq || '%' THEN 20.0
            ELSE 0.0
          END)
        + (CASE WHEN v_tsq IS NOT NULL THEN
             COALESCE(ts_rank_cd(p.search_vector, v_tsq) * 2.5, 0.0)
           ELSE 0.0 END)
        + 1.2 * GREATEST(
            COALESCE(similarity(public.normalize_arabic(coalesce(product.name_ar, '')), v_uq), 0),
            COALESCE(similarity(coalesce(product.name_en, ''), v_uq), 0)
          )
        + 0.9 * GREATEST(
            COALESCE(word_similarity(v_uq, public.normalize_arabic(coalesce(product.name_ar, ''))), 0),
            COALESCE(word_similarity(v_uq, coalesce(product.name_en, '')), 0)
          )
        + 0.08 * GREATEST(
            COALESCE(similarity(public.normalize_arabic(coalesce(product.category_name, '')), v_uq), 0),
            COALESCE(similarity(coalesce(product.category_name_en, ''), v_uq), 0)
          )
      ) AS relevance_score
    FROM public.product_effective_prices AS product
    JOIN public.products p ON p.id = product.id
    WHERE product.is_active = true
      AND (p_category IS NULL OR btrim(p_category) = '' OR product.category_name = p_category OR product.category_name_en = p_category)
      AND (NOT p_in_stock OR product.stock > 0)
      AND (p_min_price IS NULL OR product.effective_price >= p_min_price)
      AND (p_max_price IS NULL OR product.effective_price <= p_max_price)
      AND (NOT p_is_sale OR product.has_active_promotion)
      AND (
        (v_tsq IS NOT NULL AND p.search_vector @@ v_tsq)
        OR public.normalize_arabic(coalesce(product.name_ar, '')) % v_uq
        OR coalesce(product.name_en, '') % v_uq
        OR v_uq <% public.normalize_arabic(coalesce(product.name_ar, ''))
        OR v_uq <% coalesce(product.name_en, '')
        OR public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE '%' || v_uq || '%'
        OR coalesce(product.name_en, '') ILIKE '%' || v_uq || '%'
        OR coalesce(product.name_ar, '') ILIKE '%' || v_q || '%'
        OR coalesce(product.code, '') ILIKE v_q || '%'
        OR coalesce(product.barcode, '') ILIKE v_q || '%'
      )
  ),
  relevant AS (
    SELECT * FROM filtered WHERE relevance_score > 0.05
  ),
  counted AS (
    SELECT relevant.*, count(*) OVER () AS row_total FROM relevant
  )
  SELECT
    counted.id, counted.code, counted.barcode, counted.name_ar, counted.name_en,
    counted.base_price, counted.effective_price, counted.stock,
    counted.category_name, counted.category_name_en, counted.image_url,
    counted.rating_avg, counted.rating_count, counted.is_new, counted.is_bestseller,
    counted.promotion_id, counted.promotion_name, counted.promotion_discount_type,
    counted.promotion_discount_value, counted.promotion_ends_at, counted.has_active_promotion,
    counted.d_amount, counted.d_percent, counted.row_total
  FROM counted
  ORDER BY
    CASE WHEN p_sort = 'price_asc' THEN counted.effective_price END ASC,
    CASE WHEN p_sort = 'price_desc' THEN counted.effective_price END DESC,
    CASE WHEN p_sort = 'name_asc' THEN counted.name_en END ASC,
    counted.relevance_score DESC,
    counted.name_en ASC NULLS LAST,
    counted.id
  LIMIT greatest(1, least(p_limit, 100))
  OFFSET greatest(0, p_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
