-- ============================================================================
-- Migration: 20260619_search_relevance_overhaul.sql
--
-- Fixes three bugs that caused irrelevant results (e.g. "بنادول" returning
-- unrelated products) and adds "relevance" as the default sort mode for
-- query-driven search.
--
-- Bug #1 (PRIMARY): ORDER BY newest ignored rank entirely when a query was
--   active — products were ordered by insertion id regardless of relevance.
--   Fix: gate the newest CASE on "v_q is null" so rank wins during search.
--
-- Bug #2: Category ILIKE in WHERE pulled entire product categories into
--   results when a category name contained the query term (e.g. searching
--   "pain" returned every product in a "Pain Relief" category).
--   Fix: removed category ILIKE from WHERE matching clause.
--
-- Bug #3: No minimum rank threshold — near-zero-rank products were included.
--   Fix: added "relevant" CTE that filters rnk > 0.05 when query is active.
--
-- Additional improvements:
--   • Name prefix/exact bonus tier between code-match (1000) and FTS score
--   • Category weight lowered from 0.15 → 0.08 to reduce category inflation
--
-- Safe to run multiple times — CREATE OR REPLACE / DROP IF EXISTS.
-- ============================================================================

-- ─── 1. Ensure extensions ───────────────────────────────────────────────────
create extension if not exists pg_trgm  with schema public;
create extension if not exists unaccent with schema public;

-- ─── 2. Indexes (idempotent) ────────────────────────────────────────────────
create index if not exists idx_products_search_vector
  on public.products using gin(search_vector);

create index if not exists idx_products_name_en_trgm
  on public.products using gist("Name_En" gist_trgm_ops);

create index if not exists idx_products_name_ar_trgm
  on public.products using gist("Name_Ar" gist_trgm_ops);

-- ─── 3. Drop old signatures ─────────────────────────────────────────────────
drop function if exists public.search_products(text,text,boolean,numeric,numeric,text,int,int);

-- ─── 4. Rebuild search_products ─────────────────────────────────────────────
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
set search_path = public
as $$
declare
  v_q      text := nullif(trim(coalesce(p_query, '')), '');
  v_uq     text;
  v_tsq    tsquery;
  v_limit  int  := least(greatest(coalesce(p_limit, 24), 1), 100);
  v_offset int  := greatest(coalesce(p_offset, 0), 0);
begin
  if v_q is not null then
    v_uq := unaccent(v_q);

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
          -- ── Tier 1: Exact code / barcode → always surfaces first ──────────
          case
            when p."Code"    ilike v_q  then 1000.0
            when p."Barcode" ilike v_q  then 1000.0
            when p."Code"    ilike v_uq then  999.0
            when p."Barcode" ilike v_uq then  999.0
            else 0.0
          end

          -- ── Tier 2: Name prefix / exact match bonus ───────────────────────
          -- Rewards products whose name starts with or exactly equals query.
          -- Sits between code-match and FTS so named products rank above
          -- tangentially-related ones.
          + case
              when p."Name_En" ilike v_uq        then 80.0
              when p."Name_Ar" ilike v_q          then 80.0
              when p."Name_En" ilike v_uq || ' %' then 40.0
              when p."Name_Ar" ilike v_q  || ' %' then 40.0
              when p."Name_En" ilike v_uq || '%'  then 20.0
              when p."Name_Ar" ilike v_q  || '%'  then 20.0
              else 0.0
            end

          -- ── Tier 3: Full-text rank (cover density) ───────────────────────
          + case
              when v_tsq is not null and p.search_vector is not null
              then ts_rank_cd(p.search_vector, v_tsq) * 2.5
              else 0.0
            end

          -- ── Tier 4: Whole-string trigram similarity ───────────────────────
          + 1.2 * greatest(
              coalesce(similarity(coalesce(p."Name_Ar", ''), v_uq), 0),
              coalesce(similarity(coalesce(p."Name_En", ''), v_uq), 0)
            )

          -- ── Tier 5: Word / partial similarity ────────────────────────────
          + 0.9 * greatest(
              coalesce(word_similarity(v_uq, coalesce(p."Name_Ar", '')), 0),
              coalesce(word_similarity(v_uq, coalesce(p."Name_En", '')), 0)
            )

          -- ── Tier 6: Category light signal (reduced weight) ───────────────
          + 0.08 * greatest(
              coalesce(similarity(coalesce(p."Category_Name",    ''), v_uq), 0),
              coalesce(similarity(coalesce(p."Category_Name_En", ''), v_uq), 0)
            )
        )
      end as rnk
    from public.products p
    where coalesce(p.is_active, true) = true

      -- ── Category filter ──────────────────────────────────────────────────
      and (
        p_category is null
        or p."Category_Name"    =     p_category
        or p."Category_Name"    ilike p_category
        or p."Category_Name_En" ilike p_category
      )

      -- ── Stock filter ─────────────────────────────────────────────────────
      and (not p_in_stock or coalesce(p."Stock", 0) > 0)

      -- ── Price filters ────────────────────────────────────────────────────
      and (p_min_price is null or p."Price" >= p_min_price)
      and (p_max_price is null or p."Price" <= p_max_price)

      -- ── Text matching: name/code/FTS strategies only ─────────────────────
      -- Category ILIKE intentionally excluded — it injected entire categories
      -- into results regardless of whether the product name matched.
      and (
        v_q is null

        -- 1. Full-text vector (highest precision)
        or (v_tsq is not null and p.search_vector is not null
            and p.search_vector @@ v_tsq)

        -- 2. Whole-string trigram (standard fuzzy)
        or p."Name_Ar" %  v_uq
        or p."Name_En" %  v_uq

        -- 3. Word / partial trigram — "panad" ∈ "panadol"
        or v_uq <% p."Name_Ar"
        or v_uq <% p."Name_En"

        -- 4. ILIKE substring — raw query (handles Arabic direct input)
        or p."Name_Ar" ilike '%' || v_q  || '%'
        or p."Name_En" ilike '%' || v_q  || '%'

        -- 5. ILIKE substring — unaccented (handles normalised Arabic from client)
        or p."Name_Ar" ilike '%' || v_uq || '%'
        or p."Name_En" ilike '%' || v_uq || '%'

        -- 6. Code / barcode prefix
        or p."Code"    ilike v_q || '%'
        or p."Barcode" ilike v_q || '%'
      )
  ),
  -- Minimum rank filter: when a query is active, drop products with near-zero
  -- relevance (rnk ≤ 0.05) — they matched only by category weight or a very
  -- weak trigram, not by name or FTS. Browse mode (v_q is null) keeps all.
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
    -- Bug #1 fix: only sort by id (insertion order) when browsing without a
    -- query. When v_q is not null, this CASE evaluates to NULL for all rows
    -- so the tiebreaker falls through to c.rnk desc (relevance ranking).
    case when p_sort = 'newest' and v_q is null then c.id end desc nulls last,
    -- Default and search-mode fallback: rank wins
    c.rnk desc,
    c.id  desc
  limit  v_limit
  offset v_offset;
end;
$$;

revoke all    on function public.search_products(text,text,boolean,numeric,numeric,text,int,int) from public;
grant execute on function public.search_products(text,text,boolean,numeric,numeric,text,int,int) to anon, authenticated;

-- ─── 5. Notify PostgREST ────────────────────────────────────────────────────
notify pgrst, 'reload schema';
