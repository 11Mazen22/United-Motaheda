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
  CheckIcon,
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
}

// ─── Field wrapper (kept local — thin enough not to warrant a shared export,
// and lets us wire react-hook-form's `register` directly onto native inputs
// while keeping the same visual language as AdminFormField). ────────────────

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ms-1 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

const inputClass = cn(
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3",
  "text-sm text-slate-700 outline-none",
  "transition-all duration-150",
  "placeholder:text-slate-400",
  "focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

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

  const watchBarcode = watch("barcode") ?? "";

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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 shadow-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader className="border-b border-slate-100 px-5 py-4">
            <DialogTitle className="text-lg font-bold text-slate-800">
              {isEditing
                ? lang === "ar" ? "تعديل المنتج" : "Edit product"
                : lang === "ar" ? "إضافة منتج جديد" : "Add new product"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {lang === "ar" ? "أدخل بيانات المنتج وسيتم حفظه في الكتالوج." : "Fill in product details and it will be saved to the catalog."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <FormField label={lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"} required error={errors.name?.message}>
              <input {...register("name")} className={inputClass} />
            </FormField>

            <FormField label={lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"} error={errors.nameAr?.message}>
              <input {...register("nameAr")} dir="rtl" className={inputClass} />
            </FormField>

            <FormField label={lang === "ar" ? "الباركود" : "Barcode"} error={errors.barcode?.message}>
              <input {...register("barcode")} dir="ltr" className={inputClass} />
            </FormField>

            <BarcodePanel barcode={watchBarcode} lang={lang} />

            <FormField label={lang === "ar" ? "القسم" : "Category"} required error={errors.categoryId?.message}>
              <select {...register("categoryId")} className={inputClass}>
                <option value="">{lang === "ar" ? "اختر قسماً" : "Select a category"}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{lang === "ar" ? c.name : c.nameEn || c.name}</option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={lang === "ar" ? "السعر (EGP)" : "Price (EGP)"} required error={errors.price?.message}>
                <input
                  type="number"
                  step="0.01"
                  {...register("price", { valueAsNumber: true })}
                  className={inputClass}
                />
              </FormField>
              <FormField label={lang === "ar" ? "المخزون" : "Stock"} error={errors.stock?.message}>
                <input
                  type="number"
                  {...register("stock", { valueAsNumber: true })}
                  className={inputClass}
                />
              </FormField>
            </div>

          </div>

          <DialogFooter className="border-t border-slate-100 px-5 py-4 gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <XMarkIcon className="h-4 w-4" />
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              {isSubmitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
              {isEditing
                ? lang === "ar" ? "حفظ التعديلات" : "Save changes"
                : lang === "ar" ? "إضافة" : "Add product"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
