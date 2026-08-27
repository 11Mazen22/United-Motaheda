-- =============================================================================
-- search_synonyms was entirely Arabic-only — an English natural-language
-- symptom query ("medicine for a headache", "something for heartburn") got
-- zero expansion, even though this is a bilingual app and the whole point
-- of this table is bridging casual symptom language to real product names.
--
-- Adds English aliases pointing at the SAME canonical values already
-- verified against the live catalog this session (not new, unverified
-- vocabulary) — e.g. 'gaviscon rennie maalox epicogel' was confirmed via
-- direct RPC testing to return only genuine heartburn products before this
-- migration ever touches it.
--
-- Deliberately conservative on generic single words that could collide
-- with unrelated products in a health/beauty catalog ("cold", "sleep",
-- "pain" alone) — skipped or scoped to a more specific phrase where the
-- Arabic equivalent already showed a bare generic word carries real risk
-- (see 20260827050000/060000). "flu"/"cut"/"burn" were checked against the
-- confirmed-safe pattern (specific enough, no known collision) before
-- inclusion.
-- =============================================================================

INSERT INTO public.search_synonyms (alias, canonical, alias_type) VALUES
  ('headache',        'paracetamol ibuprofen panadol brufen', 'symptom'),
  ('migraine',        'ibuprofen panadol',                    'symptom'),
  ('fever',           'paracetamol ibuprofen panadol',        'symptom'),
  ('cough',           'cough syrup',                          'symptom'),
  ('sore throat',     'throat lozenge',                       'symptom'),
  ('wound',           'antiseptic',                           'symptom'),
  ('cut',             'antiseptic',                           'symptom'),
  ('burn',            'panthenol silvirburn',                 'symptom'),
  ('heartburn',       'gaviscon rennie maalox epicogel',      'symptom'),
  ('acid reflux',     'gaviscon rennie maalox epicogel',      'symptom'),
  ('indigestion',     'gaviscon rennie maalox epicogel',      'symptom'),
  ('allergy',         'claritine telfast zyrtec aerius',      'symptom'),
  ('allergies',       'claritine telfast zyrtec aerius',      'symptom'),
  ('diarrhea',        'imodium antinal',                      'symptom'),
  ('diarrhoea',       'imodium antinal',                      'symptom'),
  ('constipation',    'laxative',                             'symptom'),
  ('nausea',          'motilium primperan cinnarizine',       'symptom'),
  ('dizziness',       'cinnarizine motilium',                 'symptom'),
  ('dizzy',           'cinnarizine motilium',                 'symptom'),
  ('insomnia',        'melatonin',                            'symptom'),
  ('flu',             'cold flu',                             'symptom'),
  ('influenza',       'cold flu',                             'symptom'),
  ('painkiller',      'paracetamol ibuprofen panadol brufen voltaren diclofenac nurofen', 'symptom'),
  ('antibiotic',      'amoxicillin augmentin azithromycin ciprofloxacin', 'symptom'),
  ('anti inflammatory','ibuprofen diclofenac voltaren naproxen', 'symptom')
ON CONFLICT (alias) DO NOTHING;

NOTIFY pgrst, 'reload schema';
