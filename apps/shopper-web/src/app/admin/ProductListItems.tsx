/**
 * ProductListItems.tsx
 * Presentational list-item components for ProductManager — extracted so the
 * manager component can stay focused on data/state orchestration. Both cards
 * are memoized since they render inside a paginated list.
 */

import { memo } from "react";
import { CubeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { cn } from "../components/UI";
import type { AdminProduct } from "../../services/adminSupabaseApi";

export type Language = "ar" | "en";
export type Product = AdminProduct;

export function stockLabel(stock: number, lang: Language): string {
  if (stock === 0) return lang === "ar" ? "نفد" : "Out";
  if (stock < 5) return lang === "ar" ? "منخفض جداً" : "Critical";
  if (stock < 10) return lang === "ar" ? "منخفض" : "Low";
  return lang === "ar" ? "متاح" : "In Stock";
}

export function stockClasses(stock: number): string {
  if (stock === 0) return "border-rose-200 bg-rose-50 text-rose-700";
  if (stock < 5) return "border-orange-200 bg-orange-50 text-orange-700";
  if (stock < 10) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function formatCurrency(v: number, lang: Language): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(v);
}

interface ItemActionProps {
  product: Product;
  lang: Language;
  canEdit: boolean;
  canDelete: boolean;
  selected: boolean;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onToggleSelect: (id: string) => void;
}

// ─── ProductCard (mobile) ──────────────────────────────────────────────────────

export const ProductCard = memo(function ProductCard({
  product,
  lang,
  canEdit,
  canDelete,
  selected,
  onEdit,
  onDelete,
  onToggleSelect,
}: ItemActionProps) {
  const stockColor =
    product.stock === 0 ? "#f43f5e"
    : product.stock < 5 ? "#f97316"
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
          {(canEdit || canDelete) && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(product.id)}
              aria-label={lang === "ar" ? `تحديد ${product.name}` : `Select ${product.name}`}
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-teal-600"
            />
          )}
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


        {(canEdit || canDelete) && (
          <div className="mt-3 flex gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/60 text-xs font-bold text-teal-700 transition-all hover:bg-teal-100 hover:shadow-sm active:scale-[.98]"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                {lang === "ar" ? "تعديل" : "Edit"}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(product)}
                aria-label={lang === "ar" ? `حذف ${product.name}` : `Delete ${product.name}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/60 text-rose-600 transition-all hover:bg-rose-100 active:scale-[.98]"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
});

// ─── ProductTableRow (desktop) ─────────────────────────────────────────────────

export const ProductTableRow = memo(function ProductTableRow({
  product,
  lang,
  canEdit,
  canDelete,
  selected,
  onEdit,
  onDelete,
  onToggleSelect,
}: ItemActionProps) {
  return (
    <tr className={cn("border-b border-slate-100 transition-colors hover:bg-slate-50/60", selected && "bg-teal-50/40")}>
      {(canEdit || canDelete) && (
        <td className="w-10 px-3 py-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(product.id)}
            aria-label={lang === "ar" ? `تحديد ${product.name}` : `Select ${product.name}`}
            className="h-4 w-4 rounded border-slate-300 accent-teal-600"
          />
        </td>
      )}
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
        <div className="flex items-center gap-2">
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
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(product)}
              aria-label={lang === "ar" ? `حذف ${product.name}` : `Delete ${product.name}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 active:scale-95"
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});
