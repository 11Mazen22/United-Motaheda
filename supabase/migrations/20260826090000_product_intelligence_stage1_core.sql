-- =============================================================================
-- Product Intelligence — Stage 1: Supabase intelligence foundation
-- Date: 2026-08-26
--
-- CONTEXT (read this before touching anything below):
--
--   This project already has TWO generations of search infrastructure, built
--   in earlier sessions, that were never fully reconciled:
--
--   Generation A — apps/shopper-native/supabase/migrations/20260620_arabic_fts_
--   normalization.sql (as fixed by 20260621_fix_search_rank_type.sql) built a
--   genuinely sophisticated `search_products` RPC: weighted tsvector
--   (products.search_vector, generated column, weights A/B/C), a real
--   normalize_arabic() SQL function (strips tashkeel, unifies alef/taa-marbuta/
--   alef-maqsura/hamza variants), and 6-tier ranking (exact code/barcode >
--   name exact/prefix > FTS ts_rank_cd > trigram similarity > word_similarity
--   partial > category light signal). Verified live: search_products('بنادول')
--   correctly returns بانادول products today — the exact bug this whole
--   session has been chasing does NOT exist in this function.
--
--   Generation B — supabase/migrations/20260716100000_platform_canonical_
--   pricing_and_lifecycle.sql later built `product_effective_prices` (a view
--   resolving promotions/effective pricing) and a NEW, much dumber
--   `search_effective_products` RPC (ILIKE-only, no FTS, no trigram) that
--   queries that view. This is the function the app actually calls today
--   (apps/shopper-native/src/features/products/api/productsApi.ts).
--
--   Net result: the app gets correct promotion pricing but dumb search, while
--   a fully-built smart-search engine sits unused right next to it.
--
--   This migration does NOT invent new search logic. It TRANSPLANTS Generation
--   A's ranking engine onto Generation B's promotion-aware data source, so
--   there is exactly one canonical search function going forward. The
--   function name and signature are kept identical to the current
--   search_effective_products so the app's existing call site
--   (productsApi.ts) needs no changes.
--
--   It also adds the one genuinely-missing piece for Stage 1: a real,
--   admin-editable synonym/alias table. A 120+-entry Arabic→English brand/
--   generic/category map already exists, but only client-side (apps/shopper-
--   native/src/utils/searchUtils.ts) and is currently dead code — nothing
--   calls it. That map is seeded into this table so the SAME intelligence
--   also lives server-side (query expansion happens in the RPC itself, so it
--   still works for API callers other than this one mobile app, and an admin
--   can add an alias by inserting a row — no app deploy required).
--
-- Safe to run multiple times: every statement is idempotent
-- (CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT).
-- =============================================================================

-- ─── 0. Extensions + normalize_arabic() (defensive) ─────────────────────────
-- Already live today (applied by apps/shopper-native/supabase/migrations/
-- 20260620_arabic_fts_normalization.sql), but this migration depends on both,
-- so it should stand on its own if ever replayed against a fresh database.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() is STABLE (not IMMUTABLE) in Postgres — it technically depends
-- on a text search dictionary that could be redefined, even though in
-- practice this one never is. Index expressions require IMMUTABLE, so this
-- wrapper pins it to the specific 'unaccent' dictionary and asserts the
-- immutability Postgres won't infer on its own. Standard, widely-documented
-- workaround (not a hack specific to this project).
-- Looked up by OID from pg_ts_dict rather than a schema-qualified string
-- literal — Supabase projects vary on whether unaccent's extension objects
-- land in `extensions` or `public`, and this avoids having to guess/hardcode
-- which. Matching by dictname alone is unambiguous: there is exactly one
-- "unaccent" dictionary per database. SET search_path covers both candidate
-- schemas for the unaccent(regdictionary, text) function call itself, since
-- the migration role's ambient search_path may not include `extensions`.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT unaccent(d.oid::regdictionary, $1)
  FROM pg_ts_dict d
  WHERE d.dictname = 'unaccent'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.normalize_arabic(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(t,
                  '[ً-ٟـٰٴ]', '', 'g'),
                '[أإآٱ]', 'ا', 'g'),
              'ة', 'ه', 'g'),
            'ى', 'ي', 'g'),
          'ؤ', 'و', 'g'),
        'ئ', 'ي', 'g'),
      '\s+', ' ', 'g'))
$$;

GRANT EXECUTE ON FUNCTION public.normalize_arabic(text) TO anon, authenticated;

-- ─── 1. Synonym / alias table ────────────────────────────────────────────────
-- One row per (alias → canonical term) mapping. `canonical` is what actually
-- gets appended to the user's query before ranking — it should be a term that
-- reliably appears in product names/categories (an English brand/generic name
-- works well since the catalog stores both Name_Ar and Name_En).

CREATE TABLE IF NOT EXISTS public.search_synonyms (
  id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alias       text        NOT NULL,
  canonical   text        NOT NULL,
  -- 'brand' | 'generic' | 'category' | 'symptom' | 'typo' — informational,
  -- lets an admin dashboard group/filter the alias list; not read by the RPC.
  alias_type  text        NOT NULL DEFAULT 'brand'
              CHECK (alias_type IN ('brand', 'generic', 'category', 'symptom', 'typo')),
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alias)
);

CREATE INDEX IF NOT EXISTS idx_search_synonyms_alias_norm
  ON public.search_synonyms (lower(public.normalize_arabic(public.immutable_unaccent(alias))))
  WHERE is_active;

ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_synonyms_read ON public.search_synonyms;
CREATE POLICY search_synonyms_read
  ON public.search_synonyms FOR SELECT
  USING (true); -- readable by anyone; it's product-name intelligence, not sensitive

DROP POLICY IF EXISTS search_synonyms_admin_write ON public.search_synonyms;
CREATE POLICY search_synonyms_admin_write
  ON public.search_synonyms FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE OR REPLACE FUNCTION public.touch_search_synonyms_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_search_synonyms_updated_at ON public.search_synonyms;
CREATE TRIGGER trg_search_synonyms_updated_at
  BEFORE UPDATE ON public.search_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.touch_search_synonyms_updated_at();

-- ─── 2. Seed from the existing (currently dead) client-side map ─────────────
-- Ported verbatim from apps/shopper-native/src/utils/searchUtils.ts's
-- _RAW_AR_EN. Keeping both copies in sync is a real maintenance cost, but the
-- client-side map stays as the zero-latency first-pass (Stage 7 wires it up)
-- while this table is the authoritative, admin-editable source of truth and
-- the fallback for any caller that isn't the mobile app.

INSERT INTO public.search_synonyms (alias, canonical, alias_type) VALUES
  ('باراسيتامول', 'paracetamol', 'generic'),
  ('باراستامول', 'paracetamol', 'generic'),
  ('بنادول', 'panadol', 'brand'),
  ('بانادول', 'panadol', 'brand'),
  ('بانادول اكسترا', 'panadol extra', 'brand'),
  ('بانادول كولد', 'panadol cold', 'brand'),
  ('بانادول نايت', 'panadol night', 'brand'),
  ('بانادول اطفال', 'panadol baby', 'brand'),
  ('ابيبروفين', 'ibuprofen', 'generic'),
  ('ايبوبروفين', 'ibuprofen', 'generic'),
  ('ايبوبروفن', 'ibuprofen', 'generic'),
  ('بروفين', 'brufen', 'brand'),
  ('بروفن', 'brufen', 'brand'),
  ('نيوروفن', 'nurofen', 'brand'),
  ('أسبرين', 'aspirin', 'generic'),
  ('اسبرين', 'aspirin', 'generic'),
  ('اسبرن', 'aspirin', 'generic'),
  ('ديكلوفيناك', 'diclofenac', 'generic'),
  ('ديكلوفناك', 'diclofenac', 'generic'),
  ('فولتارين', 'voltaren', 'brand'),
  ('فولتارن', 'voltaren', 'brand'),
  ('ترامادول', 'tramadol', 'generic'),
  ('كيتوبروفين', 'ketoprofen', 'generic'),
  ('نابروكسين', 'naproxen', 'generic'),
  ('أموكسيسيلين', 'amoxicillin', 'generic'),
  ('اموكسيسيلين', 'amoxicillin', 'generic'),
  ('اموكسيسلين', 'amoxicillin', 'generic'),
  ('اموكسيل', 'amoxil', 'brand'),
  ('أموكسيل', 'amoxil', 'brand'),
  ('اوجمنتين', 'augmentin', 'brand'),
  ('أوجمنتين', 'augmentin', 'brand'),
  ('سيبروفلوكساسين', 'ciprofloxacin', 'generic'),
  ('سيبرو', 'cipro', 'brand'),
  ('ميترونيدازول', 'metronidazole', 'generic'),
  ('فلاجيل', 'flagyl', 'brand'),
  ('كلاريثروميسين', 'clarithromycin', 'generic'),
  ('اريثروميسين', 'erythromycin', 'generic'),
  ('دوكسيسيكلين', 'doxycycline', 'generic'),
  ('تتراسيكلين', 'tetracycline', 'generic'),
  ('سيفالكسين', 'cefalexin', 'generic'),
  ('باكتريم', 'bactrim', 'brand'),
  ('ازيثروميسين', 'azithromycin', 'generic'),
  ('زيثروماكس', 'zithromax', 'brand'),
  ('أوميبرازول', 'omeprazole', 'generic'),
  ('اوميبرازول', 'omeprazole', 'generic'),
  ('بانتوبرازول', 'pantoprazole', 'generic'),
  ('لانسوبرازول', 'lansoprazole', 'generic'),
  ('رانيتيدين', 'ranitidine', 'generic'),
  ('زانتاك', 'zantac', 'brand'),
  ('غافيسكون', 'gaviscon', 'brand'),
  ('مالوكس', 'maalox', 'brand'),
  ('رينيي', 'rennie', 'brand'),
  ('ميتوكلوبراميد', 'metoclopramide', 'generic'),
  ('بريمبران', 'primperan', 'brand'),
  ('دومبيريدون', 'domperidone', 'generic'),
  ('موتيليوم', 'motilium', 'brand'),
  ('بسكوبان', 'buscopan', 'brand'),
  ('ايموديوم', 'imodium', 'brand'),
  ('كلاريتين', 'claritin', 'brand'),
  ('لوراتادين', 'loratadine', 'generic'),
  ('سيتيريزين', 'cetirizine', 'generic'),
  ('زيرتك', 'zyrtec', 'brand'),
  ('كونجستال', 'congestal', 'brand'),
  ('ديفينهيدرامين', 'diphenhydramine', 'generic'),
  ('بينادريل', 'benadryl', 'brand'),
  ('هيدروكورتيزون', 'hydrocortisone', 'generic'),
  ('ديكساميثازون', 'dexamethasone', 'generic'),
  ('بريدنيزون', 'prednisone', 'generic'),
  ('بريدنيزولون', 'prednisolone', 'generic'),
  ('بيتاميثازون', 'betamethasone', 'generic'),
  ('فلوتيكازون', 'fluticasone', 'generic'),
  ('مترفورمين', 'metformin', 'generic'),
  ('ميتفورمين', 'metformin', 'generic'),
  ('جلوكوفاج', 'glucophage', 'brand'),
  ('انسولين', 'insulin', 'generic'),
  ('غليبنكلاميد', 'glibenclamide', 'generic'),
  ('جليميبيريد', 'glimepiride', 'generic'),
  ('أتورفاستاتين', 'atorvastatin', 'generic'),
  ('اتورفاستاتين', 'atorvastatin', 'generic'),
  ('ليبيتور', 'lipitor', 'brand'),
  ('سيمفاستاتين', 'simvastatin', 'generic'),
  ('روسوفاستاتين', 'rosuvastatin', 'generic'),
  ('كرستور', 'crestor', 'brand'),
  ('املوديبين', 'amlodipine', 'generic'),
  ('نورفاسك', 'norvasc', 'brand'),
  ('لوزارتان', 'losartan', 'generic'),
  ('كوزار', 'cozaar', 'brand'),
  ('اتينولول', 'atenolol', 'generic'),
  ('تينورمين', 'tenormin', 'brand'),
  ('فيتامين سي', 'vitamin c', 'category'),
  ('فيتامين د', 'vitamin d', 'category'),
  ('فيتامين ب', 'vitamin b', 'category'),
  ('فيتامين ب12', 'vitamin b12', 'category'),
  ('فيتامينات', 'vitamins', 'category'),
  ('زنك', 'zinc', 'category'),
  ('ماغنيسيوم', 'magnesium', 'category'),
  ('كالسيوم', 'calcium', 'category'),
  ('حديد', 'iron', 'category'),
  ('اوميغا 3', 'omega 3', 'category'),
  ('زيت السمك', 'fish oil', 'category'),
  ('بيوتين', 'biotin', 'category'),
  ('كولاجين', 'collagen', 'category'),
  ('مكملات غذائية', 'supplements', 'category'),
  ('كريم مرطب', 'moisturizer', 'category'),
  ('مرطب', 'moisturizer', 'category'),
  ('واقي شمس', 'sunscreen', 'category'),
  ('غسول وجه', 'face wash', 'category'),
  ('سيروم', 'serum', 'category'),
  ('تونر', 'toner', 'category'),
  ('شامبو', 'shampoo', 'category'),
  ('بلسم', 'conditioner', 'category'),
  ('كالبول', 'calpol', 'brand'),
  ('مضاد حيوي', 'antibiotic', 'symptom'),
  ('مسكن', 'painkiller', 'symptom'),
  ('مسكنات', 'painkillers', 'symptom'),
  ('خافض حرارة', 'fever reducer', 'symptom'),
  ('مضاد التهاب', 'anti inflammatory', 'symptom'),
  ('عناية بالبشرة', 'skincare', 'category'),
  ('عناية بالشعر', 'hair care', 'category'),
  ('عناية بالجسم', 'body care', 'category'),
  ('مستحضرات تجميل', 'cosmetics', 'category'),
  ('مستلزمات طبية', 'medical supplies', 'category'),
  ('عناية بالعيون', 'eye care', 'category'),
  ('صحة المرأة', 'women health', 'category'),
  ('عناية بالرجل', 'men care', 'category'),
  ('صحة الفم', 'oral health', 'category'),
  ('معجون اسنان', 'toothpaste', 'category'),
  ('غسول فم', 'mouthwash', 'category'),
  ('panadool', 'panadol', 'typo'),
  ('panodol', 'panadol', 'typo'),
  ('ibobrofen', 'ibuprofen', 'typo'),
  ('ibuprophen', 'ibuprofen', 'typo'),
  ('paracetomol', 'paracetamol', 'typo'),
  ('parcetamol', 'paracetamol', 'typo'),
  ('amoxicilin', 'amoxicillin', 'typo'),
  ('amoxisillin', 'amoxicillin', 'typo'),
  ('metformine', 'metformin', 'typo'),
  ('omeprazol', 'omeprazole', 'typo'),
  ('diclofenack', 'diclofenac', 'typo')
ON CONFLICT (alias) DO NOTHING;

-- ─── 3. Query expansion helper ───────────────────────────────────────────────
-- Given a raw query, returns it PLUS any canonical term(s) whose alias
-- matches (normalized comparison, so أ/إ/آ/tashkeel variants all hit the same
-- row). Concatenated into one string so the caller can feed it straight into
-- websearch_to_tsquery / similarity() alongside the original term — this is
-- query EXPANSION, not replacement, so a raw exact match never gets worse.

CREATE OR REPLACE FUNCTION public.expand_search_query(p_query text)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT trim(
    p_query || ' ' || COALESCE(
      (
        SELECT string_agg(DISTINCT s.canonical, ' ')
        FROM public.search_synonyms s
        WHERE s.is_active
          AND lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) = lower(public.normalize_arabic(public.immutable_unaccent(p_query)))
      ),
      ''
    )
  )
$$;

GRANT EXECUTE ON FUNCTION public.expand_search_query(text) TO anon, authenticated;

-- ─── 4. The unified canonical search RPC ────────────────────────────────────
-- Same name + same signature + same output columns as the version the app
-- calls today (supabase/migrations/20260716100000 and 20260825120000) — no
-- app-side changes needed. Ranking logic transplanted from Generation A's
-- search_products (apps/shopper-native/supabase/migrations/20260621_fix_
-- search_rank_type.sql), adapted to read effective_price/has_active_promotion
-- from product_effective_prices instead of raw products, and to run synonym
-- expansion via expand_search_query() before ranking.

DROP FUNCTION IF EXISTS public.search_effective_products(
  text, text, boolean, numeric, numeric, boolean, text, integer, integer
);

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
  IF v_q IS NOT NULL THEN
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
  END IF;

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
      CASE
        WHEN v_q IS NULL THEN 0::double precision
        ELSE (
          -- Tier 1: exact code / barcode
          (CASE
            WHEN lower(product.code)    = lower(v_q) THEN 1000.0
            WHEN lower(product.barcode) = lower(v_q) THEN 1000.0
            ELSE 0.0
          END)
          -- Tier 2: name exact / prefix bonus (normalized Arabic + raw English)
          + (CASE
              WHEN public.normalize_arabic(coalesce(product.name_ar, '')) = v_uq THEN 80.0
              WHEN coalesce(product.name_en, '') ILIKE v_uq THEN 80.0
              WHEN public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE v_uq || ' %' THEN 40.0
              WHEN coalesce(product.name_en, '') ILIKE v_uq || ' %' THEN 40.0
              WHEN public.normalize_arabic(coalesce(product.name_ar, '')) ILIKE v_uq || '%' THEN 20.0
              WHEN coalesce(product.name_en, '') ILIKE v_uq || '%' THEN 20.0
              ELSE 0.0
            END)
          -- Tier 3: full-text cover density (search_vector already carries
          -- weighted, Arabic-normalized tokens — see products_search_vector_
          -- update() trigger)
          + (CASE WHEN v_tsq IS NOT NULL THEN
               COALESCE(ts_rank_cd(p.search_vector, v_tsq) * 2.5, 0.0)
             ELSE 0.0 END)
          -- Tier 4: whole-string trigram similarity (typo tolerance)
          + 1.2 * GREATEST(
              COALESCE(similarity(public.normalize_arabic(coalesce(product.name_ar, '')), v_uq), 0),
              COALESCE(similarity(coalesce(product.name_en, ''), v_uq), 0)
            )
          -- Tier 5: word / partial similarity (live-typing prefix)
          + 0.9 * GREATEST(
              COALESCE(word_similarity(v_uq, public.normalize_arabic(coalesce(product.name_ar, ''))), 0),
              COALESCE(word_similarity(v_uq, coalesce(product.name_en, '')), 0)
            )
          -- Tier 6: category light signal
          + 0.08 * GREATEST(
              COALESCE(similarity(public.normalize_arabic(coalesce(product.category_name, '')), v_uq), 0),
              COALESCE(similarity(coalesce(product.category_name_en, ''), v_uq), 0)
            )
        )
      END AS relevance_score
    FROM public.product_effective_prices AS product
    JOIN public.products p ON p.id = product.id
    WHERE product.is_active = true
      AND (p_category IS NULL OR btrim(p_category) = '' OR product.category_name = p_category OR product.category_name_en = p_category)
      AND (NOT p_in_stock OR product.stock > 0)
      AND (p_min_price IS NULL OR product.effective_price >= p_min_price)
      AND (p_max_price IS NULL OR product.effective_price <= p_max_price)
      AND (NOT p_is_sale OR product.has_active_promotion)
      AND (
        v_q IS NULL
        OR (v_tsq IS NOT NULL AND p.search_vector @@ v_tsq)
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
    SELECT * FROM filtered WHERE v_q IS NULL OR relevance_score > 0.05
  ),
  counted AS (
    SELECT relevant.*, count(*) OVER () AS row_total FROM relevant
  )
  SELECT
    counted.id,
    counted.code,
    counted.barcode,
    counted.name_ar,
    counted.name_en,
    counted.base_price,
    counted.effective_price,
    counted.stock,
    counted.category_name,
    counted.category_name_en,
    counted.image_url,
    counted.rating_avg,
    counted.rating_count,
    counted.is_new,
    counted.is_bestseller,
    counted.promotion_id,
    counted.promotion_name,
    counted.promotion_discount_type,
    counted.promotion_discount_value,
    counted.promotion_ends_at,
    counted.has_active_promotion,
    counted.d_amount,
    counted.d_percent,
    counted.row_total
  FROM counted
  ORDER BY
    CASE WHEN p_sort = 'price_asc' THEN counted.effective_price END ASC,
    CASE WHEN p_sort = 'price_desc' THEN counted.effective_price END DESC,
    CASE WHEN p_sort = 'name_asc' THEN counted.name_en END ASC,
    CASE WHEN p_sort = 'newest' AND v_q IS NULL THEN counted.id END DESC NULLS LAST,
    counted.relevance_score DESC,
    counted.name_en ASC NULLS LAST,
    counted.id
  LIMIT greatest(1, least(p_limit, 100))
  OFFSET greatest(0, p_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_effective_products(text, text, boolean, numeric, numeric, boolean, text, integer, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.search_effective_products IS
  'Canonical product search + browse RPC. Ranking engine transplanted from the '
  '(previously unused) search_products RPC — weighted tsvector FTS, Arabic-'
  'normalized trigram + word-similarity fuzzy matching, exact/prefix bonuses — '
  'now running against product_effective_prices for promotion-aware pricing, '
  'plus server-side synonym expansion via search_synonyms/expand_search_query. '
  'This supersedes the ILIKE-only version from 20260716100000 and the pg_trgm-'
  'only version from 20260825120000 — both were partial fixes to the same '
  'underlying "search is dumber than it needs to be" problem.';

COMMENT ON TABLE public.search_synonyms IS
  'Admin-editable brand/generic/category/symptom synonym table powering '
  'expand_search_query(). Seeded from apps/shopper-native/src/utils/'
  'searchUtils.ts''s _RAW_AR_EN map — add new aliases here going forward, not '
  'in application code.';

NOTIFY pgrst, 'reload schema';
