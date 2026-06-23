import type {
  AlternativeProduct,
  ProductMedicalInfo,
  SearchResultItem,
} from "@pharmacy/types";

const ingredientStopwords = new Set([
  "mg",
  "ml",
  "tab",
  "tabs",
  "tablet",
  "tablets",
  "capsule",
  "capsules",
  "cream",
  "gel",
  "syrup",
  "drop",
  "drops",
  "the",
  "and",
]);

function tokenize(value: string | undefined | null) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !ingredientStopwords.has(token));
}

export function extractActiveIngredients(product: Pick<SearchResultItem, "nameAr" | "nameEn" | "categoryNameEn">) {
  const tokens = [...new Set([...tokenize(product.nameEn), ...tokenize(product.nameAr)])];
  return tokens.slice(0, 3);
}

export function buildMedicalInfo(
  product: Pick<SearchResultItem, "nameAr" | "nameEn" | "categoryNameEn">,
  lang: "ar" | "en" = "en",
): ProductMedicalInfo {
  const displayName = lang === "ar"
    ? (product.nameAr || product.nameEn)
    : (product.nameEn || product.nameAr);
  const ingredientTokens = extractActiveIngredients(product);

  if (lang === "ar") {
    return {
      usageInstructions: [
        `راجع إرشادات الاستخدام الموجودة على عبوة ${displayName} قبل الاستعمال.`,
        "استخدم المنتج بالطريقة المذكورة على العبوة أو وفق توجيهات الصيدلي.",
      ],
      dosageGuidance: [
        "اتبع تعليمات الجرعة والفترات الزمنية المحددة على العبوة.",
        "لا تزيد الكمية أو مرات الاستخدام دون استشارة متخصص.",
      ],
      safetyWarnings: [
        "احفظ المنتج بعيداً عن متناول الأطفال.",
        "أوقف الاستخدام واستشر صيدلانياً إذا ظهرت أعراض غير معتادة.",
      ],
      activeIngredients: ingredientTokens,
      generalDisclaimer:
        "هذه المعلومات إرشادات صيدلانية عامة ولا تُغني عن التشخيص أو المشورة العلاجية الشخصية.",
    };
  }

  return {
    usageInstructions: [
      `Review the label directions for ${displayName} before use.`,
      "Use only in the way the pack or pharmacist guidance describes.",
    ],
    dosageGuidance: [
      "Follow the package instructions and standard labeled intervals.",
      "Do not increase the amount or frequency without professional advice.",
    ],
    safetyWarnings: [
      "Keep out of reach of children.",
      "Stop use and seek professional advice if unusual symptoms appear.",
    ],
    activeIngredients: ingredientTokens,
    generalDisclaimer:
      "This information is general pharmacy guidance and does not replace diagnosis or personalized treatment advice.",
  };
}

export function rankAlternativeProducts(
  product: SearchResultItem,
  products: SearchResultItem[],
): AlternativeProduct[] {
  const activeIngredients = extractActiveIngredients(product);

  return products
    .filter((candidate) => candidate.id !== product.id)
    .map((candidate) => {
      const candidateIngredients = extractActiveIngredients(candidate);
      const sameIngredient = activeIngredients.some((token) => candidateIngredients.includes(token));

      return {
        productId: candidate.id,
        nameAr: candidate.nameAr,
        nameEn: candidate.nameEn,
        price: candidate.price,
        activeIngredients: candidateIngredients,
        matchType: sameIngredient ? "same_active_ingredient" : "same_category",
        inStock: candidate.inStock,
      } satisfies AlternativeProduct;
    })
    .filter((candidate) =>
      candidate.matchType === "same_active_ingredient"
      || products.find((item) => item.id === candidate.productId)?.category === product.category,
    )
    .sort((left, right) => {
      if (left.matchType !== right.matchType) {
        return left.matchType === "same_active_ingredient" ? -1 : 1;
      }
      if (left.inStock !== right.inStock) {
        return left.inStock ? -1 : 1;
      }
      if (left.price !== right.price) {
        return left.price - right.price;
      }
      return String(left.nameEn).localeCompare(String(right.nameEn));
    })
    .slice(0, 4);
}
