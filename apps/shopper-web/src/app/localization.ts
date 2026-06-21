import type { CatalogCategory, CatalogProduct } from "./catalog";

const warnedKeys = new Set<string>();

function warnMissingTranslationOnce(key: string, message: string) {
  if (warnedKeys.has(key)) {
    return;
  }
  warnedKeys.add(key);

  if (import.meta.env.DEV && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("united:i18n-warning", {
        detail: {
          key,
          message,
        },
      }),
    );
  }
}

/**
 * Returns true only when a product name string is a real, readable name.
 * Rejects common garbage patterns found in the catalog's nameEn field:
 *   "-2", "()", "(SOLO SEPT)", "** ML ***", "100", "15", etc.
 */
function isUsableProductName(name: string): boolean {
  if (!name) return false;
  // Pure number or negative number (e.g. "-2", "100")
  if (/^-?\d+$/.test(name)) return false;
  // Entire name wrapped in parentheses — internal codes like "(SOLO SEPT)"
  if (/^\(.+\)$/.test(name)) return false;
  // After stripping all non-letter characters, must have ≥ 3 letters remaining
  // catches "** ML ***" (→ "ML", 2 letters) and "()" (→ "", 0 letters)
  const lettersOnly = name.replace(/[^a-zA-Z؀-ۿ]/g, "");
  return lettersOnly.length >= 3;
}

export function getLocalizedProductName(product: CatalogProduct, lang: "ar" | "en") {
  const nameAr = (product.nameAr || product.name || "").trim();
  const nameEn = (product.nameEn || "").trim();

  if (lang === "ar") {
    if (!nameAr && nameEn) {
      warnMissingTranslationOnce(
        `product-name-ar:${product.id}`,
        `[i18n] Missing Arabic product name for ${product.id}; using English fallback.`,
      );
      return nameEn;
    }
    return nameAr || nameEn || product.id;
  }

  // English mode: only use nameEn if it's a real name, not a garbage catalog code
  const usableEn = isUsableProductName(nameEn) ? nameEn : "";

  if (!usableEn && nameAr) {
    warnMissingTranslationOnce(
      `product-name-en:${product.id}`,
      `[i18n] Missing English product name for ${product.id}; using Arabic fallback.`,
    );
    return nameAr;
  }
  return usableEn || nameAr || product.id;
}

export function getLocalizedCategoryName(category: CatalogCategory, lang: "ar" | "en") {
  const nameAr = (category.name || "").trim();
  const nameEn = (category.nameEn || "").trim();

  if (lang === "ar") {
    if (!nameAr && nameEn) {
      warnMissingTranslationOnce(
        `category-name-ar:${category.id}`,
        `[i18n] Missing Arabic category name for ${category.id}; using English fallback.`,
      );
      return nameEn;
    }
    return nameAr || nameEn || category.id;
  }

  if (!nameEn && nameAr) {
    warnMissingTranslationOnce(
      `category-name-en:${category.id}`,
      `[i18n] Missing English category name for ${category.id}; using Arabic fallback.`,
    );
    return nameAr;
  }
  return nameEn || nameAr || category.id;
}
