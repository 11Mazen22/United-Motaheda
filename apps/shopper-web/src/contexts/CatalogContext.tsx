/**
 * CatalogContext — Shared catalog state for the entire app
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PERFORMANCE REFACTOR (the 30-second hang fix)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The previous version called `scheduleFullCatalogLoad()` automatically on
 * mount, which fetched ALL 52 000 products from Supabase via 53 HTTP requests.
 * Even when triggered via requestIdleCallback, the browser was forced to
 * execute it within 8 seconds (timeout: 8000), causing a major performance
 * spike that froze the UI.
 *
 * NEW BOOT PATH:
 *   1. Page-1 fetch (24 products) gives fast first paint — sub-second.
 *   2. Categories are loaded from localStorage cache (30-min TTL) or via a
 *      separate lightweight fetch — no full catalog needed.
 *   3. The Products page now uses `useInfiniteProducts` (server-paginated)
 *      so it never needs the full 52K dataset.
 *   4. `refreshCatalog()` is still available for admin pages that explicitly
 *      need the full catalog (e.g., product management dashboard).
 *
 * `useFullCatalog()` returns the full dataset when available (after an explicit
 * `refreshCatalog()` call from an admin page), but no longer auto-fetches it.
 */

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deriveCatalogCategories,
  buildSpotlightProducts,
  type CatalogCategory,
  type CatalogProduct,
} from "../app/catalog";
import {
  fetchProductsPage,
  fetchCategoriesQuick,
  getCachedCategoriesQuick,
  invalidatePageCache,
  fetchShopperCatalogSnapshot,
  getCachedShopperCatalogSnapshot,
  type ProductFilters,
  type PageResult,
} from "../services/shopperCatalogApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type CatalogMetrics = {
  totalProducts: number;
  totalCategories: number;
  inStockProducts: number;
  barcodedProducts: number;
  lowStockProducts: number;
};

export type SearchFilters = Omit<ProductFilters, "searchQuery">;

type CatalogContextType = {
  // ── Core data ─────────────────────────────────────────────────────────────
  products: CatalogProduct[];
  categories: CatalogCategory[];
  productsById: Record<string, CatalogProduct>;
  categoriesById: Record<string, CatalogCategory>;
  featuredProducts: CatalogProduct[];
  inStockProducts: CatalogProduct[];
  metrics: CatalogMetrics;
  lastUpdated: string | null;

  // ── Full catalog (background-loaded) ──────────────────────────────────────
  allProducts: CatalogProduct[];
  allProductsById: Record<string, CatalogProduct>;
  isFullCatalogReady: boolean;

  // ── Loading states ────────────────────────────────────────────────────────
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;

  // ── Pagination ────────────────────────────────────────────────────────────
  totalProductCount: number;
  hasNextPage: boolean;
  currentPage: number;
  activeFilters: ProductFilters;

  // ── Actions ───────────────────────────────────────────────────────────────
  loadNextPage: () => Promise<void>;
  search: (query: string, filters?: SearchFilters) => Promise<void>;
  filterByCategory: (categoryId: string | null) => Promise<void>;
  refreshCatalog: (forceRefresh?: boolean) => Promise<void>;
  refreshCategories: () => Promise<void>;
  upsertProduct: (product: CatalogProduct) => void;
  removeProduct: (identifier: string) => void;

};

// ─── Seed from cache ──────────────────────────────────────────────────────────

const initialSnapshot = getCachedShopperCatalogSnapshot();
const seedProducts = initialSnapshot?.products ?? [];
const seedCategories = getCachedCategoriesQuick() ?? [];

// ─── Context ──────────────────────────────────────────────────────────────────

const CatalogContext = createContext<CatalogContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CatalogProvider({ children }: { children: ReactNode }) {
  // ── Display-layer state (what the grid shows) ──────────────────────────────
  const [products, setProducts] = useState<CatalogProduct[]>(
    seedProducts.length > 0 ? seedProducts : [],
  );
  const [productMap, setProductMap] = useState<Record<string, CatalogProduct>>(
    () => Object.fromEntries(seedProducts.map((p) => [p.id, p])),
  );
  const [isLoading, setIsLoading] = useState(seedProducts.length === 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(
    initialSnapshot?.lastUpdated ?? null,
  );
  const [totalProductCount, setTotalCount] = useState(seedProducts.length);
  const [currentPage, setCurrentPage] = useState(1);
  // hasNextPage is true only in the pre-full-catalog window (server pagination)
  const [hasNextPage, setHasNextPage] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ProductFilters>({});

  // ── Full-catalog state (background, stable for worker init) ───────────────
  const [allProducts, setAllProducts] = useState<CatalogProduct[]>(seedProducts);
  const [allProductsMap, setAllProductsMap] = useState<Record<string, CatalogProduct>>(
    () => Object.fromEntries(seedProducts.map((p) => [p.id, p])),
  );
  const [isFullCatalogReady, setIsFullCatalogReady] = useState(seedProducts.length > 0);

  // ── Categories ────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<CatalogCategory[]>(seedCategories);

  // ── Ref guards ────────────────────────────────────────────────────────────
  const isLoadingMoreRef = useRef(false);

  // ── applyPageResult ───────────────────────────────────────────────────────

  const applyPageResult = useCallback(
    (result: PageResult, page: number, append: boolean) => {
      startTransition(() => {
        setProductMap((prev) => {
          const next = append ? { ...prev } : {};
          result.products.forEach((p) => { next[p.id] = p; });
          return next;
        });
        setProducts((prev) =>
          append ? [...prev, ...result.products] : result.products,
        );
        if (result.totalCount >= 0) setTotalCount(result.totalCount);
        setCurrentPage(page);
        setHasNextPage(result.hasNextPage);
        setIsLoading(false);
        setIsLoadingMore(false);
        setLastUpdated(new Date().toISOString());
        setError(null);
      });
      isLoadingMoreRef.current = false;
    },
    [],
  );

  // ── Mount: page-1 fetch for fast first paint ──────────────────────────────
  //
  // We fetch ONLY the first page (24 products) on mount. This gives sub-second
  // first paint without loading all 52K products into the client.
  //
  // The full catalog is no longer loaded automatically. Pages that need the
  // full dataset (admin product manager) call `refreshCatalog()` explicitly.
  // The Products page uses `useInfiniteProducts` (server-paginated) so it
  // never needs the full catalog at all.

  useEffect(() => {
    if (seedProducts.length > 0) {
      // Cache warm — products are already available from localStorage.
      // No background fetch needed; the Products page handles its own pagination.
      return;
    }

    // Cold start — fetch page 1 immediately for first paint.
    // Emergency timer: if Supabase hangs (free-tier cold start, network issue),
    // force isLoading = false after 12 s so the UI is never blocked indefinitely.
    let settled = false;
    const emergencyTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setIsLoading(false);
      }
    }, 12_000);

    void (async () => {
      try {
        const result = await fetchProductsPage(1, {});
        settled = true;
        clearTimeout(emergencyTimer);
        applyPageResult(result, 1, false);
      } catch (err) {
        settled = true;
        clearTimeout(emergencyTimer);
        setError(err instanceof Error ? err.message : "Failed to load catalog");
        setIsLoading(false);
      }
    })();

    return () => {
      settled = true;
      clearTimeout(emergencyTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Categories: load if missing ───────────────────────────────────────────

  const refreshCategories = useCallback(async () => {
    try {
      const cats = await fetchCategoriesQuick();
      startTransition(() => setCategories(cats));
    } catch (err) {
      console.error("[CatalogContext] fetchCategoriesQuick failed:", err);
    }
  }, []);

  // Always refresh categories on mount — even when the seed cache produced a
  // non-empty list. The seed only reflects what was in localStorage at the
  // time the module loaded; the authoritative list lives in Supabase
  // (`get_category_counts` RPC) and must be re-pulled so the sidebar matches
  // the live DB instead of showing a stale snapshot.
  useEffect(() => {
    void refreshCategories();
  }, [refreshCategories]);

  // ── loadNextPage ──────────────────────────────────────────────────────────

  const loadNextPage = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasNextPage || isFullCatalogReady) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const result = await fetchProductsPage(nextPage, activeFilters);
      applyPageResult(result, nextPage, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [currentPage, hasNextPage, activeFilters, applyPageResult, isFullCatalogReady]);

  // ── search (server-side) ──────────────────────────────────────────────────

  const search = useCallback(async (query: string, extraFilters?: SearchFilters) => {
    const filters: ProductFilters = { ...extraFilters, searchQuery: query };
    setActiveFilters(filters);
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchProductsPage(1, filters);
      applyPageResult(result, 1, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setIsLoading(false);
    }
  }, [applyPageResult]);

  // ── filterByCategory (server-side) ───────────────────────────────────────

  const filterByCategory = useCallback(async (categoryId: string | null) => {
    const filters: ProductFilters = categoryId ? { categoryId } : {};
    setActiveFilters(filters);
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchProductsPage(1, filters);
      applyPageResult(result, 1, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Filter failed");
      setIsLoading(false);
    }
  }, [applyPageResult]);

  // ── refreshCatalog ────────────────────────────────────────────────────────
  //
  // Explicitly loads the full 52K catalog. Called by admin pages (product
  // manager, dashboard) that need the complete dataset. NOT called automatically
  // on mount — that was the source of the 30-second hang.

  const refreshCatalog = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await fetchShopperCatalogSnapshot(forceRefresh);
      startTransition(() => {
        setAllProducts(snapshot.products);
        setAllProductsMap(
          Object.fromEntries(snapshot.products.map((p) => [p.id, p])),
        );
        setIsFullCatalogReady(true);
        // Note: deliberately NOT calling setCategories(snapshot.categories)
        // here. snapshot.categories is built from the legacy CATEGORY_SEEDS
        // map and would clobber the live DB-driven category list pulled via
        // `refreshCategories()`. The full-catalog refresh is for product data
        // only; categories stay sourced from `get_category_counts` so the web
        // sidebar mirrors the mobile app.
        setTotalCount(snapshot.products.length);
        setIsLoading(false);
        setLastUpdated(new Date().toISOString());
        setError(null);
      });
      invalidatePageCache();
      // Pull fresh DB categories after a full refresh in case counts moved.
      void refreshCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
      setIsLoading(false);
    }
  }, [refreshCategories]);

  // ── upsertProduct / removeProduct (optimistic mutations) ─────────────────

  const upsertProduct = useCallback((product: CatalogProduct) => {
    const merge = (prev: CatalogProduct[]) => {
      const idx = prev.findIndex(
        (p) => p.id === product.id || p.code === product.code,
      );
      if (idx === -1) return [product, ...prev];
      return prev.map((p, i) => (i === idx ? product : p));
    };
    startTransition(() => {
      setProductMap((prev) => ({ ...prev, [product.id]: product }));
      setProducts(merge);
      setAllProductsMap((prev) => ({ ...prev, [product.id]: product }));
      setAllProducts(merge);
      setLastUpdated(new Date().toISOString());
    });
  }, []);

  const removeProduct = useCallback((identifier: string) => {
    const exclude = (prev: CatalogProduct[]) =>
      prev.filter((p) => p.id !== identifier && p.code !== identifier);
    startTransition(() => {
      setProductMap((prev) => {
        const next = { ...prev };
        delete next[identifier];
        return next;
      });
      setProducts(exclude);
      setAllProductsMap((prev) => {
        const next = { ...prev };
        delete next[identifier];
        return next;
      });
      setAllProducts(exclude);
      setLastUpdated(new Date().toISOString());
    });
  }, []);

  // ── Derived values (prefer full catalog for accuracy) ─────────────────────

  const catalogSource = allProducts.length > 0 ? allProducts : products;

  // `deriveCatalogCategories` always rebuilds the list from the hard-coded
  // CATEGORY_SEEDS (the 8 legacy buckets). That overrides whatever DB-driven
  // category list we just loaded via `refreshCategories`. Detect that case and
  // pass through the live `categories` state instead — that's what unifies the
  // web's category sidebar with the mobile app.
  //
  // We treat the state as authoritative whenever it has any non-seed id (the
  // seed ids are stable kebab-case slugs; DB names contain Arabic or spaces).
  const isDbDrivenList = useMemo(() => {
    if (categories.length === 0) return false;
    // Seed ids are kebab-case ASCII; DB ids are full category names. If we
    // see even one non-seed-shaped id, the list came from the DB.
    return categories.some((c) => /[^a-z0-9-]/i.test(c.id));
  }, [categories]);

  const derivedCategories = useMemo(
    () => (isDbDrivenList ? categories : deriveCatalogCategories(catalogSource, categories)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogSource, categories, isDbDrivenList],
  );

  const productsById = useMemo(() => productMap, [productMap]);

  const categoriesById = useMemo(
    () =>
      derivedCategories.reduce<Record<string, CatalogCategory>>((acc, cat) => {
        acc[cat.id] = cat;
        return acc;
      }, {}),
    [derivedCategories],
  );

  const inStockProducts = useMemo(
    () => catalogSource.filter((p) => p.inStock),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogSource],
  );

  const featuredProducts = useMemo(
    () => buildSpotlightProducts(catalogSource, derivedCategories, 180),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogSource, derivedCategories],
  );

  const metrics = useMemo<CatalogMetrics>(() => {
    return {
      totalProducts: totalProductCount > 0 ? totalProductCount : catalogSource.length,
      totalCategories: derivedCategories.length,
      inStockProducts: inStockProducts.length,
      barcodedProducts: catalogSource.filter((p) => Boolean(p.barcode)).length,
      lowStockProducts: inStockProducts.filter((p) => p.stock <= 5).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogSource, derivedCategories, inStockProducts, totalProductCount]);

  // ── Context value ─────────────────────────────────────────────────────────

  return (
    <CatalogContext.Provider
      value={{
        products,
        categories: derivedCategories,
        productsById,
        categoriesById,
        featuredProducts,
        inStockProducts,
        metrics,
        lastUpdated,
        allProducts,
        allProductsById: allProductsMap,
        isFullCatalogReady,
        isLoading,
        isLoadingMore,
        error,
        totalProductCount,
        hasNextPage,
        currentPage,
        activeFilters,
        loadNextPage,
        search,
        filterByCategory,
        refreshCatalog,
        refreshCategories,
        upsertProduct,
        removeProduct,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

// ─── useCatalogOptional ───────────────────────────────────────────────────────

export function useCatalogOptional() {
  return useContext(CatalogContext);
}

// ─── useCatalog ───────────────────────────────────────────────────────────────

export function useCatalog(): CatalogContextType {
  const ctx = useCatalogOptional();
  if (process.env.NODE_ENV !== "production" && ctx === null) {
    throw new Error(
      "[CatalogContext] useCatalog() was called outside <CatalogProvider>. " +
      "Wrap the route tree in <CatalogShell> (see App.tsx).",
    );
  }
  return ctx as CatalogContextType;
}

// ─── useFullCatalog ───────────────────────────────────────────────────────────

/** Returns the stable full-catalog dataset for worker init and admin pages. */
export function useFullCatalog() {
  const ctx = useContext(CatalogContext);
  if (process.env.NODE_ENV !== "production" && ctx === null) {
    throw new Error(
      "[CatalogContext] useFullCatalog() was called outside <CatalogProvider>.",
    );
  }
  const c = ctx as CatalogContextType;
  return {
    allProducts:       c.allProducts,
    allProductsById:   c.allProductsById,
    isFullCatalogReady: c.isFullCatalogReady,
  };
}
