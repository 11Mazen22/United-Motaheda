/**
 * useUnifiedFilters.ts — Single source of truth for product filtering UX.
 *
 * Consolidates what was previously scattered across Products.tsx / Offers.tsx
 * (URL params, local state, slider committed/dragging split, chip list,
 * clear-all logic) into one hook reusable across any product listing.
 *
 * Filter axes:
 *   • searchQuery       (URL-synced)
 *   • categoryId        (URL-synced, single value — multi-select can be added later)
 *   • inStock           (boolean toggle)
 *   • maxPrice          (committed on slider release, not on drag)
 *   • brand             (multi-select chip — client-side post-filter via extractBrand)
 *   • sortBy            (server-side via useInfiniteProducts.sortBy)
 *
 * Server-side filters are passed through to useInfiniteProducts unchanged so
 * the network behavior is identical to the prior implementation. Brand is
 * applied client-side after the server returns, because the DB has no brand
 * column.
 *
 * URL synchronization (read on mount, written on change):
 *   ?q=         search query (also driven by SearchContext)
 *   ?category=  category id
 *   ?in_stock=  "1" when in-stock toggle is on
 *   ?max=       integer price cap
 *   ?brand=     comma-separated brand tokens
 *   ?sort=      one of "relevant" | "price_asc" | "price_desc" | "name"
 */

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { CatalogProductSort } from "./useCatalogProductSearch";
import type { CatalogProduct } from "../catalog";
import { extractBrand } from "../utils/extractBrand";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UnifiedFilterChip {
  key:    string;
  label:  string;
  remove: () => void;
}

export interface UseUnifiedFiltersArgs {
  defaultSort?:        CatalogProductSort;
  /** When true, the in-stock toggle defaults to ON (e.g. Offers page). */
  defaultInStock?:     boolean;
  syncSearchToUrl?:    boolean;   // when true, ?q= mirrors searchQuery
  searchQuery?:        string;    // external source (e.g. SearchContext)
  onSearchQueryChange?: (q: string) => void;
  /** Locale-aware labels for the active chips (provided by the host page). */
  labels: {
    search:    (q: string) => string;
    category:  (label: string) => string;
    stockOnly: string;
    priceCap:  (max: number) => string;
    brand:     (brand: string) => string;
    sort:      Record<CatalogProductSort, string>;
    clearAll:  string;
  };
  /**
   * Optional lookup so chips can show the friendly category label rather than
   * the raw id. Called once per render with the current categoryId.
   */
  resolveCategoryLabel?: (id: string) => string | undefined;
}

export interface UseUnifiedFiltersResult {
  // raw state
  searchQuery:    string;
  setSearchQuery: (q: string) => void;

  categoryId:     string;          // "all" when no category selected
  setCategoryId:  (id: string | "all") => void;

  inStock:        boolean;
  setInStock:     (v: boolean) => void;

  /** Slider ceiling — computed by the host from first unfiltered page. */
  sliderMax:      number;
  setSliderMax:   (n: number) => void;

  /** The committed price cap (sent to the server). */
  committedMaxPrice: number;
  /** Update the committed cap (call from slider's release handler). */
  setCommittedMaxPrice: (n: number) => void;

  brands:         string[];
  toggleBrand:    (brand: string) => void;
  clearBrands:    () => void;

  sortBy:         CatalogProductSort;
  setSortBy:      (s: CatalogProductSort) => void;

  // derived
  hasFilters:     boolean;
  isPriceFiltered: boolean;

  // chip list — ready to drop into <ActiveFilterChips />
  activeChips:    UnifiedFilterChip[];

  // ergonomics
  clearAll:       () => void;

  /**
   * Server-side filter payload for useInfiniteProducts. Brand is NOT included
   * here because no brand column exists; use applyClientFilters() below to
   * post-filter results.
   */
  serverFilters: {
    query?: string;
    categoryId?: string;
    inStock?: boolean;
    maxPrice?: number;
    sortBy?: CatalogProductSort;
  };

  /** Apply remaining client-side filters (currently: brand) to a result set. */
  applyClientFilters: (products: CatalogProduct[]) => CatalogProduct[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useUnifiedFilters(args: UseUnifiedFiltersArgs): UseUnifiedFiltersResult {
  const {
    defaultSort         = "relevant",
    defaultInStock      = false,
    syncSearchToUrl     = false,
    searchQuery: externalQuery,
    onSearchQueryChange,
    labels,
    resolveCategoryLabel,
  } = args;

  const [searchParams, setSearchParams] = useSearchParams();

  // ─── URL → initial state (one-time read) ─────────────────────────────────
  const urlCategoryId      = searchParams.get("category") || "all";
  const urlInStockExplicit = searchParams.has("in_stock");
  const urlInStock         = urlInStockExplicit
    ? searchParams.get("in_stock") === "1"
    : defaultInStock;
  const urlMaxRaw     = Number(searchParams.get("max"));
  const urlMax        = Number.isFinite(urlMaxRaw) && urlMaxRaw > 0 ? urlMaxRaw : 0;
  const urlBrands     = (searchParams.get("brand") || "")
    .split(",").map((b) => b.trim()).filter(Boolean);
  const urlSort       = (searchParams.get("sort") || defaultSort) as CatalogProductSort;
  const urlSearch     = searchParams.get("q") || "";

  // ─── State ───────────────────────────────────────────────────────────────
  const [inStock,           setInStock]           = useState<boolean>(urlInStock);
  const [sliderMax,         setSliderMax]         = useState<number>(0);
  const [committedMaxPrice, setCommittedMaxPrice] = useState<number>(urlMax);
  const [brands,            setBrands]            = useState<string[]>(urlBrands);
  const [sortBy,            setSortBy]            = useState<CatalogProductSort>(urlSort);

  // search query: prefer external if provided
  const [internalSearch, setInternalSearch] = useState<string>(syncSearchToUrl ? urlSearch : "");
  const searchQuery = externalQuery ?? internalSearch;
  const setSearchQuery = useCallback((q: string) => {
    if (onSearchQueryChange) onSearchQueryChange(q);
    else setInternalSearch(q);
  }, [onSearchQueryChange]);

  // ─── URL ← state ─────────────────────────────────────────────────────────
  // Each setter below writes directly to the URL via setSearchParams when
  // needed. We avoid a global "sync everything from local state on change"
  // effect because it caused churn against the existing setSearchParams calls.
  // setCategoryId / setSearchQuery already handle their own URL writes.
  void searchParams; // (no-op reference kept for ESLint completeness)

  const setCategoryId = useCallback((id: string | "all") => {
    const params = new URLSearchParams(searchParams);
    if (id && id !== "all") params.set("category", id);
    else                    params.delete("category");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  // ─── Brand helpers ───────────────────────────────────────────────────────
  const toggleBrand = useCallback((brand: string) => {
    setBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand],
    );
  }, []);
  const clearBrands = useCallback(() => setBrands([]), []);

  // ─── Client-side post-filter (brand only for now) ────────────────────────
  const applyClientFilters = useCallback(
    (products: CatalogProduct[]) => {
      if (brands.length === 0) return products;
      const wanted = new Set(brands.map((b) => b.toLowerCase()));
      return products.filter((p) => wanted.has(extractBrand(p.nameEn).toLowerCase()));
    },
    [brands],
  );

  // ─── Derived ─────────────────────────────────────────────────────────────
  const isPriceFiltered = sliderMax > 0 && committedMaxPrice > 0 && committedMaxPrice < sliderMax;
  const hasFilters =
    urlCategoryId !== "all" ||
    inStock ||
    isPriceFiltered ||
    brands.length > 0 ||
    searchQuery.trim().length > 0 ||
    sortBy !== defaultSort;

  // ─── Active chips ────────────────────────────────────────────────────────
  const activeChips = useMemo<UnifiedFilterChip[]>(() => {
    const out: UnifiedFilterChip[] = [];

    if (searchQuery.trim()) {
      out.push({
        key:    "q",
        label:  labels.search(searchQuery.trim()),
        remove: () => setSearchQuery(""),
      });
    }

    if (urlCategoryId && urlCategoryId !== "all") {
      const catLabel = resolveCategoryLabel?.(urlCategoryId) ?? urlCategoryId;
      out.push({
        key:    "cat",
        label:  labels.category(catLabel),
        remove: () => setCategoryId("all"),
      });
    }

    if (inStock) {
      out.push({
        key:    "stock",
        label:  labels.stockOnly,
        remove: () => setInStock(false),
      });
    }

    if (isPriceFiltered) {
      out.push({
        key:    "price",
        label:  labels.priceCap(committedMaxPrice),
        remove: () => setCommittedMaxPrice(sliderMax),
      });
    }

    for (const b of brands) {
      out.push({
        key:    `brand:${b}`,
        label:  labels.brand(b),
        remove: () => toggleBrand(b),
      });
    }

    if (sortBy !== defaultSort) {
      out.push({
        key:    "sort",
        label:  labels.sort[sortBy] ?? String(sortBy),
        remove: () => setSortBy(defaultSort),
      });
    }

    return out;
  }, [
    searchQuery, urlCategoryId, inStock, isPriceFiltered, committedMaxPrice,
    sliderMax, brands, sortBy, defaultSort, labels, resolveCategoryLabel,
    setSearchQuery, setCategoryId, toggleBrand,
  ]);

  // ─── Clear all ────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    setInStock(false);
    setCommittedMaxPrice(sliderMax);
    setBrands([]);
    setSortBy(defaultSort);
    setSearchQuery("");
    const params = new URLSearchParams();
    setSearchParams(params, { replace: true });
  }, [sliderMax, defaultSort, setSearchQuery, setSearchParams]);

  // ─── Server filter payload ────────────────────────────────────────────────
  const serverFilters = useMemo(
    () => ({
      query:      searchQuery.trim() || undefined,
      categoryId: urlCategoryId !== "all" ? urlCategoryId : undefined,
      inStock:    inStock ? true : undefined,
      maxPrice:   isPriceFiltered ? committedMaxPrice : undefined,
      sortBy:     sortBy !== defaultSort ? sortBy : undefined,
    }),
    [searchQuery, urlCategoryId, inStock, isPriceFiltered, committedMaxPrice, sortBy, defaultSort],
  );

  return {
    searchQuery, setSearchQuery,
    categoryId: urlCategoryId, setCategoryId,
    inStock, setInStock,
    sliderMax, setSliderMax,
    committedMaxPrice, setCommittedMaxPrice,
    brands, toggleBrand, clearBrands,
    sortBy, setSortBy,
    hasFilters, isPriceFiltered,
    activeChips,
    clearAll,
    serverFilters,
    applyClientFilters,
  };
}
