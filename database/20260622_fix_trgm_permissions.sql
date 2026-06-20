-- =============================================================================
-- Migration: Fix pg_trgm GUC permission error in search_products
-- Date: 2026-06-22
--
-- Problem:
--   Supabase managed PostgreSQL (non-superuser role) throws:
--     ERROR: 42501: permission denied to set parameter "pg_trgm.similarity_threshold"
--
--   The previous migration (20260604) calls:
--     PERFORM set_config('pg_trgm.similarity_threshold', v_threshold::text, true);
--
--   set_config() on pg_trgm.* parameters requires superuser privileges in
--   Supabase hosted environments. This breaks the function at invocation.
--
-- Fix:
--   1. Remove the set_config() call entirely.
--   2. Replace all % (trigram similarity operator, which reads the GUC) with
--      explicit similarity() > threshold comparisons.
--   3. Keep rank as double precision (matches 20260621 type fix).
--   4. Keep all other logic (FTS, word_similarity, ILIKE, scoring) unchanged.
--
-- Safe to re-run (DROP IF EXISTS + CREATE OR REPLACE).
-- =============================================================================

DROP FUNCTION IF EXISTS public.search_products(text, text, boolean, numeric, numeric, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_products(
  p_query      text    DEFAULT NULL,
  p_category   text    DEFAULT NULL,
  p_in_stock   boolean DEFAULT false,
  p_min_price  numeric DEFAULT NULL,
  p_max_price  numeric DEFAULT NULL,
  p_sort       text    DEFAULT 'newest',
  p_limit      integer DEFAULT 20,
  p_offset     integer DEFAULT 0
)
RETURNS TABLE (
  id               text,
  code             text,
  barcode          text,
  name_ar          text,
  name_en          text,
  price            numeric,
  stock            numeric,
  category_name    text,
  category_name_en text,
  image_url        text,
  rank             double precision,
  total_count      bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_threshold float4  := 0.12;
  v_tsquery   tsquery := NULL;
BEGIN
  -- NOTE: set_config('pg_trgm.similarity_threshold', ...) is intentionally
  -- omitted — Supabase managed roles lack permission to SET this GUC.
  -- Instead we use explicit similarity() > v_threshold comparisons below.

  IF p_query IS NOT NULL AND trim(p_query) <> '' THEN
    BEGIN
      v_tsquery := websearch_to_tsquery('english', p_query);
    EXCEPTION WHEN OTHERS THEN
      v_tsquery := NULL;
    END;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id::text,
      p."Code"              AS code,
      p."Barcode"           AS barcode,
      p."Name_Ar"           AS name_ar,
      p."Name_En"           AS name_en,
      p."Price"             AS price,
      COALESCE(p."Stock", 0)::numeric AS stock,
      p."Category_Name"     AS category_name,
      p."Category_Name_En"  AS category_name_en,
      p.image_url,
      CASE WHEN p_query IS NULL OR trim(p_query) = '' THEN 0::double precision
        ELSE (
          (CASE WHEN lower(p."Code")    = lower(p_query) THEN 1000
                WHEN lower(p."Barcode") = lower(p_query) THEN 1000
                ELSE 0 END)::double precision
          + CASE WHEN v_tsquery IS NOT NULL THEN
              COALESCE(
                ts_rank_cd(
                  to_tsvector('english',
                    COALESCE(p."Name_En", '') || ' ' ||
                    COALESCE(p."Name_Ar", '') || ' ' ||
                    COALESCE(p."Code",    '') || ' ' ||
                    COALESCE(p."Barcode", '')
                  ),
                  v_tsquery
                ) * 2.5,
                0.0
              )
            ELSE 0.0 END
          + GREATEST(
              similarity(COALESCE(p."Name_Ar", ''), p_query),
              similarity(COALESCE(p."Name_En", ''), p_query)
            ) * 1.2
          + GREATEST(
              word_similarity(p_query, COALESCE(p."Name_Ar", '')),
              word_similarity(p_query, COALESCE(p."Name_En", ''))
            ) * 0.9
          + (CASE WHEN p."Name_Ar" ILIKE '%' || p_query || '%'
                    OR p."Name_En" ILIKE '%' || p_query || '%'
                    OR p."Code"    ILIKE '%' || p_query || '%'
                    OR p."Barcode" ILIKE '%' || p_query || '%'
                  THEN 0.3 ELSE 0.0 END)
          + similarity(COALESCE(p."Category_Name", ''), p_query) * 0.15
        )
      END AS relevance_score
    FROM public.products p
    WHERE
      (p_query IS NOT NULL AND trim(p_query) <> '' OR p.is_active = true)
      AND (p_in_stock IS NULL OR p_in_stock = false
           OR (p.is_active = true AND COALESCE(p."Stock", 0) > 0))
      AND (p_category IS NULL OR p."Category_Name" = p_category)
      AND (p_min_price IS NULL OR p."Price" >= p_min_price)
      AND (p_max_price IS NULL OR p."Price" <= p_max_price)
      AND (
        p_query IS NULL OR trim(p_query) = ''
        OR
        (v_tsquery IS NOT NULL AND
          to_tsvector('english',
            COALESCE(p."Name_En", '') || ' ' ||
            COALESCE(p."Name_Ar", '') || ' ' ||
            COALESCE(p."Code",    '') || ' ' ||
            COALESCE(p."Barcode", '')
          ) @@ v_tsquery
        )
        OR
        -- Explicit threshold avoids the % operator which reads the blocked GUC
        (   similarity(COALESCE(p."Name_Ar", ''), p_query) > v_threshold
         OR similarity(COALESCE(p."Name_En", ''), p_query) > v_threshold
         OR similarity(COALESCE(p."Code",    ''), p_query) > v_threshold
        )
        OR
        (word_similarity(p_query, COALESCE(p."Name_Ar", '')) > v_threshold
         OR word_similarity(p_query, COALESCE(p."Name_En", '')) > v_threshold)
        OR
        (p."Name_Ar" ILIKE '%' || p_query || '%'
         OR p."Name_En" ILIKE '%' || p_query || '%'
         OR p."Code"    ILIKE '%' || p_query || '%'
         OR p."Barcode" ILIKE '%' || p_query || '%')
      )
  ),
  counted AS (
    SELECT b.*, COUNT(*) OVER () AS total
    FROM base b
    ORDER BY
      CASE WHEN p_sort = 'relevance'
                OR (p_query IS NOT NULL AND trim(p_query) <> '' AND p_sort = 'newest')
           THEN -b.relevance_score END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_asc'  THEN b.price    END ASC  NULLS LAST,
      CASE WHEN p_sort = 'price_desc' THEN b.price    END DESC NULLS LAST,
      CASE WHEN p_sort = 'name_asc'   THEN b.name_en  END ASC  NULLS LAST,
      (CASE WHEN b.stock > 0 THEN 0 ELSE 1 END) ASC,
      b.name_en ASC NULLS LAST
  )
  SELECT
    c.id,
    c.code,
    c.barcode,
    c.name_ar,
    c.name_en,
    c.price,
    c.stock,
    c.category_name,
    c.category_name_en,
    c.image_url,
    c.relevance_score AS rank,
    c.total
  FROM counted c
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, text, boolean, numeric, numeric, text, integer, integer)
  TO anon, authenticated;

COMMENT ON FUNCTION public.search_products IS
  'Unified product search + browse RPC. Combines inline tsvector FTS, pg_trgm '
  'fuzzy, word_similarity partial, and ILIKE fallback. Self-contained: works '
  'without the search_vector generated column (added by 20260603). rank is '
  'double precision. Does not call set_config() — uses explicit similarity() '
  'comparisons to avoid Supabase GUC permission errors. Snake-case output '
  'matches SearchProductRowSchema in apps/shopper-native/src/features/products/'
  'types/index.ts and the web shopperCatalogApi.';
