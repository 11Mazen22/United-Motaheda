/**
 * Products API — data layer.
 *
 * Every Supabase call here:
 *   - uses an explicit column list (no select('*'))
 *   - is wrapped in withTimeout() so a stuck request fails in 12 s, not 60 s
 *   - is AbortSignal-aware (React Query passes one through)
 *   - returns a typed, zod-validated DTO
 *
 * The list/search and detail paths use the canonical effective-pricing RPCs.
 * Effective prices and active promotions are resolved server-side, so clients
 * never read legacy product sale flags or original-price columns.
 */

import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/supabaseRequest";
import { timed, timedMark } from "@/lib/devTiming";
import {
  EffectiveProductRowSchema,
  normalizeEffectiveProduct,
  type NativeCategory,
  type NativeProduct,
  type ProductFilters,
  type ProductPage,
  type ProductSortMode,
} from "../types";

/** Server page size — maps to RPC p_limit and PostgREST .range(from, to). */
const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE     = 50;



// ─── List / search ──────────────────────────────────────────────────────────

export interface FetchProductsArgs extends ProductFilters {
  signal?: AbortSignal;
}

export async function fetchProductsPage(args: FetchProductsArgs = {}): Promise<ProductPage> {
  const {
    search,
    categoryId,
    inStock,
    minPrice,
    maxPrice,
    sortBy   = "newest",
    page     = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    signal,
    isSale,
  } = args;



  const safePageSize = Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE));
  const offset       = (Math.max(1, page) - 1) * safePageSize;
  const sort: ProductSortMode = (sortBy ?? "newest") as ProductSortMode;

  const rawSearch = search?.trim() || undefined;

  const canonicalSort = sort === "name_asc" ? "name_asc" : sort === "price_asc" || sort === "price_desc" ? sort : "newest";
  const rows = await withTimeout(
    (timeoutSignal) => timed(
      `rpc:search_effective_products[cat=${categoryId ?? "*"} q="${(rawSearch ?? "").slice(0, 20)}" sort=${canonicalSort} p=${page}]`,
      () => supabase.rpc("search_effective_products", {
        p_query: rawSearch || null,
        p_category: categoryId ?? null,
        p_in_stock: inStock ?? false,
        p_min_price: minPrice ?? null,
        p_max_price: maxPrice ?? null,
        p_is_sale: isSale ?? false,
        p_sort: canonicalSort,
        p_limit: safePageSize,
        p_offset: offset,
      }).abortSignal(linkSignals(signal, timeoutSignal)),
    ),
    { signal },
  );

  const parsed = EffectiveProductRowSchema.array().safeParse(rows);
  if (!parsed.success) {
    timedMark("validation-fail", "search_effective_products rows rejected by zod");
    throw new Error(`Invalid canonical product response: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  }

  const data = parsed.data;
  const totalCount = data[0]?.total_count ?? 0;
  const products = data.map(normalizeEffectiveProduct);
  return { products, totalCount, hasNextPage: offset + products.length < totalCount, currentPage: page };
}

// ─── Detail ─────────────────────────────────────────────────────────────────

export async function fetchProductById(
  id: string,
  opts: { signal?: AbortSignal } = {},
): Promise<NativeProduct | null> {
  if (!id) return null;
  try {
    const rows = await withTimeout(
      (timeoutSignal) => supabase
        .rpc("get_effective_product", { p_product_id: id })
        .abortSignal(linkSignals(opts.signal, timeoutSignal)),
      { signal: opts.signal },
    );
    const parsed = EffectiveProductRowSchema.array().safeParse(rows);
    return parsed.success && parsed.data[0] ? normalizeEffectiveProduct(parsed.data[0]) : null;
  } catch (e) {
    if (__DEV__) console.warn("[products] fetchProductById failed:", id, e);
    return null;
  }
}

// ─── Featured (homepage rail) ───────────────────────────────────────────────

export async function fetchFeaturedProducts(
  limit = 12,
  opts: { signal?: AbortSignal } = {},
): Promise<NativeProduct[]> {
  try {
    const rows = await withTimeout(
      (timeoutSignal) =>
        timed(
          `rpc:search_effective_products[featured limit=${limit}]`,
          () => supabase
            .rpc("search_effective_products", {
              p_query: null,
              p_category: null,
              p_in_stock: true,
              p_min_price: null,
              p_max_price: null,
              p_is_sale: false,
              p_sort: "newest",
              p_limit: Math.max(1, Math.min(limit, MAX_PAGE_SIZE)),
              p_offset: 0,
            })
            .abortSignal(linkSignals(opts.signal, timeoutSignal)),
        ),
      { signal: opts.signal },
    );
    const parsed = EffectiveProductRowSchema.array().safeParse(rows);
    if (!parsed.success) return [];
    return parsed.data.map(normalizeEffectiveProduct);
  } catch {
    // Featured is non-critical — never break the homepage on its failure.
    return [];
  }
}

// ─── Categories ─────────────────────────────────────────────────────────────

interface CategoryCountRow {
  category_name:    string;
  category_name_en: string | null;
  product_count:    number;
  in_stock_count:   number;
}

const CATEGORY_SEEDS: NativeCategory[] = [
  { id: "العناية بالشعر",                name: "العناية بالشعر",                nameEn: "Hair Care",                count: 0 },
  { id: "العناية بالبشرة",                name: "العناية بالبشرة",                nameEn: "Skincare",                 count: 0 },
  { id: "مستحضرات التجميل والمكياج",     name: "مستحضرات التجميل والمكياج",     nameEn: "Cosmetics & Makeup",       count: 0 },
  { id: "العناية بالفم والأسنان",         name: "العناية بالفم والأسنان",         nameEn: "Dental & Oral",            count: 0 },
  { id: "العطور والروائح",                name: "العطور والروائح",                nameEn: "Perfumes & Fragrances",    count: 0 },
  { id: "الإسعافات الأولية والمطهرات",   name: "الإسعافات الأولية والمطهرات",   nameEn: "First Aid & Antiseptics",  count: 0 },
  { id: "الفيتامينات والمكملات الغذائية", name: "الفيتامينات والمكملات الغذائية", nameEn: "Vitamins & Supplements",   count: 0 },
  { id: "المستلزمات الطبية",              name: "المستلزمات الطبية",              nameEn: "Medical Supplies",         count: 0 },
  { id: "الرعاية الصحية العامة",          name: "الرعاية الصحية العامة",          nameEn: "General Healthcare",       count: 0 },
  { id: "العناية بالجسم",                 name: "العناية بالجسم",                 nameEn: "Body Care",                count: 0 },
  { id: "العناية بالعيون",                name: "العناية بالعيون",                nameEn: "Eye Care",                 count: 0 },
  { id: "صحة المرأة",                     name: "صحة المرأة",                     nameEn: "Women's Health",           count: 0 },
  { id: "الأطفال والرضع",                 name: "الأطفال والرضع",                 nameEn: "Baby & Child",             count: 0 },
  { id: "أدوية",                          name: "أدوية",                          nameEn: "Medications",              count: 0 },
  { id: "العناية بالرجل",                 name: "العناية بالرجل",                 nameEn: "Men's Care",               count: 0 },
  { id: "الأم والطفل",                    name: "الأم والطفل",                    nameEn: "Baby & Mother Care",       count: 0 },
  { id: "التغذية الطبية",                 name: "التغذية الطبية",                 nameEn: "Medical Nutrition",        count: 0 },
];

function isValidCategoryName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;
  if (/�/.test(name)) return false;
  if (/^\?+$/.test(name)) return false;
  if (/^[\s\W\d]+$/.test(name)) return false;
  if (!/[؀-ۿa-zA-Z]/.test(name)) return false;
  return true;
}

export async function fetchCategories(): Promise<NativeCategory[]> {
  // Race against a 5 s deadline — seeds are always the safe fallback so the
  // home screen paints even if the RPC is cold.
  const timeoutPromise = new Promise<NativeCategory[]>((resolve) =>
    setTimeout(() => {
      timedMark("fallback", "fetchCategories → CATEGORY_SEEDS (RPC timeout 5s)");
      resolve(CATEGORY_SEEDS);
    }, 5000),
  );

  const fetchPromise = (async (): Promise<NativeCategory[]> => {
    try {
      const data = await withTimeout(
        (signal) =>
          timed(
            "rpc:get_category_counts",
            () => supabase.rpc("get_category_counts").abortSignal(signal),
          ),
        { timeoutMs: 4500 },
      );
      if (!Array.isArray(data) || data.length === 0) {
        timedMark("fallback", "fetchCategories → CATEGORY_SEEDS (empty data)");
        return CATEGORY_SEEDS;
      }
      const result: NativeCategory[] = [];
      for (const row of data as CategoryCountRow[]) {
        const name = (row.category_name ?? "").trim();
        if (!isValidCategoryName(name)) continue;
        const nameEn = (row.category_name_en ?? "").trim() || name;
        result.push({ id: name, name, nameEn, count: row.product_count });
      }
      return result.length > 0 ? result : CATEGORY_SEEDS;
    } catch (e) {
      timedMark("fallback", `fetchCategories → CATEGORY_SEEDS (${(e as Error).message})`);
      return CATEGORY_SEEDS;
    }
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

// ─── Catalog stats (homepage counter) ───────────────────────────────────────

export interface CatalogStats {
  totalProducts: number;
}

export async function fetchCatalogStats(): Promise<CatalogStats> {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw error;
  return { totalProducts: count ?? 0 };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Combine an external AbortSignal (from React Query) with our internal
 * timeout signal so whichever aborts first wins. Returns a single signal
 * suitable for passing to Supabase's `.abortSignal(...)`.
 */
function linkSignals(external: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!external) return timeout;
  if (external.aborted) return external;
  if (timeout.aborted)  return timeout;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  external.addEventListener("abort", onAbort, { once: true });
  timeout.addEventListener("abort",  onAbort, { once: true });
  return controller.signal;
}
