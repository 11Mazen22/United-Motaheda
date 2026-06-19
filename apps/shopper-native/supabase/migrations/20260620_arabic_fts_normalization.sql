-- ============================================================================
-- Migration: 20260620_arabic_fts_normalization.sql
--
-- Root cause: unaccent() is Latin-only. It does nothing to Arabic tashkeel
-- (ً ٌ ٍ َ ُ ِ ّ ْ) or alef variants (أ إ آ ٱ). The search_vector for
-- "أسبرين" stored token "أسبرين". The client normalizes to "اسبرين" before
-- sending. tsquery "اسبرين" never matched token "أسبرين". FTS silently
-- returned nothing for Arabic across all 8000+ products. Trigram ILIKE was
-- the only surviving fallback — and only when the user's spelling matched the
-- DB spelling exactly.
--
-- This migration fixes the problem from the ground up:
--
--   1. normalize_arabic() — IMMUTABLE, STRICT, PARALLEL SAFE SQL function.
--      Mirrors the client's normalizeArabic() exactly so index-time and
--      query-time normalization are identical.
--
--   2. Functional GiST index on normalize_arabic("Name_Ar") — supports
--      %, <%, and ILIKE on the normalized column without a full-table scan.
--
--   3. Rebuild products_search_vector_update() trigger — Arabic columns now
--      pass through normalize_arabic(unaccent(...)) before to_tsvector().
--
--   4. Full backfill — all 8000+ products get new normalized search_vector.
--
--   5. Rebuild search_products — v_uq becomes normalize_arabic(unaccent(v_q)),
--      every Arabic column comparison uses normalize_arabic(), trigram
--      thresholds tuned to 0.2 / 0.4 for better Arabic recall.
--      All 20260619 fixes (ORDER BY, category injection, rank threshold,
--      name prefix bonus) are also incorporated here.
-- ============================================================================

-- ─── 1. normalize_arabic() ──────────────────────────────────────────────────
-- Transforms Arabic text identically to the client-side normalizeArabic():
--   • Strip tashkeel U+064B–U+065F, tatweel U+0640, superscript alef U+0670,
--     high hamza U+0674
--   • Unify alef variants أ إ آ ٱ → ا
--   • ta marbuta ة → ه
--   • alef maqsura ى → ي
--   • waw + hamza ؤ → و
--   • ya + hamza ئ → ي
--   • Collapse whitespace runs
--
-- IMMUTABLE + STRICT: safe for functional indexes. Latin characters pass
-- through unchanged (unaccent() handles those separately).

create or replace function public.normalize_arabic(t text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(t,
                  '[ً-ٟـٰٴ]', '', 'g'),   -- strip tashkeel + tatweel
                '[أإآٱ]', 'ا', 'g'),       -- unify alef variants
              'ة', 'ه', 'g'),              -- ta marbuta → ha
            'ى', 'ي', 'g'),               -- alef maqsura → ya
          'ؤ', 'و', 'g'),                 -- waw + hamza → waw
        'ئ', 'ي', 'g'),                   -- ya + hamza → ya
      '\s+', ' ', 'g'))                   -- collapse whitespace
$$;

-- ─── 2. Functional GiST index on normalized Arabic ──────────────────────────
-- Supports %, <%, ILIKE on normalize_arabic("Name_Ar") in WHERE and ranking.
-- Without this, every normalized Arabic comparison would full-scan 8000 rows.
create index if not exists idx_products_name_ar_norm_trgm
  on public.products
  using gist (normalize_arabic("Name_Ar") gist_trgm_ops);

-- ─── 3. Rebuild search_vector trigger ───────────────────────────────────────
-- Arabic name columns now use normalize_arabic(unaccent(...)) before
-- to_tsvector(). This makes FTS tokens consistent with normalized queries:
-- "أسبرين" → "اسبرين" in the index, tsquery "اسبرين" → match.
-- English columns remain unaccent()-only (correct for Latin diacritics).

create or replace function public.products_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple',
      normalize_arabic(unaccent(coalesce(new."Name",    '')))),   'A') ||
    setweight(to_tsvector('simple',
      normalize_arabic(unaccent(coalesce(new."Name_Ar", '')))),   'A') ||
    setweight(to_tsvector('simple',
      unaccent(coalesce(new."Name_En", ''))),                      'A') ||
    setweight(to_tsvector('simple',
      unaccent(coalesce(new."Code", ''))),                         'B') ||
    setweight(to_tsvector('simple',
      unaccent(coalesce(new."Barcode", ''))),                      'B') ||
    setweight(to_tsvector('simple',
      normalize_arabic(unaccent(coalesce(new."Category_Name",    '')))), 'C') ||
    setweight(to_tsvector('simple',
      unaccent(coalesce(new."Category_Name_En", ''))),             'C');
  return new;
end;
$$;

drop trigger if exists products_search_vector_trg on public.products;

create trigger products_search_vector_trg
  before insert or update of
    "Name", "Name_Ar", "Name_En", "Code", "Barcode",
    "Category_Name", "Category_Name_En"
  on public.products
  for each row execute function public.products_search_vector_update();

-- ─── 4. Full backfill — rebuild search_vector for all 8000+ products ────────
update public.products
set search_vector =
  setweight(to_tsvector('simple',
    normalize_arabic(unaccent(coalesce("Name",    '')))),   'A') ||
  setweight(to_tsvector('simple',
    normalize_arabic(unaccent(coalesce("Name_Ar", '')))),   'A') ||
  setweight(to_tsvector('simple',
    unaccent(coalesce("Name_En", ''))),                      'A') ||
  setweight(to_tsvector('simple',
    unaccent(coalesce("Code", ''))),                         'B') ||
  setweight(to_tsvector('simple',
    unaccent(coalesce("Barcode", ''))),                      'B') ||
  setweight(to_tsvector('simple',
    normalize_arabic(unaccent(coalesce("Category_Name",    '')))), 'C') ||
  setweight(to_tsvector('simple',
    unaccent(coalesce("Category_Name_En", ''))),             'C');

-- ─── 5. Rebuild search_products ─────────────────────────────────────────────
drop function if exists public.search_products(text,text,boolean,numeric,numeric,text,int,int);

create or replace function public.search_products(
  p_query      text     default null,
  p_category   text     default null,
  p_in_stock   boolean  default false,
  p_min_price  numeric  default null,
  p_max_price  numeric  default null,
  p_sort       text     default 'relevance',
  p_limit      int      default 24,
  p_offset     int      default 0
)
returns table (
  id                text,
  code              text,
  barcode           text,
  name_ar           text,
  name_en           text,
  price             numeric,
  stock             numeric,
  category_name     text,
  category_name_en  text,
  image_url         text,
  rank              real,
  total_count       bigint
)
language plpgsql
stable
security invoker
set search_path                       = public
set pg_trgm.similarity_threshold      to 0.2
set pg_trgm.word_similarity_threshold to 0.4
as $$
declare
  v_q      text := nullif(trim(coalesce(p_query, '')), '');
  -- v_uq: Arabic-normalized + Latin-unaccented query — single source of truth
  -- for all text comparisons. Idempotent: safe to apply to already-normalized input.
  v_uq     text;
  v_tsq    tsquery;
  v_limit  int  := least(greatest(coalesce(p_limit, 24), 1), 100);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
begin
  if v_q is not null then
    v_uq := normalize_arabic(unaccent(v_q));

    begin
      v_tsq := websearch_to_tsquery('simple', v_uq);
    exception when others then
      begin
        v_tsq := plainto_tsquery('simple', v_uq);
      exception when others then
        v_tsq := null;
      end;
    end;
  end if;

  return query
  with filtered as (
    select
      p.id,
      p."Code"             as code,
      p."Barcode"          as barcode,
      p."Name_Ar"          as name_ar,
      p."Name_En"          as name_en,
      p."Price"            as price,
      p."Stock"            as stock,
      p."Category_Name"    as category_name,
      p."Category_Name_En" as category_name_en,
      p.image_url,
      case
        when v_q is null then 0::real
        else (
          -- ── Tier 1: Exact code / barcode → always first ─────────────────
          case
            when p."Code"    ilike v_q  then 1000.0
            when p."Barcode" ilike v_q  then 1000.0
            when p."Code"    ilike v_uq then  999.0
            when p."Barcode" ilike v_uq then  999.0
            else 0.0
          end

          -- ── Tier 2: Name exact / prefix bonus ───────────────────────────
          -- Normalized Arabic comparison uses functional index on name_ar_norm.
          + case
              when normalize_arabic(p."Name_Ar") =        v_uq         then 80.0
              when p."Name_En"                    ilike    v_uq         then 80.0
              when normalize_arabic(p."Name_Ar") ilike    v_uq || ' %' then 40.0
              when p."Name_En"                   ilike    v_uq || ' %' then 40.0
              when normalize_arabic(p."Name_Ar") ilike    v_uq || '%'  then 20.0
              when p."Name_En"                   ilike    v_uq || '%'  then 20.0
              else 0.0
            end

          -- ── Tier 3: Full-text rank ───────────────────────────────────────
          -- Now works for Arabic: search_vector tokens are normalized,
          -- v_tsq is built from v_uq (also normalized). Tokens match.
          + case
              when v_tsq is not null and p.search_vector is not null
              then ts_rank_cd(p.search_vector, v_tsq) * 2.5
              else 0.0
            end

          -- ── Tier 4: Whole-string trigram ────────────────────────────────
          -- normalize_arabic(Name_Ar) uses functional GiST index.
          + 1.2 * greatest(
              coalesce(similarity(normalize_arabic(coalesce(p."Name_Ar", '')), v_uq), 0),
              coalesce(similarity(coalesce(p."Name_En", ''), v_uq), 0)
            )

          -- ── Tier 5: Partial / word similarity ───────────────────────────
          -- "بانا" → "بانادول" via word_similarity with threshold 0.4.
          + 0.9 * greatest(
              coalesce(word_similarity(v_uq, normalize_arabic(coalesce(p."Name_Ar", ''))), 0),
              coalesce(word_similarity(v_uq, coalesce(p."Name_En", '')), 0)
            )

          -- ── Tier 6: Category signal (light, 0.08) ───────────────────────
          + 0.08 * greatest(
              coalesce(similarity(normalize_arabic(coalesce(p."Category_Name",    '')), v_uq), 0),
              coalesce(similarity(coalesce(p."Category_Name_En", ''), v_uq), 0)
            )
        )
      end as rnk
    from public.products p
    where coalesce(p.is_active, true) = true

      -- ── User-facing category filter ──────────────────────────────────────
      and (
        p_category is null
        or p."Category_Name"    =     p_category
        or p."Category_Name"    ilike p_category
        or p."Category_Name_En" ilike p_category
      )

      and (not p_in_stock or coalesce(p."Stock", 0) > 0)
      and (p_min_price is null or p."Price" >= p_min_price)
      and (p_max_price is null or p."Price" <= p_max_price)

      -- ── Text matching — 7 complementary strategies ───────────────────────
      -- Category ILIKE intentionally excluded from WHERE (bug from 20260532):
      -- it pulled entire categories into results regardless of name relevance.
      and (
        v_q is null

        -- 1. Full-text (search_vector is now normalized — Arabic FTS works)
        or (v_tsq is not null and p.search_vector is not null
            and p.search_vector @@ v_tsq)

        -- 2. Normalized Arabic trigram whole-string (uses functional GiST)
        or normalize_arabic(p."Name_Ar") %  v_uq

        -- 3. English trigram whole-string (uses existing GiST idx_products_name_en_trgm)
        or p."Name_En" % v_uq

        -- 4. Normalized Arabic partial/word (uses functional GiST)
        or v_uq <% normalize_arabic(p."Name_Ar")

        -- 5. English partial/word (uses existing GiST idx_products_name_en_trgm)
        or v_uq <% p."Name_En"

        -- 6. Normalized Arabic ILIKE — handles alef/tashkeel mismatches
        --    between the user's typed form and what is stored in the DB.
        --    Uses functional GiST index (gist_trgm_ops supports ILIKE).
        or normalize_arabic(p."Name_Ar") ilike '%' || v_uq || '%'

        -- 7. English ILIKE (uses existing GIN products_name_en_trgm)
        or p."Name_En" ilike '%' || v_uq || '%'

        -- 8. Raw Arabic ILIKE — defensive fallback for exact-spelling matches
        --    and direct API calls that bypass client normalisation.
        --    Uses existing GIN products_name_ar_trgm.
        or p."Name_Ar" ilike '%' || v_q || '%'

        -- 9. Code / barcode prefix
        or p."Code"    ilike v_q || '%'
        or p."Barcode" ilike v_q || '%'
      )
  ),

  -- Minimum rank gate: when a query is active, products with rnk ≤ 0.05 matched
  -- only via an extremely weak signal (near-zero trigram, distant category score).
  -- Browse mode (v_q is null) passes all products through unchanged.
  relevant as (
    select f.*
    from filtered f
    where v_q is null or f.rnk > 0.05
  ),

  counted as (
    select r.*, count(*) over () as total_count
    from   relevant r
  )

  select
    c.id::text,
    c.code,
    c.barcode,
    c.name_ar,
    c.name_en,
    c.price,
    c.stock,
    c.category_name,
    c.category_name_en,
    c.image_url,
    c.rnk,
    c.total_count
  from counted c
  order by
    case when p_sort = 'price_asc'  then c.price   end asc  nulls last,
    case when p_sort = 'price_desc' then c.price   end desc nulls last,
    case when p_sort = 'name_asc'   then c.name_ar end asc  nulls last,
    -- 'newest' in browse mode (no query) = insertion order.
    -- When a query is active, this CASE is null for every row, so rank wins.
    case when p_sort = 'newest' and v_q is null then c.id end desc nulls last,
    c.rnk desc,
    c.id  desc
  limit  v_limit
  offset v_offset;
end;
$$;

-- ─── 6. Permissions ─────────────────────────────────────────────────────────
revoke all    on function public.search_products(text,text,boolean,numeric,numeric,text,int,int) from public;
grant  execute on function public.search_products(text,text,boolean,numeric,numeric,text,int,int) to anon, authenticated;

-- normalize_arabic is a utility function — grant read-only callers access
-- so PostgREST RPC and any future views can use it.
grant  execute on function public.normalize_arabic(text) to anon, authenticated;

-- ─── 7. Notify PostgREST ────────────────────────────────────────────────────
notify pgrst, 'reload schema';
