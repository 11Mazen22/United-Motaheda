-- ============================================================================
-- Migration: 20260621_fix_search_rank_type.sql
--
-- Bug: search_products RPC returns HTTP 400 with error:
--   "Returned type double precision does not match expected type real in column 11."
--
-- Root cause: the `rank` return column was declared as `real`, but the CASE
-- expression in the SELECT mixes `0::real` with un-cast numeric literals
-- (1000.0, 999.0, 80.0 …) which PostgreSQL treats as `double precision`.
-- CASE promotes the whole expression to double precision, mismatching the
-- function's declared return type.
--
-- Fix: change `rank real` → `rank double precision` in the return type.
-- Function body is otherwise identical to 20260620.
-- ============================================================================

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
  rank              double precision,
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
        when v_q is null then 0.0
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
          + case
              when v_tsq is not null and p.search_vector is not null
              then ts_rank_cd(p.search_vector, v_tsq) * 2.5
              else 0.0
            end

          -- ── Tier 4: Whole-string trigram ────────────────────────────────
          + 1.2 * greatest(
              coalesce(similarity(normalize_arabic(coalesce(p."Name_Ar", '')), v_uq), 0),
              coalesce(similarity(coalesce(p."Name_En", ''), v_uq), 0)
            )

          -- ── Tier 5: Partial / word similarity ───────────────────────────
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

      -- ── Text matching — 9 complementary strategies ───────────────────────
      and (
        v_q is null

        -- 1. Full-text (search_vector tokens are normalized — Arabic FTS works)
        or (v_tsq is not null and p.search_vector is not null
            and p.search_vector @@ v_tsq)

        -- 2. Normalized Arabic trigram whole-string (uses functional GiST)
        or normalize_arabic(p."Name_Ar") %  v_uq

        -- 3. English trigram whole-string
        or p."Name_En" % v_uq

        -- 4. Normalized Arabic partial/word
        or v_uq <% normalize_arabic(p."Name_Ar")

        -- 5. English partial/word
        or v_uq <% p."Name_En"

        -- 6. Normalized Arabic ILIKE
        or normalize_arabic(p."Name_Ar") ilike '%' || v_uq || '%'

        -- 7. English ILIKE
        or p."Name_En" ilike '%' || v_uq || '%'

        -- 8. Raw Arabic ILIKE — defensive fallback
        or p."Name_Ar" ilike '%' || v_q || '%'

        -- 9. Code / barcode prefix
        or p."Code"    ilike v_q || '%'
        or p."Barcode" ilike v_q || '%'
      )
  ),

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
    case when p_sort = 'newest' and v_q is null then c.id end desc nulls last,
    c.rnk desc,
    c.id  desc
  limit  v_limit
  offset v_offset;
end;
$$;

-- Re-grant permissions
revoke all     on function public.search_products(text,text,boolean,numeric,numeric,text,int,int) from public;
grant  execute on function public.search_products(text,text,boolean,numeric,numeric,text,int,int) to anon, authenticated;
