-- =============================================================================
-- Product Intelligence — Stage 4: Embedding lifecycle (pgvector)
-- Date: 2026-08-26
--
-- Genuinely new infrastructure — no prior migration touches pgvector or an
-- embedding column anywhere in this project (confirmed by direct query
-- against the live schema before writing this).
--
-- Why this is a separate migration from Stage 1: Stage 1's hybrid search
-- (lexical + trigram + word-similarity) works today, synchronously, inside
-- one RPC call, with zero external dependencies. Semantic search fundamentally
-- cannot: turning a query into a vector requires running an embedding model,
-- and Postgres functions can't run a model or make a synchronous outbound
-- call from inside a stable SQL/plpgsql function. So query-time embedding has
-- to happen in the search-intelligence Edge Function (see supabase/functions/
-- search-intelligence/), which embeds the query locally via gte-small, then
-- calls the SQL function this migration defines (search_products_semantic)
-- for the actual nearest-neighbor lookup. Everything on the Postgres side
-- works from the moment this migration runs — the column starts NULL until
-- generate-embeddings backfills it, the semantic function returns zero rows
-- until then, and the Edge Function's fallback (see its own comments) means
-- lexical+fuzzy search is completely unaffected either way.
--
-- Embedding dimension: 384, matching gte-small — the embedding model built
-- into the Supabase Edge Runtime (Supabase.ai.Session('gte-small'), see
-- supabase/functions/_shared/embeddings.ts). This system calls no external
-- AI API for embeddings (or anything else): gte-small runs locally inside
-- the Edge Function, on Supabase's own infrastructure, with no API key and
-- no third-party network call. If that ever changes, this column and its
-- index must be recreated to match — pgvector columns are fixed-dimension,
-- there is no dimension-agnostic option.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. Embedding column + metadata ──────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS embedding vector(384),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_failed_attempts smallint NOT NULL DEFAULT 0;

-- HNSW: Supabase's current general recommendation over IVFFlat for most
-- workloads (better recall/build-time tradeoff, no need to pre-know table
-- size to pick a list count). Only useful once rows actually have vectors,
-- but safe to create empty — it just costs near-nothing until populated.
CREATE INDEX IF NOT EXISTS idx_products_embedding_hnsw
  ON public.products USING hnsw (embedding vector_cosine_ops);

-- ─── 2. Staleness trigger ────────────────────────────────────────────────────
-- When any embedding-relevant column changes, the OLD embedding is now
-- describing stale text. Null it out (not delete-and-regenerate — NULL is
-- exactly the "needs regeneration" signal generate-embeddings polls for) and
-- reset the failure counter so a previously-failing product gets a fresh
-- attempt if its content changed since.

CREATE OR REPLACE FUNCTION public.products_invalidate_embedding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW."Name_Ar" IS DISTINCT FROM OLD."Name_Ar" OR
    NEW."Name_En" IS DISTINCT FROM OLD."Name_En" OR
    NEW."Category_Name" IS DISTINCT FROM OLD."Category_Name" OR
    NEW."Category_Name_En" IS DISTINCT FROM OLD."Category_Name_En"
  ) THEN
    NEW.embedding := NULL;
    NEW.embedding_model := NULL;
    NEW.embedding_updated_at := NULL;
    NEW.embedding_failed_attempts := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_invalidate_embedding ON public.products;
CREATE TRIGGER trg_products_invalidate_embedding
  BEFORE UPDATE OF "Name_Ar", "Name_En", "Category_Name", "Category_Name_En"
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_invalidate_embedding();

-- ─── 3. Canonical search-document text ──────────────────────────────────────
-- The exact string that gets embedded — a deliberately-composed
-- representation (name + category, both languages), not a blind
-- concatenation of every column. Exposed as a function (not a generated
-- column) because generate-embeddings needs to read this same text for many
-- rows in one query and a plain SELECT expression is simplest there.

CREATE OR REPLACE FUNCTION public.product_search_document(
  p_name_ar text, p_name_en text, p_category_name text, p_category_name_en text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(both ' | ' FROM
    concat_ws(' | ',
      nullif(trim(coalesce(p_name_en, '')), ''),
      nullif(trim(coalesce(p_name_ar, '')), ''),
      nullif(trim(coalesce(p_category_name_en, '')), ''),
      nullif(trim(coalesce(p_category_name, '')), '')
    )
  )
$$;

-- ─── 4. Worker-facing helper — what needs embedding right now ───────────────
-- embedding_failed_attempts >= 5 stops retrying a row that keeps failing
-- (e.g. consistently-empty name after all the above coalescing) so a single
-- bad row can't loop the worker forever; an admin can reset the counter to
-- retry deliberately.

CREATE OR REPLACE FUNCTION public.products_pending_embedding(p_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, search_document text)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    public.product_search_document(p."Name_Ar", p."Name_En", p."Category_Name", p."Category_Name_En")
  FROM public.products p
  WHERE p.is_active = true
    AND p.embedding IS NULL
    AND p.embedding_failed_attempts < 5
    AND public.product_search_document(p."Name_Ar", p."Name_En", p."Category_Name", p."Category_Name_En") <> ''
  ORDER BY p.embedding_failed_attempts ASC, p.id ASC
  LIMIT greatest(1, least(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.products_pending_embedding(integer) TO service_role;

-- ─── 5. Write-back helpers (service-role only — called by generate-embeddings) ─

CREATE OR REPLACE FUNCTION public.set_product_embedding(
  p_id uuid, p_embedding vector(384), p_model text
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.products
  SET embedding = p_embedding,
      embedding_model = p_model,
      embedding_updated_at = now(),
      embedding_failed_attempts = 0
  WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.mark_product_embedding_failed(p_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.products
  SET embedding_failed_attempts = embedding_failed_attempts + 1
  WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.set_product_embedding(uuid, vector, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_product_embedding_failed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_product_embedding(uuid, vector, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_product_embedding_failed(uuid) TO service_role;

-- ─── 6. Semantic nearest-neighbor search ─────────────────────────────────────
-- Called by search-intelligence AFTER it embeds the user's query — this
-- function only does the vector math, it never calls out to an API itself.
-- Returns effective-pricing-joined rows (same shape family as
-- search_effective_products) so the Edge Function can merge/dedupe by id
-- without a second round-trip for pricing.
--
-- 1 - cosine_distance is used as the similarity score (0-1, higher = closer)
-- so callers can apply the same "confidence threshold" mental model as the
-- lexical path's relevance_score, even though the two are on different scales
-- and should not be summed directly without the blending logic the Edge
-- Function owns.

CREATE OR REPLACE FUNCTION public.search_products_semantic(
  p_embedding vector(384),
  p_limit integer DEFAULT 20,
  p_min_similarity real DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  category_name text,
  category_name_en text,
  effective_price numeric,
  stock numeric,
  image_url text,
  similarity real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    product.id,
    product.name_ar,
    product.name_en,
    product.category_name,
    product.category_name_en,
    product.effective_price,
    product.stock,
    product.image_url,
    (1 - (p.embedding <=> p_embedding))::real AS similarity
  FROM public.product_effective_prices AS product
  JOIN public.products p ON p.id = product.id
  WHERE product.is_active = true
    AND p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> p_embedding)) >= p_min_similarity
  ORDER BY p.embedding <=> p_embedding ASC
  LIMIT greatest(1, least(p_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.search_products_semantic(vector, integer, real) TO anon, authenticated;

COMMENT ON COLUMN public.products.embedding IS
  'gte-small vector (384-dim), computed locally in the Supabase Edge Runtime '
  '(no external AI API), over product_search_document(). NULL until '
  'generate-embeddings backfills it or an update invalidates it — semantic '
  'search degrades gracefully to zero rows, never an error, when NULL.';

NOTIFY pgrst, 'reload schema';
