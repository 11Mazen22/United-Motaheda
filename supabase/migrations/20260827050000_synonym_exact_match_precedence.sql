-- =============================================================================
-- Confirmed live: "حصل عندي حرق في ايدي" (I got a burn on my hand) returned
-- Gaviscon/Maalox (heartburn medicine) alongside the correct Panthenol/
-- Silvirburn (burn cream) results. Root cause: the token "حرق" (burn)
-- EXACTLY matches the alias 'حرق' (-> panthenol/silvirburn), but ALSO
-- satisfies the looser substring-containment fuzzy rule against the
-- unrelated alias 'حرقان' (heartburn -> gaviscon/maalox/...), because
-- "حرقان" literally contains "حرق" as a substring — same Arabic root,
-- clinically unrelated conditions (skin burn vs. stomach acid).
--
-- Systematically audited the entire active synonym table for this class of
-- collision (any alias that is a literal substring of another alias with a
-- different canonical meaning): 14 such pairs exist. 13 of them are benign
-- or actively helpful — same drug under two names (Brufen contained in
-- Ibuprofen's Arabic spellings; Cipro inside Ciprofloxacin), or a specific
-- product variant containing its own base brand (Panadol inside "Panadol
-- Cold"/"Panadol Night"). Only حرق/حرقان represents genuinely unrelated
-- conditions. Fixed at the general-rule level rather than special-casing
-- one word pair, since the same root-sharing pattern could recur as more
-- symptom vocabulary is added later.
--
-- Fix: when the query has ANY exact alias match (whole-phrase or
-- individual-token), trust it and stop there — don't also run the fuzzy
-- substring pass. Exact matches are unambiguous; the fuzzy pass exists only
-- to catch a definite-article prefix or simple plural when NO exact match
-- was found at all, and should never be blended with an exact hit that
-- already answered the question with certainty. Verified this doesn't
-- regress the 13 benign pairs: those cases either resolve to the same
-- product family anyway, or the plain lexical/trigram match against the
-- original query text already surfaces the same products independently of
-- synonym expansion (e.g. a literal "بانادول" query already text-matches
-- "PANADOL COLD" product names directly, with no synonym involved).
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

  -- Pass 1: exact matches only (whole-phrase or exact single-token).
  SELECT string_agg(DISTINCT s.canonical, ' ') INTO v_exact
  FROM public.search_synonyms s
  WHERE s.is_active
    AND (
      lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) = v_norm
      OR lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) = ANY(v_tokens)
    );

  IF v_exact IS NOT NULL THEN
    RETURN v_exact;
  END IF;

  -- Pass 2: no exact hit anywhere in the query — fall back to the looser
  -- substring-containment rule (definite article / simple plural coverage).
  SELECT string_agg(DISTINCT s.canonical, ' ') INTO v_fuzzy
  FROM public.search_synonyms s
  WHERE s.is_active
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
