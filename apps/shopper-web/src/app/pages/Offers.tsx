"use client";
// availability toggle now wired via useUnifiedFilters + useInfiniteProducts
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  PackageSearch,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { ProductGrid }          from "../components/ProductGrid";
import { cn }                   from "../components/UI";
import { useLanguage }          from "../../contexts/LanguageContext";
import { useCatalog }           from "../../contexts/CatalogContext";
import { useInfiniteProducts }  from "../hooks/useInfiniteProducts";
import { useUnifiedFilters }    from "../hooks/useUnifiedFilters";
import { useIsShopperShell }    from "../components/ui/use-mobile";
import { CatalogSkeletonGrid }  from "../components/CatalogPrimitives";
import { getLocalizedCategoryName } from "../localization";
import { MobileOffersView }     from "./ShopperMobileViews";
import { FilterSidebar }        from "../components/FilterSidebar";
import type { FilterCategory }  from "../components/FilterSidebar";
import { extractBrand }         from "../utils/extractBrand";
import type { CatalogProductSort } from "../hooks/useCatalogProductSearch";

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortOption = {
  value:   CatalogProductSort;
  labelAr: string;
  labelEn: string;
  Icon:    React.ElementType;
};

const SORT_OPTIONS: readonly SortOption[] = [
  { value: "relevant",   labelAr: "الأكثر صلة", labelEn: "Relevant",  Icon: Sparkles    },
  { value: "price_desc", labelAr: "السعر ↓",    labelEn: "Price ↓",   Icon: TrendingDown },
  { value: "price_asc",  labelAr: "السعر ↑",    labelEn: "Price ↑",   Icon: TrendingUp  },
  { value: "name",       labelAr: "الاسم أ–ي",  labelEn: "Name A–Z",  Icon: ArrowUpDown },
] as const;

// ─── SortSegment (amber theme for offers) ────────────────────────────────────

function SortSegment({
  options,
  value,
  lang,
  onChange,
}: {
  options: readonly SortOption[];
  value:   CatalogProductSort;
  lang:    "ar" | "en";
  onChange: (v: CatalogProductSort) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200/70 bg-slate-100/60 p-1">
      {options.map((opt) => {
        const Icon   = opt.Icon;
        const active = value === opt.value;
        const label  = lang === "ar" ? opt.labelAr : opt.labelEn;
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
            <Icon className={cn("h-3 w-3 shrink-0", active ? "text-amber-500" : "text-slate-400")} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Inline search ────────────────────────────────────────────────────────────

function OffersSearch({
  value,
  onChange,
  placeholder,
}: {
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Sparkles className="pointer-events-none absolute start-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-xl border border-slate-200/70 bg-white/90 pe-3 ps-9 text-[13px] font-semibold text-slate-900 placeholder:text-slate-400",
          "shadow-[0_2px_6px_rgba(15,23,42,0.05)] transition-all duration-200",
          "focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200/60",
          value && "border-amber-200 bg-amber-50/30",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute end-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-400 transition-colors hover:bg-slate-200"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function OffersEmptyState({
  lang,
  hasFilters,
  onReset,
}: {
  lang:       "ar" | "en";
  hasFilters: boolean;
  onReset:    () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.8rem] border border-slate-200/80 bg-white/92 p-12 text-center shadow-sm backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 shadow-[0_8px_24px_rgba(245,158,11,0.12)]">
          <PackageSearch className="h-7 w-7 text-amber-500" />
        </div>
        <h2 className="mt-5 text-xl font-black tracking-tight text-slate-900">
          {lang === "ar" ? "لا توجد عروض مطابقة" : "No matching offers"}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">
          {lang === "ar"
            ? "جرّب تغيير البحث أو إزالة بعض الفلاتر."
            : "Try a different search term or clear some filters."}
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

export default function Offers() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <MobileOffersView />;
  return <OffersDesktop />;
}

// ─── Desktop view ─────────────────────────────────────────────────────────────

function OffersDesktop() {
  const { lang, t } = useLanguage();
  const { categories } = useCatalog();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // ── Category label resolver ──────────────────────────────────────────────
  const categoryOptionsBase = useMemo(
    () => categories.map((c) => ({ id: c.id, label: getLocalizedCategoryName(c, lang) })),
    [categories, lang],
  );
  const resolveCategoryLabel = useMemo(() => {
    const m = new Map(categoryOptionsBase.map((c) => [c.id, c.label]));
    return (id: string) => m.get(id);
  }, [categoryOptionsBase]);

  // ── Unified filter hook ──────────────────────────────────────────────────
  // defaultInStock: true so the "in-stock only" toggle starts ON for offers.
  const filters = useUnifiedFilters({
    defaultSort:        "relevant",
    defaultInStock:     true,
    syncSearchToUrl:    false,  // Offers has its own inline search, not global context
    resolveCategoryLabel,
    labels: {
      search:    (q) => `"${q}"`,
      category:  (label) => label,
      stockOnly: lang === "ar" ? "متاح فقط" : "In stock only",  // never emitted (toggle hidden)
      priceCap:  (max) => lang === "ar"
        ? `حتى ${max.toFixed(0)} ${t("currency")}`
        : `Up to ${max.toFixed(0)} ${t("currency")}`,
      brand:     (b) => b,
      sort: {
        relevant:   lang === "ar" ? "الأكثر صلة" : "Relevant",
        price_asc:  lang === "ar" ? "السعر ↑"   : "Price ↑",
        price_desc: lang === "ar" ? "السعر ↓"   : "Price ↓",
        name:       lang === "ar" ? "الاسم"     : "Name",
      },
      clearAll: lang === "ar" ? "مسح الكل" : "Clear all",
    },
  });

  // ── Offers feed — full serverFilters including the inStock toggle ─────────
  const {
    products: rawProducts,
    isLoading,
    isFetchingNext,
    fetchNextPage,
    hasNextPage,
    totalCount,
    activeQuery,
    error,
  } = useInfiniteProducts(filters.serverFilters);

  // ── Client-side brand filter ─────────────────────────────────────────────
  const products = useMemo(
    () => filters.applyClientFilters(rawProducts),
    [filters, rawProducts],
  );

  // ── Available brands derived from current offer set ──────────────────────
  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of rawProducts) {
      const b = extractBrand(p.nameEn);
      if (!b) continue;
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .slice(0, 60)
      .map(([b]) => b);
  }, [rawProducts]);

  // ── Price slider ceiling (locked from first page, reset on filter change) ─
  const rawMaxFromProducts = useMemo(() => {
    if (rawProducts.length === 0) return 0;
    return Math.ceil(Math.max(...rawProducts.map((p) => p.price)) / 50) * 50;
  }, [rawProducts]);

  const filterKey    = `${filters.categoryId}|${filters.searchQuery}`;
  const filterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (filterKey !== filterKeyRef.current) {
      filterKeyRef.current = filterKey;
      filters.setSliderMax(0);
      filters.setCommittedMaxPrice(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    if (rawMaxFromProducts > 0 && filters.sliderMax === 0) {
      filters.setSliderMax(rawMaxFromProducts);
      filters.setCommittedMaxPrice(rawMaxFromProducts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMaxFromProducts, filters.sliderMax]);

  // ── Category sidebar options ─────────────────────────────────────────────
  const categoryOptions: FilterCategory[] = useMemo(
    () => [
      { id: "all", label: lang === "ar" ? "كل العروض" : "All offers", count: totalCount },
      ...categories.map((c) => ({
        id:    c.id,
        label: getLocalizedCategoryName(c, lang),
        count: c.count,
      })),
    ],
    [categories, totalCount, lang],
  );

  const showInitialSkeleton = isLoading && products.length === 0;

  return (
    <div className="offers-page min-h-screen bg-[linear-gradient(165deg,#fffbf0_0%,#fafaf8_50%,#fafafa_100%)]">
      <div className="page-section py-6 pb-14">

        {/* ── Hero Banner ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5 overflow-hidden rounded-[1.8rem] border border-amber-200/70 bg-white/92 shadow-[0_4px_28px_rgba(245,158,11,0.07)] backdrop-blur-xl"
        >
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-amber-200/90 bg-amber-50 px-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                {lang === "ar" ? "العروض المميزة" : "Featured offers"}
              </span>
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
                {lang === "ar" ? "العروض الحالية" : "Current offers"}
              </h1>
              <p className="mt-1.5 max-w-xl text-[13px] font-semibold leading-6 text-slate-500">
                {lang === "ar"
                  ? "استعرض المنتجات المتاحة، وابحث بداخلها، ورتبها حسب القسم أو السعر."
                  : "Browse available products, search within them, and sort by category or price."}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Controls bar ─────────────────────────────────────── */}
        <div className="catalog-controls-stick z-30 mb-6 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/97 px-5 py-3.5 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <OffersSearch
              value={filters.searchQuery}
              onChange={filters.setSearchQuery}
              placeholder={lang === "ar" ? "ابحث في العروض…" : "Search offers…"}
            />
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50 px-3 text-[11px] font-black text-slate-700">
              <Tag className="h-3 w-3 text-amber-400" />
              {totalCount > 0
                ? (lang === "ar"
                    ? `${totalCount.toLocaleString()} عرض`
                    : `${totalCount.toLocaleString()} offers`)
                : (lang === "ar" ? "العروض" : "Offers")}
            </span>
            {filters.hasFilters && (
              <button
                type="button"
                onClick={filters.clearAll}
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
                value={filters.sortBy}
                lang={lang}
                onChange={(v) => filters.setSortBy(v)}
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-black text-slate-700 shadow-sm transition-all hover:border-amber-200 hover:bg-amber-50 lg:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500" />
              {lang === "ar" ? "الفلاتر" : "Filters"}
              {filters.hasFilters && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white">
                  {filters.activeChips.length}
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
            onlyInStock={filters.inStock}
            onInStockChange={filters.setInStock}
            categories={categoryOptions}
            activeCategory={filters.categoryId}
            onCategoryChange={(id) => filters.setCategoryId(id === "all" ? "all" : id)}
            priceRange={[0, filters.sliderMax > 0 ? filters.committedMaxPrice : 0]}
            maxPrice={filters.sliderMax}
            onPriceRangeChange={([, max]) => filters.setCommittedMaxPrice(max)}
            currency={t("currency")}
            brands={availableBrands}
            activeBrands={filters.brands}
            onToggleBrand={filters.toggleBrand}
            onClearBrands={filters.clearBrands}
            totalResults={totalCount}
            hasFilters={filters.hasFilters}
            onClearAll={filters.clearAll}
          />

          <div className="min-w-0 flex-1">
            {error ? (
              <div className="rounded-[1.8rem] border border-rose-200/80 bg-rose-50/80 p-10 text-center shadow-sm">
                <p className="text-sm font-black text-rose-700">
                  {lang === "ar" ? "حدث خطأ أثناء تحميل العروض." : "An error occurred while loading offers."}
                </p>
                <p className="mt-2 text-sm text-rose-600">{error}</p>
              </div>
            ) : showInitialSkeleton ? (
              <CatalogSkeletonGrid count={8} />
            ) : products.length > 0 ? (
              <>
                <div className="mb-4 px-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {lang === "ar" ? "شبكة العروض" : "Offers grid"}
                  </p>
                </div>
                <ProductGrid
                  products={products}
                  isLoading={isLoading}
                  isLoadingMore={isFetchingNext}
                  onEndReached={hasNextPage ? fetchNextPage : undefined}
                  activeQuery={activeQuery}
                />
              </>
            ) : (
              <OffersEmptyState lang={lang} hasFilters={filters.hasFilters} onReset={filters.clearAll} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
