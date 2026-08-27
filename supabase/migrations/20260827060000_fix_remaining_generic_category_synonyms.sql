-- =============================================================================
-- Continuing the same audit: confirmed live that 'reducer', 'painkiller',
-- 'inflammatory', and 'antibiotic' appear in ZERO product names in this
-- catalog, and this catalog has no "Pain Relief" or "Antibiotics" category
-- either (confirmed category list: Baby & Child, Baby & Mother Care, Body
-- Care, Cosmetics & Makeup, Dental & Oral, Eye Care, First Aid &
-- Antiseptics, First Aid & Supplies, General Healthcare, Hair Care, Medical
-- Nutrition, Medical Supplies, Medications, Men's Care, Oral Care,
-- Perfumes & Fragrances, Personal Care, Skincare, Vitamins & Supplements,
-- Women's Health — everything analgesic/antibiotic just falls under the
-- generic "Medications" bucket). So 'مسكن'/'مسكنات' (painkiller),
-- 'مضاد حيوي' (antibiotic), 'مضاد التهاب' (anti-inflammatory), and
-- 'خافض حرارة' (fever reducer) — all natural, common ways an Egyptian
-- customer would actually ask for these — were silently dead synonyms:
-- they contributed nothing to either lexical matching or the category
-- signal, the same failure mode already fixed for antacid/antihistamine/
-- diarrhea/nausea/dizziness/burn/sleep-aid.
--
-- Fix: same approach — point these at the union of real drug names already
-- covered elsewhere in this table, rather than an invented English category
-- word that doesn't exist in the data.
-- =============================================================================

UPDATE public.search_synonyms SET canonical = 'paracetamol ibuprofen panadol brufen voltaren diclofenac nurofen'
WHERE alias IN ('مسكن', 'مسكنات') AND canonical IN ('painkiller', 'painkillers');

UPDATE public.search_synonyms SET canonical = 'amoxicillin augmentin azithromycin ciprofloxacin'
WHERE alias = 'مضاد حيوي' AND canonical = 'antibiotic';

UPDATE public.search_synonyms SET canonical = 'ibuprofen diclofenac voltaren naproxen'
WHERE alias = 'مضاد التهاب' AND canonical = 'anti inflammatory';

UPDATE public.search_synonyms SET canonical = 'paracetamol ibuprofen panadol'
WHERE alias = 'خافض حرارة' AND canonical = 'fever reducer';

NOTIFY pgrst, 'reload schema';
