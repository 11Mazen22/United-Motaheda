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
  CubeIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCatalog } from "../../contexts/CatalogContext";
import {
  fetchAdminProducts,
  createAdminProduct,
  deleteAdminProduct,
  handleApiError,
  showSuccessToast,
  showErrorToast,
  type AdminProduct,
} from "../../services/adminSupabaseApi";
import { cn } from "../components/UI";
import {
  AdminBulkActionBar,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminErrorBanner,
  AdminMetricCard,
  AdminPaginationBar,
  AdminSearchField,
  AdminSectionCard,
  AdminTableSkeleton,
  AdminUnauthorized,
  type AdminRole,
  useDebouncedValue,
} from "./adminShared";
import { useBulkSelection } from "../../hooks/useBulkSelection";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductCard, ProductTableRow } from "./ProductListItems";
import {
  parseProductCsv,
  downloadCsvTemplate,
  type CsvRowError,
} from "../../utils/productCsv";
import { resolveProductCategoryId } from "../../utils/productValidation";

const ITEMS_PER_PAGE = 15;

type ConfirmDialogState = {
  open: boolean;
  title: string;
  description: string;
  tone?: "danger" | "warning" | "info";
  onConfirm: () => Promise<void>;
};

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
  const canDelete = ["admin", "manager"].includes(userRole);

  // Filters / pagination
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 250);

  // Create/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  // CSV import
  const [csvImporting, setCsvImporting] = useState(false);
  const [error, setError] = useState("");
  const csvRef = useRef<HTMLInputElement>(null);

  // Confirm dialog (single + bulk delete)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const openAddDialog = useCallback(() => {
    setEditingProduct(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((product: AdminProduct) => {
    setEditingProduct(product);
    setDialogOpen(true);
  }, []);

  const handleSaved = useCallback((saved: AdminProduct) => {
    setProducts((prev) => {
      const updated = prev.filter((p) => p.id !== saved.id);
      return [saved, ...updated];
    });
  }, []);

  // Load products from Supabase — abort-guarded so overlapping loads (e.g. a
  // manual refresh fired while the initial mount load is still in flight)
  // can't have a slower/older response clobber a newer one.
  const loadControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);

  const loadProducts = useCallback(async () => {
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    const requestId = ++latestRequestIdRef.current;

    setProductsLoading(true);
    setProductsError("");
    try {
      const adminProducts = await fetchAdminProducts({ signal: controller.signal });
      if (requestId !== latestRequestIdRef.current) return; // stale response
      setProducts(adminProducts);
    } catch (err) {
      if (controller.signal.aborted || requestId !== latestRequestIdRef.current) return;
      const errorMessage = handleApiError(err, "Failed to load products");
      setProductsError(errorMessage);
      showErrorToast(err, "Failed to load products");
    } finally {
      if (requestId === latestRequestIdRef.current) setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    return () => loadControllerRef.current?.abort();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "all" && resolveProductCategoryId(p, categories) !== categoryFilter) return false;
      if (stockFilter === "out" && p.stock !== 0) return false;
      if (stockFilter === "low" && (p.stock === 0 || p.stock >= 10)) return false;
      if (!q) return true;
      return [p.name, p.nameAr ?? "", p.barcode, p.categoryName]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [categories, categoryFilter, debouncedSearch, products, stockFilter]);

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

  const bulk = useBulkSelection(paginatedProducts);

  const handleDeleteOne = useCallback((product: AdminProduct) => {
    setConfirmDialog({
      open: true,
      title: lang === "ar" ? "حذف المنتج" : "Delete product",
      description: lang === "ar"
        ? `هل تريد حذف "${product.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Delete "${product.name}"? This action cannot be undone.`,
      tone: "danger",
      onConfirm: async () => {
        const previous = products;
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        try {
          await deleteAdminProduct(product.code);
          showSuccessToast(lang === "ar" ? "تم حذف المنتج." : "Product deleted.");
        } catch (err) {
          setProducts(previous); // rollback
          showErrorToast(err, "Delete failed");
          throw err;
        }
      },
    });
  }, [products, lang]);

  const handleBulkDelete = useCallback(() => {
    const targets = paginatedProducts.filter((p) => bulk.isSelected(p.id));
    if (targets.length === 0) return;
    setConfirmDialog({
      open: true,
      title: lang === "ar" ? "حذف المنتجات المحددة" : "Delete selected products",
      description: lang === "ar"
        ? `هل تريد حذف ${targets.length} منتج؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Delete ${targets.length} selected product(s)? This action cannot be undone.`,
      tone: "danger",
      onConfirm: async () => {
        const results = await Promise.allSettled(
          targets.map((p) => deleteAdminProduct(p.code).then(() => p.id)),
        );
        const deletedIds = new Set(
          results
            .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
            .map((r) => r.value),
        );
        const failedCount = results.length - deletedIds.size;
        if (deletedIds.size > 0) {
          setProducts((prev) => prev.filter((p) => !deletedIds.has(p.id)));
        }
        bulk.clear();
        if (failedCount > 0) {
          toast.error(
            lang === "ar"
              ? `تم حذف ${deletedIds.size} وفشل حذف ${failedCount}.`
              : `Deleted ${deletedIds.size}; failed to delete ${failedCount}.`,
          );
        } else {
          showSuccessToast(lang === "ar" ? "تم حذف المنتجات المحددة." : "Selected products deleted.");
        }
      },
    });
  }, [paginatedProducts, bulk, lang]);

  const handleCsvImport = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 5 * 1024 * 1024) {
      const message = lang === "ar"
        ? "اختر ملف CSV صالحًا بحجم لا يتجاوز 5 ميغابايت."
        : "Choose a valid CSV file no larger than 5 MB.";
      setError(message);
      toast.error(message);
      if (csvRef.current) csvRef.current.value = "";
      return;
    }
    setCsvImporting(true);
    setError("");
    try {
      const text = await file.text();
      const { rows, errors } = parseProductCsv(text, categories, lang);

      if (rows.length === 0) {
        const detail = errors.map((er) => er.message).join(" | ");
        const msg = lang === "ar"
          ? `لم يتم استيراد أي منتج. ${detail}`
          : `No products were imported. ${detail}`;
        setError(msg);
        toast.error(msg);
        return;
      }

      const imported: AdminProduct[] = [];
      const failures: CsvRowError[] = [...errors];

      for (const { row, payload } of rows) {
        try {
          const created = await createAdminProduct(payload);
          imported.push(created);
        } catch (err: unknown) {
          const detail = handleApiError(err, "Insert failed");
          failures.push({
            row,
            message: lang === "ar" ? `الصف ${row}: ${detail}` : `Row ${row}: ${detail}`,
          });
        }
      }

      if (imported.length > 0) {
        setProducts((prev) => {
          const importedIds = new Set(imported.map((p) => p.id));
          return [...imported, ...prev.filter((p) => !importedIds.has(p.id))];
        });
      }

      const total = rows.length + errors.length;
      if (failures.length === 0) {
        showSuccessToast(
          lang === "ar"
            ? `تم استيراد ${imported.length} من ${total} منتجًا بنجاح.`
            : `Imported ${imported.length} of ${total} products successfully.`,
        );
      } else {
        const summaryMsg = lang === "ar"
          ? `تم استيراد ${imported.length} من ${total} منتجًا (${failures.length} صفوف بها أخطاء).`
          : `Imported ${imported.length} of ${total} products (${failures.length} row${failures.length === 1 ? "" : "s"} had errors).`;
        setError(`${summaryMsg} ${failures.map((f) => f.message).join(" | ")}`);
        toast.error(summaryMsg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setCsvImporting(false);
      if (csvRef.current) csvRef.current.value = "";
    }
  }, [categories, lang]);

  // Guard — after all hooks, per Rules of Hooks.
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
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  {lang === "ar" ? "تحميل نموذج CSV" : "Download CSV template"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void loadProducts()}
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
          {canBulkImport && (
            <p className="mb-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-500">
              {lang === "ar"
                ? "تنسيق CSV: code, barcode, name, name_ar, category, price, stock (الاسم والقسم والسعر مطلوبة، والقسم يجب أن يطابق قسماً موجوداً بالاسم أو المعرف)."
                : "CSV format: code, barcode, name, name_ar, category, price, stock — name, category, and price are required; category must match an existing category by id or name."}
            </p>
          )}
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
              aria-label={lang === "ar" ? "تصفية حسب القسم" : "Filter by category"}
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
              aria-label={lang === "ar" ? "تصفية حسب حالة المخزون" : "Filter by stock status"}
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

        {canDelete && (
          <AdminBulkActionBar
            selectedCount={bulk.count}
            onClear={bulk.clear}
            lang={lang}
            actions={[
              {
                key: "delete",
                label: lang === "ar" ? "حذف المحدد" : "Delete selected",
                icon: TrashIcon,
                tone: "danger",
                onClick: handleBulkDelete,
              },
            ]}
          />
        )}

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
                    canDelete={canDelete}
                    selected={bulk.isSelected(p.id)}
                    onEdit={openEditDialog}
                    onDelete={handleDeleteOne}
                    onToggleSelect={bulk.toggle}
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
                          {canDelete && (
                            <th className="w-10 px-3 py-3">
                              <input
                                type="checkbox"
                                checked={bulk.allSelected}
                                onChange={bulk.toggleAll}
                                aria-label={lang === "ar" ? "تحديد الكل" : "Select all"}
                                className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                              />
                            </th>
                          )}
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
                            canDelete={canDelete}
                            selected={bulk.isSelected(p.id)}
                            onEdit={openEditDialog}
                            onDelete={handleDeleteOne}
                            onToggleSelect={bulk.toggle}
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

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingProduct={editingProduct}
        categories={categories}
        lang={lang}
        onSaved={handleSaved}
      />

      {confirmDialog && (
        <AdminConfirmDialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog(null)}
          onConfirm={async () => {
            await confirmDialog.onConfirm();
          }}
          title={confirmDialog.title}
          description={confirmDialog.description}
          tone={confirmDialog.tone || "info"}
          lang={lang}
        />
      )}
    </div>
  );
}
