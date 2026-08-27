-- =============================================================================
-- Fix: expand_search_query only ever matched when the ENTIRE query string
-- equaled a seeded alias verbatim — so a natural sentence like
-- "دواء لتخفيف الصداع" (medicine to relieve headache) never expanded,
-- because no alias equals that whole 4-word sentence. Confirmed live:
-- both "دواء لتخفيف الجراح" and "دواء للصداع" returned zero rows before
-- this fix, despite "صداع"-style symptom vocabulary being seeded.
--
-- This is the actual root cause of the reported "search doesn't understand
-- intent" behavior — not a ranking or fuzzy-matching problem, an expansion
-- problem: the vocabulary existed, it just never got a chance to match
-- inside a longer sentence.
--
-- Fix: tokenize the query and check each individual token against the
-- synonym table too (in addition to the existing whole-query check, which
-- still matters for multi-word aliases like "خافض حرارة"), using substring
-- containment in both directions so common Arabic morphology (definite
-- article "ال" prefix, plural forms) doesn't need a full stemmer — "الجراح"
-- containing "جراح" as a substring is enough to match an alias row seeded
-- as "جراح". This generalizes to any future sentence containing a
-- recognized word, not just the specific examples used to find the bug.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.expand_search_query(p_query text)
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
    WHERE length(tok) >= 2  -- skip 1-letter tokens (Arabic prepositions ل/ب/و etc.) — too noisy to substring-match
  );
  IF v_tokens IS NULL THEN v_tokens := ARRAY[]::text[]; END IF;

  SELECT string_agg(DISTINCT s.canonical, ' ') INTO v_match
  FROM public.search_synonyms s
  WHERE s.is_active
    AND (
      -- Whole-phrase match — still needed for multi-word aliases.
      lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) = v_norm
      -- Exact single-token match.
      OR lower(public.normalize_arabic(public.immutable_unaccent(s.alias))) = ANY(v_tokens)
      -- Substring containment either direction — catches a token carrying a
      -- definite-article prefix ("الجراح" ⊇ "جراح") or a simple plural/
      -- singular mismatch, without a full morphological analyzer.
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

  RETURN trim(p_query || ' ' || COALESCE(v_match, ''));
END;
$$;

GRANT EXECUTE ON FUNCTION public.expand_search_query(text) TO anon, authenticated;

-- ─── Broader symptom/intent vocabulary ───────────────────────────────────────
-- General-purpose additions (applicable to any future query containing these
-- words), not special-cased to the exact example sentences used to find the
-- expansion bug above. Includes common morphological variants (definite
-- article, plural) since the substring match above benefits from having
-- both forms present as real rows rather than relying only on substring
-- overlap with a single seeded form.

INSERT INTO public.search_synonyms (alias, canonical, alias_type) VALUES
  ('صداع',       'paracetamol ibuprofen', 'symptom'),
  ('الصداع',     'paracetamol ibuprofen', 'symptom'),
  ('وجع راس',    'paracetamol', 'symptom'),
  ('وجع الراس',  'paracetamol', 'symptom'),
  ('صداع نصفي',  'ibuprofen',   'symptom'),
  ('جرح',        'antiseptic',  'symptom'),
  ('جروح',       'antiseptic',  'symptom'),
  ('الجرح',      'antiseptic',  'symptom'),
  ('الجروح',     'antiseptic',  'symptom'),
  ('جراح',       'antiseptic',  'symptom'),
  ('الجراح',     'antiseptic',  'symptom'),
  ('حرق',        'burn cream',  'symptom'),
  ('حروق',       'burn cream',  'symptom'),
  ('الحروق',     'burn cream',  'symptom'),
  ('حرقان',      'antacid',     'symptom'),
  ('حموضة',      'antacid',     'symptom'),
  ('الحموضة',    'antacid',     'symptom'),
  ('تخفيف',      'relief',      'symptom'),
  ('تسكين',      'relief',      'symptom'),
  ('التهاب حلق', 'throat lozenge', 'symptom'),
  ('التهاب الحلق','throat lozenge', 'symptom'),
  ('كحة',        'cough syrup', 'symptom'),
  ('الكحة',      'cough syrup', 'symptom'),
  ('سعال',       'cough syrup', 'symptom'),
  ('نزلة برد',   'cold flu',    'symptom'),
  ('انفلونزا',   'cold flu',    'symptom'),
  ('رشح',        'cold flu',    'symptom'),
  ('امساك',      'laxative',    'symptom'),
  ('الامساك',    'laxative',    'symptom'),
  ('اسهال',      'diarrhea',    'symptom'),
  ('الاسهال',    'diarrhea',    'symptom'),
  ('غثيان',      'nausea',      'symptom'),
  ('دوخة',       'dizziness',   'symptom'),
  ('حساسية',     'antihistamine','symptom'),
  ('الحساسية',   'antihistamine','symptom'),
  ('ارق',        'sleep aid',   'symptom'),
  ('الارق',      'sleep aid',   'symptom')
ON CONFLICT (alias) DO NOTHING;

NOTIFY pgrst, 'reload schema';
