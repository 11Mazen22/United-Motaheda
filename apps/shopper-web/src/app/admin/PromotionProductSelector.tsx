import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  detectPromotionConflicts,
  searchPromotionProducts,
  type PromotionConflict,
  type PromotionDiscountType,
  type PromotionProduct,
  type PromotionProductSort,
  type PromotionProductStockFilter,
} from "../../services/promotionsApi";
import { getDiscountedPrice } from "../../utils/promotionUtils";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { cn } from "../components/UI";

interface KnownProduct {
  name: string;
  nameAr?: string;
  nameEn?: string;
  price: number;
  stock?: number;
  code?: string;
  barcode?: string;
  category?: string;
  categoryName?: string;
  categoryNameEn?: string;
  imageUrl?: string;
}

interface Props {
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
  discountPreview?: string;
  discountType?: PromotionDiscountType;
  discountValue?: number;
  startsAt?: string;
  endsAt?: string;
  excludePromotionId?: string;
  knownProducts?: Map<string, KnownProduct>;
}

const PAGE_SIZE = 20;

function formatCurrency(value: number, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value);
}

function stockTone(stock: number): string {
  if (stock <= 0) return "border-rose-200 bg-rose-50 text-rose-700";
  if (stock < 10) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function CatalogImage({ product, name }: { product: { imageUrl?: string }; name: string }) {
  return product.imageUrl ? (
    <img src={product.imageUrl} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl border border-slate-100 object-cover" />
  ) : (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-300" aria-hidden>
      <CubeIcon className="h-5 w-5" />
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** Manager catalog workspace for assigning products to an offer. Search,
 * filters, sorting and counts are server-backed so pagination never hides
 * eligible products or reports partial totals. */
export function PromotionProductSelector({
  selectedIds,
  onToggle,
  onSelectionChange,
  discountPreview,
  discountType,
  discountValue,
  startsAt,
  endsAt,
  excludePromotionId,
  knownProducts,
}: Props) {
  const { t } = useTranslation();
  const isArabic = t("lang") === "ar";
  const lang: "ar" | "en" = isArabic ? "ar" : "en";
  const copy = isArabic ? {
    subtitle: "اختر المنتجات المؤهلة وراجع السعر والمخزون والتعارضات قبل حفظ العرض.",
    catalog: "كتالوج المنتجات",
    selected: "المنتجات المحددة",
    selectedValue: "قيمة المنتجات",
    customerPays: "السعر بعد الخصم",
    estimatedSaving: "التوفير المتوقع",
    search: "ابحث بالاسم العربي أو الإنجليزي أو الكود أو الباركود",
    allCategories: "جميع الأقسام",
    allStock: "كل حالات المخزون",
    inStock: "متوفر",
    lowStock: "مخزون منخفض",
    outOfStock: "نفد المخزون",
    nameAsc: "الاسم: أ–ي",
    nameDesc: "الاسم: ي–أ",
    priceAsc: "السعر: الأقل أولاً",
    priceDesc: "السعر: الأعلى أولاً",
    stockAsc: "المخزون: الأقل أولاً",
    stockDesc: "المخزون: الأعلى أولاً",
    eligible: "منتج مؤهل",
    showing: "عرض {{from}}–{{to}} من {{total}}",
    selectPage: "تحديد الصفحة",
    clearPage: "إلغاء تحديد الصفحة",
    clearFilters: "مسح الفلاتر",
    noResults: "لا توجد منتجات مطابقة",
    noResultsHint: "غيّر كلمة البحث أو فلاتر القسم والمخزون.",
    retry: "إعادة المحاولة",
    product: "المنتج",
    identifiers: "الكود والباركود",
    stock: "المخزون",
    pricing: "سعر العرض",
    basePrice: "السعر الأساسي",
    offerPrice: "سعر العرض",
    currentOffer: "ضمن عرض نشط",
    overlap: "تعارض زمني",
    overlapSummary: "{{products}} منتج محدد مرتبط بعرض آخر خلال نفس الفترة. راجع التحذيرات قبل الحفظ.",
    checkingConflicts: "جارٍ فحص تعارضات الجدول…",
    conflictCheckFailed: "تعذر التحقق من تعارضات العروض. أعد المحاولة قبل الحفظ للتأكد من الجدول.",
    previousPage: "الصفحة السابقة",
    nextPage: "الصفحة التالية",
    noSelection: "لم تحدد منتجات بعد",
    noSelectionHint: "استخدم البحث والفلاتر ثم حدد المنتجات التي سيُطبق عليها العرض.",
    clearAll: "إلغاء تحديد الكل",
    remove: "إزالة {{name}} من العرض",
    page: "صفحة {{page}} من {{pages}}",
  } : {
    subtitle: "Choose eligible products and review pricing, stock, and conflicts before saving the offer.",
    catalog: "Product catalog",
    selected: "Selected products",
    selectedValue: "Catalog value",
    customerPays: "Offer value",
    estimatedSaving: "Estimated saving",
    search: "Search Arabic/English name, code, or barcode",
    allCategories: "All categories",
    allStock: "All stock states",
    inStock: "In stock",
    lowStock: "Low stock",
    outOfStock: "Out of stock",
    nameAsc: "Name: A–Z",
    nameDesc: "Name: Z–A",
    priceAsc: "Price: low to high",
    priceDesc: "Price: high to low",
    stockAsc: "Stock: low to high",
    stockDesc: "Stock: high to low",
    eligible: "eligible products",
    showing: "Showing {{from}}–{{to}} of {{total}}",
    selectPage: "Select page",
    clearPage: "Clear page",
    clearFilters: "Clear filters",
    noResults: "No matching products",
    noResultsHint: "Adjust the search term, category, or stock filter.",
    retry: "Try again",
    product: "Product",
    identifiers: "Code & barcode",
    stock: "Stock",
    pricing: "Offer price",
    basePrice: "Base price",
    offerPrice: "Offer price",
    currentOffer: "In an active offer",
    overlap: "Schedule overlap",
    overlapSummary: "{{products}} selected product(s) also belong to another offer during this window. Review the warnings before saving.",
    checkingConflicts: "Checking schedule conflicts…",
    conflictCheckFailed: "Promotion conflicts could not be verified. Retry before saving to confirm the schedule.",
    previousPage: "Previous page",
    nextPage: "Next page",
    noSelection: "No products selected",
    noSelectionHint: "Use search and filters, then select the products covered by this offer.",
    clearAll: "Clear all",
    remove: "Remove {{name}} from the offer",
    page: "Page {{page}} of {{pages}}",
  };

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [stockStatus, setStockStatus] = useState<PromotionProductStockFilter>("all");
  const [sort, setSort] = useState<PromotionProductSort>("name_asc");
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<PromotionProduct[]>([]);
  const [productCache, setProductCache] = useState<Map<string, PromotionProduct>>(() => new Map());
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [conflicts, setConflicts] = useState<PromotionConflict[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictError, setConflictError] = useState("");
  const [conflictReloadKey, setConflictReloadKey] = useState(0);
  const search = useDebouncedValue(query, 300);
  const requestId = useRef(0);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const categories = useMemo(() => {
    const byId = new Map<string, { id: string; label: string }>();
    knownProducts?.forEach((product) => {
      if (!product.category) return;
      const label = isArabic
        ? product.categoryName || product.categoryNameEn || product.category
        : product.categoryNameEn || product.categoryName || product.category;
      byId.set(product.category, { id: product.category, label });
    });
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, isArabic ? "ar" : "en"));
  }, [isArabic, knownProducts]);

  useEffect(() => { setPage(1); }, [search, category, stockStatus, sort]);
  useEffect(() => { setPage((current) => Math.min(current, totalPages)); }, [totalPages]);

  useEffect(() => {
    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    void searchPromotionProducts({
      query: search,
      category,
      stockStatus,
      sort,
      locale: lang,
      page,
      pageSize: PAGE_SIZE,
      signal: controller.signal,
    }).then((result) => {
      if (currentRequest !== requestId.current) return;
      setProducts(result.products);
      setProductCache((current) => {
        const next = new Map(current);
        result.products.forEach((product) => next.set(product.id, product));
        return next;
      });
      setTotal(result.total);
    }).catch((cause) => {
      if (controller.signal.aborted || currentRequest !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : "Could not load eligible products.");
    }).finally(() => {
      if (!controller.signal.aborted && currentRequest === requestId.current) setLoading(false);
    });
    return () => controller.abort();
  }, [search, category, stockStatus, sort, lang, page, reloadKey]);

  useEffect(() => {
    const start = startsAt ? Date.parse(startsAt) : Number.NaN;
    const end = endsAt ? Date.parse(endsAt) : Number.NaN;
    if (selectedIds.length === 0 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setConflicts([]);
      setConflictError("");
      setConflictsLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setConflictError("");
      setConflictsLoading(true);
      void detectPromotionConflicts({
        productIds: selectedIds,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        excludePromotionId,
        signal: controller.signal,
      }).then(setConflicts).catch((cause) => {
        if (!controller.signal.aborted) {
          setConflicts([]);
          setConflictError(cause instanceof Error ? cause.message : copy.conflictCheckFailed);
        }
      }).finally(() => {
        if (!controller.signal.aborted) setConflictsLoading(false);
      });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedIds, startsAt, endsAt, excludePromotionId, conflictReloadKey, copy.conflictCheckFailed]);

  const selectedProducts = useMemo(() => selectedIds.map((id) => {
    const loaded = productCache.get(id);
    if (loaded) return loaded;
    const known = knownProducts?.get(id);
    if (!known) return { id, name: id, nameAr: "", nameEn: "", price: 0, effectivePrice: 0, stock: 0, code: "", barcode: "", category: "", categoryName: "", categoryNameEn: "" } satisfies PromotionProduct;
    return {
      id,
      name: known.name,
      nameAr: known.nameAr ?? "",
      nameEn: known.nameEn ?? known.name,
      price: known.price,
      effectivePrice: known.price,
      stock: known.stock ?? 0,
      code: known.code ?? "",
      barcode: known.barcode ?? "",
      category: known.category ?? "",
      categoryName: known.categoryName ?? "",
      categoryNameEn: known.categoryNameEn ?? "",
      imageUrl: known.imageUrl,
    } satisfies PromotionProduct;
  }), [selectedIds, productCache, knownProducts]);

  const canPreviewDiscount = discountType !== undefined && Number.isFinite(discountValue) && (discountValue ?? 0) > 0;
  const selectionTotals = useMemo(() => selectedProducts.reduce((totals, product) => {
    const offerPrice = canPreviewDiscount ? getDiscountedPrice(product.price, discountType!, discountValue!) : product.price;
    totals.base += product.price;
    totals.offer += offerPrice;
    return totals;
  }, { base: 0, offer: 0 }), [canPreviewDiscount, discountType, discountValue, selectedProducts]);

  const conflictsByProduct = useMemo(() => {
    const map = new Map<string, PromotionConflict[]>();
    conflicts.forEach((conflict) => map.set(conflict.productId, [...(map.get(conflict.productId) ?? []), conflict]));
    return map;
  }, [conflicts]);
  const conflictedProductCount = conflictsByProduct.size;
  const allPageSelected = products.length > 0 && products.every((product) => selectedSet.has(product.id));
  const hasFilters = Boolean(query || category || stockStatus !== "all" || sort !== "name_asc");
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const toggleAllOnPage = useCallback(() => {
    const pageIds = products.map((product) => product.id);
    onSelectionChange(allPageSelected
      ? selectedIds.filter((id) => !pageIds.includes(id))
      : Array.from(new Set([...selectedIds, ...pageIds])));
  }, [allPageSelected, onSelectionChange, products, selectedIds]);

  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory("");
    setStockStatus("all");
    setSort("name_asc");
  }, []);

  const displayName = useCallback((product: PromotionProduct) => (
    isArabic ? product.nameAr || product.name || product.nameEn : product.nameEn || product.name || product.nameAr
  ), [isArabic]);
  const secondaryName = useCallback((product: PromotionProduct) => (
    isArabic ? product.nameEn : product.nameAr
  ), [isArabic]);

  const renderPrice = (product: PromotionProduct) => {
    const offerPrice = canPreviewDiscount ? getDiscountedPrice(product.price, discountType!, discountValue!) : product.price;
    return (
      <div className="text-end tabular-nums">
        {canPreviewDiscount && offerPrice !== product.price && <p className="text-[11px] text-slate-400 line-through">{formatCurrency(product.price, lang)}</p>}
        <p className="text-sm font-black text-violet-700">{formatCurrency(offerPrice, lang)}</p>
        {product.promotionName && (
          <p className="mt-1 max-w-36 truncate text-[10px] font-semibold text-amber-700" title={product.promotionName}>
            {copy.currentOffer}: {product.promotionName}
          </p>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-4" aria-labelledby="promotion-products-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 id="promotion-products-title" className="text-base font-black text-slate-900">{t("promotions.includedProducts")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{copy.subtitle}</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700 ring-1 ring-violet-100">
          <SparklesIcon className="h-4 w-4" />{selectedIds.length} {t("promotions.productsSelected")}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{copy.selected}</p>
          <p className="mt-1 text-xl font-black text-slate-900">{selectedIds.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{copy.customerPays}</p>
          <p className="mt-1 text-xl font-black text-violet-700">{formatCurrency(selectionTotals.offer, lang)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">{copy.estimatedSaving}</p>
          <p className="mt-1 text-xl font-black text-emerald-700">{formatCurrency(selectionTotals.base - selectionTotals.offer, lang)}</p>
        </div>
      </div>

      {conflictsLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700" role="status">
          <ArrowPathIcon className="h-4 w-4 animate-spin" />{copy.checkingConflicts}
        </div>
      )}
      {!conflictsLoading && conflictError && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div className="flex items-start gap-2"><ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">{copy.conflictCheckFailed}</p><p className="mt-0.5 text-xs text-rose-700">{conflictError}</p></div></div>
          <button type="button" onClick={() => setConflictReloadKey((key) => key + 1)} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 hover:bg-rose-100"><ArrowPathIcon className="h-4 w-4" />{copy.retry}</button>
        </div>
      )}
      {!conflictsLoading && !conflictError && conflictedProductCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-black">{copy.overlap}</p><p className="mt-0.5">{copy.overlapSummary.replace("{{products}}", String(conflictedProductCount))}</p></div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-200 bg-slate-50/80 p-3.5">
          <div className="relative">
            <label className="sr-only" htmlFor="promotion-product-search">{copy.search}</label>
            <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="promotion-product-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.search}
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white ps-10 pe-10 text-sm shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            />
            {query && <button type="button" onClick={() => setQuery("")} className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={copy.clearFilters}><XMarkIcon className="h-4 w-4" /></button>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label><span className="sr-only">{copy.allCategories}</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"><option value="">{copy.allCategories}</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label><span className="sr-only">{copy.allStock}</span><select value={stockStatus} onChange={(event) => setStockStatus(event.target.value as PromotionProductStockFilter)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"><option value="all">{copy.allStock}</option><option value="in_stock">{copy.inStock}</option><option value="low_stock">{copy.lowStock}</option><option value="out_of_stock">{copy.outOfStock}</option></select></label>
            <label><span className="sr-only">{copy.nameAsc}</span><select value={sort} onChange={(event) => setSort(event.target.value as PromotionProductSort)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"><option value="name_asc">{copy.nameAsc}</option><option value="name_desc">{copy.nameDesc}</option><option value="price_asc">{copy.priceAsc}</option><option value="price_desc">{copy.priceDesc}</option><option value="stock_asc">{copy.stockAsc}</option><option value="stock_desc">{copy.stockDesc}</option></select></label>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 border-slate-200 lg:border-e">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
              <p className="text-xs font-semibold text-slate-500">{loading ? "…" : copy.showing.replace("{{from}}", String(rangeStart)).replace("{{to}}", String(rangeEnd)).replace("{{total}}", String(total))}</p>
              <div className="flex items-center gap-3">
                {hasFilters && <button type="button" onClick={resetFilters} className="text-xs font-bold text-slate-500 hover:text-slate-800">{copy.clearFilters}</button>}
                <button type="button" disabled={loading || products.length === 0} onClick={toggleAllOnPage} className="text-xs font-black text-violet-700 hover:text-violet-900 disabled:opacity-40">{allPageSelected ? copy.clearPage : copy.selectPage}</button>
              </div>
            </div>

            {error ? (
              <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center" role="alert">
                <ExclamationTriangleIcon className="h-9 w-9 text-rose-400" />
                <p className="mt-3 max-w-md text-sm font-semibold text-rose-700">{error}</p>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><ArrowPathIcon className="h-4 w-4" />{copy.retry}</button>
              </div>
            ) : loading ? (
              <div className="divide-y divide-slate-100" aria-busy="true">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="flex h-20 animate-pulse items-center gap-3 px-4"><div className="h-4 w-4 rounded bg-slate-100" /><div className="h-11 w-11 rounded-xl bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-3 w-2/5 rounded bg-slate-100" /><div className="h-2.5 w-1/4 rounded bg-slate-100" /></div><div className="h-7 w-20 rounded bg-slate-100" /></div>)}</div>
            ) : products.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><CubeIcon className="h-10 w-10 text-slate-300" /><p className="mt-3 font-black text-slate-800">{copy.noResults}</p><p className="mt-1 text-sm text-slate-500">{copy.noResultsHint}</p>{hasFilters && <button type="button" onClick={resetFilters} className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{copy.clearFilters}</button>}</div>
            ) : (
              <>
                <div className="hidden max-h-[32rem] overflow-auto md:block">
                  <table className="min-w-full table-fixed text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_#e2e8f0]"><tr><th className="w-11 px-3 py-2.5" /><th className="px-3 py-2.5 text-start text-[10px] font-black uppercase tracking-wider text-slate-400">{copy.product}</th><th className="w-36 px-3 py-2.5 text-start text-[10px] font-black uppercase tracking-wider text-slate-400">{copy.identifiers}</th><th className="w-24 px-3 py-2.5 text-start text-[10px] font-black uppercase tracking-wider text-slate-400">{copy.stock}</th><th className="w-40 px-3 py-2.5 text-end text-[10px] font-black uppercase tracking-wider text-slate-400">{copy.pricing}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{products.map((product) => {
                      const selected = selectedSet.has(product.id);
                      const productConflicts = conflictsByProduct.get(product.id) ?? [];
                      const name = displayName(product);
                      return <tr key={product.id} className={cn("transition hover:bg-violet-50/40", selected && "bg-violet-50/70")}>
                        <td className="px-3 py-3 align-top"><input type="checkbox" checked={selected} onChange={() => onToggle(product.id)} className="mt-3 h-4 w-4 rounded border-slate-300 accent-violet-600" aria-label={`${selected ? copy.clearPage : copy.selectPage}: ${name}`} /></td>
                        <td className="px-3 py-3"><div className="flex min-w-0 items-start gap-3"><CatalogImage product={product} name={name} /><div className="min-w-0"><p className="truncate font-bold text-slate-900" title={name}>{name}</p>{secondaryName(product) && <p className="mt-0.5 truncate text-xs text-slate-500" dir={isArabic ? "ltr" : "rtl"}>{secondaryName(product)}</p>}<p className="mt-1 truncate text-[11px] font-semibold text-violet-600">{isArabic ? product.categoryName || product.categoryNameEn : product.categoryNameEn || product.categoryName}</p>{productConflicts.length > 0 && <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-700"><ExclamationTriangleIcon className="h-3.5 w-3.5" />{copy.overlap}: {productConflicts.map((item) => item.promotionName).join(", ")}</p>}</div></div></td>
                        <td className="px-3 py-3 align-middle"><p className="truncate font-mono text-xs font-semibold text-slate-600" dir="ltr">{product.code || "—"}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-400" dir="ltr">{product.barcode || "—"}</p></td>
                        <td className="px-3 py-3 align-middle"><span className={cn("inline-flex rounded-full border px-2 py-1 text-xs font-black tabular-nums", stockTone(product.stock))}>{product.stock}</span></td>
                        <td className="px-3 py-3 align-middle">{renderPrice(product)}</td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>

                <div className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto md:hidden">{products.map((product) => {
                  const selected = selectedSet.has(product.id);
                  const name = displayName(product);
                  const productConflicts = conflictsByProduct.get(product.id) ?? [];
                  return <label key={product.id} className={cn("block cursor-pointer p-3.5 transition hover:bg-violet-50/40", selected && "bg-violet-50/70")}><div className="flex items-start gap-3"><input type="checkbox" checked={selected} onChange={() => onToggle(product.id)} className="mt-3.5 h-4 w-4 rounded border-slate-300 accent-violet-600" /><CatalogImage product={product} name={name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{name}</p>{secondaryName(product) && <p className="truncate text-xs text-slate-500">{secondaryName(product)}</p>}<div className="mt-2 flex flex-wrap items-center gap-1.5"><span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", stockTone(product.stock))}>{copy.stock}: {product.stock}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600" dir="ltr">{product.code || "—"}</span></div>{productConflicts.length > 0 && <p className="mt-2 text-[10px] font-bold text-amber-700">{copy.overlap}: {productConflicts.map((item) => item.promotionName).join(", ")}</p>}</div>{renderPrice(product)}</div></label>;
                })}</div>
              </>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 px-3.5 py-3">
              <p className="text-xs font-semibold text-slate-500">{copy.page.replace("{{page}}", String(page)).replace("{{pages}}", String(totalPages))}</p>
              <div className="flex gap-1.5"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label={copy.previousPage}><ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" /></button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label={copy.nextPage}><ChevronRightIcon className="h-4 w-4 rtl:rotate-180" /></button></div>
            </div>
          </div>

          <aside className="bg-slate-50/60" aria-label={copy.selected}>
            <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3"><div><p className="text-sm font-black text-slate-900">{copy.selected}</p><p className="text-xs text-slate-500">{selectedIds.length} {t("promotions.productsSelected")}</p></div>{selectedIds.length > 0 && <button type="button" onClick={() => onSelectionChange([])} className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800"><TrashIcon className="h-3.5 w-3.5" />{copy.clearAll}</button>}</div>
            {selectedProducts.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><CheckCircleIcon className="h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-700">{copy.noSelection}</p><p className="mt-1 text-xs leading-5 text-slate-500">{copy.noSelectionHint}</p></div> : <div className="max-h-[32rem] divide-y divide-slate-200 overflow-y-auto">{selectedProducts.map((product) => {
              const name = displayName(product);
              const offerPrice = canPreviewDiscount ? getDiscountedPrice(product.price, discountType!, discountValue!) : product.price;
              const productConflicts = conflictsByProduct.get(product.id) ?? [];
              return <div key={product.id} className="group p-3"><div className="flex items-start gap-2.5"><CatalogImage product={product} name={name} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-900" title={name}>{name}</p><p className="mt-0.5 truncate font-mono text-[10px] text-slate-400" dir="ltr">{product.code || product.barcode || "—"}</p><div className="mt-1.5 flex items-center gap-1.5 text-[11px] tabular-nums"><span className="text-slate-400 line-through">{formatCurrency(product.price, lang)}</span><span className="font-black text-violet-700">{formatCurrency(offerPrice, lang)}</span></div>{productConflicts.length > 0 && <p className="mt-1 text-[10px] font-bold text-amber-700">{copy.overlap}: {productConflicts[0].promotionName}</p>}</div><button type="button" onClick={() => onToggle(product.id)} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={copy.remove.replace("{{name}}", name)}><XMarkIcon className="h-4 w-4" /></button></div></div>;
            })}</div>}
            {selectedIds.length > 0 && <div className="border-t border-slate-200 bg-white p-3.5"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-500">{copy.selectedValue}</span><span className="font-bold text-slate-700 line-through">{formatCurrency(selectionTotals.base, lang)}</span></div><div className="mt-2 flex items-center justify-between"><span className="text-sm font-black text-slate-900">{copy.customerPays}</span><span className="text-base font-black text-violet-700">{formatCurrency(selectionTotals.offer, lang)}</span></div>{discountPreview && <p className="mt-2 rounded-lg bg-violet-50 px-2 py-1.5 text-center text-[11px] font-bold text-violet-700">{discountPreview} · {selectedIds.length} {t("promotions.productsSelected")}</p>}</div>}
          </aside>
        </div>
      </div>
    </section>
  );
}
