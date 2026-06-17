/**
 * Products API — snapshot copy.
 *
 * Note: this version is simplified for the snapshot and assumes
 * a local `supabase` client exists at `../supabase` (or a dummy client).
 */

import { supabase } from "../supabase";
import { withTimeout, isRetryable } from "../supabaseRequest";
import { timed, timedMark } from "../devTiming";
import {
  RawProductRowSchema,
  SearchProductRowSchema,
  normalizeRawRow,
  normalizeSearchRow,
  type NativeCategory,
  type NativeProduct,
  type ProductFilters,
  type ProductPage,
  type ProductSortMode,
} from "../types";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;
const PRODUCT_COLUMNS =
  'id,"Code","Barcode","Name_Ar","Name_En","Price","Stock","Category_Name","Category_Name_En","is_active",image_url,rating_avg,rating_count,discount_percent,is_new,is_bestseller,is_sale';

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
    sortBy = "newest",
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    signal,
    isSale,
  } = args;

  if (isSale) {
    return _fetchProductsPageDirect(args);
  }

  const safePageSize = Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE));
  const offset = (Math.max(1, page) - 1) * safePageSize;
  const sort: ProductSortMode = (sortBy ?? "newest") as ProductSortMode;
  const rawSearch = search?.trim() || undefined;

  try {
    const rows = await withTimeout(
      (timeoutSignal) =>
        timed(
          `rpc:search_products[cat=${categoryId ?? "*"} q="${(rawSearch ?? "").slice(0, 20)}" sort=${sort} p=${page}]`,
          () =>
            supabase
              .rpc("search_products", {
                p_query: rawSearch || null,
                p_category: categoryId ?? null,
                p_in_stock: inStock ?? false,
                p_min_price: minPrice ?? null,
                p_max_price: maxPrice ?? null,
                p_sort: sort,
                p_limit: safePageSize,
                p_offset: offset,
              })
              .abortSignal(linkSignals(signal, timeoutSignal)),
        ),
      { signal },
    );

    const parsed = SearchProductRowSchema.array().safeParse(rows);
    if (!parsed.success) {
      timedMark("validation-fail", "search_products rows rejected by zod");
      throw new Error("zod-validation-failed");
    }

    const data = parsed.data;
    const totalCount = data[0]?.total_count ?? 0;
    const products = data.map(normalizeSearchRow);

    return {
      products,
      totalCount,
      hasNextPage: offset + products.length < totalCount,
      currentPage: page,
    };
  } catch (rpcErr) {
    return _fetchProductsPageDirect(args);
  }
}

async function _fetchProductsPageDirect(args: FetchProductsArgs): Promise<ProductPage> {
  const {
    search,
    categoryId,
    inStock,
    minPrice,
    maxPrice,
    sortBy = "newest",
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    signal,
    isSale,
  } = args;

  const safePageSize = Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE));
  const offset = (Math.max(1, page) - 1) * safePageSize;
  const sort: ProductSortMode = (sortBy ?? "newest") as ProductSortMode;
  const rawSearch = search?.trim() || undefined;

  let query: any = supabase
    .from("products")
    .select(PRODUCT_COLUMNS, { count: "exact" })
    .eq("is_active", true);

  if (isSale) {
    query = query.or("is_sale.eq.true,discount_percent.gt.0");
  }

  if (categoryId) query = query.eq("Category_Name", categoryId);
  if (inStock) query = query.gt("Stock", 0);
  if (minPrice != null) query = query.gte("Price", minPrice);
  if (maxPrice != null) query = query.lte("Price", maxPrice);

  if (rawSearch) {
    const safe = rawSearch.replace(/[%_]/g, "\\$&");
    query = query.or([
      `Name_Ar.ilike.%${safe}%`,
      `Name_En.ilike.%${safe}%`,
      `Code.ilike.%${safe}%`,
      `Barcode.ilike.%${safe}%`,
    ].join(","));
  }

  if (sort === "price_asc") {
    query = query.order("Price", { ascending: true });
  } else if (sort === "price_desc") {
    query = query.order("Price", { ascending: false });
  } else if (sort === "name_asc") {
    query = query.order("Name_En", { ascending: true });
  } else {
    query = query.order("is_active", { ascending: false }).order("Name_En", { ascending: true });
  }

  query = query.range(offset, offset + safePageSize - 1);

  const { data, error, count } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  const products = rows
    .map((row) => {
      const parsed = RawProductRowSchema.safeParse(row);
      return parsed.success ? normalizeRawRow(parsed.data) : null;
    })
    .filter((p): p is NativeProduct => p !== null);

  return {
    products,
    totalCount: count ?? 0,
    hasNextPage: offset + products.length < totalCount,
    currentPage: page,
  };
}

export async function fetchProductById(id: string, opts: { signal?: AbortSignal } = {}): Promise<NativeProduct | null> {
  if (!id) return null;
  try {
    const row = await withTimeout(
      (timeoutSignal) =>
        supabase
          .from("products")
          .select(PRODUCT_COLUMNS)
          .eq("id", id)
          .abortSignal(linkSignals(opts.signal, timeoutSignal))
          .single(),
      { signal: opts.signal },
    );
    const parsed = RawProductRowSchema.safeParse(row);
    return parsed.success ? normalizeRawRow(parsed.data) : null;
  } catch {
    return null;
  }
}

export async function fetchFeaturedProducts(limit = 12, opts: { signal?: AbortSignal } = {}): Promise<NativeProduct[]> {
  try {
    const rows = await withTimeout(
      (timeoutSignal) =>
        supabase
          .rpc("get_featured_products", { p_limit: limit })
          .abortSignal(linkSignals(opts.signal, timeoutSignal)),
      { signal: opts.signal },
    );
    const parsed = SearchProductRowSchema.partial({ rank: true, total_count: true })
      .extend({ rank: SearchProductRowSchema.shape.rank.optional(), total_count: SearchProductRowSchema.shape.total_count.optional() })
      .array()
      .safeParse(rows);
    if (!parsed.success) return [];
    return parsed.data.map((r) => normalizeSearchRow({ ...r, rank: r.rank ?? null, total_count: 0 }));
  } catch {
    return [];
  }
}

interface CategoryCountRow {
  category_name:    string;
  category_name_en: string | null;
  product_count:    number;
  in_stock_count:   number;
}

const CATEGORY_SEEDS: NativeCategory[] = [
  { id: "العناية بالشعر", name: "العناية بالشعر", nameEn: "Hair Care", count: 0 },
  { id: "العناية بالبشرة", name: "العناية بالبشرة", nameEn: "Skincare", count: 0 },
  { id: "مستحضرات التجميل والمكياج", name: "مستحضرات التجميل والمكياج", nameEn: "Cosmetics & Makeup", count: 0 },
  { id: "العناية بالفم والأسنان", name: "العناية بالفم والأسنان", nameEn: "Dental & Oral", count: 0 },
  { id: "العطور والروائح", name: "العطور والروائح", nameEn: "Perfumes & Fragrances", count: 0 },
  { id: "الإسعافات الأولية والمطهرات", name: "الإسعافات الأولية والمطهرات", nameEn: "First Aid & Antiseptics", count: 0 },
  { id: "الفيتامينات والمكملات الغذائية", name: "الفيتامينات والمكملات الغذائية", nameEn: "Vitamins & Supplements", count: 0 },
  { id: "المستلزمات الطبية", name: "المستلزمات الطبية", nameEn: "Medical Supplies", count: 0 },
  { id: "الرعاية الصحية العامة", name: "الرعاية الصحية العامة", nameEn: "General Healthcare", count: 0 },
  { id: "العناية بالجسم", name: "العناية بالجسم", nameEn: "Body Care", count: 0 },
  { id: "العناية بالعيون", name: "العناية بالعيون", nameEn: "Eye Care", count: 0 },
  { id: "صحة المرأة", name: "صحة المرأة", nameEn: "Women's Health", count: 0 },
  { id: "الأطفال والرضع", name: "الأطفال والرضع", nameEn: "Baby & Child", count: 0 },
  { id: "أدوية", name: "أدوية", nameEn: "Medications", count: 0 },
  { id: "العناية بالرجل", name: "العناية بالرجل", nameEn: "Men's Care", count: 0 },
  { id: "الأم والطفل", name: "الأم والطفل", nameEn: "Baby & Mother Care", count: 0 },
  { id: "التغذية الطبية", name: "التغذية الطبية", nameEn: "Medical Nutrition", count: 0 },
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
  const timeoutPromise = new Promise<NativeCategory[]>((resolve) =>
    setTimeout(() => resolve(CATEGORY_SEEDS), 5000),
  );

  const fetchPromise = (async (): Promise<NativeCategory[]> => {
    try {
      const data = await withTimeout(
        (signal) => supabase.rpc("get_category_counts").abortSignal(signal),
        { timeoutMs: 4500 },
      );
      if (!Array.isArray(data) || data.length === 0) return CATEGORY_SEEDS;
      const result: NativeCategory[] = [];
      for (const row of data as CategoryCountRow[]) {
        const name = (row.category_name ?? "").trim();
        if (!isValidCategoryName(name)) continue;
        const nameEn = (row.category_name_en ?? "").trim() || name;
        result.push({ id: name, name, nameEn, count: row.product_count });
      }
      return result.length > 0 ? result : CATEGORY_SEEDS;
    } catch {
      return CATEGORY_SEEDS;
    }
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

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

function linkSignals(external: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!external) return timeout;
  if (external.aborted) return external;
  if (timeout.aborted) return timeout;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  external.addEventListener("abort", onAbort, { once: true });
  timeout.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}
