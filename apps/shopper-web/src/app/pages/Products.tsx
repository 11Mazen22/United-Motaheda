"use client";

/**
 * Products.tsx — Full product catalog page
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DATA FLOW (for Bara'a)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Before this refactor:
 *   useCatalog()              → fetches all 52K products (30-second hang)
 *   useCatalogProductSearch() → client-side fuzzy worker (requires all 52K)
 *
 * After this refactor:
 *   useInfiniteProducts()     → fetches only 24 at a time from Supabase
 *     ↑ wired to VirtuosoGrid.endReached for automatic next-page loading
 *   useCatalog()              → used ONLY for the category sidebar list
 *     (categories are cached in localStorage — no extra network cost)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SEARCH FLOW
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   User types in the global search bar (SiteSearchField)
 *     → SearchContext.searchQuery updates
 *     → useInfiniteProducts sees the new query
 *     → 300ms debounce (no network call until the user pauses)
 *     → Supabase .ilike('%query%', Name_Ar | Name_En | Code | Barcode)
 *     → 24 matching results appear
 *     → Scrolling loads 24 more, etc.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CATEGORY / FILTER FLOW
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   URL ?category=medications
 *     → passed to useInfiniteProducts as `categoryId`
 *     → shopperCatalogApi resolves slug → Arabic/English names
 *     → Supabase .ilike(Category_Name | Category_Name_En)
 *
 *   In-stock toggle → passed as `inStock: true`
 *     → Supabase .eq("is_active", true)
 *
 *   Price cap → passed as `maxPrice`
 *     → Supabase .lte("Price", maxPrice)
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  LayoutGrid,
  PackageSearch,
  SlidersHorizontal,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSearchInput } from "../../contexts/SearchContext";
import { useCatalog } from "../../contexts/CatalogContext";
import { useIsShopperShell } from "../components/ui/use-mobile";
import { getLocalizedCategoryName } from "../localization";
import { useInfiniteProducts } from "../hooks/useInfiniteProducts";
import { ProductGrid } from "../components/ProductGrid";
import { CatalogSkeletonGrid } from "../components/CatalogPrimitives";
import type { CatalogProductSort } from "../hooks/useCatalogProductSearch";
import { MobileProductsView } from "./ShopperMobileViews";
import { FilterSidebar } from "../components/FilterSidebar";
import type { FilterCategory } from "../components/FilterSidebar";
import { cn } from "../components/UI";

// ─── Sort options (UI only — sorting is handled server-side via shopperCatalogApi) ──

type SortOption = {
  value: CatalogProductSort;
  labelAr: string;
  labelEn: string;
  Icon: React.ElementType;
};

const SORT_OPTIONS: readonly SortOption[] = [
  { value: "relevant",   labelAr: "الأكثر صلة", labelEn: "Relevant",  Icon: Sparkles   },
  { value: "price_asc",  labelAr: "السعر ↑",    labelEn: "Price ↑",   Icon: TrendingUp  },
  { value: "price_desc", labelAr: "السعر ↓",    labelEn: "Price ↓",   Icon: TrendingDown },
  { value: "name",       labelAr: "الاسم أ–ي",  labelEn: "Name A–Z",  Icon: ArrowUpDown },
];

// ─── SortSegment ──────────────────────────────────────────────────────────────

function SortSegment({
  options,
  value,
  lang,
  onChange,
}: {
  options: readonly SortOption[];
  value: string;
  lang: "ar" | "en";
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200/70 bg-slate-100/60 p-1">
      {options.map((opt) => {
        const Icon = opt.Icon;
        const active = value === opt.value;
        const label = lang === "ar" ? opt.labelAr : opt.labelEn;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black transition-all duration-200",
              active
                ? "bg-white text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/60"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Icon className={cn("h-3 w-3 shrink-0", active ? "text-teal-500" : "text-slate-400")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── ProductEmptyState ────────────────────────────────────────────────────────

function ProductEmptyState({
  lang,
  hasFilters,
  onReset,
}: {
  lang: "ar" | "en";
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.8rem] border border-slate-200/80 bg-white/92 p-12 text-center shadow-sm backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <PackageSearch className="h-7 w-7 text-slate-400" />
        </div>
        <h2 className="mt-5 text-xl font-black tracking-tight text-slate-900">
          {lang === "ar" ? "لا توجد نتائج" : "No results found"}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">
          {lang === "ar"
            ? "جرّب توسيع البحث أو إزالة بعض الفلاتر."
            : "Try widening the search or clearing some filters."}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5"
          >
            <X className="h-3.5 w-3.5" />
            {lang === "ar" ? "إعادة الضبط" : "Reset filters"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Products() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <MobileProductsView />;
  return <ProductsDesktop />;
}

// ─── Desktop view ─────────────────────────────────────────────────────────────

function ProductsDesktop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { lang, t } = useLanguage();

  // `useCatalog()` is used ONLY for the category sidebar list.
  // The category data is cached in localStorage (30-min TTL) so this is fast.
  // We no longer use it to get products — that comes from useInfiniteProducts below.
  const { categories } = useCatalog();

  const { searchQuery, setSearchQuery } = useSearchInput();

  const [sortBy, setSortBy] = useState<CatalogProductSort>("relevant");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [priceRange, setPriceRange] = useState(0);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const activeCategory = searchParams.get("category") || "all";

  // ── Server-side paginated product feed ────────────────────────────────────
  //
  // This hook replaces both `useCatalog().products` and `useCatalogProductSearch()`.
  // It sends ONE Supabase request for 24 products and appends more on scroll.
  // The query is debounced 300ms inside the hook — no extra debounce needed here.
  //
  // Sort is mapped to the ProductFilters.sortBy field which buildSupabaseQuery
  // translates to Supabase `.order()` calls — all sorting happens in the DB.
  const {
    products,
    isLoading,
    isFetchingNext,
    fetchNextPage,
    hasNextPage,
    totalCount,
    activeQuery,
    error,
  } = useInfiniteProducts({
    query:      searchQuery,
    categoryId: activeCategory !== "all" ? activeCategory : undefined,
    inStock:    onlyInStock ? true : undefined,
    // Only apply price cap when the user has explicitly lowered it from the max.
    maxPrice:   priceRange > 0 ? priceRange : undefined,
    // sortBy is translated to Supabase .order() calls server-side.
    sortBy:     sortBy !== "relevant" ? sortBy : undefined,
  });

  // ── Derive max price from first-page results ──────────────────────────────
  // This gives an approximate max (from the first 24 products) for the price
  // slider. It's not the global max of all 52K products, but it's fast and
  // sufficient for filtering within a reasonable price range.
  const maxPrice = useMemo(() => {
    if (products.length === 0) return 1000;
    return Math.ceil(Math.max(...products.map((p) => p.price)) / 50) * 50;
  }, [products]);

  useEffect(() => {
    if (maxPrice > 0) {
      setPriceRange((cur) => (cur > 0 ? Math.min(cur, maxPrice) : maxPrice));
    }
  }, [maxPrice]);

  // ── Category sidebar options ──────────────────────────────────────────────

  const categoryOptions = useMemo(
    () => [
      {
        id: "all",
        label: lang === "ar" ? "الكل" : "All",
        count: totalCount,
      },
      ...categories.map((c) => ({
        id: c.id,
        label: getLocalizedCategoryName(c, lang),
        count: c.count,
      })),
    ],
    [categories, totalCount, lang],
  );

  // ── Filter state helpers ──────────────────────────────────────────────────

  const activeCategoryLabel = categoryOptions.find((c) => c.id === activeCategory)?.label;
  const isPriceFiltered = maxPrice > 0 && priceRange < maxPrice;
  const hasFilters =
    activeCategory !== "all" ||
    onlyInStock ||
    isPriceFiltered ||
    searchQuery.trim().length > 0;

  const clearAll = () => {
    setSortBy("relevant");
    setOnlyInStock(false);
    setPriceRange(maxPrice);
    setSearchQuery("");
    setSearchParams(new URLSearchParams());
  };

  const updateCategory = (nextCat: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (nextCat) next.set("category", nextCat);
    else next.delete("category");
    setSearchParams(next);
  };

  const activeFilterTags = [
    activeCategory !== "all" && activeCategoryLabel
      ? { key: "cat", label: activeCategoryLabel, onRemove: () => updateCategory(null) }
      : null,
    searchQuery.trim()
      ? { key: "q", label: `"${searchQuery.trim()}"`, onRemove: () => setSearchQuery("") }
      : null,
    onlyInStock
      ? { key: "stock", label: lang === "ar" ? "المتاح فقط" : "In stock only", onRemove: () => setOnlyInStock(false) }
      : null,
    isPriceFiltered
      ? {
          key: "price",
          label:
            lang === "ar"
              ? `حتى ${priceRange.toFixed(0)} ${t("currency")}`
              : `Up to ${priceRange.toFixed(0)} ${t("currency")}`,
          onRemove: () => setPriceRange(maxPrice),
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const sidebarCategoryOptions: FilterCategory[] = categoryOptions;

  // Show skeleton grid only when we have NO products and the first page is loading.
  // Once we have any products, we keep them visible even during filter changes.
  const showInitialSkeleton = isLoading && products.length === 0;

  return (
    <div className="products-page min-h-screen bg-[linear-gradient(165deg,#f0fafa_0%,#f7fafb_50%,#fafafa_100%)]">
      <div className="page-section py-6 pb-14">
        {/* ── Hero Banner ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5 overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/92 shadow-[0_4px_28px_rgba(15,23,42,0.07)] backdrop-blur-xl"
        >
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-teal-200/80 bg-teal-50 px-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">
                <LayoutGrid className="h-3 w-3" />
                {lang === "ar" ? "كتالوج المنتجات" : "Product catalog"}
              </span>
              {/* Server-side search indicator */}
              {isFetchingNext && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700"
                >
                  <Zap className="h-3 w-3" />
                  {lang === "ar" ? "تحميل المزيد" : "Loading more"}
                </motion.span>
              )}
            </div>

            <div>
              <h1 className="text-[1.75rem] font-black tracking-tight text-slate-950">
                {lang === "ar" ? "تصفح الكتالوج الكامل" : "Browse the full catalog"}
              </h1>
              <p className="mt-1.5 max-w-xl text-[13px] font-semibold leading-6 text-slate-500">
                {lang === "ar"
                  ? "ابحث وفلتر وصنّف المنتجات للعثور على ما تحتاجه بسرعة."
                  : "Search, filter, and sort products to find exactly what you need."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/categories"
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white px-3.5 text-xs font-black text-slate-600 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-teal-500" />
                {lang === "ar" ? "خريطة الأقسام" : "Category map"}
              </Link>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 pl-3 pr-2 text-xs font-black text-teal-700 transition-colors hover:bg-teal-100"
                >
                  {searchQuery.trim()}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Sort bar + mobile filter toggle ──────────── */}
        <div className="catalog-controls-stick z-30 mb-6 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/97 px-5 py-3.5 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50 px-3 text-[11px] font-black text-slate-700">
              <Tag className="h-3 w-3 text-teal-500" />
              {/* Show total count when available, otherwise a loading placeholder */}
              {totalCount > 0
                ? (lang === "ar" ? `${totalCount.toLocaleString()} منتج` : `${totalCount.toLocaleString()} products`)
                : (lang === "ar" ? "المنتجات" : "Products")}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-600 transition-colors hover:bg-rose-100"
              >
                <X className="h-3 w-3" />
                {lang === "ar" ? "مسح الكل" : "Clear all"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <SortSegment
                options={SORT_OPTIONS}
                value={sortBy}
                lang={lang}
                onChange={(v) => setSortBy(v as CatalogProductSort)}
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-black text-slate-700 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50 lg:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-teal-500" />
              {lang === "ar" ? "الفلاتر" : "Filters"}
              {hasFilters && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[9px] font-black text-white">
                  {activeFilterTags.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="page-section-row pb-14" style={{ overflow: "visible" }}>
        <div className="flex gap-6 items-start">
          <FilterSidebar
            lang={lang}
            mobileOpen={mobileFilterOpen}
            onMobileClose={() => setMobileFilterOpen(false)}
            onlyInStock={onlyInStock}
            onInStockChange={setOnlyInStock}
            categories={sidebarCategoryOptions}
            activeCategory={activeCategory}
            onCategoryChange={(id) => updateCategory(id === "all" ? null : id)}
            priceRange={[0, priceRange]}
            maxPrice={maxPrice}
            onPriceRangeChange={([, max]) => setPriceRange(max)}
            currency={t("currency")}
            totalResults={totalCount}
            hasFilters={hasFilters}
            onClearAll={clearAll}
          />

          <div className="min-w-0 flex-1">
            {error ? (
              /* ── Error state ── */
              <div className="rounded-[1.8rem] border border-rose-200/80 bg-rose-50/80 p-10 text-center shadow-sm">
                <p className="text-sm font-black text-rose-700">
                  {lang === "ar"
                    ? "حدث خطأ أثناء تحميل المنتجات."
                    : "An error occurred while loading products."}
                </p>
                <p className="mt-2 text-sm text-rose-600">{error}</p>
              </div>
            ) : showInitialSkeleton ? (
              /* ── Initial skeleton grid ── */
              <CatalogSkeletonGrid count={8} />
            ) : products.length > 0 ? (
              /* ── Product grid with infinite scroll ── */
              <>
                <div className="mb-4 px-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {lang === "ar" ? "شبكة المنتجات" : "Product grid"}
                  </p>
                </div>

                {/**
                 * ProductGrid with infinite scroll wired up.
                 *
                 * `onEndReached` is called by VirtuosoGrid when the last visible
                 * item enters the viewport. It calls `fetchNextPage()` from
                 * `useInfiniteProducts`, which sends a Supabase request for the
                 * next 24 products and appends them to `products`.
                 *
                 * `isLoadingMore` shows a spinner + ghost skeletons below the
                 * grid while the next page is in-flight.
                 *
                 * No "Load more" button needed — scrolling is the trigger.
                 */}
                <ProductGrid
                  products={products}
                  isLoading={isLoading}
                  isLoadingMore={isFetchingNext}
                  onEndReached={hasNextPage ? fetchNextPage : undefined}
                  activeQuery={activeQuery}
                />
              </>
            ) : (
              /* ── Empty state ── */
              <ProductEmptyState lang={lang} hasFilters={hasFilters} onReset={clearAll} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
