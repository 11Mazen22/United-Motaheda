-- =============================================================================
-- Confirmed live: after fixing the OR-based synonym matching, "دواء لتخفيف
-- الجراح" correctly surfaced 7 genuine antiseptic/wound-care products
-- (Betadine, Sudocrem, antiseptic wipes) — but also 3 false positives:
-- "RELIEF ABDOMINAL BELT XXL", "RELIEF WRIST THUMB" — because this catalog
-- has an actual brand named "RELIEF" (support braces), and 'تخفيف'/'تسكين'
-- (generic Arabic words for "reduction"/"relief") were mapped to the
-- canonical English word 'relief', which then substring-matched that
-- unrelated brand name.
--
-- These two aliases were never doing useful discrimination in the first
-- place: they're generic intensity/modifier words that appear in almost any
-- symptom phrase ("تخفيف الصداع", "تخفيف الالتهاب", ...) — the actual
-- symptom word (already separately mapped: صداع->paracetamol/ibuprofen,
-- الجراح->antiseptic, etc.) is what should drive relevant results. Removing
-- 'relief' as a synonym target doesn't lose any real matching power, it
-- just stops adding noise that happens to collide with a real brand name.
--
-- Soft-disabled (is_active = false) rather than deleted, consistent with
-- how this table is meant to be managed.
-- =============================================================================

UPDATE public.search_synonyms
SET is_active = false
WHERE alias IN ('تخفيف', 'تسكين') AND canonical = 'relief';

NOTIFY pgrst, 'reload schema';
