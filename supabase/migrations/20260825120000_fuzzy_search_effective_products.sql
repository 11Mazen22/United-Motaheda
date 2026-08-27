-- Add typo-tolerant fuzzy matching to the canonical product search RPC.
--
-- Reported bug: searching "بنادول" (a common misspelling missing the alef)
-- against the correctly-spelled "بانادول" in the catalog returned zero
-- results, because search_effective_products only ever did a plain
-- ILIKE '%term%' substring match — any character difference between the
-- query and the stored name is a hard miss.
--
-- This migration:
--   1. Enables pg_trgm (ships with every Supabase project).
--   2. Adds GIN trigram indexes on products.Name_Ar/Name_En/Code so fuzzy
--      matching stays fast as the catalog grows (not required for
--      correctness at today's catalog size, but cheap insurance).
--   3. Replaces search_effective_products with the SAME signature and
--      return shape (a drop-in replacement — no client-code changes
--      needed) but with an added trigram-similarity OR-branch in the
--      WHERE clause, and a relevance tiebreaker in ORDER BY so the best
--      fuzzy match surfaces first when no explicit sort was requested.
--      Effective-price/promotion resolution (the reason this function
--      exists instead of querying pg_trgm directly) is untouched.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_ar_trgm
  ON public.products USING gin ("Name_Ar" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_name_en_trgm
  ON public.products USING gin ("Name_En" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_code_trgm
  ON public.products USING gin ("Code" gin_trgm_ops);

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
      END AS discount_percent,
      -- 0-1 fuzzy relevance score; only meaningful when p_query is present.
      GREATEST(
        similarity(coalesce(product.name_ar, ''), coalesce(p_query, '')),
        similarity(coalesce(product.name_en, ''), coalesce(p_query, ''))
      ) AS sim
    FROM public.product_effective_prices AS product
    WHERE product.is_active = true
      AND (p_query IS NULL OR btrim(p_query) = '' OR (
        -- Exact/partial substring match — still the fastest, most precise path.
        coalesce(product.name_ar, '') ILIKE '%' || p_query || '%'
        OR coalesce(product.name_en, '') ILIKE '%' || p_query || '%'
        OR coalesce(product.code, '') ILIKE '%' || p_query || '%'
        OR coalesce(product.barcode, '') ILIKE '%' || p_query || '%'
        -- Fuzzy fallback — catches typos/spelling variants (e.g. a missing
        -- alef in "بنادول" vs the catalog's "بانادول"). 0.25 is forgiving
        -- enough for common Arabic/English typos without matching noise.
        OR similarity(coalesce(product.name_ar, ''), p_query) > 0.25
        OR similarity(coalesce(product.name_en, ''), p_query) > 0.25
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
    -- Relevance tiebreaker: when a query is present and no explicit sort
    -- was requested, the best fuzzy/exact match surfaces first instead of
    -- falling straight to alphabetical order.
    CASE WHEN p_query IS NOT NULL AND btrim(p_query) <> '' THEN filtered.sim END DESC,
    filtered.name_en ASC NULLS LAST,
    filtered.id
  LIMIT greatest(1, least(p_limit, 100))
  OFFSET greatest(0, p_offset);
$$;

REVOKE ALL ON FUNCTION public.search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer) TO anon, authenticated;
