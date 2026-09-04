/**
 * ProductFormDialog.tsx
 * Create/edit product dialog for ProductManager, extracted into its own
 * component and migrated to React Hook Form + Zod (matching the pattern
 * established in PromotionsManager.tsx). Owns its own submit/save logic so
 * ProductManager only needs to react to the `onSaved` result.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowPathIcon,
  Bars3BottomLeftIcon,
  CheckIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  SparklesIcon,
  TagIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../components/UI";
import {
  createAdminProduct,
  updateAdminProduct,
  handleApiError,
  showSuccessToast,
  showErrorToast,
  type AdminProduct,
} from "../../services/adminSupabaseApi";
import { lookupBarcode } from "../../services/googleSheetsApi";
import {
  productFormSchema,
  emptyProductForm,
  productToFormValues,
  type ProductCategoryOption,
  type ProductFormValues,
} from "../../utils/productValidation";
import { stockClasses, stockLabel, formatCurrency } from "./ProductListItems";

type Language = "ar" | "en";

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

// ─── Section header — small, consistent divider between field groups ──────────

function SectionHeading({ icon: Icon, children }: { icon: typeof TagIcon; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{children}</p>
    </div>
  );
}

// ─── BarcodePanel ─────────────────────────────────────────────────────────────

function BarcodePanel({ barcode, lang }: { barcode: string; lang: Language }) {
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
    <div className="animate-in fade-in slide-in-from-top-1 rounded-xl border border-teal-200/70 bg-gradient-to-br from-teal-50/80 to-cyan-50/50 px-3.5 py-3 duration-200">
      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-teal-700">
        <MagnifyingGlassIcon className="h-3.5 w-3.5" />
        {lang === "ar" ? "نتيجة بحث الباركود" : "Barcode lookup"}
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
              <div key={idx} className="mb-2 last:mb-0">
                {match.productName && (
                  <p className="text-sm font-bold text-teal-900">{match.productName}</p>
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
}

// ─── Field wrapper (kept local — thin enough not to warrant a shared export,
// and lets us wire react-hook-form's `register` directly onto native inputs
// while keeping the same visual language as AdminFormField). ────────────────

function FormField({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="flex items-baseline justify-between gap-2 text-sm font-semibold text-slate-700">
        <span>
          {label}
          {required && <span className="ms-1 text-rose-500">*</span>}
        </span>
        {hint && <span className="text-[11px] font-normal text-slate-400">{hint}</span>}
      </label>
      {children}
      {error && <p className="flex items-center gap-1 text-xs font-medium text-rose-500">{error}</p>}
    </div>
  );
}

const inputClass = cn(
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5",
  "text-sm text-slate-700 outline-none",
  "transition-all duration-150",
  "placeholder:text-slate-400",
  "focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

// ─── Live preview — mirrors how this product will actually render in the
// catalog list, so staff can sanity-check a save before committing to it. ──────

function LivePreview({
  values,
  categoryLabel,
  imageUrl,
  lang,
  isEditing,
}: {
  values: ProductFormValues;
  categoryLabel: string;
  imageUrl?: string;
  lang: Language;
  isEditing: boolean;
}) {
  const stock = Number.isFinite(values.stock) ? values.stock : 0;
  const price = Number.isFinite(values.price) ? values.price : 0;
  const displayName = (lang === "ar" ? values.nameAr : values.name) || values.name || values.nameAr;

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">
        <SparklesIcon className="h-3.5 w-3.5 text-teal-500" />
        {lang === "ar" ? "معاينة حية" : "Live preview"}
      </p>

      <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="h-[3px]" style={{ background: stock === 0 ? "#f43f5e" : stock < 10 ? "#f59e0b" : "#10b981" }} />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <CubeIcon className="h-7 w-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold text-slate-800">
                {displayName || (lang === "ar" ? "اسم المنتج" : "Product name")}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
                {categoryLabel || (lang === "ar" ? "بدون قسم" : "No category")}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{lang === "ar" ? "السعر" : "Price"}</p>
              <p className="mt-1 text-xs font-black text-slate-800">{formatCurrency(price, lang)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{lang === "ar" ? "المخزون" : "Stock"}</p>
              <p className="mt-1 text-xs font-black text-slate-800">{stock}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2 text-center">
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{lang === "ar" ? "الحالة" : "State"}</p>
              <span className={cn("mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-bold", stockClasses(stock))}>
                {stockLabel(stock, lang)}
              </span>
            </div>
          </div>

          {values.barcode && (
            <p className="mt-2 text-[10px] font-mono text-slate-400" dir="ltr">{values.barcode}</p>
          )}
        </div>
      </article>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3.5 py-3 text-xs leading-relaxed text-slate-500">
        {isEditing
          ? (lang === "ar"
              ? "هذه معاينة كما ستظهر في الكتالوج فور الحفظ."
              : "This is how the product will appear in the catalog once saved.")
          : (lang === "ar"
              ? "أدخل البيانات على اليمين وستظهر المعاينة هنا فورًا."
              : "Fill in the fields and the preview updates live.")}
      </div>
    </div>
  );
}

// ─── ProductFormDialog ────────────────────────────────────────────────────────

export interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: AdminProduct | null;
  categories: ProductCategoryOption[];
  lang: Language;
  onSaved: (product: AdminProduct) => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  editingProduct,
  categories,
  lang,
  onSaved,
}: ProductFormDialogProps) {
  const isEditing = Boolean(editingProduct);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: emptyProductForm(),
  });

  const categoriesRef = useRef(categories);
  const categorySyncedProductRef = useRef<string | null>(null);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  // Re-seed the form only when the dialog opens for a different product (or a
  // fresh add flow). Category-option refreshes must not reset in-progress edits.
  useEffect(() => {
    if (!open) {
      categorySyncedProductRef.current = null;
      return;
    }
    categorySyncedProductRef.current = null;
    reset(editingProduct ? productToFormValues(editingProduct, categoriesRef.current) : emptyProductForm());
  }, [open, editingProduct, reset]);

  // A dialog can open before the catalog options finish loading. Once they do,
  // reconcile only the legacy category value; leave every user-edited field intact.
  useEffect(() => {
    if (!open || !editingProduct || categories.length === 0) return;
    if (categorySyncedProductRef.current === editingProduct.id) return;

    const resolvedCategoryId = productToFormValues(editingProduct, categories).categoryId;
    if (resolvedCategoryId && getValues("categoryId") !== resolvedCategoryId) {
      setValue("categoryId", resolvedCategoryId, { shouldDirty: false, shouldValidate: false });
    }
    categorySyncedProductRef.current = editingProduct.id;
  }, [categories, editingProduct, getValues, open, setValue]);

  const watchedValues = watch();
  const watchBarcode = watchedValues.barcode ?? "";
  const selectedCategory = categories.find((c) => c.id === watchedValues.categoryId);
  const categoryLabel = selectedCategory ? (lang === "ar" ? selectedCategory.name : selectedCategory.nameEn || selectedCategory.name) : "";

  const onSubmit = async (values: ProductFormValues) => {
    try {
      const category = categories.find((c) => c.id === values.categoryId);
      const payload = {
        id: editingProduct?.id,
        Code: editingProduct?.code || `PROD-${Date.now()}`,
        Barcode: values.barcode || "",
        Name: values.name,
        Name_Ar: values.nameAr || "",
        Name_En: values.name,
        Price: values.price,
        Stock: values.stock,
        Category: values.categoryId,
        Category_Name: category?.name || "",
        Category_Name_En: category?.nameEn || category?.name || "",
      };

      const saved = isEditing
        ? await updateAdminProduct(payload)
        : await createAdminProduct(payload);

      showSuccessToast(
        isEditing
          ? lang === "ar" ? "تم تحديث المنتج بنجاح." : "Product updated successfully."
          : lang === "ar" ? "تم إضافة المنتج بنجاح." : "Product added successfully.",
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = handleApiError(err, "Save failed");
      showErrorToast(err, msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
              >
                {isEditing ? <Bars3BottomLeftIcon className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
              </span>
              <div>
                <DialogTitle className="text-lg font-black text-slate-800">
                  {isEditing
                    ? lang === "ar" ? "تعديل المنتج" : "Edit product"
                    : lang === "ar" ? "إضافة منتج جديد" : "Add new product"}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  {isEditing
                    ? (lang === "ar" ? "حدّث بيانات هذا المنتج في الكتالوج." : "Update this product's catalog details.")
                    : (lang === "ar" ? "أدخل بيانات المنتج وسيتم حفظه في الكتالوج." : "Fill in product details and it will be saved to the catalog.")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-6 px-6 py-5 md:grid-cols-[minmax(0,1fr)_15rem]">
            {/* ── Fields ── */}
            <div className="space-y-5 md:order-1">
              <div className="space-y-3.5">
                <SectionHeading icon={TagIcon}>
                  {lang === "ar" ? "المعلومات الأساسية" : "Basic information"}
                </SectionHeading>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <FormField label={lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"} required error={errors.name?.message}>
                    <input {...register("name")} className={inputClass} placeholder="Panadol Extra 24 tablets" />
                  </FormField>

                  <FormField label={lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"} error={errors.nameAr?.message}>
                    <input {...register("nameAr")} dir="rtl" className={inputClass} placeholder="بانادول إكسترا ٢٤ قرص" />
                  </FormField>
                </div>

                <FormField
                  label={lang === "ar" ? "الباركود" : "Barcode"}
                  error={errors.barcode?.message}
                  hint={lang === "ar" ? "اختياري — يفعّل بحث المرجع تلقائيًا" : "Optional — triggers reference lookup automatically"}
                >
                  <div className="relative">
                    <QrCodeIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                    <input {...register("barcode")} dir="ltr" className={cn(inputClass, "ps-9")} placeholder="6221012345678" />
                  </div>
                </FormField>

                <BarcodePanel barcode={watchBarcode} lang={lang} />
              </div>

              <div className="space-y-3.5">
                <SectionHeading icon={CubeIcon}>
                  {lang === "ar" ? "القسم والتسعير والمخزون" : "Category, pricing & stock"}
                </SectionHeading>

                <FormField label={lang === "ar" ? "القسم" : "Category"} required error={errors.categoryId?.message}>
                  <select {...register("categoryId")} className={cn(inputClass, "cursor-pointer appearance-none")}>
                    <option value="">{lang === "ar" ? "اختر قسماً" : "Select a category"}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{lang === "ar" ? c.name : c.nameEn || c.name}</option>
                    ))}
                  </select>
                </FormField>

                <div className="grid grid-cols-2 gap-3.5">
                  <FormField label={lang === "ar" ? "السعر (ج.م)" : "Price (EGP)"} required error={errors.price?.message}>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      {...register("price", { valueAsNumber: true })}
                      className={inputClass}
                      placeholder="0.00"
                    />
                  </FormField>
                  <FormField label={lang === "ar" ? "المخزون" : "Stock"} error={errors.stock?.message}>
                    <input
                      type="number"
                      inputMode="numeric"
                      {...register("stock", { valueAsNumber: true })}
                      className={inputClass}
                      placeholder="0"
                    />
                  </FormField>
                </div>
              </div>
            </div>

            {/* ── Live preview (desktop: sticky side column; mobile: stacked above footer) ── */}
            <div className="md:sticky md:top-0 md:order-2 md:self-start">
              <LivePreview
                values={watchedValues}
                categoryLabel={categoryLabel}
                imageUrl={editingProduct?.imageUrl}
                lang={lang}
                isEditing={isEditing}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 px-6 py-4 gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <XMarkIcon className="h-4 w-4" />
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              {isSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
              {isEditing
                ? lang === "ar" ? "حفظ التعديلات" : "Save changes"
                : lang === "ar" ? "إضافة المنتج" : "Add product"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
