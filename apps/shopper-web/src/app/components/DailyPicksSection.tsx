import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ShoppingBag, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCatalogProductImage,
  getCatalogProductImageSrcSet,
  type CatalogProduct,
} from "../catalog";
import { getLocalizedProductName } from "../localization";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { cn } from "./UI";

/* ─── Types & Constants ─── */
type DailyPicksSectionProps = {
  products: CatalogProduct[];
  lang: "ar" | "en";
  isLoading?: boolean;
  className?: string;
  embedded?: boolean;
};

const PICKS_LIMIT = 8;
const CATEGORY_LIMIT = 6;

/* ─── Utilities (unchanged) ─── */
function hashStr(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  let nextSeed = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    nextSeed = (nextSeed * 1664525 + 1013904223) >>> 0;
    const j = nextSeed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatCurrency(value: number, isRtl: boolean) {
  return `${value.toFixed(2)} ${isRtl ? "ج.م" : "EGP"}`;
}

function getStockLabel(product: CatalogProduct, isRtl: boolean) {
  if (!product.inStock) return isRtl ? "غير متوفر" : "Unavailable";
  if (product.stock <= 3) return isRtl ? "كمية محدودة" : "Limited";
  if (product.stock <= 10) return isRtl ? "مخزون منخفض" : "Low stock";
  return isRtl ? "جاهز للشحن" : "In stock";
}

function getStockTone(product: CatalogProduct): "success" | "warning" | "danger" {
  if (!product.inStock) return "danger";
  if (product.stock <= 10) return "warning";
  return "success";
}

/* ─── Skeleton (now in cold B&W) ─── */
function SectionSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="flex items-end justify-between pb-4 border-b-2 border-[#1d1d1f]">
        <div className="h-8 w-44 rounded bg-[#1d1d1f]/10" />
        <div className="h-4 w-20 rounded bg-[#1d1d1f]/10" />
      </div>
      <div className="flex gap-7 py-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 w-14 rounded bg-[#1d1d1f]/10" />
        ))}
      </div>
      <div className="rounded-xl border-2 border-[#1d1d1f]/20 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="w-full sm:w-[45%] aspect-square sm:aspect-auto sm:min-h-[320px] bg-[#f5f5f7]" />
          <div className="hidden sm:block w-[2px] flex-shrink-0 bg-[#1d1d1f]/20" />
          <div className="flex-1 p-7 sm:p-10 space-y-4 border-t-2 sm:border-t-0 border-[#1d1d1f]/20">
            <div className="h-5 w-24 rounded border border-[#1d1d1f]/15 bg-[#1d1d1f]/10" />
            <div className="h-9 w-4/5 rounded bg-[#1d1d1f]/10" />
            <div className="h-7 w-1/3 rounded bg-[#1d1d1f]/10" />
            <div className="h-4 w-24 rounded bg-[#1d1d1f]/10" />
            <div className="mt-3 h-12 w-36 rounded-lg bg-[#1d1d1f]/10 border border-[#1d1d1f]/15" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-10 mb-5 pb-4 border-b border-[#d2d2d7]">
        <div className="h-5 w-40 rounded bg-[#1d1d1f]/10" />
        <div className="h-4 w-16 rounded bg-[#1d1d1f]/10" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border-2 border-[#1d1d1f]/15 overflow-hidden bg-white">
            <div className="aspect-[3/4] bg-[#f5f5f7]" />
            <div className="border-t-2 border-[#1d1d1f]/15 p-3 space-y-2">
              <div className="h-3 w-16 rounded border border-[#1d1d1f]/15 bg-[#1d1d1f]/10" />
              <div className="h-3.5 w-full rounded bg-[#1d1d1f]/10" />
              <div className="h-3.5 w-4/5 rounded bg-[#1d1d1f]/10" />
              <div className="pt-1 flex items-center justify-between">
                <div className="h-4 w-20 rounded bg-[#1d1d1f]/10" />
                <div className="w-2 h-2 rounded-full bg-[#1d1d1f]/20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function DailyPicksSection({
  products,
  lang,
  isLoading = false,
  className,
}: DailyPicksSectionProps) {
  const isRtl = lang === "ar";
  const dailySeed = useMemo(() => hashStr(new Date().toDateString()), []);

  const catalogPool = useMemo(
    () => seededShuffle(products, (dailySeed ^ 0x1a2b3c4d) >>> 0).slice(0, 50),
    [products, dailySeed]
  );

  const categories = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const p of catalogPool) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }

    const sorted = [...map.entries()]
      .map(([key, items]) => ({
        key,
        label: lang === "ar" ? items[0].categoryName : items[0].categoryNameEn,
        count: items.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, CATEGORY_LIMIT);

    return [
      {
        key: "__all__",
        label: isRtl ? "الكل" : "All",
        count: Math.min(catalogPool.length, PICKS_LIMIT),
      },
      ...sorted,
    ];
  }, [catalogPool, lang, isRtl]);

  const [activeKey, setActiveKey] = useState<string>("__all__");

  useEffect(() => {
    if (!categories.some((c) => c.key === activeKey)) {
      setActiveKey("__all__");
    }
  }, [categories, activeKey]);

  const activePicks = useMemo(() => {
    const base =
      activeKey === "__all__"
        ? catalogPool
        : catalogPool.filter((p) => p.category === activeKey);
    return base.slice(0, PICKS_LIMIT);
  }, [activeKey, catalogPool]);

  const spotlight = useMemo(
    () => activePicks.find((p) => p.inStock) ?? activePicks[0],
    [activePicks]
  );

  const supporting = useMemo(
    () => activePicks.filter((p) => p.id !== spotlight?.id).slice(0, 4),
    [activePicks, spotlight]
  );

  const handleCategoryChange = useCallback((key: string) => {
    setActiveKey(key);
  }, []);

  if (isLoading && products.length === 0) {
    return <SectionSkeleton />;
  }

  if (!spotlight || categories.length === 0) {
    return null;
  }

  const selectionHref =
    activeKey !== "__all__"
      ? `/products?category=${encodeURIComponent(activeKey)}`
      : "/products";

  const spotlightName = getLocalizedProductName(spotlight, lang);
  const spotlightCategory =
    lang === "ar" ? spotlight.categoryName : spotlight.categoryNameEn;
  const spotlightStock = getStockLabel(spotlight, isRtl);
  const spotlightTone = getStockTone(spotlight);

  /* ─── Monochrome stock accent (cold B&W) ─── */
  const stockDotColor = {
    success: "bg-black shadow-[0_0_6px_rgba(0,0,0,0.4)]",
    warning: "bg-neutral-700 shadow-[0_0_6px_rgba(0,0,0,0.4)]",
    danger: "bg-neutral-500 shadow-[0_0_6px_rgba(0,0,0,0.4)]",
  };

  const stockTextColor = {
    success: "text-black",
    warning: "text-neutral-700",
    danger: "text-neutral-600",
  };

  return (
    <section className={cn("", className)}>

      {/* ── Section Header ── */}
      <div
        className={cn(
          "flex items-end justify-between pb-4 border-b-2 border-[#1d1d1f]",
          isRtl && "flex-row-reverse"
        )}
      >
        <h2
          className="text-2xl md:text-[2rem] font-bold text-[#1d1d1f] leading-none"
          style={{
            fontFamily: isRtl ? "var(--font-display-ar)" : undefined,
            letterSpacing: isRtl ? undefined : "-0.025em",
          }}
        >
          {isRtl ? "مختارات اليوم" : "Today's Picks"}
        </h2>
        <Link
          to={selectionHref}
          className={cn(
            "flex items-center gap-1 text-sm font-semibold text-[#1d1d1f] hover:underline underline-offset-2 shrink-0 transition-opacity hover:opacity-80",
            isRtl && "flex-row-reverse"
          )}
        >
          {isRtl ? "عرض الكل" : "View all"}
          <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
        </Link>
      </div>

      {/* ── Category Tabs ── */}
      <div
        className={cn(
          "flex gap-6 py-5 overflow-x-auto scrollbar-hide",
          isRtl && "flex-row-reverse"
        )}
      >
        {categories.map((cat) => {
          const isActive = cat.key === activeKey;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategoryChange(cat.key)}
              className={cn(
                "relative shrink-0 pb-1 text-sm transition-colors focus-visible:outline-none",
                isActive
                  ? "text-[#1d1d1f] font-semibold"
                  : "text-[#6e6e73] font-medium hover:text-[#1d1d1f]"
              )}
            >
              {cat.label}
              {isActive && (
                <motion.span
                  layoutId="activeCatBar"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1d1d1f] rounded-full"
                  style={{ boxShadow: "0 0 8px rgba(0,0,0,0.2)" }}
                  transition={{ type: "spring", stiffness: 480, damping: 32 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Animated Content Block ── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >

          {/* ── Spotlight Hero Card ── */}
          <div className="relative rounded-xl bg-white">
            {/* Outer border with aura glow */}
            <div className="absolute inset-0 rounded-xl border-2 border-[#1d1d1f] pointer-events-none z-10" />
            {/* Subtle cold glow */}
            <div className="absolute inset-0 rounded-xl border-2 border-[#1d1d1f]/10 blur-xl opacity-30" />

            <div
              className={cn(
                "flex flex-col sm:flex-row rounded-xl overflow-hidden",
                isRtl && "sm:flex-row-reverse"
              )}
            >
              {/* Image panel */}
              <Link
                to={`/products/${spotlight.id}`}
                className="relative w-full sm:w-[45%] bg-[#f5f5f7] flex items-center justify-center overflow-hidden z-20"
                tabIndex={0}
              >
                <motion.div
                  className="w-full aspect-square sm:aspect-auto sm:h-[360px] relative flex items-center justify-center p-8"
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                >
                  {spotlight.hasActivePromotion && (
                    <span
                      className={cn(
                        "absolute top-4 z-10 inline-flex items-center gap-1 bg-[#1d1d1f] text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded shadow-[0_0_10px_rgba(0,0,0,0.3)]",
                        isRtl ? "right-4" : "left-4"
                      )}
                    >
                      <Tag className="h-3 w-3" />
                      {isRtl ? "عرض" : "Sale"}
                    </span>
                  )}
                  <ImageWithFallback
                    src={getCatalogProductImage(spotlight)}
                    srcSet={getCatalogProductImageSrcSet(spotlight.imageUrl)}
                    sizes="(max-width: 640px) 100vw, 45vw"
                    alt={spotlightName}
                    className="h-full w-full object-contain transition-transform duration-500 hover:scale-[1.04]"
                    loading="eager"
                    decoding="async"
                  />
                </motion.div>
              </Link>

              {/* Inner vertical rule */}
              <div className="hidden sm:block w-[2px] bg-[#1d1d1f] flex-shrink-0 relative z-20" />

              {/* Info panel */}
              <div
                className={cn(
                  "flex-1 flex flex-col justify-center gap-4 p-7 sm:p-10 relative z-20",
                  "border-t-2 sm:border-t-0 border-[#1d1d1f]",
                  isRtl ? "items-end text-right" : "items-start text-left"
                )}
              >
                {/* Category badge — outlined */}
                <span className="inline-block border-2 border-[#1d1d1f] text-[#1d1d1f] text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
                  {spotlightCategory}
                </span>

                {/* Product name */}
                <h3
                  className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.1] text-[#1d1d1f] tracking-tight"
                  style={{
                    fontFamily: isRtl ? "var(--font-display-ar)" : undefined,
                    letterSpacing: isRtl ? undefined : "-0.03em",
                  }}
                >
                  {spotlightName}
                </h3>

                {/* Price row */}
                <div className={cn("flex items-baseline gap-3", isRtl && "flex-row-reverse")}>
                  <span className="text-4xl font-black text-[#1d1d1f]">
                    {formatCurrency(spotlight.price, isRtl)}
                  </span>
                  {spotlight.basePrice && (
                    <span className="text-lg font-medium text-[#6e6e73] line-through">
                      {formatCurrency(spotlight.basePrice, isRtl)}
                    </span>
                  )}
                </div>

                {/* Stock indicator with cold glow */}
                <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
                  <span
                    className={cn(
                      "w-3 h-3 rounded-full flex-shrink-0 animate-pulse",
                      stockDotColor[spotlightTone]
                    )}
                  />
                  <span className={cn("text-sm font-semibold", stockTextColor[spotlightTone])}>
                    {spotlightStock}
                  </span>
                </div>

                {/* CTA button — black on black hover */}
                <Link
                  to={`/products/${spotlight.id}`}
                  className={cn(
                    "mt-1 inline-flex items-center gap-2 bg-[#1d1d1f] text-white",
                    "text-sm font-bold px-7 py-4 rounded-lg",
                    "transition-all duration-200 hover:bg-[#333]",
                    "hover:shadow-[0_0_20px_rgba(0,0,0,0.25)] hover:-translate-y-0.5",
                    isRtl && "flex-row-reverse"
                  )}
                >
                  <ShoppingBag className="h-4 w-4" />
                  {isRtl ? "اشترِ الآن" : "Buy now"}
                  <motion.span
                    className="inline-block"
                    initial={{ x: 0 }}
                    whileHover={{ x: isRtl ? -3 : 3 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                  </motion.span>
                </Link>
              </div>
            </div>
          </div>

          {/* ── Supporting Picks ── */}
          {supporting.length > 0 && (
            <div className="mt-12">

              {/* Sub-header with thin rule */}
              <div
                className={cn(
                  "flex items-center justify-between mb-6 pb-4 border-b border-[#d2d2d7]",
                  isRtl && "flex-row-reverse"
                )}
              >
                <h4
                  className="text-lg font-semibold text-[#1d1d1f] tracking-tight"
                  style={{
                    fontFamily: isRtl ? "var(--font-display-ar)" : undefined,
                  }}
                >
                  {isRtl ? "قد يعجبك أيضاً" : "You might also like"}
                </h4>
                <Link
                  to={selectionHref}
                  className="text-sm font-medium text-[#1d1d1f] hover:underline underline-offset-2"
                >
                  {isRtl ? "عرض الكل" : "See all"}
                </Link>
              </div>

              {/* 4-column grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {supporting.map((product, index) => {
                  const name = getLocalizedProductName(product, lang);
                  const category =
                    lang === "ar" ? product.categoryName : product.categoryNameEn;
                  const stock = getStockLabel(product, isRtl);
                  const tone = getStockTone(product);

                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 15, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.35,
                        delay: index * 0.08,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="h-full"
                    >
                      <Link
                        to={`/products/${product.id}`}
                        className={cn(
                          "group flex flex-col h-full",
                          "border-2 border-[#1d1d1f] rounded-xl bg-white overflow-hidden",
                          "transition-all duration-300 hover:scale-[1.03]",
                          "hover:shadow-[0_10px_30px_rgba(0,0,0,0.15),0_0_0_2px_#1d1d1f]",
                          "relative z-10"
                        )}
                      >
                        {/* Image zone */}
                        <div className="relative aspect-[3/4] bg-[#f5f5f7] flex items-center justify-center overflow-hidden p-4">
                          {product.hasActivePromotion && (
                            <span
                              className={cn(
                                "absolute top-2.5 z-10 bg-[#1d1d1f] text-white",
                                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[3px]",
                                "shadow-[0_2px_6px_rgba(0,0,0,0.3)]",
                                isRtl ? "right-2.5" : "left-2.5"
                              )}
                            >
                              {isRtl ? "عرض" : "Sale"}
                            </span>
                          )}
                          <ImageWithFallback
                            src={getCatalogProductImage(product)}
                            srcSet={getCatalogProductImageSrcSet(product.imageUrl)}
                            sizes="(max-width: 640px) 50vw, 25vw"
                            alt={name}
                            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>

                        {/* Info zone */}
                        <div
                          className={cn(
                            "flex flex-col gap-1.5 p-3 border-t-2 border-[#1d1d1f] flex-1",
                            isRtl ? "text-right" : "text-left"
                          )}
                        >
                          {/* Category tag */}
                          <span
                            className={cn(
                              "inline-block border border-[#1d1d1f] text-[#1d1d1f]",
                              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                              isRtl ? "self-end" : "self-start"
                            )}
                          >
                            {category}
                          </span>

                          {/* Product name */}
                          <h5 className="text-xs font-bold leading-snug text-[#1d1d1f] line-clamp-2 group-hover:text-black transition-colors duration-150">
                            {name}
                          </h5>

                          {/* Price + stock dot */}
                          <div
                            className={cn(
                              "mt-auto pt-2 flex items-center justify-between gap-1",
                              isRtl && "flex-row-reverse"
                            )}
                          >
                            <div className={cn("flex flex-col gap-px", isRtl && "items-end")}>
                              <span className="text-sm font-black text-[#1d1d1f]">
                                {formatCurrency(product.price, isRtl)}
                              </span>
                              {product.basePrice && (
                                <span className="text-[10px] font-medium text-[#6e6e73] line-through">
                                  {formatCurrency(product.basePrice, isRtl)}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                                stockDotColor[tone]
                              )}
                              title={stock}
                              aria-label={stock}
                            />
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
