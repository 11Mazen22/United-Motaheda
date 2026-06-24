import babyMotherCareImage from "@assets/categories/baby-mother-care.svg";
import generalHealthcareImage from "@assets/categories/general-healthcare.svg";
import medicalDevicesImage from "@assets/categories/medical-devices.svg";
import medicationsImage from "@assets/categories/medications.svg";
import personalCareImage from "@assets/categories/personal-care.svg";
import wellnessSupplementsImage from "@assets/categories/wellness-supplements.svg";
import { getSupabaseClient } from "../lib/supabaseClient";

type CatalogLanguage = "ar" | "en";

export type CategoryTheme = {
  accent: string;
  accentSoft: string;
  border: string;
  surface: string;
  color: string;
  bg: string;
  glow: string;
};

export type CatalogCategory = {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  emoji: string;
  count: number;
  inStockCount: number;
  descAr: string;
  descEn: string;
  theme: CategoryTheme;
  imageUrl: string;
  imagePosition?: string;
};

export type CategorySeed = {
  id: string;
  names: { ar: string; en: string };
  icon: string;
  emoji: string;
  imageUrl: string;
  imagePosition?: string;
  desc: {
    ar: string;
    en: string;
  };
  theme: CategoryTheme;
  aliases: string[];
  keywords: string[];
};

export type CatalogCategorySearchMetadata = {
  aliases: string[];
  keywords: string[];
};

export type CatalogProduct = {
  id: string;
  code: string;
  barcode: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  price: number;
  stock: number;
  inStock: boolean;
  category: string;
  categoryName: string;
  categoryNameEn: string;
  imageUrl?: string;
  sourceRow: number;
  isSale?: boolean;
  originalPrice?: number;
};

export type CatalogSnapshot = {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  lastUpdated: string;
};

type CachedCatalogSnapshot = {
  cachedAt: number;
  snapshot: CatalogSnapshot;
};

const CACHE_KEY = "united-pharmacies-catalog-v8";
const CACHE_TTL_MS = 1000 * 60 * 15;
const FALLBACK_CATEGORY_ID = "general-healthcare";
const DEFAULT_CATEGORY_THEME: CategoryTheme = {
  accent: "#0f766e",
  accentSoft: "rgba(15, 118, 110, 0.12)",
  border: "rgba(15, 118, 110, 0.18)",
  surface: "#f0fdfa",
  color: "#0f766e",
  bg: "#f0fdfa",
  glow: "rgba(15, 118, 110, 0.14)",
};

const CATEGORY_SEEDS: CategorySeed[] = [
  {
    id: "medications",
    names: { ar: "الأدوية والعلاجات", en: "Medications" },
    icon: "Pill",
    emoji: "💊",
    imageUrl: medicationsImage,
    desc: {
      ar: "أدوية الوصفات والعلاج اليومي والعلاجات المتخصصة مرتبة وفق الاستخدام الدوائي.",
      en: "Prescription medicines, OTC treatments, and daily therapy products arranged by pharmacy use.",
    },
    theme: {
      accent: "#0f766e",
      accentSoft: "rgba(15, 118, 110, 0.12)",
      border: "rgba(15, 118, 110, 0.18)",
      surface: "#f0fdfa",
      color: "#0f766e",
      bg: "#f0fdfa",
      glow: "rgba(15, 118, 110, 0.14)",
    },
    keywords: [
      "tablet",
      "tablets",
      "capsule",
      "capsules",
      "syrup",
      "suspension",
      "ampoule",
      "vial",
      "ointment",
      "antibiotic",
      "analgesic",
      "drug",
      "medicine",
      "medication",
      "paracetamol",
      "ibuprofen",
      "دواء",
      "أدوية",
      "ادوية",
      "علاج",
      "مسكن",
      "مضاد حيوي",
      "شراب",
      "كبسول",
      "قرص",
      "حقن",
    ],
    aliases: [
      "medications",
      "medication",
      "medicine",
      "medicines",
      "pharmaceuticals",
      "prescription",
      "otc",
      "drugs",
      "الأدوية",
      "ادوية",
      "الأدوية والعلاجات",
      "علاجات",
    ],
  },
  {
    id: "vitamins-supplements",
    names: { ar: "الفيتامينات والمكملات", en: "Vitamins & Supplements" },
    icon: "HeartPulse",
    emoji: "🌿",
    imageUrl: wellnessSupplementsImage,
    desc: {
      ar: "فيتامينات ومكملات غذائية ودعم يومي للطاقة والمناعة والعناية الوقائية.",
      en: "Vitamins, nutrition supplements, and everyday wellness support for immunity and energy.",
    },
    theme: {
      accent: "#0f7490",
      accentSoft: "rgba(8, 145, 178, 0.12)",
      border: "rgba(8, 145, 178, 0.18)",
      surface: "#ecfeff",
      color: "#0f7490",
      bg: "#ecfeff",
      glow: "rgba(8, 145, 178, 0.14)",
    },
    keywords: [
      "vitamin",
      "supplement",
      "omega",
      "collagen",
      "biotin",
      "zinc",
      "iron",
      "calcium",
      "magnesium",
      "probiotic",
      "folic",
      "multivitamin",
      "فيتامين",
      "مكمل",
      "مكملات",
      "اوميجا",
      "كالسيوم",
      "حديد",
      "زنك",
      "كولاجين",
    ],
    aliases: [
      "vitamins",
      "supplements",
      "vitamins supplements",
      "nutrition",
      "wellness",
      "dietary supplements",
      "الفيتامينات",
      "المكملات",
      "الفيتامينات والمكملات",
    ],
  },
  {
    id: "skin-care",
    names: { ar: "العناية بالبشرة", en: "Skin Care" },
    icon: "Droplets",
    emoji: "🧴",
    imageUrl: personalCareImage,
    desc: {
      ar: "مرطبات وسيروم ومنتجات علاجية وتجميلية للعناية اليومية بالبشرة.",
      en: "Moisturizers, serums, treatment creams, and daily skin-care essentials.",
    },
    theme: {
      accent: "#0f172a",
      accentSoft: "rgba(15, 23, 42, 0.08)",
      border: "rgba(15, 23, 42, 0.14)",
      surface: "#f8fafc",
      color: "#0f172a",
      bg: "#f8fafc",
      glow: "rgba(15, 23, 42, 0.12)",
    },
    keywords: [
      "skin",
      "skincare",
      "face",
      "facial",
      "serum",
      "cleanser",
      "moisturizer",
      "sunblock",
      "sunscreen",
      "acne",
      "lotion",
      "cream",
      "بشرة",
      "عناية بالبشرة",
      "غسول",
      "سيروم",
      "مرطب",
      "واقي شمس",
    ],
    aliases: [
      "skin care",
      "skincare",
      "face care",
      "dermocosmetics",
      "العناية بالبشرة",
      "بشرة",
      "منتجات البشرة",
    ],
  },
  {
    id: "personal-care",
    names: { ar: "العناية الشخصية", en: "Personal Care" },
    icon: "Sparkles",
    emoji: "✨",
    imageUrl: personalCareImage,
    desc: {
      ar: "العناية بالشعر والجسم والنظافة اليومية ومنتجات الروتين الشخصي.",
      en: "Hair care, body care, hygiene essentials, and everyday personal routines.",
    },
    theme: {
      accent: "#4f46e5",
      accentSoft: "rgba(79, 70, 229, 0.1)",
      border: "rgba(79, 70, 229, 0.14)",
      surface: "#eef2ff",
      color: "#4338ca",
      bg: "#eef2ff",
      glow: "rgba(79, 70, 229, 0.12)",
    },
    keywords: [
      "hair",
      "body",
      "shampoo",
      "conditioner",
      "soap",
      "deodorant",
      "bath",
      "feminine",
      "hygiene",
      "شعر",
      "جسم",
      "شامبو",
      "بلسم",
      "صابون",
      "مزيل عرق",
      "عناية شخصية",
    ],
    aliases: [
      "personal care",
      "body care",
      "hair care",
      "hygiene",
      "العناية الشخصية",
      "العناية بالجسم",
      "العناية بالشعر",
    ],
  },
  {
    id: "baby-mother-care",
    names: { ar: "الأم والطفل", en: "Baby & Mother Care" },
    icon: "Baby",
    emoji: "🍼",
    imageUrl: babyMotherCareImage,
    desc: {
      ar: "احتياجات الرضع والأطفال والأمهات من التغذية والعناية اليومية والملحقات الأساسية.",
      en: "Infant, child, and maternity essentials for feeding, hygiene, and daily care.",
    },
    theme: {
      accent: "#d97706",
      accentSoft: "rgba(217, 119, 6, 0.12)",
      border: "rgba(217, 119, 6, 0.18)",
      surface: "#fffbeb",
      color: "#b45309",
      bg: "#fffbeb",
      glow: "rgba(217, 119, 6, 0.14)",
    },
    keywords: [
      "baby",
      "infant",
      "kids",
      "child",
      "mother",
      "maternity",
      "formula",
      "diaper",
      "feeding",
      "رضع",
      "رضاعة",
      "حفاض",
      "أطفال",
      "طفل",
      "أم",
      "امومة",
    ],
    aliases: [
      "baby care",
      "baby mother care",
      "mother care",
      "kids care",
      "الأم والطفل",
      "الأطفال",
      "الام والطفل",
    ],
  },
  {
    id: "oral-care",
    names: { ar: "العناية بالفم والأسنان", en: "Oral Care" },
    icon: "Sparkles",
    emoji: "🪥",
    imageUrl: personalCareImage,
    desc: {
      ar: "معاجين وفرش وغسول فم ومنتجات متخصصة لصحة الفم والأسنان.",
      en: "Toothpaste, brushes, mouthwash, and focused oral-care products.",
    },
    theme: {
      accent: "#0369a1",
      accentSoft: "rgba(3, 105, 161, 0.1)",
      border: "rgba(3, 105, 161, 0.16)",
      surface: "#f0f9ff",
      color: "#0369a1",
      bg: "#f0f9ff",
      glow: "rgba(3, 105, 161, 0.12)",
    },
    keywords: [
      "oral",
      "dental",
      "tooth",
      "toothpaste",
      "mouthwash",
      "toothbrush",
      "gum",
      "teeth",
      "فم",
      "اسنان",
      "أسنان",
      "معجون",
      "فرشاة",
      "غسول فم",
    ],
    aliases: [
      "oral care",
      "dental care",
      "teeth care",
      "العناية بالفم",
      "العناية بالاسنان",
      "العناية بالفم والأسنان",
    ],
  },
  {
    id: "first-aid-supplies",
    names: { ar: "الإسعافات والمستلزمات", en: "First Aid & Supplies" },
    icon: "Package",
    emoji: "🩹",
    imageUrl: generalHealthcareImage,
    desc: {
      ar: "ضمادات ومطهرات وشاش وقفازات ومستلزمات الرعاية السريعة والمنزلية.",
      en: "Bandages, antiseptics, gauze, gloves, and fast-access care supplies.",
    },
    theme: {
      accent: "#475569",
      accentSoft: "rgba(71, 85, 105, 0.1)",
      border: "rgba(71, 85, 105, 0.16)",
      surface: "#f8fafc",
      color: "#475569",
      bg: "#f8fafc",
      glow: "rgba(71, 85, 105, 0.14)",
    },
    keywords: [
      "bandage",
      "gauze",
      "cotton",
      "antiseptic",
      "disinfectant",
      "gloves",
      "mask",
      "plaster",
      "tape",
      "first aid",
      "ضماد",
      "شاش",
      "قطن",
      "مطهر",
      "معقم",
      "قفاز",
      "كمامة",
      "إسعافات",
    ],
    aliases: [
      "first aid",
      "first aid supplies",
      "medical supplies",
      "consumables",
      "الإسعافات",
      "المستلزمات",
      "مستلزمات طبية",
    ],
  },
  {
    id: "medical-devices",
    names: { ar: "الأجهزة الطبية", en: "Medical Devices" },
    icon: "Stethoscope",
    emoji: "🩺",
    imageUrl: medicalDevicesImage,
    desc: {
      ar: "أجهزة القياس والمتابعة المنزلية والدعامات والأدوات الطبية المعمرة.",
      en: "Home monitoring devices, braces, supports, and durable medical equipment.",
    },
    theme: {
      accent: "#2563eb",
      accentSoft: "rgba(37, 99, 235, 0.12)",
      border: "rgba(37, 99, 235, 0.18)",
      surface: "#eff6ff",
      color: "#2563eb",
      bg: "#eff6ff",
      glow: "rgba(37, 99, 235, 0.14)",
    },
    keywords: [
      "device",
      "monitor",
      "thermometer",
      "glucometer",
      "pressure",
      "nebulizer",
      "wheelchair",
      "support",
      "brace",
      "جهاز",
      "أجهزة",
      "اجهزة",
      "قياس",
      "ضغط",
      "سكر",
      "ميزان حرارة",
      "دعامة",
    ],
    aliases: [
      "medical devices",
      "medical device",
      "devices",
      "equipment",
      "الأجهزة الطبية",
      "اجهزة طبية",
      "الأجهزة",
    ],
  },
  {
    id: FALLBACK_CATEGORY_ID,
    names: { ar: "الصحة العامة", en: "General Healthcare" },
    icon: "Package",
    emoji: "📦",
    imageUrl: generalHealthcareImage,
    desc: {
      ar: "منتجات صحية واستهلاكية عامة لم تندرج ضمن الأقسام المتخصصة الأخرى.",
      en: "General health and household products that do not fall into a more specific pharmacy section.",
    },
    theme: {
      accent: "#334155",
      accentSoft: "rgba(51, 65, 85, 0.1)",
      border: "rgba(51, 65, 85, 0.16)",
      surface: "#f8fafc",
      color: "#334155",
      bg: "#f8fafc",
      glow: "rgba(51, 65, 85, 0.12)",
    },
    keywords: [],
    aliases: [
      "general healthcare",
      "general",
      "misc",
      "household",
      "الصحة العامة",
      "عام",
      "عناية عامة",
    ],
  },
];

const CATEGORY_SEED_BY_ID = CATEGORY_SEEDS.reduce<Record<string, CategorySeed>>((accumulator, seed) => {
  accumulator[seed.id] = seed;
  return accumulator;
}, {});

const CATEGORY_ALIAS_TO_ID = CATEGORY_SEEDS.reduce<Record<string, string>>((accumulator, seed) => {
  seed.aliases.forEach((alias) => {
    accumulator[normalizeForMatch(alias)] = seed.id;
  });
  accumulator[normalizeForMatch(seed.names.en)] = seed.id;
  accumulator[normalizeForMatch(seed.names.ar)] = seed.id;
  return accumulator;
}, {});

let catalogSnapshotCache: CatalogSnapshot | null = null;
let catalogSnapshotPromise: Promise<CatalogSnapshot> | null = null;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function sanitizeText(value: unknown) {
  return normalizeWhitespace(String(value ?? "").replace(/[\uFEFF\uFFFD]/g, ""));
}

function sanitizeBarcode(value: string) {
  return sanitizeText(value).replace(/[^\p{Letter}\p{Number}-]+/gu, "");
}

function parseNumber(value: string) {
  const numericText = sanitizeText(value).replace(/,/g, "");
  const parsed = Number(numericText);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value: string) {
  return normalizeForMatch(value).replace(/\s+/g, "-") || "catalog-item";
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readSnapshotFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as CachedCatalogSnapshot;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.cachedAt !== "number" ||
      !parsed.snapshot ||
      !Array.isArray(parsed.snapshot.products) ||
      !Array.isArray(parsed.snapshot.categories)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// FIX: localStorage has a 5MB limit. 52,602 products serialise to ~10MB of
// JSON, so setItem silently throws QuotaExceededError and the cache is never
// written. Every page load then re-fetches all 52K rows from scratch.
// Solution: store only a lightweight index (id + name + price + inStock +
// category) in localStorage for instant first-paint, and rely on the in-memory
// `catalogSnapshotCache` for the full dataset within the same session.
function writeSnapshotToStorage(snapshot: CatalogSnapshot) {
  if (typeof window === "undefined") return;

  // Build a slim version: drop imageUrl and sourceRow, keep only fields the
  // UI needs for the initial skeleton render and category counts.
  const slimProducts = snapshot.products.map((p) => ({
    id: p.id,
    code: p.code,
    barcode: p.barcode,
    name: p.name,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    price: p.price,
    stock: p.stock,
    inStock: p.inStock,
    category: p.category,
    categoryName: p.categoryName,
    categoryNameEn: p.categoryNameEn,
    sourceRow: p.sourceRow,
  }));

  const cachedSnapshot: CachedCatalogSnapshot = {
    cachedAt: Date.now(),
    snapshot: { ...snapshot, products: slimProducts as CatalogProduct[] },
  };

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cachedSnapshot));
  } catch {
    // QuotaExceededError — localStorage is full.
    // Clear just our key and try once more with a smaller slice (first 8K rows).
    // 52K products exceed the 5 MB localStorage quota.
    // Remove the stale key so the next load fetches fresh data rather
    // than serving an incomplete partial cache.
    try { window.localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  }
}

// ─── Supabase product normalizer ──────────────────────────────────────────────

export function normalizeSupabaseProduct(row: Record<string, unknown>, sourceRow: number): CatalogProduct | null {
  const nameAr = sanitizeText(row.Name_Ar);
  const nameEnRaw = sanitizeText(row.Name_En);
  const legacyName = sanitizeText(row.Name);
  const name = legacyName || nameAr || nameEnRaw;
  const nameEn = nameEnRaw || undefined;

  const price = parseNumber(String(row.Price ?? ""));
  if (!name || price === null || price <= 0) return null;

  // The DB table has a real Stock column. Read it directly; fall back to
  // is_active (1/0) only for RPC rows that didn't include a stock figure.
  const rawStock = row.Stock ?? row.stock;
  const stockNum = Number.isFinite(Number(rawStock)) ? Number(rawStock) : null;
  const inStock = stockNum !== null ? stockNum > 0 : row.is_active === true;
  const stockVal = stockNum !== null ? stockNum : (inStock ? 1 : 0);

  const rawCategoryAr = sanitizeText(row.Category_Name);
  const rawCategoryEn = sanitizeText(row.Category_Name_En);
  const categorySeed = resolveCategory(
    rawCategoryAr,
    rawCategoryEn,
    nameAr || name,
    nameEnRaw || name,
  );

  const code = sanitizeText(row.Code);
  const barcode = sanitizeBarcode(sanitizeText(row.Barcode));
  const imageUrl = sanitizeText(row.image_url ?? "");
  const idSeed = code || barcode || `${categorySeed.id}-${name}`;

  const isSale = row.is_sale === true;
  const originalPriceRaw = parseNumber(String(row.original_price ?? ""));
  const originalPrice =
    originalPriceRaw !== null && originalPriceRaw > price ? originalPriceRaw : undefined;

  return {
    id: String(row.id || `${slugify(idSeed)}-${sourceRow}`),
    code,
    barcode,
    name,
    nameAr: nameAr || undefined,
    nameEn,
    price: Number(price.toFixed(2)),
    stock: Number(stockVal.toFixed(2)),
    inStock,
    category: categorySeed.id,
    categoryName: categorySeed.names.ar,
    categoryNameEn: categorySeed.names.en,
    imageUrl: isValidHttpUrl(imageUrl) ? imageUrl : undefined,
    sourceRow,
    isSale: isSale || undefined,
    originalPrice,
  } satisfies CatalogProduct;
}

// ─── Supabase fetch (replaces Google Sheets CSV fetch) ────────────────────────

async function fetchAllProductRows(): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseClient();
  const PAGE_SIZE = 1000;
  // Matches typical HTTP/2 stream limits; prevents 429s on free-tier Supabase.
  const CONCURRENCY = 6;

  // First, get the exact row count with a lightweight head request.
  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });

  if (countError) throw new Error(`Supabase count error: ${countError.message}`);
  if (!count || count === 0) return [];

  // Build page indices and fire them in parallel waves of CONCURRENCY.
  const pageCount = Math.ceil(count / PAGE_SIZE);
  const pages = Array.from({ length: pageCount }, (_, i) => i);
  const allRows: Record<string, unknown>[] = [];

  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const wave = pages.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      wave.map(async (pageIndex) => {
        const from = pageIndex * PAGE_SIZE;
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`Supabase error on page ${pageIndex}: ${error.message}`);
        return data as Record<string, unknown>[] | null;
      }),
    );
    for (const pageData of results) {
      if (pageData && pageData.length > 0) allRows.push(...pageData);
    }
  }

  return allRows;
}

function scoreSeedMatch(seed: CategorySeed, searchText: string) {
  let bestScore = 0;

  seed.aliases.forEach((alias) => {
    const normalizedAlias = normalizeForMatch(alias);
    if (!normalizedAlias) {
      return;
    }

    if (searchText === normalizedAlias) {
      bestScore = Math.max(bestScore, 240 + normalizedAlias.length);
    } else if (searchText.includes(normalizedAlias)) {
      bestScore = Math.max(bestScore, 160 + normalizedAlias.length);
    }
  });

  seed.keywords.forEach((keyword) => {
    const normalizedKeyword = normalizeForMatch(keyword);
    if (!normalizedKeyword) {
      return;
    }

    if (searchText.includes(normalizedKeyword)) {
      bestScore = Math.max(bestScore, 80 + normalizedKeyword.length);
    }
  });

  return bestScore;
}

export function resolveCategory(rawCategoryAr: string, rawCategoryEn: string, productNameAr: string, productNameEn: string) {
  const explicitCandidates = [rawCategoryEn, rawCategoryAr]
    .map((value) => normalizeForMatch(value))
    .filter(Boolean);

  // Try exact matches first
  for (const candidate of explicitCandidates) {
    const explicitMatch = CATEGORY_ALIAS_TO_ID[candidate];
    if (explicitMatch) {
      return CATEGORY_SEED_BY_ID[explicitMatch];
    }
  }

  const searchText = normalizeForMatch(
    [rawCategoryEn, rawCategoryAr, productNameEn, productNameAr].filter(Boolean).join(" "),
  );

  let bestSeed = CATEGORY_SEED_BY_ID[FALLBACK_CATEGORY_ID];
  let bestScore = 0;

  CATEGORY_SEEDS.forEach((seed) => {
    if (seed.id === FALLBACK_CATEGORY_ID) {
      return;
    }

    const score = scoreSeedMatch(seed, searchText);
    if (score > bestScore) {
      bestSeed = seed;
      bestScore = score;
    }
  });

  return bestSeed;
}


function buildCategoryFromSeed(seed: CategorySeed, count: number, inStockCount: number) {
  return {
    id: seed.id,
    name: seed.names.ar,
    nameEn: seed.names.en,
    icon: seed.icon,
    emoji: seed.emoji,
    count,
    inStockCount,
    descAr: seed.desc.ar,
    descEn: seed.desc.en,
    theme: seed.theme,
    imageUrl: seed.imageUrl,
    imagePosition: seed.imagePosition,
  } satisfies CatalogCategory;
}

export function deriveCatalogCategories(products: CatalogProduct[], _previousCategories: CatalogCategory[] = []) {
  // Single pass: count + capture a sample product per category (eliminates O(N) find() calls later)
  const counts = new Map<string, { count: number; inStockCount: number; sample: CatalogProduct }>();

  for (const product of products) {
    const current = counts.get(product.category);
    if (current) {
      current.count += 1;
      if (product.inStock) current.inStockCount += 1;
    } else {
      counts.set(product.category, { count: 1, inStockCount: product.inStock ? 1 : 0, sample: product });
    }
  }

  // Always include every seed category, even when 0 products match the current
  // page-1 slice. The count will be 0 on cold start and update once the grid
  // loads more products. Filtering out 0-count seeds was the root cause of the
  // "empty sidebar on cold start" bug.
  const knownCategories = CATEGORY_SEEDS.map((seed) => {
    const stats = counts.get(seed.id);
    return buildCategoryFromSeed(seed, stats?.count ?? 0, stats?.inStockCount ?? 0);
  });

  const knownIds = new Set(knownCategories.map((category) => category.id));
  const fallbackCategories = Array.from(counts.entries()).flatMap(([categoryId, stats]) => {
    if (knownIds.has(categoryId)) return [];

    const { sample } = stats; // already captured — no O(N) find needed
    return [
      {
        id: categoryId,
        name: sample.categoryName || "الصحة العامة",
        nameEn: sample.categoryNameEn || sample.categoryName || "General Healthcare",
        icon: "Package",
        emoji: "📦",
        count: stats.count,
        inStockCount: stats.inStockCount,
        descAr: "قسم متصل مباشرة ببيانات الكتالوج الحالية.",
        descEn: "A category sourced directly from the current catalog data.",
        theme: DEFAULT_CATEGORY_THEME,
        imageUrl: generalHealthcareImage,
      } satisfies CatalogCategory,
    ];
  });

  return [...knownCategories, ...fallbackCategories].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.nameEn.localeCompare(right.nameEn, "en");
  });
}

export function getCatalogCategorySearchMetadata(categoryId: string): CatalogCategorySearchMetadata {
  const seed = CATEGORY_SEED_BY_ID[categoryId];
  return {
    aliases: seed?.aliases ?? [],
    keywords: seed?.keywords ?? [],
  };
}

function sortProducts(products: CatalogProduct[]) {
  return products.slice().sort((left, right) => {
    if (Number(right.inStock) !== Number(left.inStock)) {
      return Number(right.inStock) - Number(left.inStock);
    }

    if (right.stock !== left.stock) {
      return right.stock - left.stock;
    }

    if (left.price !== right.price) {
      return left.price - right.price;
    }

    return left.name.localeCompare(right.name, "en");
  });
}

async function fetchLiveCatalogSnapshot() {
  const rows = await fetchAllProductRows();

  if (rows.length === 0) {
    throw new Error("Catalog source is empty.");
  }

  const products = rows
    .map((row, index) => normalizeSupabaseProduct(row, index + 2))
    .filter(Boolean) as CatalogProduct[];

  if (products.length === 0) {
    throw new Error("Catalog parsing produced no usable products.");
  }

  const seen = new Map<string, CatalogProduct>();
  for (const product of products) {
    const key = `${product.code || ""}::${product.barcode || ""}::${product.name}`;
    if (!seen.has(key)) {
      seen.set(key, product);
    }
  }

  const dedupedProducts = Array.from(seen.values());
  const normalizedProducts = sortProducts(dedupedProducts);

  return {
    products: normalizedProducts,
    categories: deriveCatalogCategories(normalizedProducts),
    lastUpdated: new Date().toISOString(),
  } satisfies CatalogSnapshot;
}

export async function fetchCatalogSnapshot(forceRefresh = false): Promise<CatalogSnapshot> {
  if (!forceRefresh && catalogSnapshotCache) {
    return catalogSnapshotCache;
  }

  if (!forceRefresh) {
    const cachedSnapshot = readSnapshotFromStorage();

    if (cachedSnapshot && Date.now() - cachedSnapshot.cachedAt < CACHE_TTL_MS) {
      catalogSnapshotCache = cachedSnapshot.snapshot;
      return cachedSnapshot.snapshot;
    }
  }

  if (!forceRefresh && catalogSnapshotPromise) {
    return catalogSnapshotPromise;
  }

  catalogSnapshotPromise = fetchLiveCatalogSnapshot()
    .then((snapshot) => {
      catalogSnapshotCache = snapshot;
      writeSnapshotToStorage(snapshot);
      return snapshot;
    })
    .catch((error) => {
      const cachedSnapshot = readSnapshotFromStorage();

      if (cachedSnapshot?.snapshot) {
        catalogSnapshotCache = cachedSnapshot.snapshot;
        return cachedSnapshot.snapshot;
      }

      throw error;
    })
    .finally(() => {
      catalogSnapshotPromise = null;
    });

  return catalogSnapshotPromise;
}

export function getCachedCatalogSnapshot() {
  if (catalogSnapshotCache) {
    return catalogSnapshotCache;
  }

  const cachedSnapshot = readSnapshotFromStorage();
  if (!cachedSnapshot) {
    return null;
  }

  catalogSnapshotCache = cachedSnapshot.snapshot;
  return cachedSnapshot.snapshot;
}

export function getCategoryTheme(categoryId: string) {
  return CATEGORY_SEED_BY_ID[categoryId]?.theme ?? DEFAULT_CATEGORY_THEME;
}

export function getCategoryIconName(categoryId: string) {
  return CATEGORY_SEED_BY_ID[categoryId]?.icon ?? "Package";
}

/**
 * Returns the AR and EN display names for a known category seed ID.
 * Used by shopperCatalogApi to build category filter queries without needing
 * the full product catalog snapshot loaded into memory.
 */
export function getCategoryNamesById(id: string): { name: string; nameEn: string } | null {
  const seed = CATEGORY_SEED_BY_ID[id];
  return seed ? { name: seed.names.ar, nameEn: seed.names.en } : null;
}

/**
 * Returns every Arabic + English alias known for a category seed (including
 * its display names). Used by the products page filter so that selecting
 * "Medications" also pulls in DB rows whose Category_Name is "أدوية" or
 * "Medication" — not only the exact seed display name.
 *
 * This is the fix for the user-reported issue "most of the products in the
 * website itself are not in their categories": the previous filter used a
 * single ilike against the display name, which missed many real DB labels.
 */
export function getCategoryMatchTermsById(
  id: string,
): { ar: string[]; en: string[] } | null {
  const seed = CATEGORY_SEED_BY_ID[id];
  if (!seed) return null;

  const ar = new Set<string>();
  const en = new Set<string>();

  ar.add(seed.names.ar);
  en.add(seed.names.en);

  for (const alias of seed.aliases) {
    // Heuristic: aliases with any Arabic codepoint go to ar; otherwise en.
    if (/[؀-ۿ]/.test(alias)) ar.add(alias);
    else en.add(alias);
  }

  return { ar: Array.from(ar), en: Array.from(en) };
}

/**
 * Returns all CATEGORY_SEEDS as fully-shaped CatalogCategory objects with
 * zero product counts. Used as a zero-network fallback for the category sidebar
 * on cold-start before any products are loaded from Supabase.
 * Counts will be updated by deriveCatalogCategories() once products arrive.
 */
export function getStaticCategoryList(): CatalogCategory[] {
  return CATEGORY_SEEDS.map((seed) => buildCategoryFromSeed(seed, 0, 0));
}

export function formatStockQuantity(stock: number) {
  if (stock <= 0) {
    return "0";
  }

  return Number.isInteger(stock) ? String(stock) : stock.toFixed(2);
}

export function getProductAvailabilityLabel(product: CatalogProduct, lang: CatalogLanguage) {
  if (!product.inStock) {
    return lang === "ar" ? "غير متوفر حالياً" : "Currently unavailable";
  }
  // The DB signals availability via is_active only (no real quantity column),
  // so stock is always 0 or 1 — showing "(1)" as a count is misleading.
  return lang === "ar" ? "متوفر" : "In stock";
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

// ─── M8: Image pipeline helpers ──────────────────────────────────────────────

const SUPABASE_STORAGE_ORIGIN = "supabase.co";

/**
 * Convert a Supabase Storage object URL to an image-transform URL so the
 * browser receives a correctly sized, WebP-encoded image instead of the
 * raw (often large) original.
 *
 * Original:    https://[ref].supabase.co/storage/v1/object/public/[bucket]/[path]
 * Transformed: https://[ref].supabase.co/storage/v1/render/image/public/[bucket]/[path]?width=N&quality=80&format=webp
 *
 * Falls through unchanged for:
 *   • Non-Supabase URLs (CDN, external host)
 *   • data: URIs (our SVG placeholders)
 *   • Already-transformed render URLs
 */
function toSupabaseTransformUrl(url: string, width: number): string {
  if (!url || url.startsWith("data:")) return url;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(SUPABASE_STORAGE_ORIGIN)) return url;
    if (u.pathname.includes("/render/image/")) return url; // already transformed
    // Replace /object/public/ with /render/image/public/
    const transformed = u.pathname.replace("/object/public/", "/render/image/public/");
    if (transformed === u.pathname) return url; // path pattern didn't match
    u.pathname = transformed;
    u.searchParams.set("width",   String(width));
    u.searchParams.set("quality", "80");
    u.searchParams.set("format",  "webp");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Generate a responsive `srcset` string for a Supabase-hosted product image.
 * Uses widths matched to the product grid breakpoints (see GRID_CLASSES in
 * ProductGrid.tsx):
 *   320w  — mobile single-column (2-col grid, ~160px per card on 375px screen)
 *   480w  — 2-col grid on tablet / dense mobile
 *   640w  — card images on desktop 3-col grid
 *   960w  — 2× retina of 480w, covers high-DPI tablets
 *
 * Returns null for:
 *   • Non-Supabase URLs (we don't know the transform API supports them)
 *   • data: URIs (SVG placeholders — already vector, no srcset needed)
 */
export function getCatalogProductImageSrcSet(url: string | undefined): string | undefined {
  if (!url || url.startsWith("data:")) return undefined;
  try {
    const u = new URL(url);
    if (!u.hostname.includes(SUPABASE_STORAGE_ORIGIN)) return undefined;
  } catch {
    return undefined;
  }
  const widths = [320, 480, 640, 960] as const;
  return widths.map((w) => `${toSupabaseTransformUrl(url, w)} ${w}w`).join(", ");
}

export function getCatalogProductImage(product: CatalogProduct) {
  if (product.imageUrl && isValidHttpUrl(product.imageUrl)) {
    // Serve an appropriately sized image (640px width = 2× retina for typical
    // product card on a desktop 3-column grid). The srcset in the <img> element
    // will pick the right size; this is the fallback src for browsers without
    // srcset support and for the LCP pre-fetch.
    return toSupabaseTransformUrl(product.imageUrl, 640);
  }

  const theme = getCategoryTheme(product.category);
  const name = escapeSvgText(truncate(product.name, 22));
  const code = escapeSvgText(truncate(product.code || product.barcode || "UNITED", 24));
  const category = escapeSvgText(truncate(product.categoryNameEn || product.categoryName, 18));

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" role="img" aria-label="${name}">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="${theme.surface}" />
        </linearGradient>
      </defs>
      <rect width="520" height="520" rx="40" fill="url(#bg)" />
      <circle cx="420" cy="88" r="96" fill="${theme.accentSoft}" />
      <circle cx="96" cy="430" r="120" fill="${theme.accentSoft}" />
      <rect x="38" y="38" width="444" height="444" rx="34" fill="#ffffff" stroke="${theme.border}" stroke-width="2" />
      <rect x="74" y="78" width="180" height="34" rx="17" fill="${theme.accentSoft}" />
      <text x="164" y="100" text-anchor="middle" font-family="Manrope, 'IBM Plex Sans Arabic', sans-serif" font-size="15" font-weight="800" fill="${theme.accent}">
        ${category}
      </text>
      <rect x="92" y="146" width="336" height="220" rx="34" fill="${theme.surface}" stroke="${theme.border}" />
      <path d="M170 202h100c30 0 54 24 54 54s-24 54-54 54H170z" fill="#ffffff" />
      <path d="M188 218h76c20 0 36 16 36 36s-16 36-36 36h-76z" fill="${theme.accentSoft}" />
      <rect x="156" y="192" width="28" height="128" rx="14" fill="${theme.accent}" />
      <rect x="128" y="224" width="84" height="28" rx="14" fill="${theme.accent}" />
      <rect x="120" y="398" width="280" height="18" rx="9" fill="${theme.accentSoft}" />
      <text x="92" y="450" font-family="Manrope, 'IBM Plex Sans Arabic', sans-serif" font-size="14" font-weight="800" fill="#64748b">
        ${code}
      </text>
      <text x="92" y="478" font-family="Manrope, 'IBM Plex Sans Arabic', sans-serif" font-size="30" font-weight="900" fill="#0f172a">
        ${name}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildSpotlightProducts(products: CatalogProduct[], categories: CatalogCategory[], limit = 12) {
  // Single pass: group in-stock products by category (O(N))
  const bucketMap = new Map<string, CatalogProduct[]>();
  for (const product of products) {
    if (!product.inStock) continue;
    const bucket = bucketMap.get(product.category);
    if (bucket) {
      bucket.push(product);
    } else {
      bucketMap.set(product.category, [product]);
    }
  }

  const comparator = (left: CatalogProduct, right: CatalogProduct) => {
    if (right.stock !== left.stock) return right.stock - left.stock;
    if (left.price !== right.price) return left.price - right.price;
    return left.name.localeCompare(right.name, "en");
  };

  // Sort each bucket once, preserving category order from the categories list
  const categoryBuckets = categories
    .map((category) => ({ id: category.id, items: (bucketMap.get(category.id) ?? []).sort(comparator) }))
    .filter((b) => b.items.length > 0);

  const selected: CatalogProduct[] = [];
  const selectedIds = new Set<string>();
  let depth = 0;

  while (selected.length < limit) {
    let addedOnCycle = false;

    for (const bucket of categoryBuckets) {
      if (selected.length >= limit) break;
      const candidate = bucket.items[depth];
      if (!candidate || selectedIds.has(candidate.id)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.id);
      addedOnCycle = true;
    }

    if (!addedOnCycle) break;
    depth += 1;
  }

  if (selected.length >= limit) return selected;

  // Fill remaining slots with any in-stock product not already selected (O(N), no allocation)
  for (const product of products) {
    if (selected.length >= limit) break;
    if (product.inStock && !selectedIds.has(product.id)) selected.push(product);
  }

  return selected;
}