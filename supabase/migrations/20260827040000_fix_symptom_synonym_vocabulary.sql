-- =============================================================================
-- Confirmed live via direct RPC testing of 6 different symptom queries after
-- the OR-matching fix (20260827020000): 3 of 6 still failed, but for a
-- different reason than before — the canonical vocabulary itself was wrong,
-- not the matching logic.
--
--   - 'حرقان'/'حموضة' -> 'antacid': ZERO results. This catalog has no
--     category or product literally containing the word "antacid" — real
--     heartburn products here are branded (Gaviscon, Rennie, Maalox,
--     Epicogel), confirmed via direct catalog query.
--   - 'حساسية' -> 'antihistamine': ZERO results, same problem — real allergy
--     products here are Claritine, Telfast, Zyrtec, Aerius.
--   - 'اسهال' -> 'diarrhea', 'غثيان' -> 'nausea', 'دوخة' -> 'dizziness':
--     same problem, confirmed zero matches for all three generic English
--     words. Real products: Imodium/Antinal (diarrhea), Motilium/
--     Primperan/Cinnarizine (nausea/dizziness — same drug class covers both
--     in this catalog).
--   - 'حرق'/'حروق' -> 'burn cream': returned 8 results but only 1
--     (SILVIRBURN) was actually burn-related — the other 7 were unrelated
--     skincare/haircare/deodorant products that happened to contain the
--     word "cream", which is far too generic a word in a pharmacy catalog
--     to use as a standalone OR-alternative. Real burn-specific products
--     here use "panthenol" or the brand "silvirburn" — both specific,
--     neither collides with anything else in the catalog.
--   - 'ارق' -> 'sleep aid': same class of risk — "aid" is dangerously
--     generic (it's literally half of "First Aid", this catalog's biggest
--     category). Real product: melatonin.
--
-- 'صداع'->'paracetamol ibuprofen' and 'كحة'/'التهاب حلق'/'نزلة برد'->
-- 'cough syrup'/'throat lozenge'/'cold flu' were NOT touched — confirmed
-- correct (or, for the latter three, checked against the real catalog and
-- found to already point at genuinely distinctive matches with no observed
-- collision) by direct testing.
-- =============================================================================

UPDATE public.search_synonyms SET canonical = 'gaviscon rennie maalox epicogel'
WHERE alias IN ('حرقان', 'حموضة', 'الحموضة') AND canonical = 'antacid';

UPDATE public.search_synonyms SET canonical = 'claritine telfast zyrtec aerius'
WHERE alias IN ('حساسية', 'الحساسية') AND canonical = 'antihistamine';

UPDATE public.search_synonyms SET canonical = 'imodium antinal'
WHERE alias IN ('اسهال', 'الاسهال') AND canonical = 'diarrhea';

UPDATE public.search_synonyms SET canonical = 'motilium primperan cinnarizine'
WHERE alias = 'غثيان' AND canonical = 'nausea';

UPDATE public.search_synonyms SET canonical = 'cinnarizine motilium'
WHERE alias = 'دوخة' AND canonical = 'dizziness';

UPDATE public.search_synonyms SET canonical = 'panthenol silvirburn'
WHERE alias IN ('حرق', 'حروق', 'الحروق') AND canonical = 'burn cream';

UPDATE public.search_synonyms SET canonical = 'melatonin'
WHERE alias IN ('ارق', 'الارق') AND canonical = 'sleep aid';

NOTIFY pgrst, 'reload schema';
