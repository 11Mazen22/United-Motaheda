const DEFAULT_SITE_URL = "https://www.unitedpharmacy.net";

const NON_INDEXABLE_EXACT_PATHS = new Set([
  "/login",
  "/register",
  "/cart",
  "/checkout",
  "/profile",
  "/orders",
  "/wishlist",
  "/favorites",
  "/suspended",
  "/suspension-info",
]);

const NON_INDEXABLE_PREFIXES = ["/admin", "/ops", "/driver", "/track/"] as const;

const CATEGORY_RULES = [
  {
    id: "medications",
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
    aliases: [
      "vitamins",
      "supplements",
      "vitamins supplements",
      "vitamin supplements",
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
    aliases: [
      "baby mother care",
      "baby care",
      "mother care",
      "kids care",
      "الأم والطفل",
      "الام والطفل",
      "الأطفال",
    ],
  },
  {
    id: "oral-care",
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
    id: "general-healthcare",
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
] as const;

function readSiteUrlEnv(): string {
  const env = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env;
  return env?.VITE_SITE_URL?.trim() || "";
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePathname(pathname: string) {
  if (!pathname) {
    return "/";
  }

  const collapsed = pathname.replace(/\/{2,}/g, "/");
  if (collapsed === "/") {
    return "/";
  }

  return collapsed.replace(/\/+$/, "") || "/";
}

function safeDecodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeForMatch(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

export function getSiteUrl() {
  return stripTrailingSlash(readSiteUrlEnv() || DEFAULT_SITE_URL);
}

export function resolveCanonicalCategorySegment(segment: string) {
  const decoded = safeDecodeSegment(segment).trim();
  const normalized = normalizeForMatch(decoded);

  if (!normalized) {
    return decoded;
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.id === decoded) {
      return rule.id;
    }

    if (rule.aliases.some((alias) => normalizeForMatch(alias) === normalized)) {
      return rule.id;
    }
  }

  return decoded;
}

export function getCanonicalPath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === "/favorites") {
    return "/wishlist";
  }

  if (normalizedPath.startsWith("/categories/")) {
    const rawSegment = normalizedPath.slice("/categories/".length);
    if (!rawSegment) {
      return "/categories";
    }

    const canonicalSegment = resolveCanonicalCategorySegment(rawSegment);
    return `/categories/${encodeURIComponent(canonicalSegment)}`;
  }

  return normalizedPath;
}

export function getCanonicalUrl(pathname: string) {
  return `${getSiteUrl()}${getCanonicalPath(pathname)}`;
}

export function shouldNoindexRoute(pathname: string, search = "") {
  const normalizedPath = normalizePathname(pathname);
  const canonicalPath = getCanonicalPath(normalizedPath);

  if (NON_INDEXABLE_EXACT_PATHS.has(normalizedPath) || NON_INDEXABLE_EXACT_PATHS.has(canonicalPath)) {
    return true;
  }

  if (NON_INDEXABLE_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return true;
  }

  if (canonicalPath !== normalizedPath) {
    return true;
  }

  if (
    search &&
    (normalizedPath === "/products" ||
      normalizedPath === "/categories" ||
      normalizedPath.startsWith("/products/") ||
      normalizedPath.startsWith("/categories/"))
  ) {
    return true;
  }

  return false;
}
