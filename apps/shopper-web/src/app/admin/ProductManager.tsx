/**
 * ProductManager.tsx
 * Full product catalog management with role-based access.
 *
 * Roles & Permissions:
 * - admin:        Full CRUD + bulk import
 * - manager:      Full CRUD + bulk import
 * - pharmacist:   Can view and edit products (no bulk import)
 * - others:       Unauthorized
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCatalog } from "../../contexts/CatalogContext";
import {
  lookupBarcode,
  type ProductMutationPayload,
} from "../../services/googleSheetsApi";
import {
  fetchAdminProducts,
  updateAdminProduct,
  createAdminProduct,
  handleApiError,
  showSuccessToast,
  showErrorToast,
  type AdminProduct,
} from "../../services/adminSupabaseApi";
import { cn } from "../components/UI";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminFormField,
  AdminMetricCard,
  AdminPaginationBar,
  AdminSearchField,
  AdminSectionCard,
  AdminTableSkeleton,
  AdminUnauthorized,
  type AdminRole,
  useDebouncedValue,
} from "./adminShared";

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = "ar" | "en";
type Product = AdminProduct;

interface ProductFormState {
  id: string;
  barcode: string;
  name: string;
  nameAr: string;
  categoryId: string;
  price: string;
  stock: string;
  description: string;
  isOffer: boolean;
  originalPrice: string;
}

interface BarcodeLookupResult {
  barcode: string;
  found: boolean;
  matches: Array<{
    id: string;
    barcode: string;
    productName: string;
    brand: string;
    category: string;
    imageUrl: string;
    source: string;
  }>;
  searchedAt: string;
}

const EMPTY_FORM: ProductFormState = {
  id: "",
  barcode: "",
  name: "",
  nameAr: "",
  categoryId: "",
  price: "",
  stock: "",
  description: "",
  isOffer: false,
  originalPrice: "",
};

const ITEMS_PER_PAGE = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockLabel(stock: number, lang: Language): string {
  if (stock === 0) return lang === "ar" ? "نفد" : "Out";
  if (stock < 5)  return lang === "ar" ? "منخفض جداً" : "Critical";
  if (stock < 10) return lang === "ar" ? "منخفض" : "Low";
  return lang === "ar" ? "متاح" : "In Stock";
}

function stockClasses(stock: number): string {
  if (stock === 0)  return "border-rose-200 bg-rose-50 text-rose-700";
  if (stock < 5)    return "border-orange-200 bg-orange-50 text-orange-700";
  if (stock < 10)   return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatCurrency(v: number, lang: Language): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency", currency: "EGP", maximumFractionDigits: 2,
  }).format(v);
}

// ─── BarcodePanel ─────────────────────────────────────────────────────────────

const BarcodePanel = memo(function BarcodePanel({
  barcode,
  lang,
}: {
  barcode: string;
  lang: Language;
}) {
  const [lookupResult, setLookupResult] = useState<BarcodeLookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const prevBarcode = useRef("");

  useEffect(() => {
    if (!barcode || barcode.length < 8 || barcode === prevBarcode.current) return;
    prevBarcode.current = barcode;
    setLookupLoading(true);
    setLookupResult(null);

    lookupBarcode(barcode)
      .then((res) => { setLookupResult(res); })
      .catch(() => { setLookupResult(null); })
      .finally(() => { setLookupLoading(false); });
  }, [barcode]);

  if (!barcode || barcode.length < 8) return null;

  return (
    <div className="rounded-md border border-teal-200 bg-teal-50/60 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
        {lang === "ar" ? "بيانات الباركود" : "Barcode lookup"}
      </p>
      {lookupLoading ? (
        <div className="mt-2 space-y-1.5">
          <Skeleton className="h-3 w-32 rounded-full bg-teal-100" />
          <Skeleton className="h-3 w-48 rounded-full bg-teal-100" />
        </div>
      ) : lookupResult ? (
        <div className="mt-2">
          {lookupResult.matches && lookupResult.matches.length > 0 ? (
            lookupResult.matches.map((match, idx) => (
              <div key={idx} className="mb-2">
                {match.productName && (
                  <p className="text-sm font-semibold text-teal-800">{match.productName}</p>
                )}
                {match.brand && (
                  <p className="text-xs text-teal-600">{match.brand}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-teal-600">
              {lang === "ar" ? "لا توجد نتائج مطابقة." : "No matching results found."}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-teal-600">
          {lang === "ar" ? "لا توجد بيانات متاحة لهذا الباركود." : "No reference data found for this barcode."}
        </p>
      )}
    </div>
  );
});

// ─── ProductCard (mobile) ──────────────────────────────────────────────────────

const ProductCard = memo(function ProductCard({
  product,
  lang,
  canEdit,
  onEdit,
}: {
  product: Product;
  lang: Language;
  canEdit: boolean;
  onEdit: (p: Product) => void;
}) {
  const stockColor =
    product.stock === 0 ? "#f43f5e"
    : product.stock < 5  ? "#f97316"
    : product.stock < 10 ? "#f59e0b"
    : "#10b981";

  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
    >
      <div className="h-[3px]" style={{ background: stockColor }} />

      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <CubeIcon className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold text-slate-800">
              {lang === "ar" && product.nameAr ? product.nameAr : product.name}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">{product.categoryName}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{lang === "ar" ? "السعر" : "Price"}</p>
            <p className="mt-1 text-xs font-black text-slate-800">{formatCurrency(product.price, lang)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{lang === "ar" ? "المخزون" : "Stock"}</p>
            <p className="mt-1 text-xs font-black" style={{ color: stockColor }}>{product.stock}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{lang === "ar" ? "الحالة" : "State"}</p>
            <span className={cn("mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-bold", stockClasses(product.stock))}>
              {stockLabel(product.stock, lang)}
            </span>
          </div>
        </div>

        {product.barcode && (
          <p className="mt-2 text-[10px] font-mono text-slate-400" dir="ltr">{product.barcode}</p>
        )}

        {product.is_offer && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
            <span>🏷</span>
            {lang === "ar" ? "عرض نشط" : "Active offer"}
            {product.original_price ? ` · ${formatCurrency(product.original_price, lang)}` : ""}
          </div>
        )}

      {canEdit && (
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/60 text-xs font-bold text-teal-700 transition-all hover:bg-teal-100 hover:shadow-sm active:scale-[.98]"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          {lang === "ar" ? "تعديل" : "Edit"}
        </button>
      )}
      </div>
    </article>
  );
});

// ─── ProductTableRow (desktop) ─────────────────────────────────────────────────

const ProductTableRow = memo(function ProductTableRow({
  product,
  lang,
  canEdit,
  onEdit,
}: {
  product: Product;
  lang: Language;
  canEdit: boolean;
  onEdit: (p: Product) => void;
}) {
  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-100 bg-slate-50">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <CubeIcon className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">
              {lang === "ar" && product.nameAr ? product.nameAr : product.name}
            </p>
            {product.barcode && (
              <p className="mt-0.5 text-[11px] text-slate-400" dir="ltr">{product.barcode}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{product.categoryName}</td>
      <td className="px-4 py-3 text-sm font-bold text-slate-700">{formatCurrency(product.price, lang)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700">{product.stock}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", stockClasses(product.stock))}>
            {stockLabel(product.stock, lang)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-100 active:scale-95"
          >
            <PencilIcon className="h-3 w-3" />
            {lang === "ar" ? "تعديل" : "Edit"}
          </button>
        )}
      </td>
    </tr>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductManager() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { categories, isLoading, error: catalogError } = useCatalog();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");

  const userRole = (user?.role ?? "customer") as AdminRole;

  // Role-based permissions
  const canManageProducts = ["admin", "manager", "pharmacist"].includes(userRole);
  const canBulkImport = ["admin", "manager"].includes(userRole);

  // State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [error, setError] = useState("");
  const csvRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const openAddDialog = useCallback(() => {
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((product: AdminProduct) => {
    setForm({
      id: product.code,
      barcode: product.barcode ?? "",
      name: product.name,
      nameAr: product.nameAr ?? "",
      categoryId: product.category,
      price: String(product.price),
      stock: String(product.stock),
      description: "",
      isOffer: product.is_offer ?? false,
      originalPrice: product.original_price != null ? String(product.original_price) : "",
    });
    setFormError("");
    setDialogOpen(true);
  }, []);

  // Load products from Supabase
  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError("");
      try {
        const adminProducts = await fetchAdminProducts();
        setProducts(adminProducts);
      } catch (error) {
        const errorMessage = handleApiError(error, "Failed to load products");
        setProductsError(errorMessage);
        showErrorToast(error, "Failed to load products");
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (stockFilter === "out" && p.stock !== 0) return false;
      if (stockFilter === "low" && (p.stock === 0 || p.stock >= 10)) return false;
      if (!q) return true;
      return [p.name, p.nameAr ?? "", p.barcode, p.categoryName]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [categoryFilter, debouncedSearch, products, stockFilter]);

  const summary = useMemo(() => ({
    total: products.length,
    inStock: products.filter((p) => p.stock > 0).length,
    lowStock: products.filter((p) => p.stock > 0 && p.stock < 10).length,
    outOfStock: products.filter((p) => p.stock === 0).length,
  }), [products]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, categoryFilter, stockFilter]);
  useEffect(() => { setCurrentPage((p) => Math.min(p, totalPages)); }, [totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredProducts]);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.categoryId || !form.price) {
      setFormError(lang === "ar" ? "يرجى ملء الحقول المطلوبة." : "Please fill all required fields.");
      return;
    }
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (Number.isNaN(price) || price < 0) {
      setFormError(lang === "ar" ? "السعر غير صالح." : "Invalid price.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const origPrice = form.originalPrice ? Number(form.originalPrice) : null;
      const payload = {
        Code: form.id || `PROD-${Date.now()}`,
        Barcode: form.barcode || "",
        Name: form.name,
        Name_Ar: form.nameAr || "",
        Name_En: form.name,
        Price: Number.isNaN(price) ? 0 : price,
        Stock: Number.isNaN(stock) ? 0 : stock,
        Category: form.categoryId,
        Category_Name: categories.find((c) => c.id === form.categoryId)?.name || "",
        Category_Name_En: categories.find((c) => c.id === form.categoryId)?.nameEn || "",
        is_offer: form.isOffer,
        original_price: origPrice && !Number.isNaN(origPrice) ? origPrice : null,
      } satisfies ProductMutationPayload;

      let updatedProduct: AdminProduct;
      
      if (form.id) {
        // Update existing product
        updatedProduct = await updateAdminProduct(payload);
        showSuccessToast(lang === "ar" ? "تم تحديث المنتج بنجاح." : "Product updated successfully.");
      } else {
        // Create new product
        updatedProduct = await createAdminProduct(payload);
        showSuccessToast(lang === "ar" ? "تم إضافة المنتج بنجاح." : "Product added successfully.");
      }

      // Update local state
      setProducts(prev => {
        const updated = prev.filter(p => p.id !== updatedProduct.id);
        return [updatedProduct, ...updated];
      });

      setDialogOpen(false);
      
    } catch (err: unknown) {
      const msg = handleApiError(err, "Save failed");
      setFormError(msg);
      showErrorToast(err, "Save failed");
    } finally {
      setSubmitting(false);
    }
  }, [form, lang, categories]);

  const handleCsvImport = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setError("");
    try {
      // TODO: Parse CSV file and convert to BulkProductPayload[]
      await file.text();
      toast.info(
        lang === "ar"
          ? "ميزة استيراد CSV قيد الإنشاء."
          : "CSV import feature coming soon.",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setCsvImporting(false);
      if (csvRef.current) csvRef.current.value = "";
    }
  }, [lang]);

  // Guard
  if (!canManageProducts) return <AdminUnauthorized lang={lang} />;

  const thClass = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCard
          label={lang === "ar" ? "إجمالي المنتجات" : "Total products"}
          value={summary.total}
          icon={CubeIcon}
          tone="slate"
        />
        <AdminMetricCard
          label={lang === "ar" ? "متاح" : "In stock"}
          value={summary.inStock}
          tone="emerald"
        />
        <AdminMetricCard
          label={lang === "ar" ? "مخزون منخفض" : "Low stock"}
          value={summary.lowStock}
          icon={ExclamationTriangleIcon}
          tone="amber"
        />
        <AdminMetricCard
          label={lang === "ar" ? "نفد" : "Out of stock"}
          value={summary.outOfStock}
          tone="rose"
        />
      </div>

      <AdminErrorBanner message={error || catalogError || productsError || ""} />

      <AdminSectionCard
        eyebrow={lang === "ar" ? "كتالوج المنتجات" : "Product catalog"}
        title={lang === "ar" ? "إدارة المنتجات" : "Product management"}
        description={lang === "ar"
          ? "استعرض وعدّل المنتجات والمخزون والتصنيفات."
          : "Browse, edit products, stock levels, and categories."}
        bodyClassName="space-y-4 px-0 py-0"
        actions={
          <div className="flex flex-wrap gap-2">
            {canBulkImport && (
              <>
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvImport}
                  className="sr-only"
                  id="csv-import-input"
                  aria-label={lang === "ar" ? "استيراد CSV" : "Import CSV"}
                />
                <label
                  htmlFor="csv-import-input"
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50",
                    csvImporting && "cursor-not-allowed opacity-60",
                  )}
                >
                  {csvImporting ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-teal-600" />
                  ) : (
                    <ArrowUpTrayIcon className="h-4 w-4 text-teal-600" />
                  )}
                  {lang === "ar" ? "استيراد CSV" : "Import CSV"}
                </label>
              </>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  const adminProducts = await fetchAdminProducts();
                  setProducts(adminProducts);
                  showSuccessToast(lang === "ar" ? "تم تحديث المنتجات" : "Products refreshed");
                } catch (error) {
                  showErrorToast(error, "Failed to refresh products");
                }
              }}
              disabled={isLoading || productsLoading}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowPathIcon className={cn("h-4 w-4", (isLoading || productsLoading) && "animate-spin")} />
              {lang === "ar" ? "تحديث" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={openAddDialog}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              <PlusIcon className="h-4 w-4" />
              {lang === "ar" ? "إضافة منتج" : "Add product"}
            </button>
          </div>
        }
      >
        {/* Filters */}
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AdminSearchField
              value={search}
              onChange={setSearch}
              placeholder={lang === "ar" ? "ابحث بالاسم أو الباركود" : "Search by name or barcode"}
              className="w-full"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
            >
              <option value="all">{lang === "ar" ? "جميع الأقسام" : "All categories"}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{lang === "ar" ? c.name : c.nameEn || c.name}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as "all" | "low" | "out")}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
            >
              <option value="all">{lang === "ar" ? "جميع حالات المخزون" : "All stock states"}</option>
              <option value="low">{lang === "ar" ? "مخزون منخفض" : "Low stock"}</option>
              <option value="out">{lang === "ar" ? "نفد المخزون" : "Out of stock"}</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {filteredProducts.length} {lang === "ar" ? "منتج" : "products"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-2 pt-3">
          {isLoading || productsLoading ? (
            <AdminTableSkeleton rows={8} />
          ) : paginatedProducts.length === 0 ? (
            <AdminEmptyState
              title={lang === "ar" ? "لا توجد منتجات مطابقة" : "No matching products"}
              description={lang === "ar" ? "جرّب تعديل الفلاتر أو إضافة منتجات." : "Try adjusting the filters or add new products."}
              action={
                <button
                  type="button"
                  onClick={openAddDialog}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
                >
                  <PlusIcon className="h-4 w-4" />
                  {lang === "ar" ? "إضافة منتج" : "Add product"}
                </button>
              }
            />
          ) : (
            <>
              {/* Mobile grid */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:hidden">
                {paginatedProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    lang={lang}
                    canEdit={canManageProducts}
                    onEdit={openEditDialog}
                  />
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden xl:block">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-[56rem] w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className={thClass}>{lang === "ar" ? "المنتج" : "Product"}</th>
                          <th className={thClass}>{lang === "ar" ? "القسم" : "Category"}</th>
                          <th className={thClass}>{lang === "ar" ? "السعر" : "Price"}</th>
                          <th className={thClass}>{lang === "ar" ? "المخزون" : "Stock"}</th>
                          <th className={thClass}>{lang === "ar" ? "إجراء" : "Action"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map((p) => (
                          <ProductTableRow
                            key={p.id}
                            product={p}
                            lang={lang}
                            canEdit={canManageProducts}
                            onEdit={openEditDialog}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <AdminPaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredProducts.length}
          itemsPerPage={ITEMS_PER_PAGE}
          lang={lang}
          onPageChange={setCurrentPage}
        />
      </AdminSectionCard>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 shadow-lg">
          <DialogHeader className="border-b border-slate-100 px-5 py-4">
            <DialogTitle className="text-lg font-bold text-slate-800">
              {form.id
                ? lang === "ar" ? "تعديل المنتج" : "Edit product"
                : lang === "ar" ? "إضافة منتج جديد" : "Add new product"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {lang === "ar" ? "أدخل بيانات المنتج وسيتم حفظه في الكتالوج." : "Fill in product details and it will be saved to the catalog."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <AdminFormField
              label={lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}
              value={form.name}
              onChange={(v) => setForm((p) => ({ ...p, name: v }))}
              required
            />
            <AdminFormField
              label={lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}
              value={form.nameAr}
              onChange={(v) => setForm((p) => ({ ...p, nameAr: v }))}
              dir="rtl"
            />
            <AdminFormField
              label={lang === "ar" ? "الباركود" : "Barcode"}
              value={form.barcode}
              onChange={(v) => setForm((p) => ({ ...p, barcode: v }))}
              dir="ltr"
            />

            <BarcodePanel barcode={form.barcode} lang={lang} />

            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                {lang === "ar" ? "القسم" : "Category"} *
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
              >
                <option value="">{lang === "ar" ? "اختر قسماً" : "Select a category"}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{lang === "ar" ? c.name : c.nameEn || c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <AdminFormField
                label={lang === "ar" ? "السعر (EGP)" : "Price (EGP)"}
                value={form.price}
                onChange={(v) => setForm((p) => ({ ...p, price: v }))}
                type="number"
                required
              />
              <AdminFormField
                label={lang === "ar" ? "المخزون" : "Stock"}
                value={form.stock}
                onChange={(v) => setForm((p) => ({ ...p, stock: v }))}
                type="number"
              />
            </div>

            {/* Offer section */}
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {lang === "ar" ? "تمييز كعرض" : "Mark as offer"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === "ar"
                      ? "سيظهر في صفحة العروض مع شارة مميزة."
                      : "Product will appear on the Offers page with a badge."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, isOffer: !p.isOffer }))}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                    form.isOffer ? "bg-amber-500" : "bg-slate-200",
                  )}
                  role="switch"
                  aria-checked={form.isOffer}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                      form.isOffer ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
              {form.isOffer && (
                <AdminFormField
                  label={lang === "ar" ? "السعر الأصلي (قبل التخفيض)" : "Original price (before discount)"}
                  value={form.originalPrice}
                  onChange={(v) => setForm((p) => ({ ...p, originalPrice: v }))}
                  type="number"
                />
              )}
            </div>

            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 px-5 py-4 gap-2">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <XMarkIcon className="h-4 w-4" />
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={submitting}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              {submitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
              {form.id
                ? lang === "ar" ? "حفظ التعديلات" : "Save changes"
                : lang === "ar" ? "إضافة" : "Add product"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}