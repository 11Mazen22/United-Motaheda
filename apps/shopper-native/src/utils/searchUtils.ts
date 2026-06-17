/**
 * Smart Bilingual Search Utilities — Arabic & English
 *
 * This module is the single source of truth for all client-side search
 * intelligence. It handles:
 *
 *   1. Language detection  — Arabic / English / mixed / code (barcode)
 *   2. Arabic normalisation — strips tashkeel (harakat), unifies alef variants,
 *      ta marbuta, alef maqsura, hamza carriers so that "أسبرين" = "اسبرين"
 *      and "فيتامين سى" = "فيتامين سي" before any comparison.
 *   3. Arabic → English resolution — 120+ entry map covering common
 *      pharmaceutical brands, generics, categories, and common misspellings.
 *      Keys are pre-normalised so the user never has to type exact Arabic.
 *   4. Partial / prefix matching — "بانا" resolves to "panadol".
 *   5. Token-by-token resolution — "بانادول اكسترا" → "panadol extra".
 *   6. English typo correction — "panadool", "ibobrofen", "paracetomol", etc.
 *
 * The resolved term is what gets sent to the Supabase RPC. The DB side
 * (search_products) then applies tsvector FTS + trigram + word_similarity +
 * ILIKE fallback for maximum recall.
 */

// ─── Language detection ──────────────────────────────────────────────────────

export type SearchLang = "arabic" | "english" | "mixed" | "code";

/**
 * Classify the dominant script of a search query.
 * Returns 'code' for strings that look like a barcode / product code.
 */
export function detectSearchLang(query: string): SearchLang {
  if (!query?.trim()) return "english";
  const t = query.trim();
  // Numeric barcode / product code
  if (/^[\d\s\-]+$/.test(t)) return "code";
  const arabicChars = (t.match(/[؀-ۿ]/g) ?? []).length;
  const latinChars  = (t.match(/[a-zA-Z]/g) ?? []).length;
  const total       = arabicChars + latinChars;
  if (total === 0) return "english";
  const ratio = arabicChars / total;
  if (ratio > 0.7) return "arabic";
  if (ratio < 0.3) return "english";
  return "mixed";
}

// ─── Arabic normalisation ────────────────────────────────────────────────────

/**
 * Normalise Arabic text for fuzzy comparison.
 *
 * Transformations applied (in order):
 *   • Strip tashkeel (U+064B–U+065F), tatweel (U+0640), superscript alef (U+0670)
 *   • Unify alef variants: أ إ آ ٱ ٵ  →  ا
 *   • Ta marbuta  ة  →  ه
 *   • Alef maqsura  ى  →  ي
 *   • Waw with hamza  ؤ  →  و
 *   • Ya with hamza below  ئ  →  ي
 *
 * After normalisation "أسبرين" = "اسبرين" = "اسبرين",
 * and "فيتامين سى" = "فيتامين سي".
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ٟـٰٴ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱٱ]/g, "ا")                      // alef variants
    .replace(/ة/g, "ه")                                 // ta marbuta
    .replace(/ى/g, "ي")                                 // alef maqsura
    .replace(/ؤ/g, "و")                                 // waw + hamza
    .replace(/ئ/g, "ي")                                 // ya + hamza
    .trim()
    .toLowerCase();
}

// ─── Arabic → English map ────────────────────────────────────────────────────
// Raw entries — readable Arabic keys; values are the English equivalents
// that match product names in the database.
// Keys do NOT need to be pre-normalised here — we normalise them at build time.

const _RAW_AR_EN: Record<string, string> = {
  // ── Analgesics / antipyretics ────────────────────────────────────────────
  "باراسيتامول":         "paracetamol",
  "باراستامول":          "paracetamol",
  "بنادول":              "panadol",
  "بانادول":             "panadol",
  "بانادول اكسترا":      "panadol extra",
  "بانادول كولد":        "panadol cold",
  "بانادول نايت":        "panadol night",
  "بانادول اطفال":       "panadol baby",
  "ابيبروفين":           "ibuprofen",
  "ايبوبروفين":          "ibuprofen",
  "ايبوبروفن":           "ibuprofen",
  "بروفين":              "brufen",
  "بروفن":               "brufen",
  "نيوروفن":             "nurofen",
  "أسبرين":              "aspirin",
  "اسبرين":              "aspirin",
  "اسبرن":               "aspirin",
  "ديكلوفيناك":          "diclofenac",
  "ديكلوفناك":           "diclofenac",
  "كلوفيناك":            "clovenac",
  "فولتارين":            "voltaren",
  "فولتارن":             "voltaren",
  "ترامادول":            "tramadol",
  "كيتوبروفين":          "ketoprofen",
  "نابروكسين":           "naproxen",
  "بيالجين":             "bialgin",
  "نوفالجين":            "novalgin",

  // ── Antibiotics ──────────────────────────────────────────────────────────
  "أموكسيسيلين":         "amoxicillin",
  "اموكسيسيلين":         "amoxicillin",
  "اموكسيسلين":          "amoxicillin",
  "اموكسيل":             "amoxil",
  "أموكسيل":             "amoxil",
  "اوجمنتين":            "augmentin",
  "أوجمنتين":            "augmentin",
  "سيبروفلوكساسين":      "ciprofloxacin",
  "سيبروفلوكسسين":       "ciprofloxacin",
  "سيبرو":               "cipro",
  "ميترونيدازول":        "metronidazole",
  "ميتروندازول":         "metronidazole",
  "فلاجيل":              "flagyl",
  "كلاريثروميسين":       "clarithromycin",
  "اريثروميسين":         "erythromycin",
  "دوكسيسيكلين":         "doxycycline",
  "دوكسيسيكلن":          "doxycycline",
  "تتراسيكلين":          "tetracycline",
  "سيفالكسين":           "cefalexin",
  "سيفالكسن":            "cefalexin",
  "كوترايموكسازول":      "cotrimoxazole",
  "باكتريم":             "bactrim",
  "ازيثروميسين":         "azithromycin",
  "زيثروماكس":           "zithromax",

  // ── GI / antacids ────────────────────────────────────────────────────────
  "أوميبرازول":          "omeprazole",
  "اوميبرازول":          "omeprazole",
  "اوميبرازل":           "omeprazole",
  "بانتوبرازول":         "pantoprazole",
  "بانتوبرازل":          "pantoprazole",
  "بانتوزول":            "pantazole",
  "لانسوبرازول":         "lansoprazole",
  "رانيتيدين":           "ranitidine",
  "زانتاك":              "zantac",
  "غافيسكون":            "gaviscon",
  "مالوكس":              "maalox",
  "رينيي":               "rennie",
  "رينى":                "rennie",
  "ميتوكلوبراميد":       "metoclopramide",
  "بريمبران":            "primperan",
  "دومبيريدون":          "domperidone",
  "موتيليوم":            "motilium",
  "بسكوبان":             "buscopan",
  "ايموديوم":            "imodium",

  // ── Antihistamines / allergy ─────────────────────────────────────────────
  "كلاريتين":            "claritin",
  "لوراتادين":           "loratadine",
  "لوراتادن":            "loratadine",
  "سيتيريزين":           "cetirizine",
  "سيتيريزن":            "cetirizine",
  "زيرتك":               "zyrtec",
  "زيرتيك":              "zyrtec",
  "كلور تريميتون":       "chlorphenamine",
  "كلورفينيرامين":       "chlorphenamine",
  "كونجستال":            "congestal",
  "ديفينهيدرامين":       "diphenhydramine",
  "بينادريل":            "benadryl",

  // ── Corticosteroids ──────────────────────────────────────────────────────
  "هيدروكورتيزون":       "hydrocortisone",
  "هيدروكورتيزن":        "hydrocortisone",
  "ديكساميثازون":        "dexamethasone",
  "ديكساميثازن":         "dexamethasone",
  "ديكساسون":            "dexasone",
  "بريدنيزون":           "prednisone",
  "بريدنيزولون":         "prednisolone",
  "بيتاميثازون":         "betamethasone",
  "فلوتيكازون":          "fluticasone",

  // ── Diabetes ─────────────────────────────────────────────────────────────
  "مترفورمين":           "metformin",
  "ميتفورمين":           "metformin",
  "ميتفورمن":            "metformin",
  "جلوكوفاج":            "glucophage",
  "جلوكوفج":             "glucophage",
  "انسولين":             "insulin",
  "أنسولين":             "insulin",
  "غليبنكلاميد":         "glibenclamide",
  "جليميبيريد":          "glimepiride",
  "امارyl":              "amaryl",

  // ── Cholesterol / cardiovascular ─────────────────────────────────────────
  "أتورفاستاتين":        "atorvastatin",
  "اتورفاستاتين":        "atorvastatin",
  "ليبيتور":             "lipitor",
  "سيمفاستاتين":         "simvastatin",
  "روسوفاستاتين":        "rosuvastatin",
  "كرستور":              "crestor",
  "امبوديبين":           "amlodipine",
  "امبوديبن":            "amlodipine",
  "نورفاسك":             "norvasc",
  "لوزارتان":            "losartan",
  "كوزار":               "cozaar",
  "اتينولول":            "atenolol",
  "تينورمين":            "tenormin",

  // ── Vitamins & supplements ───────────────────────────────────────────────
  "فيتامين سي":          "vitamin c",
  "فيتامين c":           "vitamin c",
  "فيتامين د":           "vitamin d",
  "فيتامين d":           "vitamin d",
  "فيتامين ب":           "vitamin b",
  "فيتامين b":           "vitamin b",
  "فيتامين ب12":         "vitamin b12",
  "فيتامين ب كمبلكس":    "vitamin b complex",
  "فيتامينات":           "vitamins",
  "زنك":                 "zinc",
  "ماغنيسيوم":           "magnesium",
  "ماغنيسيم":            "magnesium",
  "كالسيوم":             "calcium",
  "كالسيم":              "calcium",
  "حديد":                "iron",
  "اوميغا 3":            "omega 3",
  "اوميجا 3":            "omega 3",
  "زيت السمك":           "fish oil",
  "بيوتين":              "biotin",
  "كولاجين":             "collagen",
  "مكملات":              "supplements",
  "مكملات غذائية":       "supplements",

  // ── Skincare / cosmetics ─────────────────────────────────────────────────
  "كريم":                "cream",
  "كريم مرطب":           "moisturizer",
  "مرطب":                "moisturizer",
  "واقي شمس":            "sunscreen",
  "كريم واقي شمس":       "sunscreen",
  "شاشة شمسية":          "sunscreen",
  "كريم شمس":            "sunscreen",
  "غسول":                "wash",
  "غسول وجه":            "face wash",
  "سيروم":               "serum",
  "تونر":                "toner",
  "مقشر":                "scrub",
  "كنسيلر":              "concealer",
  "فاونديشن":            "foundation",
  "ميكاب":               "makeup",
  "مكياج":               "makeup",

  // ── Hair ─────────────────────────────────────────────────────────────────
  "شامبو":               "shampoo",
  "شامبو مضاد للقشرة":   "anti dandruff shampoo",
  "بلسم":                "conditioner",
  "علاج الشعر":          "hair treatment",

  // ── Baby / child ─────────────────────────────────────────────────────────
  "شراب اطفال":          "pediatric syrup",
  "كالبول":              "calpol",
  "بامبرز":              "pampers",

  // ── Categories ───────────────────────────────────────────────────────────
  "ادوية":               "medications",
  "أدوية":               "medications",
  "دواء":                "medication",
  "مضاد حيوي":           "antibiotic",
  "مضادات حيوية":        "antibiotics",
  "مسكن":                "painkiller",
  "مسكنات":              "painkillers",
  "مسكن الم":            "painkiller",
  "خافض حرارة":          "fever reducer",
  "مضاد التهاب":         "anti inflammatory",
  "عناية بشرة":          "skincare",
  "عناية بالبشرة":       "skincare",
  "عناية بالشعر":        "hair care",
  "عناية بالجسم":        "body care",
  "مستحضرات تجميل":      "cosmetics",
  "رعاية صحية":          "healthcare",
  "مستلزمات طبية":       "medical supplies",
  "عناية بالعيون":       "eye care",
  "صحة المراة":          "women health",
  "صحة المرأة":          "women health",
  "اطفال":               "baby",
  "الاطفال":             "baby",
  "رضع":                 "infant",
  "منتجات رجالية":       "men care",
  "عناية بالرجل":        "men care",
  "عطور":                "perfume",
  "عطر":                 "perfume",
  "صحة الفم":            "oral health",
  "معجون اسنان":         "toothpaste",
  "غسول فم":             "mouthwash",
};

// Pre-compute normalised lookup once at module load
const ARABIC_LOOKUP: Map<string, string> = new Map(
  Object.entries(_RAW_AR_EN).map(([k, v]) => [normalizeArabic(k), v]),
);

// ─── English typo correction ─────────────────────────────────────────────────

const _TYPO_MAP: Record<string, string> = {
  panadool:         "panadol",
  panadoll:         "panadol",
  panodol:          "panadol",
  pannodol:         "panadol",
  panadolx:         "panadol extra",
  panadolextra:     "panadol extra",
  ibobrofen:        "ibuprofen",
  ibuprophen:       "ibuprofen",
  ibuferon:         "ibuprofen",
  ibuprefen:        "ibuprofen",
  ibuproffen:       "ibuprofen",
  bruffen:          "brufen",
  brufin:           "brufen",
  amoxicilin:       "amoxicillin",
  amoxisillin:      "amoxicillin",
  amoxicillion:     "amoxicillin",
  amoxicillan:      "amoxicillin",
  paracetomol:      "paracetamol",
  paracetamool:     "paracetamol",
  parcetamol:       "paracetamol",
  paracetamo:       "paracetamol",
  metformine:       "metformin",
  voltarene:        "voltaren",
  voltaren:         "voltaren",
  omeprazol:        "omeprazole",
  pantazol:         "pantazole",
  ciprofloaxin:     "ciprofloxacin",
  ciprofloxaxin:    "ciprofloxacin",
  ciprofloxassin:   "ciprofloxacin",
  diclofenack:      "diclofenac",
  diclofenac:       "diclofenac",
  dexasone:         "dexasone",
  vitaminc:         "vitamin c",
  vitamind:         "vitamin d",
  vitaminb:         "vitamin b",
  vitaminb12:       "vitamin b12",
  crestor:          "crestor",
  lipitor:          "lipitor",
};

function fixEnglishTypos(query: string): string {
  const lower = query.toLowerCase().trim();
  if (_TYPO_MAP[lower]) return _TYPO_MAP[lower];
  // Token-by-token
  const tokens = lower.split(/\s+/);
  return tokens.map((t) => _TYPO_MAP[t] ?? t).join(" ");
}

// ─── Arabic lookup (exact → prefix → token fallback) ────────────────────────

function lookupArabic(raw: string): string | null {
  const n = normalizeArabic(raw);

  // 1. Exact normalised match
  const exact = ARABIC_LOOKUP.get(n);
  if (exact) return exact;

  // 2. Prefix / contains: user typed start or substring of a known term
  if (n.length >= 3) {
    for (const [key, val] of ARABIC_LOOKUP) {
      if (key.startsWith(n) || n.startsWith(key)) return val;
    }
  }

  return null;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface SmartSearchResult {
  /** The resolved term to send to the database */
  term:           string;
  /** Dominant script of the original query */
  lang:           SearchLang;
  /** True if Arabic input was converted to an English DB term */
  wasTranslated:  boolean;
  /** True if an English typo was auto-corrected */
  typoFixed:      boolean;
  /**
   * Short Arabic hint for the UI, e.g. "يبحث بـ: panadol".
   * Null when no translation / correction occurred.
   */
  displayHint:    string | null;
}

/**
 * Resolve a raw user query into the best search term for the database.
 *
 * Flow:
 *   code     → pass as-is (barcode / product code)
 *   english  → apply typo fix
 *   arabic   → exact map lookup → prefix match → token-by-token → normalised Arabic
 *   mixed    → process each token by its own language
 */
export function resolveSmartQuery(rawQuery: string): SmartSearchResult {
  const empty: SmartSearchResult = {
    term: "", lang: "english", wasTranslated: false, typoFixed: false, displayHint: null,
  };
  if (!rawQuery?.trim()) return empty;

  const trimmed = rawQuery.trim();
  const lang    = detectSearchLang(trimmed);

  // ── Barcode / product code ───────────────────────────────────────────────
  if (lang === "code") {
    return { term: trimmed, lang, wasTranslated: false, typoFixed: false, displayHint: null };
  }

  // ── Pure English — fix typos only ────────────────────────────────────────
  if (lang === "english") {
    const fixed     = fixEnglishTypos(trimmed);
    const typoFixed = fixed.toLowerCase() !== trimmed.toLowerCase();
    return {
      term:          fixed,
      lang,
      wasTranslated: false,
      typoFixed,
      displayHint:   typoFixed ? `تصحيح: ${fixed}` : null,
    };
  }

  // ── Mixed (Arabic + Latin) — process each token by its script ───────────
  if (lang === "mixed") {
    const tokens   = trimmed.split(/\s+/);
    const resolved = tokens.map((t) => {
      const tLang = detectSearchLang(t);
      if (tLang === "arabic") return lookupArabic(t) ?? normalizeArabic(t);
      return fixEnglishTypos(t);
    });
    return { term: resolved.join(" "), lang, wasTranslated: false, typoFixed: false, displayHint: null };
  }

  // ── Pure Arabic ──────────────────────────────────────────────────────────

  // 1. Try whole query against the map
  const wholeMatch = lookupArabic(trimmed);
  if (wholeMatch) {
    return {
      term:          wholeMatch,
      lang:          "arabic",
      wasTranslated: true,
      typoFixed:     false,
      displayHint:   `يبحث بـ: ${wholeMatch}`,
    };
  }

  // 2. Token-by-token — resolve each Arabic word independently
  const tokens = trimmed.split(/\s+/);
  if (tokens.length > 1) {
    const resolvedTokens = tokens.map((t) => lookupArabic(t));
    const anyResolved    = resolvedTokens.some((r) => r !== null);

    if (anyResolved) {
      const mixed = resolvedTokens.map((r, i) => r ?? tokens[i]).join(" ");
      return {
        term:          mixed,
        lang:          "arabic",
        wasTranslated: true,
        typoFixed:     false,
        displayHint:   `يبحث بـ: ${mixed}`,
      };
    }
  }

  // 3. No map match — pass normalised Arabic to the DB (ILIKE handles it)
  const normalised = normalizeArabic(trimmed);
  return {
    term:          normalised,
    lang:          "arabic",
    wasTranslated: false,
    typoFixed:     false,
    displayHint:   null,
  };
}
