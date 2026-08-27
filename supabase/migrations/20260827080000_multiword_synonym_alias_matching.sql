-- =============================================================================
-- Confirmed live: "محتاج مضاد حيوي" (I need an antibiotic) correctly
-- returned Augmentin/Ciprofloxacin, but ALSO Voltaren (an anti-inflammatory,
-- not an antibiotic). Root cause is structural, not a one-off word pair:
-- multi-word Arabic aliases like 'مضاد حيوي' (antibiotic) and 'مضاد التهاب'
-- (anti-inflammatory) share the prefix word 'مضاد' ("anti-/resistant to").
-- find_synonym_terms tokenizes the query and fuzzy-matches individual
-- tokens against individual alias fragments — so the lone token 'مضاد'
-- (leftover once the 2-word alias gets split apart by the query's own
-- tokenizer) fuzzy-matched the FIRST WORD of BOTH unrelated 2-word aliases,
-- pulling in both canonicals. The exact-match-precedence fix
-- (20260827050000) didn't help here because NEITHER alias gets a clean
-- exact match in this scenario — the whole-phrase check fails (query has
-- an extra leading word), and single-token exact match can't equal a
-- 2-word alias either.
--
-- This is the same underlying issue as حرق/حرقان (two different concepts
-- sharing surface text), just triggered by decomposing a multi-word alias
-- into single-word fragments instead of a definite-article prefix.
--
-- Fix: stop treating multi-word aliases the same as single-word ones.
--   - Single-word aliases keep the existing exact-token + fuzzy-substring
--     behavior (handles definite articles/plurals — 'الجراح' matching
--     'جراح', etc.).
--   - Multi-word aliases (e.g. 'مضاد حيوي', 'نزلة برد', 'التهاب حلق')
--     now require ALL of their own words to be present among the query's
--     tokens (order-independent), and get NO fuzzy/substring fallback —
--     decomposing them into fragments is exactly what caused this bug, so
--     they either match as a whole compound concept or don't match at all.
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
  v_exact  text;
  v_fuzzy  text;
BEGIN
  v_tokens := (
    SELECT array_agg(tok) FROM unnest(regexp_split_to_array(trim(v_norm), '\s+')) AS tok
    WHERE length(tok) >= 2
  );
  IF v_tokens IS NULL THEN v_tokens := ARRAY[]::text[]; END IF;

  SELECT string_agg(DISTINCT s.canonical, ' ') INTO v_exact
  FROM public.search_synonyms s
  CROSS JOIN LATERAL (
    SELECT
      lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) AS alias_norm,
      regexp_split_to_array(trim(lower(public.normalize_arabic(public.immutable_unaccent(s.alias)))), '\s+') AS alias_words
  ) a
  WHERE s.is_active
    AND (
      -- Whole-phrase exact match (query is exactly this alias, nothing more).
      a.alias_norm = v_norm
      -- Single-word alias: exact membership among the query's own tokens.
      OR (array_length(a.alias_words, 1) = 1 AND a.alias_norm = ANY(v_tokens))
      -- Multi-word alias: ALL of its words present among the query's
      -- tokens, order-independent — not decomposed into single-word
      -- fragments that could collide with an unrelated compound alias
      -- sharing one of those words.
      OR (
        array_length(a.alias_words, 1) > 1
        AND NOT EXISTS (SELECT 1 FROM unnest(a.alias_words) w WHERE NOT (w = ANY(v_tokens)))
      )
    );

  IF v_exact IS NOT NULL THEN
    RETURN v_exact;
  END IF;

  -- Fuzzy fallback (definite article / simple plural coverage) — single-word
  -- aliases only. Multi-word aliases get no fuzzy pass: fragment-level
  -- fuzzy matching is exactly what caused this bug.
  SELECT string_agg(DISTINCT s.canonical, ' ') INTO v_fuzzy
  FROM public.search_synonyms s
  WHERE s.is_active
    AND array_length(regexp_split_to_array(trim(lower(public.normalize_arabic(public.immutable_unaccent(s.alias)))), '\s+'), 1) = 1
    AND EXISTS (
      SELECT 1 FROM unnest(v_tokens) AS tok
      WHERE length(tok) >= 3
        AND length(lower(public.normalize_arabic(public.immutable_unaccent(s.alias)))) >= 3
        AND (
          tok ILIKE '%' || lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) || '%'
          OR lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) ILIKE '%' || tok || '%'
        )
    );

  RETURN v_fuzzy;
END;
$$;

NOTIFY pgrst, 'reload schema';
