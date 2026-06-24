// ShopperMobileViews.tsx – cleaned version
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  CircleHelp,
  FileText,
  Heart,
  Info,
  LayoutGrid,
  LogOut,
  Package,
  PackageSearch,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useCatalog } from "../../contexts/CatalogContext";
import { useFavorites } from "../../contexts/FavoritesContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSearchInput } from "../../contexts/SearchContext";
import {
  getCatalogProductImage,
  type CatalogProduct,
} from "../catalog";
import {
  getDeliveryWindowCompactLabel,
  getDeliveryWindowLabel,
  getDeliveryWindowSentence,
} from "../config";
import { readOrders, syncRemoteOrders, type StoredOrder } from "../orders";
import { fetchProductsByIds } from "../../services/shopperCatalogApi";
import {
  getCachedCustomerOrders,
  getCustomerOrders,
} from "../../services/shopperOrdersApi";
import {
  CatalogChip,
  CatalogDrawer,
  CatalogSkeletonGrid,
  MobileFilterDrawer,
} from "../components/CatalogPrimitives";
import { EmptyState } from "../components/BrandPrimitives";
import { FavoriteHeartButton } from "../components/FavoriteHeartButton";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import {
  ShopperAccountLink,
  ShopperActionDock,
  ShopperCategoryTile,
  ShopperPage,
  ShopperProductTile,
  ShopperSectionHeader,
  ShopperSurface,
} from "../components/ShopperPrimitives";
import { getLocalizedCategoryName, getLocalizedProductName } from "../localization";
import { cn } from "../components/UI";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useCatalogCategorySearch } from "../hooks/useCatalogCategorySearch";
import { getMaxPriceCeiled } from "../hooks/useCatalogFilters";
import { useInfiniteProducts } from "../hooks/useInfiniteProducts";

const SORT_OPTIONS = [
  { value: "relevant", labelAr: "الأكثر صلة", labelEn: "Most relevant" },
  { value: "price_asc", labelAr: "السعر الأقل", labelEn: "Lowest price" },
  { value: "price_desc", labelAr: "السعر الأعلى", labelEn: "Highest price" },
  { value: "name", labelAr: "الاسم", labelEn: "Name" },
] as const;

const OFFERS_SORT_OPTIONS = [
  { value: "relevant", labelAr: "الأكثر صلة", labelEn: "Most relevant" },
  { value: "price_desc", labelAr: "السعر الأعلى", labelEn: "Highest price" },
  { value: "price_asc", labelAr: "السعر الأقل", labelEn: "Lowest price" },
  { value: "name", labelAr: "الاسم", labelEn: "Name" },
] as const;

const PAGE_SIZE = 24;
const PROFILE_PREFERENCES_KEY = "united-pharmacies-profile-preferences-v1";

function getOptionLabel<
  T extends readonly { value: string; labelAr: string; labelEn: string }[],
>(options: T, value: T[number]["value"], lang: "ar" | "en") {
  const option = options.find((item) => item.value === value);
  return lang === "ar" ? option?.labelAr : option?.labelEn;
}

function FeedDockButton({
  icon: Icon,
  label,
  active = false,
  filled = false,
  onClick,
}: {
  icon: typeof SlidersHorizontal;
  label: string;
  active?: boolean;
  filled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition-all active:scale-[0.98]",
        filled
          ? "bg-[#2563eb] text-white shadow-[0_16px_30px_rgba(37,99,235,0.24)]"
          : active
            ? "bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]"
            : "border border-slate-200 bg-white text-slate-700",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MobileListIntro({
  eyebrow,
  title,
  activeFilters,
}: {
  eyebrow: string;
  title: string;
  activeFilters?: ReactNode;
}) {
  return (
    <ShopperSurface className="overflow-hidden border-slate-200 bg-[linear-gradient(145deg,#ffffff_0%,#f8fbfb_62%,#eff6f7_100%)]">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(36,184,181,0.1),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.06),transparent_28%)]"
        />
        <div className="relative z-10">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-[1.6rem] font-black leading-[1.08] tracking-tight text-slate-950 sm:text-[1.8rem]">
            {title}
          </h1>
          {activeFilters ? <div className="mt-3 flex flex-wrap gap-2">{activeFilters}</div> : null}
        </div>
      </div>
    </ShopperSurface>
  );
}

function readPreferences() {
  if (typeof window === "undefined") {
    return { orders: true, offers: true, news: false };
  }
  try {
    const rawValue = window.localStorage.getItem(PROFILE_PREFERENCES_KEY);
    if (!rawValue) {
      return { orders: true, offers: true, news: false };
    }
    const parsed = JSON.parse(rawValue) as Record<string, boolean>;
    return {
      orders: Boolean(parsed.orders),
      offers: Boolean(parsed.offers),
      news: Boolean(parsed.news),
    };
  } catch {
    return { orders: true, offers: true, news: false };
  }
}

function sortProducts(
  products: CatalogProduct[],
  sortBy: (typeof SORT_OPTIONS)[number]["value"],
  normalizedSearch: string,
  lang: "ar" | "en",
) {
  const sortLocale = lang === "ar" ? "ar" : "en";
  return [...products].sort((left, right) => {
    const leftName = getLocalizedProductName(left, lang);
    const rightName = getLocalizedProductName(right, lang);

    if (sortBy === "price_asc") {
      return left.price - right.price;
    }
    if (sortBy === "price_desc") {
      return right.price - left.price;
    }
    if (sortBy === "name") {
      return leftName.localeCompare(rightName, sortLocale);
    }
    const leftStartsWithSearch =
      normalizedSearch.length > 0 && leftName.toLowerCase().startsWith(normalizedSearch);
    const rightStartsWithSearch =
      normalizedSearch.length > 0 && rightName.toLowerCase().startsWith(normalizedSearch);
    if (Number(rightStartsWithSearch) !== Number(leftStartsWithSearch)) {
      return Number(rightStartsWithSearch) - Number(leftStartsWithSearch);
    }
    if (Number(right.inStock) !== Number(left.inStock)) {
      return Number(right.inStock) - Number(left.inStock);
    }
    if (left.price !== right.price) {
      return left.price - right.price;
    }
    return leftName.localeCompare(rightName, sortLocale);
  });
}

export function MobileCategoriesView() {
  const { categories, isLoading } = useCatalog();
  const { lang } = useLanguage();
  const { searchQuery, setSearchQuery } = useSearchInput();
  const debouncedSearch = useDebouncedValue(searchQuery, 160);
  const filteredCategories = useCatalogCategorySearch(categories, debouncedSearch);

  return (
    <ShopperPage docked={false} className="w-full">
      <div className="space-y-4 w-full">
        <MobileListIntro
          eyebrow={lang === "ar" ? "خريطة الأقسام" : "Category map"}
          title={lang === "ar" ? "تسوق حسب القسم" : "Shop by category"}
          activeFilters={
            <>
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                {categories.length} {lang === "ar" ? "قسم" : "sections"}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                {filteredCategories.length} {lang === "ar" ? "نتائج" : "results"}
              </span>
            </>
          }
        />

        <div
          className="sticky z-20 -mx-1 rounded-[1.3rem] border border-slate-200/80 bg-white/92 p-3 shadow-[0_14px_26px_rgba(15,23,42,0.08)] backdrop-blur-md"
          style={{ top: "var(--shopper-header-offset)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {lang === "ar" ? "نتائج الأقسام" : "Category results"}
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {lang === "ar"
                  ? `${filteredCategories.length} من ${categories.length} أقسام`
                  : `${filteredCategories.length} of ${categories.length} categories`}
              </p>
            </div>
            <Link
              to="/products"
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
            >
              {lang === "ar" ? "كل المنتجات" : "All products"}
            </Link>
          </div>
          {debouncedSearch.trim() ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
              >
                {searchQuery.trim()}
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        {isLoading && categories.length === 0 ? (
          <CatalogSkeletonGrid variant="category" count={8} />
        ) : filteredCategories.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredCategories.map((category) => (
              <ShopperCategoryTile
                key={category.id}
                category={category}
                compact
              />
            ))}
          </div>
        ) : categories.length > 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title={lang === "ar" ? "لا توجد أقسام مطابقة" : "No matching categories"}
            description={
              lang === "ar"
                ? "جرّب عبارة أخرى أو امسح البحث الحالي للرجوع إلى كل الأقسام."
                : "Try another term or clear the current search to return to all categories."
            }
            action={
              <button
                type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white"
                >
                {lang === "ar" ? "مسح البحث" : "Clear search"}
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={LayoutGrid}
            title={lang === "ar" ? "لا توجد أقسام متاحة" : "No categories available"}
            description={
              lang === "ar"
                ? "سيظهر هنا ترتيب الأقسام بمجرد توفر بيانات الكتالوج."
                : "The category map will appear here once catalog data is available."
            }
          />
        )}
      </div>
    </ShopperPage>
  );
}

export function MobileProductsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    categories,
    products,
    isLoading,
    isLoadingMore,
    loadNextPage,
    hasNextPage,
    totalProductCount,
    search,
  } = useCatalog();
  const { lang } = useLanguage();
  const { searchQuery, setSearchQuery } = useSearchInput();
  const [priceRange, setPriceRange] = useState(0);
  const [sortBy, setSortBy] =
    useState<(typeof SORT_OPTIONS)[number]["value"]>("relevant");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const activeCategory = searchParams.get("category") || "all";
  const syncedSearch = (searchParams.get("search") || "").trim();
  const debouncedSearch = useDebouncedValue(searchQuery, 180);
  // getMaxPriceCeiled avoids the V8 spread-limit crash on 65K+ args
  const maxPrice = useMemo(
    () => getMaxPriceCeiled(products, 50),
    [products],
  );
  useEffect(() => {
    if (maxPrice > 0) {
      setPriceRange((current) => (current > 0 ? Math.min(current, maxPrice) : maxPrice));
    }
  }, [maxPrice]);

  useEffect(() => {
    if (searchQuery !== syncedSearch) {
      setSearchQuery(syncedSearch);
    }
  }, [searchQuery, setSearchQuery, syncedSearch]);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === syncedSearch) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    if (trimmed) {
      next.set("search", trimmed);
    } else {
      next.delete("search");
    }
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams, syncedSearch]);

  const categoryOptions = useMemo(
    () => [
      { id: "all", label: lang === "ar" ? "كل المنتجات" : "All products" },
      ...categories.map((category) => ({
        id: category.id,
        label: getLocalizedCategoryName(category, lang),
      })),
    ],
    [categories, lang],
  );
  const { products: sortedProducts, resultCount, isSearching } = {
    products,
    resultCount: totalProductCount,
    isSearching: isLoading,
  };
  const hasFilters =
    activeCategory !== "all"
    || onlyInStock
    || (maxPrice > 0 && priceRange < maxPrice)
    || searchQuery.trim().length > 0;
  const activeCategoryLabel = categoryOptions.find((item) => item.id === activeCategory)?.label;
  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    });
    setSearchParams(next);
  };

  useEffect(() => {
    const filters = {
      categoryId: activeCategory !== "all" ? activeCategory : undefined,
      inStock: onlyInStock ? true : undefined,
      maxPrice: priceRange > 0 ? priceRange : undefined,
      sortBy: sortBy !== "relevant" ? sortBy : undefined,
    };

    if (
      debouncedSearch
      || filters.categoryId
      || filters.inStock !== undefined
      || filters.maxPrice !== undefined
      || filters.sortBy !== undefined
    ) {
      void search(debouncedSearch, filters);
    }
  }, [activeCategory, debouncedSearch, onlyInStock, priceRange, sortBy, search]);

  const clearAll = () => {
    setSortBy("relevant");
    setOnlyInStock(false);
    setPriceRange(maxPrice);
    setSearchQuery("");
    setSearchParams(new URLSearchParams());
  };
  return (
    <ShopperPage className="w-full">
      <div className="space-y-4 w-full">
        <MobileListIntro
          eyebrow={lang === "ar" ? "سوق الصيدلية" : "Pharmacy marketplace"}
          title={
            searchQuery
              ? lang === "ar"
                ? `نتائج بحث "${searchQuery}"`
                : `Results for "${searchQuery}"`
              : lang === "ar"
                ? "كل المنتجات"
                : "All products"
          }
          activeFilters={
            <>
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                {lang === "ar" ? "المنتجات" : "Products"}
              </span>
              <Link
                to="/categories"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {lang === "ar" ? "الأقسام" : "Categories"}
              </Link>
              {isSearching ? (
                <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700">
                  {lang === "ar" ? "جارٍ الترتيب" : "Ranking"}
                </span>
              ) : null}
            </>
          }
        />
        <div
          className="sticky z-20 -mx-1 rounded-[1.35rem] border border-slate-200/80 bg-white/92 p-3 shadow-[0_14px_26px_rgba(15,23,42,0.08)] backdrop-blur-md"
          style={{ top: "var(--shopper-header-offset)" }}
        >
          <div className="shopper-rail">
            {categoryOptions.map((category) => (
              <CatalogChip
                key={category.id}
                selected={activeCategory === category.id}
                onClick={() =>
                  updateParams({ category: category.id === "all" ? null : category.id })
                }
                className="min-w-max"
              >
                {category.label}
              </CatalogChip>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeCategoryLabel && activeCategory !== "all" ? (
              <button
                type="button"
                onClick={() => updateParams({ category: null })}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
              >
                {activeCategoryLabel}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <CatalogChip selected={onlyInStock} onClick={() => setFilterOpen(true)}>
              {lang === "ar" ? "المتاح فقط" : "In stock only"}
            </CatalogChip>
            <CatalogChip selected={sortBy !== "relevant"} onClick={() => setSortOpen(true)}>
              {getOptionLabel(SORT_OPTIONS, sortBy, lang)}
            </CatalogChip>
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
              >
                {searchQuery.trim()}
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-black text-rose-600"
              >
                {lang === "ar" ? "مسح الكل" : "Clear all"}
              </button>
            ) : null}
          </div>
        </div>
        {isLoading && products.length === 0 ? (
          <CatalogSkeletonGrid count={6} />
        ) : sortedProducts.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {lang === "ar" ? "تغذية المنتجات" : "Product feed"}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {lang === "ar"
                  ? `${sortedProducts.length} من ${totalProductCount || resultCount}`
                  : `${sortedProducts.length} of ${totalProductCount || resultCount}`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {sortedProducts.map((product) => (
                <ShopperProductTile
                  key={product.id}
                  product={product}
                  showCategory={false}
                />
              ))}
            </div>
            {hasNextPage ? (
              <button
                type="button"
                onClick={() => void loadNextPage()}
                disabled={isLoadingMore}
                className="inline-flex h-12 w-full items-center justify-center rounded-[1.35rem] border border-slate-200 bg-white text-sm font-black text-slate-700 shadow-[0_14px_28px_rgba(15,23,42,0.05)] disabled:opacity-60"
              >
                {isLoadingMore
                  ? (lang === "ar" ? "جارٍ التحميل..." : "Loading…")
                  : (lang === "ar" ? "عرض المزيد" : "Load more")}
              </button>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={PackageSearch}
            title={lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching products"}
            description={
              lang === "ar"
                ? "جرّب توسيع الفلاتر أو إزالة البحث الحالي للوصول إلى منتجات أكثر."
                : "Try widening the filters or clearing the current search to reach more products."
            }
            action={
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white"
              >
                {lang === "ar" ? "إعادة الضبط" : "Reset"}
              </button>
            }
          />
        )}
      </div>
      <MobileFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title={lang === "ar" ? "تصفية النتائج" : "Filter results"}
        description={
          lang === "ar"
            ? "عدّل القسم والمخزون والسعر من نفس الشاشة."
            : "Adjust section, stock, and price without leaving the feed."
        }
        footer={
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="h-12 w-full rounded-[1.3rem] bg-[var(--primary)] text-sm font-black text-white"
          >
            {lang === "ar" ? "عرض النتائج" : "Show results"}
          </button>
        }
        lang={lang}
      >
        <div className="space-y-5">
          <div>
            <p className="mb-3 text-sm font-black text-slate-950">
              {lang === "ar" ? "القسم" : "Category"}
            </p>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((category) => (
                <CatalogChip
                  key={category.id}
                  selected={activeCategory === category.id}
                  onClick={() =>
                    updateParams({ category: category.id === "all" ? null : category.id })
                  }
                >
                  {category.label}
                </CatalogChip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-black text-slate-950">
              {lang === "ar" ? "المخزون" : "Availability"}
            </p>
            <button
              type="button"
              onClick={() => setOnlyInStock((current) => !current)}
              className={cn(
                "flex min-h-12 w-full items-center justify-between rounded-[1.2rem] border px-4 text-sm font-black transition-colors",
                onlyInStock
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700",
              )}
            >
              <span>{lang === "ar" ? "عرض المتاح فقط" : "Show in-stock only"}</span>
              <span>{onlyInStock ? "ON" : "OFF"}</span>
            </button>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-950">
                {lang === "ar" ? "السعر الأقصى" : "Max price"}
              </p>
              <span className="text-sm font-black text-slate-700">
                {priceRange.toFixed(0)} {lang === "ar" ? "ج.م" : "EGP"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={maxPrice || 0}
              step={50}
              value={priceRange}
              onChange={(event) => setPriceRange(Number(event.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>
        </div>
      </MobileFilterDrawer>
      <MobileFilterDrawer
        open={sortOpen}
        onOpenChange={setSortOpen}
        title={lang === "ar" ? "ترتيب النتائج" : "Sort results"}
        description={
          lang === "ar"
            ? "اختر الطريقة التي تريد ترتيب السوق بها."
            : "Choose how the marketplace should be ordered."
        }
        lang={lang}
      >
        <div className="grid gap-2">
          {SORT_OPTIONS.map((option) => (
            <CatalogChip
              key={option.value}
              selected={sortBy === option.value}
              onClick={() => {
                setSortBy(option.value);
                setSortOpen(false);
              }}
              className="justify-start"
            >
              {lang === "ar" ? option.labelAr : option.labelEn}
            </CatalogChip>
          ))}
        </div>
      </MobileFilterDrawer>
    </ShopperPage>
  );
}

export function MobileOffersView() {
  const { lang } = useLanguage();
  const { categories } = useCatalog();
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] =
    useState<(typeof OFFERS_SORT_OPTIONS)[number]["value"]>("relevant");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const categoryId = activeCategory !== "all" ? activeCategory : undefined;

  const {
    products,
    isLoading,
    isFetchingNext,
    fetchNextPage,
    hasNextPage,
    totalCount,
  } = useInfiniteProducts({ isOffer: true, categoryId, sortBy });

  const categoryOptions = useMemo(
    () => [
      { id: "all", label: lang === "ar" ? "كل العروض" : "All offers" },
      ...categories.map((category) => ({
        id: category.id,
        label: getLocalizedCategoryName(category, lang),
      })),
    ],
    [categories, lang],
  );

  const activeCategoryLabel = categoryOptions.find((item) => item.id === activeCategory)?.label;
  const hasFilters = activeCategory !== "all";

  return (
    <ShopperPage className="w-full">
      <div className="space-y-4 w-full">
        <MobileListIntro
          eyebrow={lang === "ar" ? "العروض" : "Offers"}
          title={lang === "ar" ? "العروض الحالية" : "Current offers"}
          activeFilters={
            <>
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                {totalCount > 0
                  ? `${totalCount.toLocaleString()} ${lang === "ar" ? "عرض" : "offers"}`
                  : (lang === "ar" ? "العروض" : "Offers")}
              </span>
              {activeCategoryLabel && activeCategory !== "all" ? (
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
                >
                  {activeCategoryLabel}
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </>
          }
        />

        <ShopperSurface>
          <div className="shopper-rail">
            {categoryOptions.map((category) => (
              <CatalogChip
                key={category.id}
                selected={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
                className="min-w-max"
              >
                {category.label}
              </CatalogChip>
            ))}
          </div>
        </ShopperSurface>
        {isLoading && products.length === 0 ? (
          <CatalogSkeletonGrid count={6} />
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ShopperProductTile
                  key={product.id}
                  product={product}
                  showCategory={false}
                />
              ))}
            </div>
            {hasNextPage ? (
              <button
                type="button"
                onClick={fetchNextPage}
                disabled={isFetchingNext}
                className="inline-flex h-12 w-full items-center justify-center rounded-[1.35rem] border border-slate-200 bg-white text-sm font-black text-slate-700 shadow-[0_14px_28px_rgba(15,23,42,0.05)] disabled:opacity-60"
              >
                {isFetchingNext
                  ? (lang === "ar" ? "جارٍ التحميل…" : "Loading…")
                  : (lang === "ar" ? "عرض المزيد" : "Load more")}
              </button>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={Tag as typeof Sparkles}
            title={
              hasFilters
                ? (lang === "ar" ? "لا توجد عروض مطابقة" : "No matching offers")
                : (lang === "ar" ? "لا توجد عروض نشطة الآن" : "No active offers right now")
            }
            description={
              hasFilters
                ? (lang === "ar"
                    ? "جرّب إلغاء التصنيف الحالي أو الرجوع إلى كل العروض."
                    : "Try clearing the current category or returning to all offers.")
                : (lang === "ar"
                    ? "ترقّب! سيتم إضافة عروض وتخفيضات قريباً."
                    : "Stay tuned — deals and discounts are coming soon.")
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white"
                >
                  {lang === "ar" ? "إعادة الضبط" : "Reset"}
                </button>
              ) : null
            }
          />
        )}
      </div>
      <ShopperActionDock>
        <FeedDockButton
          icon={Tag as typeof SlidersHorizontal}
          label={lang === "ar" ? "ترتيب" : "Sort"}
          filled
          onClick={() => setSortOpen(true)}
        />
        <FeedDockButton
          icon={SlidersHorizontal}
          label={lang === "ar" ? "تصنيف" : "Filter"}
          active={hasFilters}
          onClick={() => setFilterOpen(true)}
        />
      </ShopperActionDock>
      <CatalogDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title={lang === "ar" ? "تصنيف العروض" : "Filter offers"}
        description={
          lang === "ar"
            ? "اختر القسم المطلوب."
            : "Choose the section you want to review."
        }
      >
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((category) => (
            <CatalogChip
              key={category.id}
              selected={activeCategory === category.id}
              onClick={() => {
                setActiveCategory(category.id);
                setFilterOpen(false);
              }}
            >
              {category.label}
            </CatalogChip>
          ))}
        </div>
      </CatalogDrawer>
      <CatalogDrawer
        open={sortOpen}
        onOpenChange={setSortOpen}
        title={lang === "ar" ? "ترتيب العروض" : "Sort offers"}
        description={
          lang === "ar"
            ? "اختر طريقة ترتيب العروض."
            : "Choose how the offers should be ordered."
        }
      >
        <div className="grid gap-2">
          {OFFERS_SORT_OPTIONS.map((option) => (
            <CatalogChip
              key={option.value}
              selected={sortBy === option.value}
              onClick={() => {
                setSortBy(option.value);
                setSortOpen(false);
              }}
              className="justify-start"
            >
              {lang === "ar" ? option.labelAr : option.labelEn}
            </CatalogChip>
          ))}
        </div>
      </CatalogDrawer>
    </ShopperPage>
  );
}

export function MobileCategoryDetailsView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const {
    categories,
    categoriesById,
    products,
    isLoading,
    isLoadingMore,
    isFullCatalogReady,
    totalProductCount,
    filterByCategory,
    loadNextPage,
    hasNextPage,
    search,
  } = useCatalog();
  const { searchQuery, setSearchQuery } = useSearchInput();
  const [sortBy, setSortBy] =
    useState<(typeof SORT_OPTIONS)[number]["value"]>("relevant");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery, 180);
  const category = id ? categoriesById[id] : undefined;

  // Server-side filter only needed before full catalog loads; afterwards the
  // hook derives the category slice directly from the in-memory allProducts.
  useEffect(() => {
    if (id && !isFullCatalogReady) void filterByCategory(id);
  }, [id, isFullCatalogReady, filterByCategory]);

  useEffect(() => {
    if (!id) return;

    const filters = {
      categoryId: id,
      onlyInStock: onlyInStock ? true : undefined,
      sortBy: sortBy !== "relevant" ? sortBy : undefined,
    };

    if (debouncedSearch || filters.onlyInStock !== undefined || filters.sortBy !== undefined) {
      void search(debouncedSearch, filters);
    }
  }, [id, debouncedSearch, onlyInStock, sortBy, search]);

  if (!category) {
    return (
      <ShopperPage docked={false} className="w-full">
        <EmptyState
          icon={PackageSearch}
          title={lang === "ar" ? "القسم غير متوفر" : "Category not found"}
          description={
            lang === "ar"
              ? "يمكنك العودة إلى الأقسام أو متابعة التصفح داخل كل المنتجات."
              : "You can return to categories or continue browsing the full marketplace."
          }
          action={
            <button
              type="button"
              onClick={() => navigate("/categories")}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white"
            >
              {lang === "ar" ? "العودة إلى الأقسام" : "Back to categories"}
            </button>
          }
        />
      </ShopperPage>
    );
  }
  const displayName = getLocalizedCategoryName(category, lang);
  // products is already server-filtered to this category by the effect above
  const { products: sortedProducts, resultCount, isSearching } = {
    products,
    resultCount: totalProductCount,
    isSearching: isLoading,
  };
  const relatedCategories = categories.filter((entry) => entry.id !== category.id).slice(0, 5);
  return (
    <ShopperPage className="w-full">
      <div className="space-y-4 w-full">
        <MobileListIntro
          eyebrow={lang === "ar" ? "القسم" : "Category"}
          title={displayName}
          activeFilters={
            <>
              <button
                type="button"
                onClick={() => navigate("/categories")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
              >
                <ArrowLeft className={cn("h-3.5 w-3.5", lang === "ar" && "rotate-180")} />
                {lang === "ar" ? "كل الأقسام" : "All categories"}
              </button>
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                {lang === "ar" ? "متاح" : "Available"}
              </span>
            </>
          }
        />
        <ShopperSurface className="overflow-hidden p-3">
          <div className="flex gap-3">
            <div className="flex-1 overflow-hidden rounded-[1.15rem] border border-slate-200 bg-slate-50">
              <ImageWithFallback
                src={category.imageUrl}
                alt={displayName}
                className="aspect-square w-full object-cover"
                style={category.imagePosition ? { objectPosition: category.imagePosition } : undefined}
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </ShopperSurface>
        {relatedCategories.length > 0 ? (
          <ShopperSurface className="overflow-hidden">
            <ShopperSectionHeader
              eyebrow={lang === "ar" ? "الأقسام القريبة" : "Nearby sections"}
              title={lang === "ar" ? "واصل التصفح بسهولة" : "Keep browsing smoothly"}
              description={
                lang === "ar"
                  ? "انتقل إلى قسم آخر من نفس الشاشة بدل الرجوع للخلف."
                  : "Jump into another section from the same feed without backtracking."
              }
            />
            <div className="mt-4 shopper-rail">
              {relatedCategories.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/categories/${entry.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
                >
                  {getLocalizedCategoryName(entry, lang)}
                </Link>
              ))}
            </div>
          </ShopperSurface>
        ) : null}
        <div
          className="sticky z-20 -mx-1 rounded-[1.3rem] border border-slate-200/80 bg-white/92 p-3 shadow-[0_14px_26px_rgba(15,23,42,0.08)] backdrop-blur-md"
          style={{ top: "var(--shopper-header-offset)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {lang === "ar" ? "نتائج القسم" : "Section results"}
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {lang === "ar"
                  ? `${resultCount} من ${category.count} منتج`
                  : `${resultCount} of ${category.count} products`}
              </p>
            </div>
            {isSearching ? (
              <span className="inline-flex min-h-10 items-center rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-black text-teal-700">
                {lang === "ar" ? "جارٍ الترتيب" : "Ranking"}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <CatalogChip selected={onlyInStock} onClick={() => setFilterOpen(true)}>
              {lang === "ar" ? "المتاح فقط" : "In stock only"}
            </CatalogChip>
            <CatalogChip selected={sortBy !== "relevant"} onClick={() => setSortOpen(true)}>
              {getOptionLabel(SORT_OPTIONS, sortBy, lang)}
            </CatalogChip>
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"
              >
                {searchQuery.trim()}
              </button>
            ) : null}
            {onlyInStock ? (
              <button
                type="button"
                onClick={() => setOnlyInStock(false)}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-black text-rose-600"
              >
                {lang === "ar" ? "مسح" : "Clear"}
              </button>
            ) : null}
          </div>
        </div>
        {isLoading && products.length === 0 ? (
          <CatalogSkeletonGrid count={6} />
        ) : sortedProducts.length > 0 ? (
          <>
            <ShopperSurface className="border-slate-200 bg-white">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {lang === "ar" ? "النتائج" : "Results"}
                  </p>
                  <p className="mt-2 text-lg font-black text-slate-950">{resultCount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {lang === "ar" ? "الترتيب" : "Sort"}
                  </p>
                  <p className="mt-2 text-sm font-black text-slate-900">{getOptionLabel(SORT_OPTIONS, sortBy, lang)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {lang === "ar" ? "التوفر" : "Stock"}
                  </p>
                  <p className="mt-2 text-sm font-black text-slate-900">
                    {onlyInStock ? (lang === "ar" ? "المتاح فقط" : "In stock only") : (lang === "ar" ? "كل المنتجات" : "All items")}
                  </p>
                </div>
              </div>
            </ShopperSurface>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sortedProducts.map((product) => (
                <ShopperProductTile
                  key={product.id}
                  product={product}
                  showCategory={false}
                />
              ))}
            </div>
            {hasNextPage ? (
              <button
                type="button"
                onClick={() => void loadNextPage()}
                disabled={isLoadingMore}
                className="inline-flex h-12 w-full items-center justify-center rounded-[1.35rem] border border-slate-200 bg-white text-sm font-black text-slate-700 shadow-[0_14px_28px_rgba(15,23,42,0.05)] disabled:opacity-60"
              >
                {isLoadingMore
                  ? (lang === "ar" ? "جارٍ التحميل..." : "Loading…")
                  : (lang === "ar" ? "عرض المزيد" : "Load more")}
              </button>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={PackageSearch}
            title={lang === "ar" ? "لا توجد نتائج داخل هذا القسم" : "No matches in this section"}
            description={
              lang === "ar"
                ? "جرّب إلغاء فلتر التوفر أو العودة إلى كل الأقسام."
                : "Try clearing the availability filter or going back to all sections."
            }
            action={
              <button
                type="button"
                onClick={() => {
                    setSearchQuery("");
                    setOnlyInStock(false);
                  }}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white"
              >
                {lang === "ar" ? "إعادة الضبط" : "Reset"}
              </button>
            }
          />
        )}
      </div>
      <MobileFilterDrawer
        open={sortOpen}
        onOpenChange={setSortOpen}
        title={lang === "ar" ? "ترتيب القسم" : "Sort section"}
        description={
          lang === "ar"
            ? "غيّر ترتيب المنتجات داخل هذا القسم."
            : "Change the order of products inside this section."
        }
        lang={lang}
      >
        <div className="grid gap-2">
          {SORT_OPTIONS.map((option) => (
            <CatalogChip
              key={option.value}
              selected={sortBy === option.value}
              onClick={() => {
                setSortBy(option.value);
                setSortOpen(false);
              }}
              className="justify-start"
            >
              {lang === "ar" ? option.labelAr : option.labelEn}
            </CatalogChip>
          ))}
        </div>
      </MobileFilterDrawer>
      <MobileFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title={lang === "ar" ? "تصفية القسم" : "Filter section"}
        description={
          lang === "ar"
            ? "طبّق فلاتر سريعة داخل نفس شاشة القسم."
            : "Apply quick filters without leaving this section feed."
        }
        lang={lang}
      >
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setOnlyInStock((current) => !current)}
            className={cn(
              "flex min-h-12 w-full items-center justify-between rounded-[1.2rem] border px-4 text-sm font-black transition-colors",
              onlyInStock
                ? "border-slate-900 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-700",
            )}
          >
            <span>{lang === "ar" ? "عرض المتاح فقط" : "Show in-stock only"}</span>
            <span>{onlyInStock ? "ON" : "OFF"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOnlyInStock(false);
              setFilterOpen(false);
            }}
            className="h-12 w-full rounded-[1.2rem] border border-rose-100 bg-rose-50 text-sm font-black text-rose-600"
          >
            {lang === "ar" ? "مسح الخيارات" : "Clear options"}
          </button>
        </div>
      </MobileFilterDrawer>
    </ShopperPage>
  );
}

export function MobileProductDetailsView() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { addToCart } = useCart();
  const { productsById, featuredProducts } = useCatalog();
  const [added, setAdded] = useState(false);
  const product = id ? productsById[id] : undefined;
  const relatedProducts = useMemo(() => {
    if (!product) {
      return [];
    }
    return featuredProducts
      .filter((item) => item.category === product.category && item.id !== product.id)
      .slice(0, 6);
  }, [featuredProducts, product]);
  useEffect(() => {
    if (!added) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [added]);
  if (!product) {
    return (
      <ShopperPage docked={false} className="w-full">
        <EmptyState
          icon={PackageSearch}
          title={lang === "ar" ? "المنتج غير متوفر" : "Product not found"}
          description={
            lang === "ar"
              ? "يمكنك الرجوع إلى المنتجات أو متابعة التصفح من الأقسام."
              : "You can return to products or continue browsing from categories."
          }
          action={
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white"
            >
              {lang === "ar" ? "العودة إلى المنتجات" : "Back to products"}
            </button>
          }
        />
      </ShopperPage>
    );
  }
  const displayName = getLocalizedProductName(product, lang);
  const categoryLabel =
    lang === "en" ? product.categoryNameEn || product.categoryName : product.categoryName;
  const backTarget =
    typeof location.state === "object"
      && location.state
      && "from" in location.state
      && typeof location.state.from === "string"
      ? location.state.from
      : `/categories/${product.category}`;
  const deliveryWindowSentence = getDeliveryWindowSentence(lang);
  const deliveryCompact = getDeliveryWindowCompactLabel(lang);
  return (
    <ShopperPage className="w-full">
      <div className="space-y-4 w-full">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(backTarget)}
            className="inline-flex h-11 items-center gap-2 rounded-[1.1rem] border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.05)]"
          >
            <ArrowLeft className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
            {lang === "ar" ? "رجوع" : "Back"}
          </button>
          <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600">
            {categoryLabel}
          </span>
        </div>
        <ShopperSurface className="overflow-hidden">
          <div className="rounded-[1.5rem] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4f8f8_100%)] p-4">
            <ImageWithFallback
              src={getCatalogProductImage(product)}
              alt={displayName}
              className="aspect-square w-full rounded-[1.2rem] object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
        </ShopperSurface>
        <ShopperSurface>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            {lang === "ar" ? "معلومة مباشرة من الكتالوج" : "Live catalog data"}
          </p>
          <h1 className="mt-2 text-[1.9rem] font-black leading-[1.05] tracking-tight text-slate-950">
            {displayName}
          </h1>
          <div className="mt-5 rounded-[1.45rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {lang === "ar" ? "السعر الحالي" : "Current price"}
            </p>
            <p className="mt-1 text-[2rem] font-black tracking-tight text-slate-950">
              {product.price.toFixed(2)} <span className="text-base text-slate-400">{t("currency")}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1.5 text-xs font-black",
                  product.inStock ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600",
                )}
              >
                {product.inStock ? (lang === "ar" ? "جاهز للطلب" : "Ready to order") : (lang === "ar" ? "غير متاح الآن" : "Unavailable")}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600">
                {lang === "ar" ? `كود ${product.code || product.barcode || product.id}` : `Code ${product.code || product.barcode || product.id}`}
              </span>
            </div>
          </div>
        </ShopperSurface>
        <ShopperSurface>
          <ShopperSectionHeader
            eyebrow={lang === "ar" ? "التوصيل والخدمة" : "Delivery and service"}
            title={lang === "ar" ? "ما الذي يحدث بعد الإضافة؟" : "What happens after adding?"}
            description={
              lang === "ar"
                ? `${deliveryWindowSentence} مع رسوم تحدد حسب المنطقة.`
                : `${deliveryWindowSentence} with fee based on area.`
            }
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center gap-2 text-slate-700">
                <Truck className="h-4 w-4" />
                <p className="text-sm font-black">{lang === "ar" ? "نافذة التوصيل" : "Delivery window"}</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">{deliveryCompact}</p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-sm font-black">{lang === "ar" ? "رسوم حسب المنطقة" : "Area-based fee"}</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {lang === "ar" ? "تحدد عند إتمام الطلب" : "Calculated at checkout"}
              </p>
            </div>
          </div>
        </ShopperSurface>
        {relatedProducts.length > 0 ? (
          <div className="space-y-3">
            <ShopperSectionHeader
              eyebrow={lang === "ar" ? "ربما يعجبك أيضاً" : "You may also like"}
              title={lang === "ar" ? "استكمال نفس الرحلة" : "Keep the same journey going"}
              description={
                lang === "ar"
                  ? "منتجات قريبة من نفس القسم لزيادة سرعة المقارنة والإضافة."
                  : "Nearby items from the same section for faster comparison and carting."
              }
            />
            <div className="shopper-rail">
              {relatedProducts.map((item) => (
                <ShopperProductTile
                  key={item.id}
                  product={item}
                  className="min-w-0"
                  showCategory={false}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <ShopperActionDock>
        <div style={{ flex: "0 0 auto" }}>
          <FavoriteHeartButton productId={product.id} className="h-12 w-12 rounded-full" />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center rounded-full bg-slate-50 px-4 text-sm font-black text-slate-700">
          {product.price.toFixed(2)} {t("currency")}
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!product.inStock) {
              return;
            }
            await addToCart(product);
            setAdded(true);
          }}
          disabled={!product.inStock}
          className={cn(
            "inline-flex h-12 min-w-0 flex-1 items-center justify-center rounded-full text-sm font-black transition-all",
            product.inStock
              ? added
                ? "bg-slate-950 text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)]"
                : "bg-[#2563eb] text-white shadow-[0_16px_28px_rgba(37,99,235,0.24)]"
              : "bg-slate-200 text-slate-500",
          )}
        >
          {added ? (lang === "ar" ? "تمت الإضافة" : "Added to cart") : t("add_to_cart")}
        </button>
      </ShopperActionDock>
    </ShopperPage>
  );
}

export function MobileCartView() {
  const navigate = useNavigate();
  const { cart, removeFromCart, updateQuantity, summary } = useCart();
  const { featuredProducts } = useCatalog();
  const { t, lang } = useLanguage();
  const [visibleRecommendations, setVisibleRecommendations] = useState(4);
  const recommendationPool = featuredProducts.filter(
    (product) => !cart.some((item) => item.product_id === product.id),
  );
  const recommendations = recommendationPool.slice(0, visibleRecommendations);
  if (cart.length === 0) {
    return (
      <ShopperPage docked={false} className="w-full">
        <div className="space-y-4 w-full">
          <ShopperSurface className="overflow-hidden bg-[linear-gradient(145deg,#ffffff_0%,#f7fbfb_60%,#edf5f6_100%)] text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#fef3c7] text-[#b45309] shadow-[0_18px_34px_rgba(245,158,11,0.18)]">
              <ShoppingBag className="h-10 w-10" />
            </div>
            <h1 className="mt-5 text-[2rem] font-black tracking-tight text-slate-950">
              {lang === "ar" ? "سلة التسوق فارغة" : "Your cart looks empty"}
            </h1>
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="mt-5 inline-flex h-12 items-center justify-center rounded-[1.2rem] bg-[#111827] px-6 text-sm font-black text-white"
            >
              {lang === "ar" ? "ابدأ التسوق" : "Start shopping"}
            </button>
          </ShopperSurface>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              <ShopperSectionHeader
                eyebrow={lang === "ar" ? "اقتراحات لك" : "Picked for you"}
                title={lang === "ar" ? "ابدأ من عروض جاهزة" : "Start from ready offers"}
                description={
                  lang === "ar"
                    ? "بدلاً من عرض منتجين أو ثلاثة فقط، أصبحت السلة الفارغة تعرض شبكة عروض واضحة وقابلة للتوسعة."
                    : "Instead of showing only a couple of items, the empty cart now opens into an expandable offers grid."
                }
              />
              <div className="grid grid-cols-2 gap-3">
                {recommendations.map((product) => (
                  <ShopperProductTile key={product.id} product={product} showCategory={false} />
                ))}
              </div>
              {recommendationPool.length > visibleRecommendations ? (
                <button
                  type="button"
                  onClick={() => setVisibleRecommendations((current) => current + 4)}
                  className="inline-flex h-12 w-full items-center justify-center rounded-[1.2rem] border border-slate-200 bg-white text-sm font-black text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                >
                  {lang === "ar" ? "عرض المزيد من العروض" : "Load more offers"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </ShopperPage>
    );
  }
  return (
    <ShopperPage className="w-full">
      <div className="space-y-4 w-full">
        <ShopperSurface className="overflow-hidden bg-[linear-gradient(145deg,#ffffff_0%,#f7fbfb_60%,#edf5f6_100%)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {lang === "ar" ? "مراجعة الطلب" : "Order review"}
              </p>
              <h1 className="mt-2 text-[1.8rem] font-black leading-[1.04] tracking-tight text-slate-950">
                {lang === "ar" ? "سلة مرتبة وواضحة" : "A clearer cart"}
              </h1>
            </div>
            <Link
              to="/products"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
            >
              {lang === "ar" ? "إضافة المزيد" : "Add more"}
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {lang === "ar" ? "العناصر" : "Items"}
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">{summary.itemCount}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {lang === "ar" ? "التوصيل" : "Delivery"}
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">{getDeliveryWindowLabel(lang)}</p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {lang === "ar" ? "الإجمالي" : "Total"}
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {summary.subtotal.toFixed(2)} {t("currency")}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-[1.2rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            {lang === "ar" ? "مراجعة واضحة قبل الدفع" : "A clear review before payment"}
          </div>
        </ShopperSurface>
        <div className="space-y-3">
          {cart.map((item) => {
            const lineTotal = item.product.price * item.quantity;
            return (
              <ShopperSurface key={item.id} className="p-4">
                <div className="flex gap-3">
                  <Link
                    to={`/products/${item.product_id}`}
                    state={{ from: "/cart" }}
                    className="h-[5.9rem] w-[5.9rem] shrink-0 overflow-hidden rounded-[1.1rem] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4f8f8_100%)]"
                  >
                    <ImageWithFallback
                      src={getCatalogProductImage(item.product)}
                      alt={getLocalizedProductName(item.product, lang)}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/products/${item.product_id}`} state={{ from: "/cart" }} className="block min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-black leading-6 text-slate-950">
                          {getLocalizedProductName(item.product, lang)}
                        </h3>
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="inline-flex h-8 items-center justify-center rounded-[0.8rem] border border-rose-100 bg-rose-50 px-3 text-[11px] font-black text-rose-600"
                      >
                        {lang === "ar" ? "إزالة" : "Remove"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500" dir="ltr">
                      {item.product.code || item.product.barcode || item.product.id}
                    </p>
                    <div className="mt-3 grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            {lang === "ar" ? "سعر الوحدة" : "Unit price"}
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-900">
                            {item.product.price.toFixed(2)} {t("currency")}
                          </p>
                        </div>
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-2 text-end">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            {lang === "ar" ? "الإجمالي" : "Line total"}
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-900">
                            {lineTotal.toFixed(2)} {t("currency")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-slate-200 bg-slate-50 p-1.5">
                        <div className="px-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            {lang === "ar" ? "الكمية" : "Quantity"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[0.9rem] text-slate-700"
                            aria-label={lang === "ar" ? "تقليل الكمية" : "Decrease quantity"}
                          >
                            <span className="text-lg font-black">-</span>
                          </button>
                          <span className="inline-flex min-w-8 items-center justify-center text-sm font-black text-slate-950">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[0.9rem] text-slate-700"
                            aria-label={lang === "ar" ? "زيادة الكمية" : "Increase quantity"}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ShopperSurface>
            );
          })}
        </div>
        <ShopperSurface className="border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                {lang === "ar" ? "ملخص السلة" : "Cart summary"}
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-950">
                {lang === "ar" ? "جاهز قبل الإتمام" : "Ready before checkout"}
              </h2>
            </div>
            <div className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white">
              {summary.itemCount} {lang === "ar" ? "قطعة" : "items"}
            </div>
          </div>
          <div className="mt-4 space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-500">{t("subtotal")}</span>
              <span className="font-black text-slate-950">
                {summary.subtotal.toFixed(2)} {t("currency")}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-500">{t("shipping")}</span>
              <span className="font-black text-slate-950">
                {lang === "ar" ? "يُحدد لاحقاً" : "Calculated at checkout"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-500">
                {lang === "ar" ? "موعد التوصيل" : "Delivery window"}
              </span>
              <span className="font-black text-slate-950">{getDeliveryWindowLabel(lang)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <span className="text-base font-black text-slate-950">{t("total")}</span>
              <span className="text-lg font-black text-slate-950">
                {summary.subtotal.toFixed(2)} {t("currency")}
              </span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              to="/products"
              className="inline-flex h-12 items-center justify-center rounded-[1.2rem] border border-slate-200 bg-white text-sm font-black text-slate-700"
            >
              {lang === "ar" ? "متابعة التسوق" : "Continue shopping"}
            </Link>
            <Link
              to="/checkout"
              className="inline-flex h-12 items-center justify-center rounded-[1.2rem] bg-[#2563eb] text-sm font-black text-white shadow-[0_16px_28px_rgba(37,99,235,0.24)]"
            >
              {lang === "ar" ? "الانتقال إلى الدفع" : "Proceed to checkout"}
            </Link>
          </div>
        </ShopperSurface>
        {recommendations.length > 0 ? (
          <div className="space-y-3">
            <ShopperSectionHeader
              eyebrow={lang === "ar" ? "قد تحتاج أيضاً" : "You may need too"}
              title={lang === "ar" ? "أضف عروضاً مع طلبك الحالي" : "Add more offers to this order"}
              description={
                lang === "ar"
                  ? "العروض المقترحة أصبحت مرتبة في شبكة أوضح مع إمكانية تحميل المزيد."
                  : "Suggested offers are now arranged in a clearer grid with load-more support."
              }
            />
            <div className="grid grid-cols-2 gap-3">
              {recommendations.map((product) => (
                <ShopperProductTile key={product.id} product={product} showCategory={false} />
              ))}
            </div>
            {recommendationPool.length > visibleRecommendations ? (
              <button
                type="button"
                onClick={() => setVisibleRecommendations((current) => current + 4)}
                className="inline-flex h-12 w-full items-center justify-center rounded-[1.2rem] border border-slate-200 bg-white text-sm font-black text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
              >
                {lang === "ar" ? "عرض المزيد من العروض" : "Load more offers"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <ShopperActionDock>
        <div className="rounded-[1.05rem] bg-slate-50 px-4 py-2 text-center text-sm font-black text-slate-700">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            {lang === "ar" ? "الإجمالي" : "Total"}
          </p>
          <p className="mt-1">
            {summary.subtotal.toFixed(2)} {t("currency")}
          </p>
        </div>
        <Link
          to="/checkout"
          className="inline-flex h-12 items-center justify-center rounded-full bg-[#2563eb] text-sm font-black text-white shadow-[0_16px_28px_rgba(37,99,235,0.24)]"
        >
          {lang === "ar" ? "إتمام الطلب" : "Checkout"}
        </Link>
      </ShopperActionDock>
    </ShopperPage>
  );
}

export function MobileProfileView() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { cart } = useCart();
  const { lang } = useLanguage();
  const [notifications, setNotifications] = useState(readPreferences);
  const [orders, setOrders] = useState<StoredOrder[]>(() => {
    if (!user) {
      return [];
    }

    const cachedOrders = getCachedCustomerOrders();

    if (cachedOrders?.length) {
      return syncRemoteOrders(cachedOrders, user.phone);
    }

    return readOrders().filter((order) => user.role !== "customer" || order.phone === user.phone);
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROFILE_PREFERENCES_KEY, JSON.stringify(notifications));
    }
  }, [notifications]);
  useEffect(() => {
    if (!user || user.role !== "customer") {
      setOrders(user ? readOrders() : []);
      return;
    }

    setOrders(readOrders().filter((order) => order.phone === user.phone));

    let active = true;

    void getCustomerOrders(true)
      .then((remoteOrders) => {
        if (!active) {
          return;
        }

        setOrders(syncRemoteOrders(remoteOrders, user.phone));
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setOrders(readOrders().filter((order) => order.phone === user.phone));
      });

    return () => {
      active = false;
    };
  }, [user]);
  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + order.total, 0),
    [orders],
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );
  const userInitial =
    user?.fullName?.charAt(0).toUpperCase()
    || user?.phone?.charAt(0).toUpperCase()
    || "U";
  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
        dateStyle: "medium",
      }),
    [lang],
  );
  if (!user) {
    return (
      <ShopperPage docked={false} className="w-full">
        <EmptyState
          icon={ShieldCheck}
          title={lang === "ar" ? "سجل الدخول للوصول إلى الحساب" : "Sign in to access your account"}
          description={
            lang === "ar"
              ? "الطلبات السابقة، التفضيلات، وصفحات المساعدة كلها تظهر هنا بعد تسجيل الدخول."
              : "Orders, preferences, and help pages all appear here after you sign in."
          }
          action={
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white"
            >
              {lang === "ar" ? "تسجيل الدخول" : "Login"}
            </button>
          }
        />
      </ShopperPage>
    );
  }
  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };
  return (
    <ShopperPage docked={false} className="w-full">
      <div className="space-y-4 w-full">
        <ShopperSurface className="overflow-hidden bg-[linear-gradient(145deg,#ffffff_0%,#f7fbfb_60%,#edf5f6_100%)]">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)] text-xl font-black text-white shadow-[0_18px_34px_rgba(25,56,68,0.24)]">
              {userInitial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {lang === "ar" ? "الحساب" : "Account"}
              </p>
              <h1 className="mt-2 truncate text-[1.8rem] font-black leading-[1.04] tracking-tight text-slate-950">
                {user.fullName || (lang === "ar" ? "المستخدم" : "User")}
              </h1>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500" dir="ltr">
                {user.phone}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-center">
              <p className="text-lg font-black text-slate-950">{orders.length}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {lang === "ar" ? "طلبات" : "Orders"}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-center">
              <p className="text-lg font-black text-slate-950">{cartCount}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {lang === "ar" ? "في السلة" : "In cart"}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-center">
              <p className="text-lg font-black text-slate-950">
                {totalSpent.toFixed(0)}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {lang === "ar" ? "إجمالي" : "Spent"}
              </p>
            </div>
          </div>
        </ShopperSurface>
        <div className="grid gap-3 sm:grid-cols-2">
          <ShopperAccountLink
            icon={Package}
            title={lang === "ar" ? "طلباتي" : "My orders"}
            subtitle={
              lang === "ar"
                ? `${orders.length} طلب سابق`
                : `${orders.length} previous orders`
            }
          />
          <ShopperAccountLink
            icon={ShoppingBag}
            title={lang === "ar" ? "السلة الحالية" : "Current cart"}
            subtitle={
              lang === "ar"
                ? `${cartCount} عناصر نشطة`
                : `${cartCount} active items`
            }
            to="/cart"
          />
        </div>
        <ShopperSurface>
          <ShopperSectionHeader
            eyebrow={lang === "ar" ? "آخر الطلبات" : "Recent orders"}
            title={lang === "ar" ? "سجل الطلبات" : "Order history"}
            description={
              lang === "ar"
                ? "عرض سريع لسجل الطلبات المرتبط بالحساب الحالي."
                : "A quick view of the order history tied to the current account."
            }
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {orders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{order.id}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatDate.format(new Date(order.createdAt))}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-black text-slate-950">
                      {order.total.toFixed(2)} {lang === "ar" ? "ج.م" : "EGP"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {order.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 ? (
              <p className="text-sm font-semibold leading-7 text-slate-500">
                {lang === "ar"
                  ? "لا توجد طلبات محفوظة بعد."
                  : "No saved orders yet."}
              </p>
            ) : null}
          </div>
        </ShopperSurface>
        <ShopperSurface>
          <ShopperSectionHeader
            eyebrow={lang === "ar" ? "التفضيلات" : "Preferences"}
            title={lang === "ar" ? "ما الذي يصلك؟" : "What should reach you?"}
            description={
              lang === "ar"
                ? "بدّل تفضيلات التنبيهات المحلية من داخل الحساب."
                : "Toggle local notification preferences directly from the account hub."
            }
          />
          <div className="mt-4 space-y-3">
            {[
              {
                key: "orders" as const,
                labelAr: "تنبيهات الطلبات",
                labelEn: "Order updates",
                noteAr: "حالة الطلب، المراجعة، والتوصيل",
                noteEn: "Order status, review, and delivery",
              },
              {
                key: "offers" as const,
                labelAr: "العروض",
                labelEn: "Offers",
                noteAr: "عروض وتوصيات مرتبطة بالتسوق",
                noteEn: "Shopping-related offers and recommendations",
              },
              {
                key: "news" as const,
                labelAr: "أخبار الصيدلية",
                labelEn: "Pharmacy news",
                noteAr: "إعلانات الخدمة والفروع",
                noteEn: "Service and branch announcements",
              },
            ].map((item) => {
              const active = notifications[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setNotifications((current) => ({
                      ...current,
                      [item.key]: !current[item.key],
                    }))
                  }
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[1.2rem] border px-4 py-3 text-sm transition-colors",
                    active
                      ? "border-slate-900 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700",
                  )}
                >
                  <div className="text-start">
                    <p className="font-black">{lang === "ar" ? item.labelAr : item.labelEn}</p>
                    <p
                      className={cn(
                        "mt-1 text-xs font-semibold",
                        active ? "text-white/70" : "text-slate-400",
                      )}
                    >
                      {lang === "ar" ? item.noteAr : item.noteEn}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                        active
                          ? "bg-white/12 text-white"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {active
                        ? lang === "ar"
                          ? "مفعل"
                          : "On"
                        : lang === "ar"
                          ? "متوقف"
                          : "Off"}
                    </span>
                    <Bell className="h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </ShopperSurface>
        <ShopperSurface>
          <ShopperSectionHeader
            eyebrow={lang === "ar" ? "المساعدة والسياسات" : "Help and policies"}
            title={lang === "ar" ? "كل ما تحتاجه بعد الدخول" : "Everything after sign-in"}
            description={
              lang === "ar"
                ? "راجع الدعم والسياسات المرتبطة بالحساب والطلبات."
                : "Review support and policy pages related to your account and orders."
            }
          />
          <div className="mt-4 grid gap-3">
            <ShopperAccountLink
              icon={Phone}
              title={lang === "ar" ? "اتصل بنا" : "Contact us"}
              subtitle={lang === "ar" ? "دعم مباشر وبيانات الفروع" : "Direct support and branch details"}
              to="/contact"
            />
            <ShopperAccountLink
              icon={Truck}
              title={lang === "ar" ? "سياسة التوصيل" : "Delivery policy"}
              subtitle={lang === "ar" ? "مواعيد ورسوم التوصيل" : "Time windows and delivery fees"}
              to="/shipping"
            />
            <ShopperAccountLink
              icon={RotateCcw}
              title={lang === "ar" ? "الإرجاع" : "Returns"}
              subtitle={lang === "ar" ? "تقديم طلب إرجاع ومراجعة الشروط" : "Submit a return request and review the terms"}
              to="/returns"
            />
            <ShopperAccountLink
              icon={CircleHelp}
              title={lang === "ar" ? "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629" : "FAQ"}
              subtitle={lang === "ar" ? "\u0625\u062c\u0627\u0628\u0627\u062a \u0633\u0631\u064a\u0639\u0629 \u0644\u0644\u0627\u0633\u062a\u0641\u0633\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062a\u0643\u0631\u0631\u0629" : "Quick answers to common questions"}
              to="/faq"
            />
            <ShopperAccountLink
              icon={ShieldCheck}
              title={lang === "ar" ? "\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629" : "Privacy policy"}
              subtitle={lang === "ar" ? "\u0643\u064a\u0641 \u064a\u062a\u0645 \u0627\u0644\u062a\u0639\u0627\u0645\u0644 \u0645\u0639 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0648\u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a" : "How data and personal information are handled"}
              to="/privacy"
            />
            <ShopperAccountLink
              icon={FileText}
              title={lang === "ar" ? "\u0627\u0644\u0634\u0631\u0648\u0637 \u0648\u0627\u0644\u0623\u062d\u0643\u0627\u0645" : "Terms and conditions"}
              subtitle={lang === "ar" ? "\u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a\u0629 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0627\u0644\u0637\u0644\u0628\u0627\u062a" : "Legal terms for ordering and use"}
              to="/terms"
            />
            <ShopperAccountLink
              icon={Info}
              title={lang === "ar" ? "\u0639\u0646 \u0627\u0644\u0635\u064a\u062f\u0644\u064a\u0629" : "About us"}
              subtitle={lang === "ar" ? "\u062a\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0641\u0631\u0648\u0639 \u0648\u0627\u0644\u062e\u062f\u0645\u0629" : "Learn about the branches and service"}
              to="/about"
            />
          </div>
          <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              {lang === "ar" ? "مركز الخدمة" : "Service hub"}
            </p>
            <p className="mt-2 text-sm font-black text-slate-950">
              {lang === "ar"
                ? "كل الروابط الأساسية للحساب والطلبات أصبحت منظمة في مساحة واحدة."
                : "The key account and order-related pages are now organized into one clearer service hub."}
            </p>
          </div>
        </ShopperSurface>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.3rem] border border-rose-100 bg-rose-50 text-sm font-black text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          {lang === "ar" ? "تسجيل الخروج" : "Logout"}
        </button>
      </div>
    </ShopperPage>
  );
}

// ─── MobileFavoritesView ──────────────────────────────────────────────────────

export function MobileFavoritesView() {
  const { lang } = useLanguage();
  const { productsById } = useCatalog();
  const { favoriteIds, isBusy } = useFavorites();
  const [fetchedProducts, setFetchedProducts] = useState<Record<string, CatalogProduct>>({});
  const fetchedRef = useRef<Record<string, CatalogProduct>>({});
  const [isFetchingFavs, setIsFetchingFavs] = useState(false);

  useEffect(() => {
    if (favoriteIds.size === 0) return;
    const missingIds = Array.from(favoriteIds).filter(
      (id) => !productsById[id] && !fetchedRef.current[id],
    );
    if (missingIds.length === 0) return;
    setIsFetchingFavs(true);
    void fetchProductsByIds(missingIds).then((fetched) => {
      fetched.forEach((p) => { fetchedRef.current[p.id] = p; });
      setFetchedProducts({ ...fetchedRef.current });
      setIsFetchingFavs(false);
    });
  }, [favoriteIds, productsById]);

  const favoriteProducts = useMemo(() => {
    const allById: Record<string, CatalogProduct> = { ...fetchedProducts, ...productsById };
    return Array.from(favoriteIds)
      .map((id) => allById[id])
      .filter((p): p is CatalogProduct => Boolean(p));
  }, [favoriteIds, productsById, fetchedProducts]);

  const isLoading = isBusy || isFetchingFavs;
  const availableCount = favoriteProducts.filter((p) => p.inStock).length;

  return (
    <ShopperPage docked={false} className="w-full">
      <div className="space-y-4">
        {/* Header card */}
        <ShopperSurface>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50">
              <Heart className="h-5 w-5 fill-rose-400 text-rose-400" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-slate-950">
                {lang === "ar" ? "المفضلة" : "Favourites"}
              </h1>
              <p className="text-xs font-semibold text-slate-400">
                {favoriteIds.size}{" "}
                {lang === "ar" ? "منتج محفوظ" : favoriteIds.size === 1 ? "saved item" : "saved items"}
              </p>
            </div>
            {favoriteProducts.length > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-black text-white"
                style={{ background: "var(--primary)" }}
              >
                <Sparkles className="h-3 w-3" />
                {availableCount}
              </span>
            )}
          </div>
        </ShopperSurface>

        {isLoading ? (
          <CatalogSkeletonGrid count={6} />
        ) : favoriteProducts.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={lang === "ar" ? "لا توجد منتجات محفوظة" : "No saved items"}
            description={
              lang === "ar"
                ? "احفظ المنتجات للرجوع إليها لاحقاً من صفحات الكتالوج والعروض."
                : "Save products from the catalog or offers to find them here."
            }
            action={
              <Link
                to="/products"
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white"
              >
                <Package className="h-4 w-4" />
                {lang === "ar" ? "تصفح المنتجات" : "Browse products"}
              </Link>
            }
          />
        ) : (
          <ShopperSurface>
            <div className="grid grid-cols-2 gap-3">
              {favoriteProducts.map((product) => (
                <ShopperProductTile key={product.id} product={product} />
              ))}
            </div>
          </ShopperSurface>
        )}
      </div>
    </ShopperPage>
  );
}
