import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  ChevronRight,
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
import { useUnifiedFilters } from "../hooks/useUnifiedFilters";
import { extractBrand } from "../utils/extractBrand";
import { ProductGrid } from "../components/ProductGrid";
import { CatalogSkeletonGrid } from "../components/CatalogPrimitives";
import type { CatalogProductSort } from "../hooks/useCatalogProductSearch";
import { MobileProductsView } from "./ShopperMobileViews";
import { FilterSidebar } from "../components/FilterSidebar";
import type { FilterCategory } from "../components/FilterSidebar";
import { cn } from "../components/UI";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const TEAL = "#0E7E74";
const INK  = "#0A1220";

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortOption = {
  value: CatalogProductSort;
  labelAr: string;
  labelEn: string;
  Icon: React.ElementType;
};

const SORT_OPTIONS: readonly SortOption[] = [
  { value: "relevant",   labelAr: "الأكثر صلة", labelEn: "Relevant",  Icon: Sparkles    },
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
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
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
              "inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-[11px] font-black transition-all duration-200",
              active
                ? "bg-white text-slate-900 shadow-[0_1px_4px_rgba(15,23,42,0.08)]"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Icon
              className={cn("h-3 w-3 shrink-0", active ? "" : "text-slate-400")}
              style={active ? { color: TEAL } : undefined}
            />
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
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-slate-100 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
        <PackageSearch className="h-10 w-10 text-slate-200" />
      </div>
      <h2 className="text-2xl font-black text-slate-900">
        {lang === "ar" ? "لا توجد نتائج" : "No results found"}
      </h2>
      <p className="mt-2 max-w-xs text-sm font-semibold leading-relaxed text-slate-400">
        {lang === "ar"
          ? "جرّب توسيع البحث أو إزالة بعض الفلاتر."
          : "Try widening the search or clearing some filters."}
      </p>
      {hasFilters && (
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={onReset}
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-black text-white shadow-[0_6px_20px_rgba(10,18,32,0.16)] transition-[background-color] duration-200 hover:bg-[#0E7E74]"
          style={{ backgroundColor: INK }}
        >
          <X className="h-3.5 w-3.5" />
          {lang === "ar" ? "إعادة الضبط" : "Reset filters"}
        </motion.button>
      )}
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
  const { lang, t } = useLanguage();
  const { categories } = useCatalog();
  const { searchQuery, setSearchQuery } = useSearchInput();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const categoryOptionsBase = useMemo(
    () => categories.map((c) => ({ id: c.id, label: getLocalizedCategoryName(c, lang) })),
    [categories, lang],
  );
  const resolveCategoryLabel = useMemo(() => {
    const m = new Map(categoryOptionsBase.map((c) => [c.id, c.label]));
    return (id: string) => m.get(id);
  }, [categoryOptionsBase]);

  const filters = useUnifiedFilters({
    defaultSort: "relevant",
    syncSearchToUrl: false,
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    resolveCategoryLabel,
    labels: {
      search:    (q) => `"${q}"`,
      category:  (label) => label,
      stockOnly: lang === "ar" ? "متاح فقط" : "In stock only",
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

  const products = useMemo(
    () => filters.applyClientFilters(rawProducts),
    [filters, rawProducts],
  );

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

  const rawMaxFromProducts = useMemo(() => {
    if (rawProducts.length === 0) return 0;
    return Math.ceil(Math.max(...rawProducts.map((p) => p.price)) / 50) * 50;
  }, [rawProducts]);

  const filterKey = `${filters.categoryId}|${searchQuery}`;
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

  const categoryOptions = useMemo(
    () => [
      { id: "all", label: lang === "ar" ? "الكل" : "All", count: totalCount },
      ...categories.map((c) => ({
        id: c.id,
        label: getLocalizedCategoryName(c, lang),
        count: c.count,
      })),
    ],
    [categories, totalCount, lang],
  );

  const sidebarCategoryOptions: FilterCategory[] = categoryOptions;

  const sortBy               = filters.sortBy;
  const setSortBy            = filters.setSortBy;
  const onlyInStock          = filters.inStock;
  const setOnlyInStock       = filters.setInStock;
  const sliderMax            = filters.sliderMax;
  const committedPriceCap    = filters.committedMaxPrice;
  const setCommittedPriceCap = filters.setCommittedMaxPrice;
  const activeCategory       = filters.categoryId;
  const hasFilters           = filters.hasFilters;
  const clearAll             = filters.clearAll;
  const updateCategory       = (id: string | null) => filters.setCategoryId(id ?? "all");
  const activeFilterTags     = filters.activeChips.map((c) => ({
    key: c.key, label: c.label, onRemove: c.remove,
  }));

  const showInitialSkeleton = isLoading && products.length === 0;

  return (
    <div className="products-page min-h-screen bg-[#F8FAFB]">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="page-section py-6">
          {/* Breadcrumb */}
          <nav className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Link to="/" className="transition-colors hover:text-slate-600">
              {lang === "ar" ? "الرئيسية" : "Home"}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-600">
              {lang === "ar" ? "المنتجات" : "Products"}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">
              {lang === "ar" ? "تصفح الكتالوج الكامل" : "Browse the catalog"}
            </h1>
            {totalCount > 0 && (
              <span
                className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-black text-white"
                style={{ backgroundColor: INK }}
              >
                <LayoutGrid className="h-3 w-3" />
                {totalCount.toLocaleString()} {lang === "ar" ? "منتج" : "products"}
              </span>
            )}
            {isFetchingNext && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 text-[11px] font-black text-teal-700"
              >
                <Zap className="h-3 w-3" />
                {lang === "ar" ? "تحميل المزيد" : "Loading more"}
              </motion.span>
            )}
          </div>

          {/* Quick chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to="/categories"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-black text-slate-600 transition-colors hover:bg-slate-100"
            >
              <LayoutGrid className="h-3 w-3" style={{ color: TEAL }} />
              {lang === "ar" ? "خريطة الأقسام" : "Category map"}
            </Link>
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 pl-3 pr-2 text-[11px] font-black text-teal-700 transition-colors hover:bg-teal-100"
              >
                {searchQuery.trim()}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Controls bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="page-section catalog-controls-stick z-30 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-black text-slate-700">
                <Tag className="h-3 w-3" style={{ color: TEAL }} />
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
              {/* Active filter chips */}
              {activeFilterTags.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  onClick={tag.onRemove}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  {tag.label}
                  <X className="h-2.5 w-2.5" />
                </button>
              ))}
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
                className="inline-flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-black text-slate-700 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50 lg:hidden"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" style={{ color: TEAL }} />
                {lang === "ar" ? "الفلاتر" : "Filters"}
                {hasFilters && (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
                    style={{ backgroundColor: TEAL }}
                  >
                    {activeFilterTags.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sidebar + Grid ────────────────────────────────────────────────────── */}
      <div className="page-section-row py-8 pb-14" style={{ overflow: "visible" }}>
        <div className="flex items-start gap-6">
          <FilterSidebar
            lang={lang}
            mobileOpen={mobileFilterOpen}
            onMobileClose={() => setMobileFilterOpen(false)}
            onlyInStock={onlyInStock}
            onInStockChange={setOnlyInStock}
            categories={sidebarCategoryOptions}
            activeCategory={activeCategory}
            onCategoryChange={(id) => updateCategory(id === "all" ? null : id)}
            priceRange={[0, sliderMax > 0 ? committedPriceCap : 0]}
            maxPrice={sliderMax}
            onPriceRangeChange={([, max]) => setCommittedPriceCap(max)}
            currency={t("currency")}
            brands={availableBrands}
            activeBrands={filters.brands}
            onToggleBrand={filters.toggleBrand}
            onClearBrands={filters.clearBrands}
            totalResults={totalCount}
            hasFilters={hasFilters}
            onClearAll={clearAll}
          />

          <div className="min-w-0 flex-1">
            {error ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-10 text-center">
                <p className="text-sm font-black text-rose-700">
                  {lang === "ar"
                    ? "حدث خطأ أثناء تحميل المنتجات."
                    : "An error occurred while loading products."}
                </p>
                <p className="mt-2 text-sm text-rose-500">{error}</p>
              </div>
            ) : showInitialSkeleton ? (
              <CatalogSkeletonGrid count={8} />
            ) : products.length > 0 ? (
              <>
                <div className="mb-4 px-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {lang === "ar" ? "شبكة المنتجات" : "Product grid"}
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
              <ProductEmptyState lang={lang} hasFilters={hasFilters} onReset={clearAll} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
