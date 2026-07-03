/**
 * CategoryDetails.tsx — Single-category product page
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DATA FLOW (for Bara'a)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Before this refactor:
 *   useCatalog()              → all 52K products + filterByCategory() effect
 *   useCatalogProductSearch() → client-side fuzzy worker on those products
 *   "Load more" button        → manual pagination
 *
 * After this refactor:
 *   useInfiniteProducts({ categoryId: id })
 *     → Supabase .ilike(Category_Name | Category_Name_En, '%name%') + .range(0,23)
 *     → only 24 products per request, auto-appended on scroll
 *   useCatalog()              → ONLY for the category list (sidebar rail + hero lookup)
 *     → served from localStorage cache (30-min TTL), no extra Supabase calls
 *
 * CATEGORY LOOKUP:
 *   `category = categories.find(c => c.id === id)` — reads from the cached list,
 *   not from `categoriesById` which is derived from loaded products and would be
 *   empty on a cold start now that the background 52K load has been removed.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpDown,
  LayoutGrid,
  PackageSearch,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCatalog } from "../../contexts/CatalogContext";
import { useSearchInput } from "../../contexts/SearchContext";
import { ProductGrid } from "../components/ProductGrid";
import { CatalogSkeletonGrid } from "../components/CatalogPrimitives";
import { cn } from "../components/UI";
import { useIsShopperShell } from "../components/ui/use-mobile";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { getLocalizedCategoryName } from "../localization";
import { useInfiniteProducts } from "../hooks/useInfiniteProducts";
import type { CatalogProductSort } from "../hooks/useCatalogProductSearch";
import { resolveCanonicalCategorySegment } from "../seo";
import { MobileCategoryDetailsView } from "./ShopperMobileViews";
import { FilterSidebar } from "../components/FilterSidebar";

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "relevant",   labelAr: "الأكثر صلة", labelEn: "Relevant",  Icon: Sparkles    },
  { value: "price_asc",  labelAr: "السعر ↑",    labelEn: "Price ↑",   Icon: TrendingUp  },
  { value: "price_desc", labelAr: "السعر ↓",    labelEn: "Price ↓",   Icon: TrendingDown },
  { value: "name",       labelAr: "الاسم",      labelEn: "Name A–Z",  Icon: ArrowUpDown  },
] as const;

// ─── InlineState ──────────────────────────────────────────────────────────────

function InlineState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
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
        <h2 className="mt-5 text-xl font-black tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </motion.div>
  );
}

// ─── SortSegment ─────────────────────────────────────────────────────────────

function SortSegment({
  options,
  value,
  lang,
  onChange,
}: {
  options: typeof SORT_OPTIONS;
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

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CategoryDetails() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <MobileCategoryDetailsView />;
  return <CategoryDetailsDesktop />;
}

// ─── Desktop view ─────────────────────────────────────────────────────────────

function CategoryDetailsDesktop() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const canonicalId = id ? resolveCanonicalCategorySegment(id) : undefined;

  // `useCatalog()` is used ONLY for the category metadata list.
  // Categories are cached in localStorage (30-min TTL from fetchCategoriesQuick),
  // so this is near-instant even on first render.
  //
  // NOTE: We look up `category` via `categories.find()` — NOT via `categoriesById`.
  // `categoriesById` is derived from loaded products (which is now only the first
  // page) and would be empty for most categories on a cold start. The raw
  // `categories` array comes from the localStorage category cache and always
  // contains the full list of category metadata.
  const { categories, isLoading: isCatalogLoading } = useCatalog();
  const { searchQuery, setSearchQuery } = useSearchInput();

  const [sortBy, setSortBy] = useState<CatalogProductSort>("relevant");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Resolve the active category from the cached category list.
  const category = useMemo(
    () => {
      if (!id) return undefined;
      return categories.find((c) => c.id === canonicalId || c.id === id);
    },
    [categories, canonicalId, id],
  );

  // Related categories for the quick-browse rail (excludes current category).
  const relatedCategories = useMemo(
    () => categories.filter((c) => c.id !== id).slice(0, 10),
    [categories, id],
  );

  // ── Server-side paginated product feed filtered to this category ──────────
  //
  // `categoryId: id` is passed to shopperCatalogApi which resolves the slug to
  // its Arabic/English display names and applies:
  //   .or("Category_Name.ilike.%name%, Category_Name_En.ilike.%name%")
  //
  // The 300ms debounce inside the hook handles search; sortBy is translated to
  // Supabase .order() calls. No client-side fuzzy search worker is involved.
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
    categoryId: canonicalId ?? id,
    inStock:    onlyInStock ? true : undefined,
    sortBy:     sortBy !== "relevant" ? sortBy : undefined,
  });

  const hasFilters = onlyInStock || searchQuery.trim().length > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setOnlyInStock(false);
    setSortBy("relevant");
  };

  // ── Category not found ────────────────────────────────────────────────────
  //
  // Show a skeleton while categories are still loading from localStorage/network.
  // Only show "not found" once we know the category list is populated.
  if (!category && isCatalogLoading) {
    return (
      <div className="category-details-page min-h-screen bg-[linear-gradient(165deg,#f0fafa_0%,#f7fafb_50%,#fafafa_100%)]">
        <div className="page-section py-16">
          <CatalogSkeletonGrid count={8} />
        </div>
      </div>
    );
  }

  if (!category && !isCatalogLoading) {
    return (
      <div className="category-details-page min-h-screen bg-[linear-gradient(165deg,#f0fafa_0%,#f7fafb_50%,#fafafa_100%)]">
        <div className="page-section py-16">
          <InlineState
            title={lang === "ar" ? "القسم غير متوفر" : "Category not found"}
            description={
              lang === "ar"
                ? "تعذر العثور على هذا القسم. يمكنك العودة إلى الأقسام أو متابعة تصفح كل المنتجات."
                : "We couldn't find this category. Return to categories or browse the full catalog."
            }
            action={
              <Link
                to="/categories"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5"
              >
                <LayoutGrid className="h-4 w-4" />
                {lang === "ar" ? "العودة إلى الأقسام" : "Back to categories"}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!id || !canonicalId || canonicalId === id) return;
    navigate(`/categories/${canonicalId}`, { replace: true });
  }, [canonicalId, id, navigate]);

  // `category` is non-null past this point (TS narrowing via the checks above).
  const displayName = category ? getLocalizedCategoryName(category, lang) : "";
  const description = category ? (lang === "ar" ? category.descAr : category.descEn) : "";

  return (
    <div className="category-details-page min-h-screen bg-[linear-gradient(165deg,#f0fafa_0%,#f7fafb_50%,#fafafa_100%)]">
      <div className="page-section py-6 pb-14">

        {/* ── Category Hero ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5 overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/92 shadow-[0_4px_28px_rgba(15,23,42,0.07)] backdrop-blur-xl"
        >
          <div className="grid gap-0 xl:grid-cols-[1fr_10rem]">

            {/* Left: info */}
            <div className="space-y-4 p-5">
              {/* Breadcrumb */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/categories"
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-2.5 text-[10px] font-black text-slate-600 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
                >
                  <ArrowLeft className={cn("h-3 w-3", lang === "ar" && "rotate-180")} />
                  {lang === "ar" ? "الأقسام" : "Categories"}
                </Link>
                <span className="text-slate-300">/</span>
                <span className="inline-flex h-7 items-center rounded-lg border border-teal-200/80 bg-teal-50 px-2.5 text-[10px] font-black text-teal-700">
                  {displayName}
                </span>
                <Link
                  to="/products"
                  className="ms-auto inline-flex h-7 items-center rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 text-[10px] font-black text-slate-500 transition-all hover:bg-white"
                >
                  {lang === "ar" ? "كل المنتجات" : "All products"}
                </Link>
              </div>

              {/* Title + description */}
              <div>
                <h1 className="text-[1.75rem] font-black tracking-tight text-slate-950">
                  {displayName}
                </h1>
                <p className="mt-1.5 max-w-2xl text-[13px] font-semibold leading-6 text-slate-500">
                  {description}
                </p>
                {/* Loading-more indicator */}
                <AnimatePresence>
                  {isFetchingNext && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="mt-2 inline-flex h-6 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 text-[10px] font-black text-violet-700"
                    >
                      <Zap className="h-2.5 w-2.5" />
                      {lang === "ar" ? "جارٍ تحميل المزيد" : "Loading more"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right: category image */}
            {category && (
              <div className="overflow-hidden border-s border-slate-100 bg-slate-50/50 xl:rounded-e-[1.7rem]">
                <ImageWithFallback
                  src={category.imageUrl}
                  alt={displayName}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  style={category.imagePosition ? { objectPosition: category.imagePosition } : undefined}
                  loading="eager"
                  decoding="async"
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Related Categories Rail ────────────────────── */}
        {relatedCategories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-5 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/92 px-5 py-4 shadow-sm backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  {lang === "ar" ? "تنقل سريع" : "Quick browse"}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {lang === "ar" ? "أقسام أخرى" : "Other sections"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {relatedCategories.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/categories/${entry.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/90 px-3 text-[11px] font-black text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-md"
                >
                  {getLocalizedCategoryName(entry, lang)}
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Sort bar + mobile filter toggle ─────────── */}
        <div className="catalog-controls-stick z-30 mb-6 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/97 px-5 py-3.5 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 items-center rounded-lg border border-slate-200/70 bg-slate-50 px-3 text-[11px] font-black text-slate-600">
              {totalCount > 0
                ? (lang === "ar" ? `${totalCount.toLocaleString()} منتج` : `${totalCount.toLocaleString()} products`)
                : (lang === "ar" ? "المنتجات" : "Products")}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
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
            categories={[]}
            activeCategory="all"
            onCategoryChange={() => {}}
            priceRange={[0, 9999]}
            maxPrice={0}
            onPriceRangeChange={() => {}}
            totalResults={totalCount}
            hasFilters={hasFilters}
            onClearAll={clearFilters}
          />

          <div className="min-w-0 flex-1">
            {error ? (
              /* ── Error state ── */
              <div className="rounded-[1.8rem] border border-rose-200/80 bg-rose-50/80 p-10 text-center shadow-sm">
                <p className="text-sm font-black text-rose-700">
                  {lang === "ar"
                    ? "حدث خطأ أثناء تحميل منتجات القسم."
                    : "An error occurred while loading category products."}
                </p>
                <p className="mt-2 text-sm text-rose-600">{error}</p>
              </div>
            ) : isLoading && products.length === 0 ? (
              /* ── Initial skeleton ── */
              <CatalogSkeletonGrid count={8} />
            ) : products.length > 0 ? (
              <>
                <div className="mb-4 px-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {lang === "ar" ? "منتجات القسم" : "Category feed"}
                  </p>
                </div>

                {/**
                 * ProductGrid with infinite scroll.
                 *
                 * `onEndReached` fires when VirtuosoGrid's last item enters the
                 * viewport → calls `fetchNextPage()` → Supabase .range(N, N+23)
                 * → appended to `products` array automatically.
                 *
                 * `isLoadingMore` shows the spinner + ghost skeletons below the
                 * grid while the next page is loading.
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
              <InlineState
                title={lang === "ar" ? "لا توجد منتجات مطابقة" : "No matching products"}
                description={
                  lang === "ar"
                    ? "جرّب تغيير البحث أو تعطيل فلتر التوفر للوصول إلى منتجات أكثر."
                    : "Try another search term or disable the stock filter to reveal more products."
                }
                action={
                  <Link
                    to="/products"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    {lang === "ar" ? "استكشاف كل المنتجات" : "Explore all products"}
                  </Link>
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
