/**
 * ProductCard — 2026 redesign.
 *
 * Key architectural decisions:
 *   • NO overflow:hidden on the article — this was clipping the hover shadow and
 *     the -translate-y lift. overflow:hidden is applied ONLY to the image wrapper.
 *   • hover:z-10 on article so the lifted card renders above its grid siblings
 *     without being clipped (requires GridItemContainer to be position:relative).
 *   • StockBar removed — replaced with a one-line dot + label that costs zero
 *     layout height and reads at a glance.
 *   • Button: solid ink (#0A1220) → hover teal (#0E7E74). No CSS variable gradient
 *     dependency that can break when variables aren't loaded.
 *   • CSS entrance animation preserved (product-card-animate class) — still
 *     suppressed via animate=false in virtualized contexts.
 */

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Eye, ShoppingBag, Zap } from "lucide-react";
import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { Link } from "react-router-dom";
import { useCart }     from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  formatStockQuantity,
  getCatalogProductImage,
  getCatalogProductImageSrcSet,
  getProductAvailabilityLabel,
  type CatalogProduct,
} from "../catalog";
import { getLocalizedProductName } from "../localization";
import { FavoriteHeartButton }    from "./FavoriteHeartButton";
import { ImageWithFallback }      from "./figma/ImageWithFallback";
import { cn }                     from "./UI";

// ─── Brand teal ───────────────────────────────────────────────────────────────
const TEAL = "#0E7E74";
const INK  = "#0A1220";

// ─── useAddedFeedback ─────────────────────────────────────────────────────────

function useAddedFeedback() {
  const [isAdded, setIsAdded] = useState(false);
  const resetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (resetRef.current !== null) window.clearTimeout(resetRef.current); };
  }, []);

  const trigger = () => {
    setIsAdded(true);
    if (resetRef.current !== null) window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => {
      setIsAdded(false);
      resetRef.current = null;
    }, 1600);
  };

  return { isAdded, trigger };
}

// ─── ProductCardSkeleton ──────────────────────────────────────────────────────

export function ProductCardSkeleton({ className }: { className?: string }) {
  const shimmer = [
    "relative overflow-hidden",
    "before:absolute before:inset-0",
    "before:bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.65)_50%,transparent_75%)]",
    "before:bg-[length:200%_100%]",
    "before:animate-shimmer",
  ].join(" ");

  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-col rounded-2xl border border-slate-100 bg-white",
        "shadow-[0_1px_4px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      <div className={cn("aspect-square w-full rounded-t-2xl bg-slate-100", shimmer)} />
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
        <div className={cn("h-4 w-4/5 rounded-lg bg-slate-100", shimmer)} />
        <div className={cn("h-3 w-1/2 rounded-lg bg-slate-100", shimmer)} />
        <div className={cn("h-3 w-1/3 rounded-lg bg-slate-100", shimmer)} />
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className={cn("h-6 w-14 rounded-lg bg-slate-100", shimmer)} />
          <div className={cn("h-9 w-28 rounded-xl bg-slate-100", shimmer)} />
        </div>
      </div>
    </div>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

export const ProductCard = memo(function ProductCard({
  product,
  className,
  style,
  animate = true,
}: {
  product:    CatalogProduct;
  className?: string;
  style?:     CSSProperties;
  animate?:   boolean;
}) {
  const { lang, t }          = useLanguage();
  const { addToCart }        = useCart();
  const { isAdded, trigger } = useAddedFeedback();

  const primaryName   = getLocalizedProductName(product, lang);
  const secondaryName =
    lang === "ar"
      ? (product.nameEn ?? product.name ?? "")
      : (product.nameAr ?? product.name ?? "");
  const displayCategoryName =
    lang === "ar" ? product.categoryName : product.categoryNameEn;

  const handleAddToCart = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock) return;
    await addToCart(product);
    trigger();
  };

  const stockLevel =
    !product.inStock    ? "out"      :
    product.stock <= 3  ? "critical" :
    product.stock <= 10 ? "low"      : "ok";

  return (
    <article
      style={{ ...(style ?? {}), WebkitTapHighlightColor: "transparent" } as CSSProperties}
      className={cn(
        // ⚠ NO overflow:hidden here — it clips the hover shadow + translateY.
        // Image clipping is handled inside the image wrapper below.
        "product-card group relative flex flex-col",
        "rounded-2xl border border-slate-100 bg-white",
        "shadow-[0_1px_3px_rgba(15,23,42,0.05),0_2px_8px_rgba(15,23,42,0.04)]",
        // Lift on hover: translate not scale — scale makes neighbours feel crowded.
        // z-10 ensures the lifted card renders above siblings without clipping.
        "transition-[transform,box-shadow,border-color] duration-300 ease-out",
        "hover:-translate-y-2.5 hover:z-10",
        "hover:shadow-[0_16px_48px_rgba(15,23,42,0.14),0_4px_16px_rgba(15,23,42,0.06)]",
        "hover:border-slate-200/80",
        animate && "product-card-animate",
        className,
      )}
    >
      {/* ── IMAGE AREA ─────────────────────────────────────────────────────── */}
      {/* overflow:hidden ONLY here — clips image to rounded top corners        */}
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-[#F7FAFB]">

        {/* Category pill + favourite */}
        <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
          <span className="inline-flex max-w-[68%] items-center truncate rounded-lg border border-white/70 bg-white/92 px-2 py-1 text-[9px] font-black tracking-wide text-slate-600 shadow-sm">
            {displayCategoryName}
          </span>
          <FavoriteHeartButton
            productId={product.id}
            size="sm"
            className="border-white/70 bg-white/92 shadow-sm"
          />
        </div>

        {/* Product image — wrapped in Link */}
        <Link
          to={`/products/${product.id}`}
          className="block h-full w-full focus-visible:outline-none focus-visible:ring-0"
          tabIndex={-1}
          style={{ WebkitTapHighlightColor: "transparent" } as CSSProperties}
        >
          <ImageWithFallback
            src={getCatalogProductImage(product)}
            srcSet={getCatalogProductImageSrcSet(product.imageUrl)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
            alt={primaryName}
            className="h-full w-full object-contain p-8 transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            loading="lazy"
            decoding="async"
          />
        </Link>

        {/* Limited qty badge */}
        {stockLevel === "critical" && product.inStock && (
          <div className="absolute bottom-3 inset-x-3 z-10 flex justify-center">
            <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[9px] font-black text-white shadow-md">
              <Zap className="h-3 w-3" />
              {lang === "ar" ? "كمية محدودة" : "Limited qty"}
            </span>
          </div>
        )}

        {/* Out-of-stock veil */}
        {!product.inStock && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/55 backdrop-blur-[2px]">
            <span className="rounded-lg bg-slate-900/90 px-3 py-1.5 text-[10px] font-black text-white shadow-lg">
              {lang === "ar" ? "نفد المخزون" : "Out of stock"}
            </span>
          </div>
        )}

        {/* "View product" hover overlay */}
        {product.inStock && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/[0.03] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-3.5 py-1.5 text-[11px] font-black text-slate-700 shadow-md">
              <Eye className="h-3.5 w-3.5" style={{ color: TEAL }} />
              {lang === "ar" ? "عرض المنتج" : "View product"}
            </span>
          </div>
        )}
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">

        {/* Product names */}
        <Link
          to={`/products/${product.id}`}
          className="mb-2.5 block focus-visible:outline-none"
          style={{ WebkitTapHighlightColor: "transparent" } as CSSProperties}
        >
          <h3 className="line-clamp-2 text-[0.88rem] font-black leading-tight text-slate-900 transition-colors duration-200 group-hover:text-[#0E7E74]">
            {primaryName}
          </h3>
          {secondaryName && secondaryName !== primaryName ? (
            <p className="mt-0.5 line-clamp-1 text-[0.75rem] font-medium text-slate-400" dir="auto">
              {secondaryName}
            </p>
          ) : (
            <div className="mt-0.5 h-[1rem]" />
          )}
        </Link>

        {/* Availability row */}
        <div className="mb-3 flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              product.inStock ? "bg-emerald-400" : "bg-rose-400",
            )}
          />
          <span
            className={cn(
              "text-[10px] font-semibold",
              product.inStock ? "text-emerald-600" : "text-rose-500",
            )}
          >
            {getProductAvailabilityLabel(product, lang)}
          </span>
          <span
            className={cn(
              "ms-auto text-[10px] font-black",
              stockLevel === "critical" ? "text-amber-500" :
              stockLevel === "out"      ? "text-rose-400"  : "text-slate-300",
            )}
          >
            {formatStockQuantity(product.stock)}
          </span>
        </div>

        {/* Footer: price + add-to-cart */}
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
              {lang === "ar" ? "السعر" : "Price"}
            </p>
            <p className="mt-0.5 text-[1.1rem] font-black leading-none tracking-tight text-slate-900">
              {product.price.toFixed(2)}{" "}
              <span className="text-[10px] font-bold text-slate-400">{t("currency")}</span>
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={handleAddToCart}
            disabled={!product.inStock}
            aria-label={lang === "ar" ? "إضافة إلى السلة" : "Add to cart"}
            className={cn(
              "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-[12px] font-black",
              "transition-[background-color,box-shadow] duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              product.inStock
                ? isAdded
                  ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.30)] focus-visible:ring-emerald-400"
                  : "text-white shadow-[0_4px_14px_rgba(10,18,32,0.20)] hover:shadow-[0_4px_14px_rgba(14,126,116,0.30)] focus-visible:ring-[#0E7E74]"
                : "cursor-not-allowed bg-slate-100 text-slate-400",
            )}
            style={
              product.inStock && !isAdded
                ? { backgroundColor: INK, WebkitTapHighlightColor: "transparent" } as CSSProperties
                : { WebkitTapHighlightColor: "transparent" } as CSSProperties
            }
            onMouseEnter={(e) => {
              if (product.inStock && !isAdded) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = TEAL;
              }
            }}
            onMouseLeave={(e) => {
              if (product.inStock && !isAdded) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = INK;
              }
            }}
          >
            <AnimatePresence mode="wait">
              {isAdded ? (
                <motion.span
                  key="added"
                  initial={{ opacity: 0, scale: 0.75 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.75 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {lang === "ar" ? "تمت" : "Added"}
                </motion.span>
              ) : (
                <motion.span
                  key="add"
                  initial={{ opacity: 0, scale: 0.75 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.75 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {t("add_to_cart")}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </article>
  );
});

// ─── ProductCardCompact ───────────────────────────────────────────────────────

export const ProductCardCompact = memo(function ProductCardCompact({
  product,
  animate = true,
}: {
  product:  CatalogProduct;
  animate?: boolean;
}) {
  const { lang, t }          = useLanguage();
  const { addToCart }        = useCart();
  const { isAdded, trigger } = useAddedFeedback();

  const primaryName   = getLocalizedProductName(product, lang);
  const secondaryName =
    lang === "ar"
      ? (product.nameEn ?? product.name ?? "")
      : (product.nameAr ?? product.name ?? "");
  const displayCategoryName =
    lang === "ar" ? product.categoryName : product.categoryNameEn;

  return (
    <div
      className={cn(
        "product-card-compact group relative flex items-start gap-3 overflow-hidden",
        "rounded-2xl border border-slate-100 bg-white p-3",
        "shadow-[0_1px_4px_rgba(15,23,42,0.05)]",
        "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(15,23,42,0.10)]",
        animate && "product-card-animate",
      )}
      style={{ WebkitTapHighlightColor: "transparent" } as CSSProperties}
    >
      {/* Thumbnail */}
      <Link
        to={`/products/${product.id}`}
        className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-slate-50 focus-visible:outline-none"
        style={{ WebkitTapHighlightColor: "transparent" } as CSSProperties}
      >
        <ImageWithFallback
          src={getCatalogProductImage(product)}
          srcSet={getCatalogProductImageSrcSet(product.imageUrl)}
          sizes="80px"
          alt={primaryName}
          className="h-full w-full object-contain p-1 transition-transform duration-500 ease-out group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
      </Link>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <span className="truncate rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black text-slate-500">
            {displayCategoryName}
          </span>
          <FavoriteHeartButton productId={product.id} size="sm" className="border-slate-200 bg-white" />
        </div>

        <Link
          to={`/products/${product.id}`}
          className="mt-1.5 block focus-visible:outline-none"
          style={{ WebkitTapHighlightColor: "transparent" } as CSSProperties}
        >
          <p className="line-clamp-1 text-[0.83rem] font-black leading-snug text-slate-900 transition-colors group-hover:text-[#0E7E74]">
            {primaryName}
          </p>
        </Link>

        {secondaryName && secondaryName !== primaryName && (
          <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-slate-400" dir="auto">
            {secondaryName}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-slate-900">
              {product.price.toFixed(2)}{" "}
              <span className="text-[10px] font-bold text-slate-400">{t("currency")}</span>
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
              {getProductAvailabilityLabel(product, lang)}
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.93 }}
            type="button"
            onClick={() => {
              if (!product.inStock) return;
              void addToCart(product).then(() => trigger());
            }}
            disabled={!product.inStock}
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black",
              "transition-[background-color] duration-200 focus-visible:outline-none",
              product.inStock
                ? isAdded
                  ? "bg-emerald-500 text-white"
                  : "bg-[#0A1220] text-white hover:bg-[#0E7E74]"
                : "cursor-not-allowed bg-slate-100 text-slate-400",
            )}
            aria-label={lang === "ar" ? "إضافة إلى السلة" : "Add to cart"}
          >
            {isAdded ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
          </motion.button>
        </div>
      </div>
    </div>
  );
});
