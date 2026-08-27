-- =============================================================================
-- Search diagnostics — see WHY a query matched (or didn't) a given product,
-- for testing/tuning the ranking without touching the production search
-- path (search_effective_products' own signature/behavior is unchanged).
--
-- Not customer-facing — informational only, for development/QA use via the
-- SQL editor or an admin tool. Mirrors the exact same normalization/
-- expansion/tier logic search_effective_products uses internally, so a
-- score seen here matches what actually drove that product's ranking.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.debug_search_relevance(
  p_query text,
  p_product_id uuid
)
RETURNS TABLE (
  expanded_query        text,
  normalized_query       text,
  tier1_exact_code_barcode double precision,
  tier2_name_exact_prefix  double precision,
  tier3_fts_rank           double precision,
  tier4_trigram_similarity double precision,
  tier5_word_similarity    double precision,
  tier6_category_signal    double precision,
  total_score              double precision,
  passes_cutoff            boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_expanded text;
  v_uq       text;
  v_tsq      tsquery;
  product    record;
BEGIN
  SELECT p.*, epp.effective_price INTO product
  FROM public.products p
  JOIN public.product_effective_prices epp ON epp.id = p.id
  WHERE p.id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No product with id %', p_product_id;
  END IF;

  v_expanded := public.expand_search_query(p_query);
  v_uq := public.normalize_arabic(public.immutable_unaccent(v_expanded));

  BEGIN
    v_tsq := websearch_to_tsquery('simple', v_uq);
  EXCEPTION WHEN OTHERS THEN
    v_tsq := NULL;
  END;

  RETURN QUERY SELECT
    v_expanded,
    v_uq,
    (CASE WHEN lower(product."Code") = lower(p_query) THEN 1000.0 WHEN lower(product."Barcode") = lower(p_query) THEN 1000.0 ELSE 0.0 END),
    (CASE
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) = v_uq THEN 80.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq THEN 80.0
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE v_uq || ' %' THEN 40.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq || ' %' THEN 40.0
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE v_uq || '%' THEN 20.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq || '%' THEN 20.0
      ELSE 0.0
    END),
    (CASE WHEN v_tsq IS NOT NULL THEN COALESCE(ts_rank_cd(product.search_vector, v_tsq) * 2.5, 0.0) ELSE 0.0 END),
    1.2 * GREATEST(
      COALESCE(similarity(public.normalize_arabic(coalesce(product."Name_Ar", '')), v_uq), 0),
      COALESCE(similarity(coalesce(product."Name_En", ''), v_uq), 0)
    ),
    0.9 * GREATEST(
      COALESCE(word_similarity(v_uq, public.normalize_arabic(coalesce(product."Name_Ar", ''))), 0),
      COALESCE(word_similarity(v_uq, coalesce(product."Name_En", '')), 0)
    ),
    0.08 * GREATEST(
      COALESCE(similarity(public.normalize_arabic(coalesce(product."Category_Name", '')), v_uq), 0),
      COALESCE(similarity(coalesce(product."Category_Name_En", ''), v_uq), 0)
    ),
    (
      (CASE WHEN lower(product."Code") = lower(p_query) THEN 1000.0 WHEN lower(product."Barcode") = lower(p_query) THEN 1000.0 ELSE 0.0 END)
      + (CASE
          WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) = v_uq THEN 80.0
          WHEN coalesce(product."Name_En", '') ILIKE v_uq THEN 80.0
          WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE v_uq || ' %' THEN 40.0
          WHEN coalesce(product."Name_En", '') ILIKE v_uq || ' %' THEN 40.0
          WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE v_uq || '%' THEN 20.0
          WHEN coalesce(product."Name_En", '') ILIKE v_uq || '%' THEN 20.0
          ELSE 0.0
        END)
      + (CASE WHEN v_tsq IS NOT NULL THEN COALESCE(ts_rank_cd(product.search_vector, v_tsq) * 2.5, 0.0) ELSE 0.0 END)
      + 1.2 * GREATEST(
          COALESCE(similarity(public.normalize_arabic(coalesce(product."Name_Ar", '')), v_uq), 0),
          COALESCE(similarity(coalesce(product."Name_En", ''), v_uq), 0)
        )
      + 0.9 * GREATEST(
          COALESCE(word_similarity(v_uq, public.normalize_arabic(coalesce(product."Name_Ar", ''))), 0),
          COALESCE(word_similarity(v_uq, coalesce(product."Name_En", '')), 0)
        )
      + 0.08 * GREATEST(
          COALESCE(similarity(public.normalize_arabic(coalesce(product."Category_Name", '')), v_uq), 0),
          COALESCE(similarity(coalesce(product."Category_Name_En", ''), v_uq), 0)
        )
    ) AS total,
    (
      (CASE WHEN lower(product."Code") = lower(p_query) THEN 1000.0 WHEN lower(product."Barcode") = lower(p_query) THEN 1000.0 ELSE 0.0 END)
      + (CASE
          WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) = v_uq THEN 80.0
          WHEN coalesce(product."Name_En", '') ILIKE v_uq THEN 80.0
          ELSE 0.0
        END)
      + (CASE WHEN v_tsq IS NOT NULL THEN COALESCE(ts_rank_cd(product.search_vector, v_tsq) * 2.5, 0.0) ELSE 0.0 END)
      + 1.2 * GREATEST(
          COALESCE(similarity(public.normalize_arabic(coalesce(product."Name_Ar", '')), v_uq), 0),
          COALESCE(similarity(coalesce(product."Name_En", ''), v_uq), 0)
        )
    ) > 0.05;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_search_relevance(text, uuid) TO authenticated;

COMMENT ON FUNCTION public.debug_search_relevance IS
  'Diagnostics only — shows the per-tier score breakdown search_effective_products would compute for one (query, product) pair. Not called by the app; for QA/tuning via SQL editor.';
