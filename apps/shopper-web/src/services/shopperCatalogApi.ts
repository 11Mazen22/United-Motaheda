/**
 * HIGH-PERFORMANCE SHOPPER CATALOG API
 *
 * Optimized for 52 000+ product catalogs with:
 * - Full snapshot loading via catalog.ts (1 000-row Supabase pagination under the hood)
 * - Server-side search and filtering for the paginated view (sub-3 s first paint)
 * - Non-blocking architecture with skeleton UI support
 * - Layered caching: in-memory LRU → localStorage slim-index → live Supabase fetch
 * - Automatic background refresh on stale cache
 */

import { getSupabaseClient } from "../lib/supabaseClient";
import {
  fetchCatalogSnapshot,
  getCachedCatalogSnapshot,
  getCategoryNamesById,

  getStaticCategoryList,
  resolveCategory,
  FALLBACK_CATEGORY_ID,
  type CatalogSnapshot,
  type CatalogProduct,
  type CatalogCategory,
  normalizeSupabaseProduct,
} from "../app/catalog";


// Strip emoji / pictographs that may be embedded in DB category names.
function stripEmoji(s: string): string {
  return s.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductFilters {
  searchQuery?: string;
  categoryId?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "price_asc" | "price_desc" | "name" | "relevant";
  isSale?: boolean;
}

export interface PageResult {
  products: CatalogProduct[];
  totalCount: number;
  hasNextPage: boolean;
  currentPage: number;
  pageSize: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Products per page — fits common grid layouts (6×4, 8×3, 4×6). */
const PAGE_SIZE = 24;

/** Maximum pages to keep in the in-memory LRU page cache. */
const MAX_CACHE_SIZE = 50;

/** localStorage key for the category list (separate, lightweight entry).
 *  v4 = unified with mobile (DB-driven categories via get_category_counts RPC).
 *  Bumping the key invalidates any stale v3 caches that held the old 8 hard-
 *  coded seed names. */
const CATEGORY_CACHE_KEY = "united-pharmacies-categories-v6";

/** 30-minute TTL for category localStorage cache (categories rarely change). */
const CATEGORY_CACHE_TTL_MS = 30 * 60 * 1000;

// ─── In-memory LRU Page Cache ─────────────────────────────────────────────────

interface CacheEntry {
  data: PageResult;
  timestamp: number;
  filtersHash: string;
}

class PageCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize = MAX_CACHE_SIZE;

  private getCacheKey(page: number, filters: ProductFilters): string {
    return `${page}:${this.hashFilters(filters)}`;
  }

  private hashFilters(filters: ProductFilters): string {
    return JSON.stringify({
      searchQuery: filters.searchQuery?.toLowerCase() ?? "",
      categoryId: filters.categoryId ?? "",
      inStock: filters.inStock ?? false,
      minPrice: filters.minPrice ?? 0,
      maxPrice: filters.maxPrice ?? 0,
      sortBy: filters.sortBy ?? "relevant",
      isSale: filters.isSale ?? false,
    });
  }

  get(page: number, filters: ProductFilters): PageResult | null {
    const key = this.getCacheKey(page, filters);
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Filtered results expire sooner than baseline (unfiltered) results.
    const ttl =
      filters.searchQuery || filters.categoryId ? 5 * 60 * 1000 : 15 * 60 * 1000;
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    // Promote to most-recently-used position: delete then re-insert so that
    // Map's insertion-order reflects recency for LRU eviction in `set()`.
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  set(page: number, filters: ProductFilters, data: PageResult): void {
    const key = this.getCacheKey(page, filters);

    // If the key already exists, remove it first so re-insertion moves it to
    // the most-recently-used (tail) position before the size check.
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // LRU eviction: drop the least-recently-used (head) entry when full.
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) this.cache.delete(lruKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      filtersHash: this.hashFilters(filters),
    });
  }

  /** Evict every entry for the given filter combination. */
  invalidateFilters(filters: ProductFilters): void {
    const hash = this.hashFilters(filters);
    // Collect keys first to avoid mutating the Map while iterating it.
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache) {
      if (entry.filtersHash === hash) keysToDelete.push(key);
    }
    for (const key of keysToDelete) this.cache.delete(key);
  }

  /** Evict the entire cache (e.g. after a forced catalog refresh). */
  invalidateAll(): void {
    this.cache.clear();
  }
}

const pageCache = new PageCache();


// ─── localStorage Helpers ─────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function safeLocalStorageGet(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // QuotaExceededError — silently ignore.
  }
}

function safeLocalStorageRemove(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the in-memory or localStorage cached snapshot immediately (sync),
 * or `null` if nothing is cached yet.
 *
 * Delegates to `getCachedCatalogSnapshot` from `catalog.ts`, which owns the
 * authoritative cache key and validates the `CatalogProduct` shape on read.
 */
export function getCachedShopperCatalogSnapshot(): CatalogSnapshot | null {
  return getCachedCatalogSnapshot();
}

/**
 * PRIMARY CATALOG FETCH — loads all 52 000+ products with maximum performance.
 *
 * Architecture:
 * 1. In-memory snapshot cache (instantaneous — zero network).
 * 2. localStorage slim-index (< 5 ms, survives page reload).
 * 3. Live Supabase fetch with automatic 1 000-row pagination.
 *
 * All caching, deduplication, normalization, and sorting are handled by
 * `catalog.ts`.  This function is a thin, error-recovering facade.
 *
 * @param forceRefresh — bypass all caches and re-fetch from the database.
 */
export async function fetchShopperCatalogSnapshot(
  forceRefresh = false,
): Promise<CatalogSnapshot> {
  // 1. Serve from in-memory / localStorage cache when possible.
  if (!forceRefresh) {
    const cached = getCachedShopperCatalogSnapshot();
    if (cached) return cached;
  }

  try {
    // 2. Fetch, normalize, deduplicate, and cache via catalog.ts.
    return await fetchCatalogSnapshot(forceRefresh);
  } catch (error) {
    console.error("[shopperCatalogApi] fetchShopperCatalogSnapshot failed:", error);

    // 3. Fallback to any stale cache rather than crashing the UI.
    const stale = getCachedShopperCatalogSnapshot();
    if (stale) {
      console.warn("[shopperCatalogApi] Serving stale cache due to fetch error.");
      return stale;
    }

    throw error;
  }
}

/**
 * Fetch a single page of products with server-side filtering and pagination.
 *
 * When a `searchQuery` is present the request is routed through the
 * `search_products` Supabase RPC (bilingual exact/prefix/fuzzy search).
 * All other filters and pagination behave identically for both paths.
 *
 * Fallback: if the RPC is not yet deployed or fails, the function transparently
 * retries with the standard ilike query so the UI never goes blank.
 *
 * Results are kept in the in-memory LRU page cache (TTL: 5 min for filtered
 * results, 15 min for unfiltered).
 */
export async function fetchProductsPage(
  pageNumber: number,
  filters: ProductFilters = {},
): Promise<PageResult> {
  const cached = pageCache.get(pageNumber, filters);
  if (cached) return cached;

  let products: CatalogProduct[] = [];
  let totalCount: number = 0;

  // The canonical RPC resolves promotions and applies every catalog/search
  // filter server-side. Do not fall back to a raw products-table query: that
  // would display stale base prices and bypass the promotion authority.
  const result = await fetchProductsPageRpc(pageNumber, filters);
  products = result.products;
  totalCount = result.totalCount;

  const pageResult: PageResult = {
    products,
    totalCount,
    hasNextPage: totalCount > pageNumber * PAGE_SIZE,
    currentPage: pageNumber,
    pageSize: PAGE_SIZE,
  };

  pageCache.set(pageNumber, filters, pageResult);
  return pageResult;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchProductsPageRpc(
  pageNumber: number,
  filters: ProductFilters,
): Promise<{ products: CatalogProduct[]; totalCount: number }> {
  const supabase = getSupabaseClient();

  let categoryAr: string | null = null;
  let categoryEn: string | null = null;
  if (filters.categoryId) {
    const names = getCategoryNamesById(filters.categoryId);
    if (names) {
      // Known seed slug — translate to its Arabic/English display names.
      categoryAr = names.name;
      categoryEn = names.nameEn;
    } else {
      // Live DB category name — pass it through directly to the RPC.
      categoryAr = filters.categoryId;
    }
  }
  const category = categoryAr ?? categoryEn;

  const rawQuery = filters.searchQuery?.trim() || null;
  const sort = filters.sortBy === "name" ? "name_asc" : filters.sortBy === "price_asc" || filters.sortBy === "price_desc" ? filters.sortBy : "newest";

  const { data, error } = await supabase.rpc("search_effective_products", {
    p_query: rawQuery,
    p_category: category ?? null,
    p_in_stock: filters.inStock ?? false,
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_is_sale: filters.isSale ?? false,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: (pageNumber - 1) * PAGE_SIZE,
  });

  if (error) throw new Error(`RPC failed: ${error.message}`);
  if (!data || !Array.isArray(data)) return { products: [], totalCount: 0 };

  const totalCount = Number((data[0] as Record<string, unknown> | undefined)?.total_count ?? 0);

  // The `search_products` RPC returns *lowercase* column names (name_ar,
  // name_en, category_name, …) — Postgres folds unquoted identifiers to lower-
  // case. The catalog normalizer reads the *quoted* schema columns (Name_Ar,
  // Name_En, Category_Name, …). Without this translation every row would be
  // dropped because `normalizeSupabaseProduct` couldn't find Name_Ar/Price/etc,
  // and the search would silently render "No matching products" even though
  // 2,000+ rows came back. That's the user-reported "search shows nothing" bug.
  interface RpcProductRow {
    id?:               string;
    code?:             string | null;
    barcode?:          string | null;
    name_ar?:          string | null;
    name_en?:          string | null;
    base_price?:       number | string | null;
    effective_price?:  number | string | null;
    stock?:            number | string | null;
    category_name?:    string | null;
    category_name_en?: string | null;
    image_url?:        string | null;
  }

  const toSchemaShape = (row: RpcProductRow): Record<string, unknown> => {
    const stockNum =
      typeof row.stock === "number"
        ? row.stock
        : Number.parseFloat(String(row.stock ?? "0"));
    const inStock = Number.isFinite(stockNum) && stockNum > 0;

    return {
      id:               row.id,
      Code:             row.code ?? "",
      Barcode:          row.barcode ?? "",
      Name_Ar:          row.name_ar ?? "",
      Name_En:          row.name_en ?? "",
      Name: row.name_en ?? row.name_ar ?? "",
      effective_price: row.effective_price ?? 0,
      base_price: row.base_price ?? row.effective_price ?? 0,
      Category_Name: row.category_name ?? "",
      Category_Name_En: row.category_name_en ?? "",
      Stock: Number.isFinite(stockNum) ? stockNum : 0,
      is_active: inStock,
      image_url: row.image_url ?? null,
      has_active_promotion: (row as Record<string, unknown>).has_active_promotion === true,
      discount_percent: (row as Record<string, unknown>).discount_percent,
      promotion_name: (row as Record<string, unknown>).promotion_name,
    };
  };

  const products = (data as RpcProductRow[])
    .map((row, i) =>
      normalizeSupabaseProduct(toSchemaShape(row), (pageNumber - 1) * PAGE_SIZE + i + 2),
    )
    .filter((p): p is CatalogProduct => p !== null);

  return { products, totalCount };
}

/**
 * Return the catalog's category list as quickly as possible.
 *
 * NEW (unification fix): the web now fetches categories from the same
 * `get_category_counts` RPC the native app uses. Previously the web showed 8
 * hard-coded buckets (medications, vitamins-supplements, …) that didn't line
 * up with the DB's actual `Category_Name` values, so most products appeared
 * uncategorised or under the wrong heading. By using the DB list, web and
 * mobile see the same shelves with the same counts.
 *
 * Priority:
 * 1. In-memory snapshot — already-derived categories (zero network).
 * 2. localStorage cache — survives reload, 30-min TTL.
 * 3. `get_category_counts` RPC — authoritative.
 * 4. Static seed list — final safety net (RPC offline / first cold start).
 */
async function fetchDbCategoriesViaRpc(): Promise<CatalogCategory[] | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("get_category_counts");
    if (error || !Array.isArray(data) || data.length === 0) return null;

    const rows = data as Array<{
      category_name:    string;
      category_name_en: string | null;
      product_count:    number;
      in_stock_count:   number;
    }>;

    // Build a CatalogCategory per DB row, normalising seeded categories to their
    // stable kebab-case IDs. This ensures the web category URLs and product
    // routing remain consistent even when the DB stores the live category names
    // as native Arabic or variant English labels.
    const categoriesMap = new Map<string, CatalogCategory>();

    for (const row of rows) {
      const dbName = (row.category_name ?? "").trim();
      if (!dbName) continue;
      const dbNameEn = (row.category_name_en ?? "").trim() || dbName;

      const seed = resolveCategory(dbName, dbNameEn, "", "");
      const categoryId = seed.id !== FALLBACK_CATEGORY_ID ? seed.id : dbName;
      const displayAr = seed.id !== FALLBACK_CATEGORY_ID ? seed.names.ar : stripEmoji(dbName);
      const displayEn = seed.id !== FALLBACK_CATEGORY_ID ? seed.names.en : stripEmoji(dbNameEn);

      const existing = categoriesMap.get(categoryId);
      if (existing) {
        existing.count += Number(row.product_count) || 0;
        existing.inStockCount += Number(row.in_stock_count) || 0;
        continue;
      }

      categoriesMap.set(categoryId, {
        id:            categoryId,
        name:          displayAr,
        nameEn:        displayEn,
        icon:          seed.icon,
        emoji:         seed.emoji,
        count:         Number(row.product_count) || 0,
        inStockCount:  Number(row.in_stock_count) || 0,
        descAr:        seed.desc.ar,
        descEn:        seed.desc.en,
        theme:         seed.theme,
        imageUrl:      seed.imageUrl,
        imagePosition: seed.imagePosition,
      });
    }

    return Array.from(categoriesMap.values()).sort(
      (a, b) => (b.count - a.count) || a.nameEn.localeCompare(b.nameEn, "en"),
    );
  } catch {
    return null;
  }
}

export async function fetchCategoriesQuick(): Promise<CatalogCategory[]> {
  // 1. In-memory snapshot — already consistent.
  const liveSnapshot = getCachedCatalogSnapshot();
  if (liveSnapshot?.categories.length) return liveSnapshot.categories;

  // 2. localStorage cache — instant before any network.
  const localCategories = readCachedCategories();
  if (localCategories && localCategories.length > 0) return localCategories;

  // 3. Authoritative: ask the DB for the real category list (matches mobile).
  const dbCategories = await fetchDbCategoriesViaRpc();
  if (dbCategories && dbCategories.length > 0) {
    writeCachedCategories(dbCategories);
    return dbCategories;
  }

  // 4. Safety net — static seed list if the RPC is offline.
  const staticCategories = getStaticCategoryList();
  writeCachedCategories(staticCategories);
  return staticCategories;
}

/**
 * Return the locally-cached category list synchronously, or `null` if the
 * cache is absent or expired.
 */
export function getCachedCategoriesQuick(): CatalogCategory[] | null {
  // Prefer the in-memory snapshot (always consistent, no serialisation cost).
  const liveSnapshot = getCachedCatalogSnapshot();
  if (liveSnapshot?.categories.length) return liveSnapshot.categories;

  return readCachedCategories();
}

/**
 * Prefetch a page into the in-memory cache (fire-and-forget).
 * Errors are silently swallowed — this is a best-effort optimisation.
 */
export async function prefetchProductsPage(
  pageNumber: number,
  filters: ProductFilters = {},
): Promise<void> {
  try {
    await fetchProductsPage(pageNumber, filters);
  } catch {
    // Intentionally silent.
  }
}

/**
 * Invalidate the entire in-memory page cache (e.g. after a forced catalog
 * refresh or a cart/stock mutation).
 */
export function invalidatePageCache(): void {
  pageCache.invalidateAll();
}

/**
 * Invalidate only the cached pages that match the given filter combination.
 */
export function invalidateFiltersCache(filters: ProductFilters): void {
  pageCache.invalidateFilters(filters);
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

interface CachedCategories {
  categories: CatalogCategory[];
  timestamp: number;
}

function readCachedCategories(): CatalogCategory[] | null {
  const raw = safeLocalStorageGet(CATEGORY_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed: CachedCategories = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.timestamp !== "number" ||
      !Array.isArray(parsed.categories)
    ) {
      safeLocalStorageRemove(CATEGORY_CACHE_KEY);
      return null;
    }

    if (Date.now() - parsed.timestamp > CATEGORY_CACHE_TTL_MS) {
      safeLocalStorageRemove(CATEGORY_CACHE_KEY);
      return null;
    }

    return parsed.categories;
  } catch {
    safeLocalStorageRemove(CATEGORY_CACHE_KEY);
    return null;
  }
}

function writeCachedCategories(categories: CatalogCategory[]): void {
  const payload: CachedCategories = { categories, timestamp: Date.now() };
  safeLocalStorageSet(CATEGORY_CACHE_KEY, JSON.stringify(payload));
}

/**
 * Fetch a specific set of products by UUID through the canonical pricing API.
 * Used by Cart and Favorites to resolve product IDs that are not in the page-1
 * in-memory cache. Returns an empty array on failure so callers can treat this
 * as best-effort.
 */
export async function fetchProductsByIds(ids: string[]): Promise<CatalogProduct[]> {
  if (ids.length === 0) return [];
  try {
    const supabase = getSupabaseClient();
    const rows = await Promise.all(ids.map(async (id) => {
      const { data, error } = await supabase.rpc("get_effective_product", { p_product_id: id });
      if (error || !Array.isArray(data) || !data[0]) return null;
      return normalizeSupabaseProduct(data[0] as Record<string, unknown>, 0);
    }));
    return rows.filter((product): product is CatalogProduct => product !== null);
  } catch {
    return [];
  }
}