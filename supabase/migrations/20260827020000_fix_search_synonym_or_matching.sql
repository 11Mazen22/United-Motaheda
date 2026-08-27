-- =============================================================================
-- Confirmed live, by direct RPC testing: search_effective_products('دواء
-- لتخفيف الجراح') returned ZERO rows, even though expand_search_query()
-- correctly expands the query to 'دواء لتخفيف الجراح antiseptic relief' and
-- the catalog has 15+ real, well-named antiseptic/wound-care products
-- ("SUDOCREM ANTISEPTIC HEALING CREAM", "QUALITA ANTISEPTIC WIPES...",
-- category "First Aid & Antiseptics", etc.). This is the exact wound-
-- medicine example the reconstruction directive named explicitly as a
-- must-not-fail case.
--
-- Root cause: search_effective_products takes the WHOLE expanded string
-- (original sentence + appended synonym words, all one blob) and:
--   1. Feeds it to websearch_to_tsquery() as one phrase — which ANDs every
--      token together by default. The resulting tsquery required a product
--      to contain 'دواء' AND 'لتخفيف' AND 'الجراح' AND 'antiseptic' AND
--      'relief' ALL AT ONCE. No product will ever contain the original
--      Arabic sentence fragments literally, so this predicate can never be
--      satisfied — the appended synonym word being present is irrelevant
--      once it's AND-locked to words that can never match.
--   2. Uses the same whole blob for ILIKE '%...%' and trigram similarity,
--      which have the identical problem: a 5-token mixed-language blob will
--      essentially never appear as a substring of, or be trigram-similar
--      enough to, a real 3-4 word product name.
--
-- expand_search_query() itself is not the bug (already fixed earlier this
-- session, confirmed correct via direct RPC test) — the bug is entirely in
-- how the expanded result was consumed downstream. Concatenation was never
-- going to work for a synonym system: the whole point of "the original
-- phrase didn't match, but a known related word does" is an OR
-- relationship, not something you can express by gluing two phrases
-- together and requiring the combined phrase to match as a unit.
--
-- Fix: split the synonym lookup out into find_synonym_terms() (same
-- matching logic expand_search_query already had), then have
-- search_effective_products build the ORIGINAL query's tsquery and the
-- SYNONYM terms' tsquery SEPARATELY and OR them together (tsquery `||`),
-- with the synonym words themselves OR'd against each other too (a
-- canonical value like 'paracetamol ibuprofen' means "either", not "both").
-- Same treatment for the ILIKE/trigram fallback checks — tested against
-- each synonym word individually, not the concatenated blob.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_synonym_terms(p_query text)
RETURNS text
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_norm   text := lower(public.normalize_arabic(public.immutable_unaccent(p_query)));
  v_tokens text[];
  v_match  text;
BEGIN
  v_tokens := (
    SELECT array_agg(tok) FROM unnest(regexp_split_to_array(trim(v_norm), '\s+')) AS tok
    WHERE length(tok) >= 2
  );
  IF v_tokens IS NULL THEN v_tokens := ARRAY[]::text[]; END IF;

  SELECT string_agg(DISTINCT s.canonical, ' ') INTO v_match
  FROM public.search_synonyms s
  WHERE s.is_active
    AND (
      lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) = v_norm
      OR lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) = ANY(v_tokens)
      OR EXISTS (
        SELECT 1 FROM unnest(v_tokens) AS tok
        WHERE length(tok) >= 3
          AND length(lower(public.normalize_arabic(public.immutable_unaccent(s.alias)))) >= 3
          AND (
            tok ILIKE '%' || lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) || '%'
            OR lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) ILIKE '%' || tok || '%'
          )
      )
    );

  RETURN v_match; -- space-separated canonical words/phrases, or NULL — deliberately NOT concatenated with p_query (see header)
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_synonym_terms(text) TO anon, authenticated;

-- expand_search_query keeps its existing signature/behavior for any other
-- caller (e.g. debug_search_relevance's informational "expanded_query"
-- column) — now just a thin wrapper over the shared lookup.
CREATE OR REPLACE FUNCTION public.expand_search_query(p_query text)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT trim(p_query || ' ' || COALESCE(public.find_synonym_terms(p_query), ''));
$$;

-- =============================================================================
-- search_effective_products — OR-based synonym matching (see header).
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
  v_q        text := nullif(trim(coalesce(p_query, '')), '');
  v_uq       text;
  v_tsq      tsquery;
  v_syn      text;
  v_syn_words text[];
  v_syn_tsq_text text;
  v_syn_tsq  tsquery;
  v_tsq_combined tsquery;
BEGIN
  -- ── Fast path: no search term — plain filtered browse/listing (unchanged) ──
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
  v_uq := public.normalize_arabic(public.immutable_unaccent(v_q));

  BEGIN
    v_tsq := websearch_to_tsquery('simple', v_uq);
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_tsq := plainto_tsquery('simple', v_uq);
    EXCEPTION WHEN OTHERS THEN
      v_tsq := NULL;
    END;
  END;

  -- Synonym terms are matched as an OR alternative to the literal query, not
  -- concatenated onto it (see header) — a symptom-derived word like
  -- "antiseptic" needs to independently satisfy the match, not be AND-locked
  -- to sentence fragments no product will ever contain.
  v_syn := public.find_synonym_terms(v_q);
  IF v_syn IS NOT NULL THEN
    v_syn_words := (
      SELECT array_agg(DISTINCT w) FROM unnest(
        regexp_split_to_array(trim(public.normalize_arabic(public.immutable_unaccent(v_syn))), '\s+')
      ) AS w WHERE length(w) > 0
    );
    IF v_syn_words IS NOT NULL AND array_length(v_syn_words, 1) > 0 THEN
      v_syn_tsq_text := array_to_string(v_syn_words, ' | ');
      BEGIN
        v_syn_tsq := to_tsquery('simple', v_syn_tsq_text);
      EXCEPTION WHEN OTHERS THEN
        v_syn_tsq := NULL;
      END;
    END IF;
  END IF;

  v_tsq_combined := CASE
    WHEN v_tsq IS NOT NULL AND v_syn_tsq IS NOT NULL THEN v_tsq || v_syn_tsq
    WHEN v_syn_tsq IS NOT NULL THEN v_syn_tsq
    ELSE v_tsq
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
        + (CASE WHEN v_tsq_combined IS NOT NULL THEN
             COALESCE(ts_rank_cd(p.search_vector, v_tsq_combined) * 2.5, 0.0)
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
        -- Synonym-word signal, independent of the phrase-level scores above —
        -- a product that only matches via a symptom synonym (not the literal
        -- phrase at all) still needs a positive score to clear the 0.05
        -- relevance floor below. Weighted lower than a direct name hit.
        + (CASE WHEN v_syn_words IS NOT NULL THEN
             15.0 * (
               SELECT count(*)::numeric FROM unnest(v_syn_words) w
               WHERE length(w) >= 3 AND (
                 coalesce(product.name_en, '') ILIKE '%' || w || '%'
                 OR public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE '%' || w || '%'
                 OR coalesce(product.category_name_en, '') ILIKE '%' || w || '%'
                 OR public.normalize_arabic(coalesce(product.category_name, '')) ILIKE '%' || w || '%'
               )
             ) / greatest(1, array_length(v_syn_words, 1))
           ELSE 0.0 END)
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
        (v_tsq_combined IS NOT NULL AND p.search_vector @@ v_tsq_combined)
        OR public.normalize_arabic(coalesce(product.name_ar, '')) % v_uq
        OR coalesce(product.name_en, '') % v_uq
        OR v_uq <% public.normalize_arabic(coalesce(product.name_ar, ''))
        OR v_uq <% coalesce(product.name_en, '')
        OR public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE '%' || v_uq || '%'
        OR coalesce(product.name_en, '') ILIKE '%' || v_uq || '%'
        OR coalesce(product.name_ar, '') ILIKE '%' || v_q || '%'
        OR coalesce(product.code, '') ILIKE v_q || '%'
        OR coalesce(product.barcode, '') ILIKE v_q || '%'
        OR (v_syn_words IS NOT NULL AND EXISTS (
          SELECT 1 FROM unnest(v_syn_words) w
          WHERE length(w) >= 3 AND (
            coalesce(product.name_en, '') ILIKE '%' || w || '%'
            OR public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE '%' || w || '%'
            OR coalesce(product.category_name_en, '') ILIKE '%' || w || '%'
            OR public.normalize_arabic(coalesce(product.category_name, '')) ILIKE '%' || w || '%'
          )
        ))
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

-- =============================================================================
-- debug_search_relevance had never actually run successfully: confirmed live
-- via direct RPC call ("42804: Returned type numeric does not match expected
-- type double precision in column 3") — the same class of bug fixed earlier
-- this session in resolve_delivery_zone (plpgsql's RETURN QUERY needs an
-- exact type match; `1000.0`/`0.0` numeric literals don't implicitly widen
-- to a declared `double precision` column). Fixed with explicit casts, and
-- brought in line with the OR-based synonym scoring above — this function
-- exists specifically to show the score search_effective_products actually
-- computed, so it needs to compute the identical formula.
-- =============================================================================

-- CREATE OR REPLACE cannot change a function's OUT-parameter row shape
-- (this adds tier7_synonym_signal to the previously-deployed 10-column
-- version) — confirmed live via the exact "cannot change return type of
-- existing function... Row type defined by OUT parameters is different"
-- error. Must drop first.
DROP FUNCTION IF EXISTS public.debug_search_relevance(text, uuid);

CREATE FUNCTION public.debug_search_relevance(
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
  tier7_synonym_signal     double precision,
  total_score              double precision,
  passes_cutoff            boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uq        text;
  v_tsq       tsquery;
  v_syn       text;
  v_syn_words text[];
  v_syn_tsq   tsquery;
  v_tsq_combined tsquery;
  product     record;
  v_t1 double precision;
  v_t2 double precision;
  v_t3 double precision;
  v_t4 double precision;
  v_t5 double precision;
  v_t6 double precision;
  v_t7 double precision;
BEGIN
  SELECT p.*, epp.effective_price INTO product
  FROM public.products p
  JOIN public.product_effective_prices epp ON epp.id = p.id
  WHERE p.id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No product with id %', p_product_id;
  END IF;

  v_uq := public.normalize_arabic(public.immutable_unaccent(p_query));

  BEGIN
    v_tsq := websearch_to_tsquery('simple', v_uq);
  EXCEPTION WHEN OTHERS THEN
    v_tsq := NULL;
  END;

  v_syn := public.find_synonym_terms(p_query);
  IF v_syn IS NOT NULL THEN
    v_syn_words := (
      SELECT array_agg(DISTINCT w) FROM unnest(
        regexp_split_to_array(trim(public.normalize_arabic(public.immutable_unaccent(v_syn))), '\s+')
      ) AS w WHERE length(w) > 0
    );
    IF v_syn_words IS NOT NULL AND array_length(v_syn_words, 1) > 0 THEN
      BEGIN
        v_syn_tsq := to_tsquery('simple', array_to_string(v_syn_words, ' | '));
      EXCEPTION WHEN OTHERS THEN
        v_syn_tsq := NULL;
      END;
    END IF;
  END IF;

  v_tsq_combined := CASE
    WHEN v_tsq IS NOT NULL AND v_syn_tsq IS NOT NULL THEN v_tsq || v_syn_tsq
    WHEN v_syn_tsq IS NOT NULL THEN v_syn_tsq
    ELSE v_tsq
  END;

  v_t1 := (CASE WHEN lower(product."Code") = lower(p_query) THEN 1000.0 WHEN lower(product."Barcode") = lower(p_query) THEN 1000.0 ELSE 0.0 END)::double precision;
  v_t2 := (CASE
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) = v_uq THEN 80.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq THEN 80.0
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE v_uq || ' %' THEN 40.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq || ' %' THEN 40.0
      WHEN public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE v_uq || '%' THEN 20.0
      WHEN coalesce(product."Name_En", '') ILIKE v_uq || '%' THEN 20.0
      ELSE 0.0
    END)::double precision;
  v_t3 := (CASE WHEN v_tsq_combined IS NOT NULL THEN COALESCE(ts_rank_cd(product.search_vector, v_tsq_combined) * 2.5, 0.0) ELSE 0.0 END)::double precision;
  v_t4 := (1.2 * GREATEST(
      COALESCE(similarity(public.normalize_arabic(coalesce(product."Name_Ar", '')), v_uq), 0),
      COALESCE(similarity(coalesce(product."Name_En", ''), v_uq), 0)
    ))::double precision;
  v_t5 := (0.9 * GREATEST(
      COALESCE(word_similarity(v_uq, public.normalize_arabic(coalesce(product."Name_Ar", ''))), 0),
      COALESCE(word_similarity(v_uq, coalesce(product."Name_En", '')), 0)
    ))::double precision;
  v_t6 := (0.08 * GREATEST(
      COALESCE(similarity(public.normalize_arabic(coalesce(product."Category_Name", '')), v_uq), 0),
      COALESCE(similarity(coalesce(product."Category_Name_En", ''), v_uq), 0)
    ))::double precision;
  v_t7 := (CASE WHEN v_syn_words IS NOT NULL THEN
      15.0 * (
        SELECT count(*)::numeric FROM unnest(v_syn_words) w
        WHERE length(w) >= 3 AND (
          coalesce(product."Name_En", '') ILIKE '%' || w || '%'
          OR public.normalize_arabic(coalesce(product."Name_Ar", '')) ILIKE '%' || w || '%'
          OR coalesce(product."Category_Name_En", '') ILIKE '%' || w || '%'
          OR public.normalize_arabic(coalesce(product."Category_Name", '')) ILIKE '%' || w || '%'
        )
      ) / greatest(1, array_length(v_syn_words, 1))
    ELSE 0.0 END)::double precision;

  RETURN QUERY SELECT
    public.expand_search_query(p_query),
    v_uq,
    v_t1, v_t2, v_t3, v_t4, v_t5, v_t6, v_t7,
    (v_t1 + v_t2 + v_t3 + v_t4 + v_t5 + v_t6 + v_t7),
    (v_t1 + v_t2 + v_t3 + v_t4 + v_t7) > 0.05;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_search_relevance(text, uuid) TO authenticated;

COMMENT ON FUNCTION public.debug_search_relevance IS
  'Diagnostics only — shows the per-tier score breakdown search_effective_products would compute for one (query, product) pair, including the OR-based synonym signal (tier7). Not called by the app; for QA/tuning via SQL editor.';

NOTIFY pgrst, 'reload schema';
