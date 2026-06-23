/**
 * ProductDetails.tsx — Flagship product experience.
 *
 * Built from first principles to match Amazon / Sephora / Apple-tier
 * ecommerce pages while staying honest about the data we actually have
 * (no fabricated reviews, ratings, brands, or discounts).
 *
 * Page flow:
 *   Breadcrumb → Hero (Gallery | Buy Panel) → Trust Strip →
 *   Tabbed Info → Reviews → Frequently Bought → You May Also Like →
 *   Alternatives → Recently Viewed → FAQ → Sticky Buy Bar
 */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { buildMedicalInfo } from "@pharmacy/domain-catalog";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Barcode,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Layers,
  MapPin,
  Maximize2,
  MessageCircle,
  Minus,
  Package,
  PackageSearch,
  Phone,
  Pill,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { useLanguage }            from "../../contexts/LanguageContext";
import { useCart }                from "../../contexts/CartContext";
import { useCatalog }             from "../../contexts/CatalogContext";
import { useAuth }                from "../../contexts/AuthContext";
import { Reveal }                 from "../components/Reveal";
import { useAlternativeProducts } from "../hooks/useAlternativeProducts";
import { useProductById }         from "../hooks/useProductById";
import {
  useProductReviews,
  useReviewStats,
  useMyReview,
  useMyHelpfulVotes,
  useSubmitReview,
  useDeleteReview,
  useToggleHelpful,
} from "../hooks/useProductReviews";
import type { ReviewRow, ReviewSort } from "../../lib/reviewsApi";
import { cn }                     from "../components/UI";
import { useIsShopperShell }      from "../components/ui/use-mobile";
import { ImageWithFallback }      from "../components/figma/ImageWithFallback";
import { getCatalogProductImage, type CatalogProduct } from "../catalog";
import { getDeliveryWindowSentence } from "../config";
import { getLocalizedProductName }   from "../localization";
import { extractBrand, sameBrand }   from "../utils/extractBrand";
import { FavoriteHeartButton }       from "../components/FavoriteHeartButton";
import { MobileProductDetailsView }  from "./ShopperMobileViews";

// ═══════════════════════════════════════════════════════════════════════════
//  ENTRY
// ═══════════════════════════════════════════════════════════════════════════

export default function ProductDetails() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <MobileProductDetailsView />;
  return <ProductDetailsDesktop />;
}

// ═══════════════════════════════════════════════════════════════════════════
//  RECENTLY VIEWED — localStorage-backed
// ═══════════════════════════════════════════════════════════════════════════

const RV_KEY  = "united-recently-viewed-v1";
const RV_MAX  = 12;

function readRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

function pushRecentlyViewed(id: string) {
  if (typeof window === "undefined") return;
  try {
    const prev = readRecentlyViewed().filter((x) => x !== id);
    const next = [id, ...prev].slice(0, RV_MAX);
    window.localStorage.setItem(RV_KEY, JSON.stringify(next));
  } catch { /* quota / disabled */ }
}

// Ordered complementary categories used by "Complete the routine".
// Each list is a routine — the engine pulls products from each entry in order
// until it has enough items, so the ordering matters (most-related first).
const COMPLEMENT_MAP: Record<string, string[]> = {
  "medications":          ["first-aid-supplies", "vitamins-supplements", "personal-care", "medical-devices"],
  "vitamins-supplements": ["medications", "personal-care", "oral-care", "first-aid-supplies"],
  "skin-care":            ["personal-care", "oral-care", "vitamins-supplements", "baby-mother-care"],
  "personal-care":        ["skin-care", "oral-care", "vitamins-supplements", "baby-mother-care"],
  "baby-mother-care":     ["personal-care", "first-aid-supplies", "skin-care", "vitamins-supplements"],
  "oral-care":            ["personal-care", "skin-care", "vitamins-supplements", "medications"],
  "first-aid-supplies":   ["medications", "medical-devices", "personal-care", "skin-care"],
  "medical-devices":      ["first-aid-supplies", "medications", "vitamins-supplements", "personal-care"],
  "general-healthcare":   ["personal-care", "vitamins-supplements", "first-aid-supplies", "medications"],
};

const RECO_TARGET = 12;   // ideal product count per section
const RECO_MIN    = 8;    // minimum to maintain "premium feel"

// Smart label classifier for alternative products.
export type AltLabelKind =
  | "cheaper"          // ≥ 15% cheaper
  | "premium"          // ≥ 15% pricier
  | "same_price"       // within ±5%
  | "same_brand"       // brand matches
  | "different_brand"  // brand differs (default fallback)
  | "best_value"       // in-stock AND cheaper
  | "limited";         // low stock

export interface AltLabel {
  kind:  AltLabelKind;
  ar:    string;
  en:    string;
  tone:  "teal" | "amber" | "slate" | "rose";
}

function classifyAlternative(
  current: CatalogProduct,
  candidate: CatalogProduct,
): AltLabel {
  const priceDelta = (candidate.price - current.price) / Math.max(1, current.price);
  if (!candidate.inStock) {
    return { kind: "limited", ar: "غير متاح", en: "Unavailable", tone: "rose" };
  }
  if (priceDelta <= -0.15) {
    return { kind: candidate.inStock ? "best_value" : "cheaper",
             ar: "أقل سعرًا", en: "Lower price", tone: "teal" };
  }
  if (priceDelta >= 0.15) {
    return { kind: "premium", ar: "خيار راقٍ", en: "Premium choice", tone: "amber" };
  }
  if (sameBrand(current.nameEn, candidate.nameEn)) {
    return { kind: "same_brand", ar: "نفس العلامة", en: "Same brand", tone: "slate" };
  }
  if (Math.abs(priceDelta) < 0.05) {
    return { kind: "same_price", ar: "نفس السعر تقريبًا", en: "Similar price", tone: "slate" };
  }
  return { kind: "different_brand", ar: "علامة بديلة", en: "Different brand", tone: "slate" };
}

const TONE_CLASSES: Record<AltLabel["tone"], string> = {
  teal:  "bg-[#0E7E74]/12 text-[#0E7E74] border-[#0E7E74]/25",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  rose:  "bg-rose-50 text-rose-600 border-rose-200",
};

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN — DESKTOP PRODUCT DETAILS
// ═══════════════════════════════════════════════════════════════════════════

function ProductDetailsDesktop() {
  const { id }                                          = useParams();
  const { lang, t }                                     = useLanguage();
  const { addToCart }                                   = useCart();
  const { products: catalogProducts, productsById } = useCatalog();
  const [qty, setQty]                                   = useState(1);
  const [added, setAdded]                               = useState(false);
  const [activeTab, setActiveTab]                       = useState<TabKey>("overview");
  const [lightbox, setLightbox]                         = useState(false);
  const [showSticky, setShowSticky]                     = useState(false);
  const buyPanelRef                                     = useRef<HTMLDivElement>(null);

  const cachedProduct = id ? productsById[id] : undefined;
  const { product: fetchedProduct, isLoading: isProductLoading } =
    useProductById(cachedProduct ? undefined : id);
  const product           = cachedProduct ?? fetchedProduct;
  const isProductFetching = !cachedProduct && isProductLoading;
  const isRtl             = lang === "ar";

  // Push to recently-viewed once we know the id
  useEffect(() => { if (product?.id) pushRecentlyViewed(product.id); }, [product?.id]);

  // Scroll to top when navigating between products
  useLayoutEffect(() => {
    if (product?.id) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [product?.id]);

  // Sticky bar — show when buy panel scrolls past top
  useEffect(() => {
    const onScroll = () => {
      const node = buyPanelRef.current;
      if (!node) return;
      setShowSticky(node.getBoundingClientRect().bottom < 80);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [product?.id]);

  // Reset added animation
  useEffect(() => {
    if (!added) return;
    const tm = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(tm);
  }, [added]);

  // Reset qty when product changes
  useEffect(() => { setQty(1); }, [product?.id]);

  // ── Recommendations ────────────────────────────────────────────────────
  const { alternatives: rawAlternatives } = useAlternativeProducts(
    product ?? undefined, catalogProducts, productsById, RECO_TARGET,
  );

  // Top up alternatives with same-category, in-stock matches when the worker
  // returns fewer than RECO_MIN. Sorted by price-proximity to current product.
  const alternatives = useMemo(() => {
    if (!product) return [];
    if (rawAlternatives.length >= RECO_MIN) return rawAlternatives;
    const have = new Set(rawAlternatives.map((p) => p.id));
    const filler = catalogProducts
      .filter((p) =>
        p.id !== product.id &&
        p.category === product.category &&
        p.inStock &&
        !have.has(p.id)
      )
      .sort((a, b) =>
        Math.abs(a.price - product.price) - Math.abs(b.price - product.price),
      )
      .slice(0, RECO_TARGET - rawAlternatives.length);
    return [...rawAlternatives, ...filler];
  }, [rawAlternatives, catalogProducts, product]);

  const altLabels = useMemo(() => {
    if (!product) return new Map<string, AltLabel>();
    const m = new Map<string, AltLabel>();
    for (const alt of alternatives) m.set(alt.id, classifyAlternative(product, alt));
    return m;
  }, [alternatives, product]);

  const youMayAlsoLike = useMemo(() => {
    if (!product) return [];
    const exclude = new Set([product.id, ...alternatives.map((p) => p.id)]);
    return catalogProducts
      .filter((p) =>
        p.category === product.category &&
        !exclude.has(p.id) &&
        p.inStock,
      )
      .slice(0, RECO_TARGET);
  }, [catalogProducts, product, alternatives]);

  // Pulls products from EVERY complementary category in order, then backfills
  // with cross-category popular picks until we hit RECO_TARGET.
  const frequentlyBought = useMemo(() => {
    if (!product) return [];
    const exclude = new Set([
      product.id,
      ...alternatives.map((p) => p.id),
      ...youMayAlsoLike.map((p) => p.id),
    ]);
    const out: CatalogProduct[] = [];
    const targets = COMPLEMENT_MAP[product.category] || Object.keys(COMPLEMENT_MAP);
    const perCategory = Math.ceil(RECO_TARGET / Math.max(1, targets.length));

    for (const targetCat of targets) {
      const picks = catalogProducts
        .filter((p) => p.category === targetCat && p.inStock && !exclude.has(p.id))
        .slice(0, perCategory);
      picks.forEach((p) => exclude.add(p.id));
      out.push(...picks);
      if (out.length >= RECO_TARGET) break;
    }

    // Backfill from ANY in-stock product if we still need more
    if (out.length < RECO_MIN) {
      const more = catalogProducts
        .filter((p) => p.inStock && !exclude.has(p.id))
        .slice(0, RECO_TARGET - out.length);
      out.push(...more);
    }
    return out.slice(0, RECO_TARGET);
  }, [catalogProducts, product, alternatives, youMayAlsoLike]);

  const recentlyViewed = useMemo(() => {
    if (!product) return [];
    const ids = readRecentlyViewed().filter((x) => x !== product.id);
    return ids.map((rid) => productsById[rid]).filter(Boolean).slice(0, 10) as CatalogProduct[];
  }, [productsById, product?.id]);

  const medicalInfo = useMemo(
    () =>
      product
        ? buildMedicalInfo(
            {
              nameAr: product.nameAr ?? product.name,
              nameEn: product.nameEn ?? product.name,
              categoryNameEn: product.categoryNameEn,
            },
            lang,
          )
        : null,
    [product, lang],
  );

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isProductFetching) return <ProductDetailsSkeleton />;

  // ── Not found ──────────────────────────────────────────────────────────
  if (!product) return <ProductNotFound isRtl={isRtl} />;

  // ── Derived display values ─────────────────────────────────────────────
  const displayName    = getLocalizedProductName(product, lang);
  const categoryLabel  = isRtl ? product.categoryName : (product.categoryNameEn || product.categoryName);
  const deliveryWindow = getDeliveryWindowSentence(lang);
  const imageUrl       = getCatalogProductImage(product);

  const handleAdd = async () => {
    if (!product.inStock) return;
    for (let i = 0; i < qty; i++) await addToCart(product);
    setAdded(true);
  };

  return (
    <div className={cn("min-h-screen bg-white", isRtl && "[direction:rtl]")}>

      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100">
        <div className={cn("page-section flex items-center gap-2 py-3 text-[12px] font-bold text-slate-400", isRtl && "flex-row-reverse")}>
          <Link to="/" className="hover:text-slate-700">{t("home")}</Link>
          <ChevronRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
          <Link to="/products" className="hover:text-slate-700">{t("products")}</Link>
          <ChevronRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
          <Link to={`/categories/${product.category}`} className="hover:text-slate-700">{categoryLabel}</Link>
          <ChevronRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
          <span className="truncate font-black text-[#0A1220]">{displayName}</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          HERO — Gallery + Buy Panel (2-col on desktop)
         ───────────────────────────────────────────────────────────────────── */}
      <div className="page-section py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-14">

          {/* ── Gallery ─────────────────────────────────────────────────── */}
          <ProductGallery
            product={product}
            displayName={displayName}
            imageUrl={imageUrl}
            categoryLabel={categoryLabel}
            isRtl={isRtl}
            onOpenLightbox={() => setLightbox(true)}
          />

          {/* ── Buy Panel ───────────────────────────────────────────────── */}
          <div ref={buyPanelRef}>
            <BuyPanel
              product={product}
              displayName={displayName}
              categoryLabel={categoryLabel}
              currency={t("currency")}
              addToCartLabel={t("add_to_cart")}
              deliveryWindow={deliveryWindow}
              qty={qty}
              setQty={setQty}
              onAdd={handleAdd}
              added={added}
              isRtl={isRtl}
            />
          </div>

        </div>
      </div>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      <TrustStrip isRtl={isRtl} />

      {/* ── Tabbed information ───────────────────────────────────────────── */}
      {medicalInfo && (
        <section className="bg-slate-50/40 py-14 lg:py-20">
          <div className="page-section">
            <Reveal direction="up">
              <SectionHeader
                eyebrow={isRtl ? "معلومات تفصيلية" : "Product Information"}
                title={isRtl ? "كل ما تحتاج معرفته" : "Everything You Need to Know"}
                isRtl={isRtl}
              />
            </Reveal>
            <TabbedInfo
              product={product}
              displayName={displayName}
              categoryLabel={categoryLabel}
              medicalInfo={medicalInfo}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isRtl={isRtl}
            />
          </div>
        </section>
      )}

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      <ReviewsSection product={product} displayName={displayName} isRtl={isRtl} />

      {/* ── Frequently bought together ───────────────────────────────────── */}
      {frequentlyBought.length > 0 && (
        <RecommendationSection
          products={frequentlyBought}
          eyebrow={isRtl ? "غالباً ما يُشترى معاً" : "Frequently bought together"}
          title={isRtl ? "أكمل احتياجك" : "Complete the routine"}
          icon={Layers}
          isRtl={isRtl}
          background="white"
        />
      )}

      {/* ── You may also like ────────────────────────────────────────────── */}
      {youMayAlsoLike.length > 0 && (
        <RecommendationSection
          products={youMayAlsoLike}
          eyebrow={isRtl ? "اقتراحات لك" : "You may also like"}
          title={isRtl ? "منتجات من نفس القسم" : "More from this category"}
          icon={Sparkles}
          isRtl={isRtl}
          background="slate"
          viewAllHref={`/categories/${product.category}`}
        />
      )}

      {/* ── Alternative products ─────────────────────────────────────────── */}
      {alternatives.length > 0 && (
        <RecommendationSection
          products={alternatives}
          eyebrow={isRtl ? "بدائل ذكية" : "Smart alternatives"}
          title={isRtl ? "خيارات قد تناسبك أكثر" : "Alternatives worth considering"}
          subtitle={isRtl ? "نفس المادة الفعالة أو قسم قريب" : "Same ingredient or closely related"}
          icon={RefreshCw}
          isRtl={isRtl}
          background="white"
          labels={altLabels}
          showBrand
        />
      )}

      {/* ── Recently viewed ──────────────────────────────────────────────── */}
      {recentlyViewed.length > 0 && (
        <RecommendationSection
          products={recentlyViewed}
          eyebrow={isRtl ? "تابعت تصفحها مؤخراً" : "Recently viewed"}
          title={isRtl ? "اعد زيارة منتجاتك" : "Pick up where you left off"}
          icon={Clock}
          isRtl={isRtl}
          background="slate"
        />
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <FaqSection categoryId={product.category} isRtl={isRtl} />

      {/* ── Sticky buy bar ───────────────────────────────────────────────── */}
      <StickyBuyBar
        product={product}
        displayName={displayName}
        imageUrl={imageUrl}
        currency={t("currency")}
        addToCartLabel={t("add_to_cart")}
        qty={qty}
        setQty={setQty}
        onAdd={handleAdd}
        added={added}
        visible={showSticky}
        isRtl={isRtl}
      />

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightbox && (
          <Lightbox imageUrl={imageUrl} alt={displayName} onClose={() => setLightbox(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  GALLERY
// ═══════════════════════════════════════════════════════════════════════════

function ProductGallery({
  product, displayName, imageUrl, categoryLabel, isRtl, onOpenLightbox,
}: {
  product: CatalogProduct;
  displayName: string;
  imageUrl: string;
  categoryLabel: string;
  isRtl: boolean;
  onOpenLightbox: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className="lg:sticky lg:top-24 lg:self-start"
    >
      {/* Main image card */}
      <div className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white">

        {/* Top tags row */}
        <div className={cn("absolute left-0 right-0 top-0 z-[2] flex items-start justify-between gap-3 p-5", isRtl && "flex-row-reverse")}>
          <span className="rounded-full border border-slate-200 bg-white/95 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 backdrop-blur">
            {categoryLabel}
          </span>
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-black backdrop-blur",
            product.inStock
              ? "bg-emerald-50/95 text-emerald-600"
              : "bg-rose-50/95 text-rose-500",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", product.inStock ? "bg-emerald-500" : "bg-rose-500")} />
            {product.inStock
              ? (isRtl ? "متاح" : "In stock")
              : (isRtl ? "غير متاح" : "Out of stock")}
          </span>
        </div>

        {/* Image — fixed aspect, max image size 280px, centered */}
        <button
          type="button"
          onClick={onOpenLightbox}
          aria-label={isRtl ? "تكبير الصورة" : "Zoom image"}
          className="relative flex aspect-square w-full cursor-zoom-in items-center justify-center bg-gradient-to-br from-slate-50/40 via-white to-slate-50/40 px-12 py-12"
        >
          <motion.div
            whileHover={{ scale: 1.06 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="flex h-[320px] w-[320px] items-center justify-center"
          >
            <ImageWithFallback
              src={imageUrl}
              alt={displayName}
              className="h-full w-full object-contain drop-shadow-[0_20px_40px_rgba(10,18,32,0.12)]"
              loading="eager"
              decoding="async"
            />
          </motion.div>

          {/* Zoom hint chip — visible on hover */}
          <span className={cn(
            "absolute bottom-5 z-[2] inline-flex items-center gap-1.5 rounded-full bg-[#0A1220]/90 px-3 py-1.5 text-[10.5px] font-black uppercase tracking-[0.16em] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100",
            isRtl ? "right-5 flex-row-reverse" : "left-5",
          )}>
            <Maximize2 className="h-3 w-3" />
            {isRtl ? "تكبير" : "Zoom"}
          </span>
        </button>
      </div>

      {/* Thumbnail strip — currently 1 image per product, but UI scales to N */}
      <div className={cn("mt-3.5 flex gap-2.5", isRtl && "flex-row-reverse")}>
        <button
          type="button"
          aria-label={isRtl ? "العرض الأمامي" : "Front view"}
          className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#0E7E74] bg-white p-2 ring-4 ring-[#0E7E74]/10"
        >
          <ImageWithFallback src={imageUrl} alt={displayName} className="h-full w-full object-contain" />
        </button>
        {/* Placeholder slots — communicate scalability without faking content */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden
            className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50"
          >
            <Plus className="h-3.5 w-3.5 text-slate-300" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  BUY PANEL — name, price, qty, CTA, delivery, meta
// ═══════════════════════════════════════════════════════════════════════════

function BuyPanel({
  product, displayName, categoryLabel, currency, addToCartLabel,
  deliveryWindow, qty, setQty, onAdd, added, isRtl,
}: {
  product: CatalogProduct;
  displayName: string;
  categoryLabel: string;
  currency: string;
  addToCartLabel: string;
  deliveryWindow: string;
  qty: number;
  setQty: (n: number) => void;
  onAdd: () => void;
  added: boolean;
  isRtl: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 30, delay: 0.05 }}
      className={isRtl ? "text-right" : ""}
    >
      {/* Live-data indicator */}
      <div className={cn("inline-flex items-center gap-2 rounded-full border border-[#0E7E74]/25 bg-[#0E7E74]/[0.06] px-3.5 py-1.5", isRtl && "flex-row-reverse")}>
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0E7E74] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#0E7E74]" />
        </span>
        <span className="text-[10.5px] font-black uppercase tracking-[0.2em] text-[#0E7E74]">
          {isRtl ? "بيانات حية — المتحدة" : "Live data — United Catalog"}
        </span>
      </div>

      {/* Product name */}
      <h1 className="mt-4 text-[clamp(1.85rem,3.4vw,2.7rem)] font-black leading-[1.08] tracking-tight text-[#0A1220]">
        {displayName}
      </h1>

      {/* Quick row: brand-line/category + rating placeholder */}
      <div className={cn("mt-3 flex flex-wrap items-center gap-3 text-[12px] font-black", isRtl && "flex-row-reverse")}>
        <Link
          to={`/categories/${product.category}`}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600 transition-colors hover:bg-white hover:text-[#0A1220]"
        >
          {categoryLabel}
        </Link>
        <div className={cn("flex items-center gap-1 text-slate-400", isRtl && "flex-row-reverse")}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5" />
          ))}
          <span className="ml-1">{isRtl ? "لا توجد تقييمات بعد" : "No reviews yet"}</span>
        </div>
      </div>

      {/* Description */}
      <p className="mt-4 text-[14.5px] font-semibold leading-[1.8] text-slate-500">
        {isRtl
          ? `${displayName} من قسم ${product.categoryName}، مع عرض مرتب للسعر والجاهزية والمراجع، ومتاح للتوصيل داخل القاهرة.`
          : `${displayName} from the ${product.categoryNameEn} section, with clear pricing, real-time availability, and Cairo-wide delivery.`}
      </p>

      {/* Price card */}
      <div className="mt-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50/70 to-white p-5 lg:p-6">
        <div className={cn("flex items-end justify-between gap-3", isRtl && "flex-row-reverse")}>
          <div className={isRtl ? "text-right" : ""}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {isRtl ? "السعر النهائي" : "Final price"}
            </p>
            <div className={cn("mt-1.5 flex items-baseline gap-2.5", isRtl && "flex-row-reverse")}>
              <span className="text-[3.2rem] font-black leading-none tracking-tight text-[#0A1220]">
                {product.price.toFixed(2)}
              </span>
              <span className="text-base font-black text-slate-400">{currency}</span>
            </div>
            <p className="mt-1.5 text-[12px] font-bold text-slate-400">
              {isRtl ? "شامل ضريبة القيمة المضافة" : "VAT included"}
            </p>
          </div>

          {product.stock > 0 && product.stock <= 5 && (
            <span className={cn("inline-flex animate-pulse items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700", isRtl && "flex-row-reverse")}>
              <Zap className="h-3 w-3" />
              {isRtl ? "كمية محدودة" : "Limited"}
            </span>
          )}
        </div>

        {/* Qty + CTA row */}
        <div className={cn("mt-5 flex items-stretch gap-2.5", isRtl && "flex-row-reverse")}>
          {/* Qty stepper */}
          <div className={cn("flex h-14 items-center gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white", isRtl && "flex-row-reverse")}>
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={qty <= 1 || !product.inStock}
              aria-label={isRtl ? "تقليل" : "Decrease"}
              className="flex h-full w-10 items-center justify-center text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="flex h-full min-w-[2.5rem] items-center justify-center text-[15px] font-black tabular-nums text-[#0A1220]">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              disabled={!product.inStock}
              aria-label={isRtl ? "زيادة" : "Increase"}
              className="flex h-full w-10 items-center justify-center text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Wishlist */}
          <FavoriteHeartButton
            productId={product.id}
            size="md"
            className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 bg-white"
          />

          {/* CTA */}
          <motion.button
            whileHover={product.inStock && !added ? { scale: 1.015 } : {}}
            whileTap={product.inStock ? { scale: 0.97 } : {}}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            onClick={onAdd}
            disabled={!product.inStock}
            className={cn(
              "flex h-14 flex-1 items-center justify-center gap-2.5 rounded-2xl text-[15px] font-black transition-colors",
              product.inStock
                ? added
                  ? "bg-emerald-500 text-white"
                  : "bg-[#0E7E74] text-white hover:bg-[#0A6B62]"
                : "cursor-not-allowed bg-slate-200 text-slate-400",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {product.inStock ? (
                added ? (
                  <motion.span key="added" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={cn("flex items-center gap-2.5", isRtl && "flex-row-reverse")}>
                    <CheckCircle2 className="h-5 w-5" />
                    {isRtl ? "تمت الإضافة" : "Added"}
                  </motion.span>
                ) : (
                  <motion.span key="add" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={cn("flex items-center gap-2.5", isRtl && "flex-row-reverse")}>
                    <ShoppingCart className="h-5 w-5" />
                    {addToCartLabel}
                  </motion.span>
                )
              ) : (
                <motion.span key="out" className={cn("flex items-center gap-2.5", isRtl && "flex-row-reverse")}>
                  <PackageSearch className="h-5 w-5" />
                  {isRtl ? "غير متاح" : "Unavailable"}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Delivery / Authenticity strip */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <DeliveryChip
            icon={Truck}
            labelTop={isRtl ? "التوصيل" : "Delivery"}
            labelBottom={deliveryWindow}
            isRtl={isRtl}
          />
          <DeliveryChip
            icon={ShieldCheck}
            labelTop={isRtl ? "الأصالة" : "Authenticity"}
            labelBottom={isRtl ? "أدوية أصلية ١٠٠٪" : "100% genuine meds"}
            isRtl={isRtl}
          />
        </div>
      </div>

      {/* Meta rows — code / barcode */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <MetaCard
          icon={Package}
          label={isRtl ? "كود الصنف" : "Item code"}
          value={product.code || "—"}
          isRtl={isRtl}
        />
        <MetaCard
          icon={Barcode}
          label={isRtl ? "الباركود" : "Barcode"}
          value={product.barcode || "—"}
          isRtl={isRtl}
        />
      </div>
    </motion.div>
  );
}

function DeliveryChip({
  icon: Icon, labelTop, labelBottom, isRtl,
}: {
  icon: typeof Truck;
  labelTop: string;
  labelBottom: string;
  isRtl: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-3", isRtl && "flex-row-reverse text-right")}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0E7E74]/10">
        <Icon className="h-3.5 w-3.5 text-[#0E7E74]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{labelTop}</p>
        <p className="mt-0.5 truncate text-[12.5px] font-black text-[#0A1220]">{labelBottom}</p>
      </div>
    </div>
  );
}

function MetaCard({
  icon: Icon, label, value, isRtl,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  isRtl: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 hover:bg-white", isRtl && "flex-row-reverse")}>
      <span className={cn("flex items-center gap-2.5", isRtl && "flex-row-reverse")}>
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      </span>
      <p className="text-[13px] font-black text-[#0A1220]" dir="ltr">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  TRUST STRIP
// ═══════════════════════════════════════════════════════════════════════════

function TrustStrip({ isRtl }: { isRtl: boolean }) {
  const items = [
    { Icon: ShieldCheck, ar: "أدوية أصلية",          en: "Authentic meds"        },
    { Icon: Award,       ar: "صيدلية مرخصة",         en: "Licensed pharmacy"     },
    { Icon: Truck,       ar: "توصيل سريع للقاهرة",   en: "Fast Cairo delivery"   },
    { Icon: RefreshCw,   ar: "سياسة استرجاع واضحة",  en: "Easy returns policy"   },
    { Icon: Phone,       ar: "دعم على مدار الساعة",  en: "24/7 customer support" },
    { Icon: MapPin,      ar: "استلام من الفرع متاح", en: "Branch pickup option"  },
  ];
  return (
    <section className="border-y border-slate-100 bg-white py-7">
      <div className="page-section">
        <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6")}>
          {items.map(({ Icon, ar, en }) => (
            <div
              key={en}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 px-4 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0E7E74]/30 hover:bg-white hover:shadow-[0_8px_24px_rgba(14,126,116,0.08)]",
                isRtl && "flex-row-reverse text-right",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0E7E74]/10">
                <Icon className="h-4 w-4 text-[#0E7E74]" />
              </span>
              <p className="text-[12.5px] font-black leading-snug text-[#0A1220]">
                {isRtl ? ar : en}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  TABBED INFORMATION
// ═══════════════════════════════════════════════════════════════════════════

type TabKey = "overview" | "usage" | "dosage" | "safety" | "storage" | "specs";

function TabbedInfo({
  product, displayName, categoryLabel, medicalInfo, activeTab, setActiveTab, isRtl,
}: {
  product: CatalogProduct;
  displayName: string;
  categoryLabel: string;
  medicalInfo: { usageInstructions: string[]; dosageGuidance: string[]; safetyWarnings: string[]; generalDisclaimer: string };
  activeTab: TabKey;
  setActiveTab: (k: TabKey) => void;
  isRtl: boolean;
}) {
  const tabs: { key: TabKey; icon: typeof Info; ar: string; en: string }[] = [
    { key: "overview", icon: Info,          ar: "نظرة عامة",       en: "Overview"      },
    { key: "usage",    icon: Pill,          ar: "طريقة الاستخدام", en: "Usage"         },
    { key: "dosage",   icon: Clock,         ar: "الجرعة",          en: "Dosage"        },
    { key: "safety",   icon: AlertTriangle, ar: "السلامة",         en: "Safety"        },
    { key: "storage",  icon: Package,       ar: "التخزين",         en: "Storage"       },
    { key: "specs",    icon: Layers,        ar: "المواصفات",       en: "Specifications"},
  ];

  return (
    <Reveal direction="up">
      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {/* Tab nav */}
        <div className={cn("flex overflow-x-auto border-b border-slate-100", isRtl && "[direction:rtl]")}>
          {tabs.map(({ key, icon: Icon, ar, en }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-5 py-4 text-[13px] font-black transition-colors",
                  active ? "text-[#0A1220]" : "text-slate-400 hover:text-slate-700",
                )}
              >
                <Icon className="h-4 w-4" />
                {isRtl ? ar : en}
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#0E7E74]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === "overview" && (
                <TabPanel
                  title={isRtl ? "نظرة عامة" : "Overview"}
                  isRtl={isRtl}
                >
                  <p className="text-[15px] font-semibold leading-[1.85] text-slate-600">
                    {isRtl
                      ? `${displayName} هو منتج صيدلاني ضمن قسم ${product.categoryName} ضمن كتالوج صيدليات المتحدة. كل بيانات السعر والجاهزية تُسحب من قاعدة البيانات لحظياً، ويتم التوصيل عبر شبكة الفروع المعتمدة داخل القاهرة.`
                      : `${displayName} is a pharmacy product in the ${product.categoryNameEn} section of the United Pharmacies catalog. Pricing and availability are pulled live from our database; orders are fulfilled through our authorized Cairo branch network.`}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <InfoTile
                      label={isRtl ? "القسم" : "Category"}
                      value={categoryLabel}
                      isRtl={isRtl}
                    />
                    <InfoTile
                      label={isRtl ? "كود الصنف" : "Item code"}
                      value={product.code || "—"}
                      isRtl={isRtl}
                    />
                    <InfoTile
                      label={isRtl ? "الحالة" : "Status"}
                      value={product.inStock ? (isRtl ? "متاح للتوصيل" : "Available") : (isRtl ? "غير متاح" : "Unavailable")}
                      isRtl={isRtl}
                    />
                  </div>
                </TabPanel>
              )}
              {activeTab === "usage" && (
                <TabPanel title={isRtl ? "طريقة الاستخدام" : "Usage"} isRtl={isRtl}>
                  <InfoList items={medicalInfo.usageInstructions} isRtl={isRtl} />
                </TabPanel>
              )}
              {activeTab === "dosage" && (
                <TabPanel title={isRtl ? "إرشادات الجرعة" : "Dosage guidance"} isRtl={isRtl}>
                  <InfoList items={medicalInfo.dosageGuidance} isRtl={isRtl} />
                </TabPanel>
              )}
              {activeTab === "safety" && (
                <TabPanel title={isRtl ? "تنبيهات السلامة" : "Safety warnings"} isRtl={isRtl}>
                  <InfoList items={medicalInfo.safetyWarnings} isRtl={isRtl} />
                  <div className={cn("mt-5 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3.5", isRtl && "flex-row-reverse text-right")}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-[13px] font-semibold leading-[1.7] text-amber-800">
                      {medicalInfo.generalDisclaimer}
                    </p>
                  </div>
                </TabPanel>
              )}
              {activeTab === "storage" && (
                <TabPanel title={isRtl ? "تعليمات التخزين" : "Storage instructions"} isRtl={isRtl}>
                  <InfoList
                    isRtl={isRtl}
                    items={isRtl
                      ? [
                          "يُحفظ في درجة حرارة الغرفة بعيداً عن الرطوبة المباشرة وأشعة الشمس.",
                          "يُترك داخل عبوته الأصلية حتى وقت الاستخدام.",
                          "يُحفظ بعيداً عن متناول الأطفال في مكان مغلق.",
                        ]
                      : [
                          "Store at room temperature, away from direct moisture and sunlight.",
                          "Keep inside the original packaging until use.",
                          "Keep out of reach of children, in a closed location.",
                        ]
                    }
                  />
                </TabPanel>
              )}
              {activeTab === "specs" && (
                <TabPanel title={isRtl ? "المواصفات الكاملة" : "Full specifications"} isRtl={isRtl}>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {[
                      { k: isRtl ? "الاسم"        : "Name",        v: displayName                },
                      { k: isRtl ? "القسم"        : "Category",    v: categoryLabel              },
                      { k: isRtl ? "كود الصنف"    : "Item code",   v: product.code    || "—"     },
                      { k: isRtl ? "الباركود"     : "Barcode",     v: product.barcode || "—"     },
                      { k: isRtl ? "السعر"        : "Price",       v: `${product.price.toFixed(2)} EGP` },
                      { k: isRtl ? "الحالة"       : "Availability", v: product.inStock ? (isRtl ? "متاح" : "In stock") : (isRtl ? "غير متاح" : "Out of stock") },
                    ].map(({ k, v }) => (
                      <div key={k} className={cn("flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3", isRtl && "flex-row-reverse")}>
                        <dt className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{k}</dt>
                        <dd className="text-[13px] font-black text-[#0A1220]" dir="ltr">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </TabPanel>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Reveal>
  );
}

function TabPanel({ title, children, isRtl }: { title: string; children: ReactNode; isRtl: boolean }) {
  return (
    <div className={isRtl ? "text-right" : ""}>
      <h3 className="text-[20px] font-black text-[#0A1220]">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function InfoList({ items, isRtl }: { items: string[]; isRtl: boolean }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item}
          className={cn("flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/40 px-4 py-3 text-[14px] font-semibold leading-[1.7] text-slate-700", isRtl && "flex-row-reverse text-right")}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0E7E74]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function InfoTile({ label, value, isRtl }: { label: string; value: string; isRtl: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3.5", isRtl && "text-right")}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-[14px] font-black text-[#0A1220]">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  REVIEWS — honest empty state with rating distribution UI
// ═══════════════════════════════════════════════════════════════════════════

function ReviewsSection({
  product, displayName, isRtl,
}: {
  product: CatalogProduct;
  displayName: string;
  isRtl: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id;

  const [sort,         setSort]         = useState<ReviewSort>("helpful");
  const [starFilter,   setStarFilter]   = useState<number | undefined>(undefined);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withPhotosOnly, setWithPhotosOnly] = useState(false);
  const [formOpen,     setFormOpen]     = useState(false);

  const statsQ   = useReviewStats(product.id);
  const listQ    = useProductReviews({
    productId: product.id,
    sort,
    starFilter,
    verifiedOnly,
    withPhotosOnly,
    limit: 20,
  });
  const myReviewQ = useMyReview(product.id, userId);
  const helpfulIds = useMyHelpfulVotes(product.id, userId).data ?? new Set<string>();
  const submitM   = useSubmitReview(product.id, userId);
  const deleteM   = useDeleteReview(product.id, userId);
  const toggleM   = useToggleHelpful(product.id, userId);

  const stats   = statsQ.data ?? { totalReviews: 0, averageRating: 0, distribution: [0,0,0,0,0], verifiedCount: 0, photoCount: 0 };
  const reviews = listQ.data ?? [];

  const totalReviews = stats.totalReviews;
  const hasReviews   = totalReviews > 0;

  const handleSubmit = async (input: { rating: number; title?: string; body?: string }) => {
    if (!user) return;
    const authorName = user.fullName || user.email || (isRtl ? "عميل" : "Customer");
    await submitM.mutateAsync({ ...input, authorName });
    setFormOpen(false);
  };

  return (
    <section className="bg-white py-14 lg:py-20">
      <div className="page-section">
        <Reveal direction="up">
          <SectionHeader
            eyebrow={isRtl ? "تقييمات العملاء" : "Customer Reviews"}
            title={isRtl ? "آراء حقيقية من عملاء حقيقيين" : "Real opinions from verified customers"}
            isRtl={isRtl}
          />
        </Reveal>

        {/* ── Aggregate panel ───────────────────────────────────────────── */}
        <Reveal direction="up" delay={80}>
          <div className="mt-8 grid gap-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50/60 to-white p-7 lg:grid-cols-[300px_1fr] lg:gap-10 lg:p-10">
            {/* Overall rating */}
            <div className={cn("flex flex-col items-center justify-center text-center", isRtl && "lg:text-right")}>
              <div className={cn("flex items-center gap-1.5", isRtl && "flex-row-reverse")}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-5 w-5",
                      i < Math.round(stats.averageRating) ? "fill-amber-400 text-amber-400" : "text-slate-300",
                    )}
                  />
                ))}
              </div>
              <p className="mt-3 text-[3rem] font-black leading-none tracking-tight text-[#0A1220]">
                {hasReviews ? stats.averageRating.toFixed(1) : "—"}
              </p>
              <p className="mt-1.5 text-[12px] font-bold text-slate-400">
                {hasReviews
                  ? (isRtl
                      ? `بناءً على ${totalReviews} ${totalReviews === 1 ? "تقييم" : "تقييمات"}`
                      : `Based on ${totalReviews} ${totalReviews === 1 ? "review" : "reviews"}`)
                  : (isRtl ? "لا توجد تقييمات بعد" : "No ratings yet")}
              </p>
              {hasReviews && (
                <div className={cn("mt-3 flex flex-wrap items-center justify-center gap-2 text-[10.5px] font-black", isRtl && "flex-row-reverse")}>
                  {stats.verifiedCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0E7E74]/12 px-2.5 py-1 text-[#0E7E74]">
                      <ShieldCheck className="h-3 w-3" />
                      {isRtl ? `${stats.verifiedCount} موثّق` : `${stats.verifiedCount} verified`}
                    </span>
                  )}
                  {stats.photoCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                      <ImageIcon className="h-3 w-3" />
                      {isRtl ? `${stats.photoCount} بصور` : `${stats.photoCount} with photos`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Distribution + CTA */}
            <div className={isRtl ? "text-right" : ""}>
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">
                {isRtl ? "توزيع التقييمات" : "Rating distribution"}
              </p>
              <div className="mt-3 space-y-2">
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = stats.distribution[n - 1] ?? 0;
                  const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                  const active = starFilter === n;
                  return (
                    <button
                      type="button"
                      key={n}
                      onClick={() => setStarFilter(active ? undefined : n)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-2 py-1.5 transition-colors",
                        active ? "bg-amber-50" : "hover:bg-slate-50",
                        isRtl && "flex-row-reverse",
                      )}
                    >
                      <span className={cn("flex w-9 shrink-0 items-center gap-0.5 text-[12px] font-black text-slate-500", isRtl && "flex-row-reverse")}>
                        {n}<Star className="h-3 w-3 fill-current text-amber-400" />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full bg-amber-400"
                        />
                      </div>
                      <span className="w-10 text-end text-[11px] font-bold text-slate-500 tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className={cn("mt-6 flex flex-wrap items-center gap-3", isRtl && "flex-row-reverse")}>
                {user ? (
                  <motion.button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24 }}
                    className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0E7E74] px-5 text-[13px] font-black text-white hover:bg-[#0A6B62]", isRtl && "flex-row-reverse")}
                  >
                    {myReviewQ.data ? <Edit3 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    {myReviewQ.data
                      ? (isRtl ? "تعديل تقييمك" : "Edit your review")
                      : hasReviews
                        ? (isRtl ? "اكتب تقييمك"      : "Write a review")
                        : (isRtl ? "كن أول من يقيم"   : "Be the first to review")}
                  </motion.button>
                ) : (
                  <Link
                    to="/login"
                    className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0E7E74] px-5 text-[13px] font-black text-white hover:bg-[#0A6B62]", isRtl && "flex-row-reverse")}
                  >
                    <Sparkles className="h-4 w-4" />
                    {isRtl ? "سجّل الدخول للتقييم" : "Sign in to review"}
                  </Link>
                )}
                <p className="text-[12px] font-semibold text-slate-400">
                  {hasReviews
                    ? (isRtl ? "آراؤك تساعد غيرك من المشترين" : "Your opinion helps other shoppers")
                    : (isRtl ? "كن أول من يبدأ المحادثة"     : "Start the conversation")}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ── Toolbar (sort + filters) ───────────────────────────────────── */}
        {hasReviews && (
          <Reveal direction="up" delay={120}>
            <ReviewToolbar
              sort={sort}            setSort={setSort}
              starFilter={starFilter} setStarFilter={setStarFilter}
              verifiedOnly={verifiedOnly}   setVerifiedOnly={setVerifiedOnly}
              withPhotosOnly={withPhotosOnly} setWithPhotosOnly={setWithPhotosOnly}
              total={totalReviews}
              visible={reviews.length}
              isRtl={isRtl}
            />
          </Reveal>
        )}

        {/* ── List ───────────────────────────────────────────────────────── */}
        {hasReviews && (
          <div className="mt-6 space-y-3">
            {listQ.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              ))
            ) : reviews.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-12 text-center">
                <p className="text-[14px] font-bold text-slate-500">
                  {isRtl ? "لا توجد تقييمات مطابقة للفلتر" : "No reviews match the current filters"}
                </p>
                <button
                  type="button"
                  onClick={() => { setStarFilter(undefined); setVerifiedOnly(false); setWithPhotosOnly(false); }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-[12px] font-black text-slate-600 hover:border-[#0E7E74]/40 hover:text-[#0A1220]"
                >
                  <X className="h-3.5 w-3.5" />
                  {isRtl ? "مسح الفلاتر" : "Clear filters"}
                </button>
              </div>
            ) : (
              reviews.map((r, i) => (
                <Reveal key={r.id} direction="up" delay={i * 40}>
                  <ReviewCard
                    review={r}
                    isMine={r.user_id === userId}
                    isHelpful={helpfulIds.has(r.id)}
                    onToggleHelpful={() => userId ? toggleM.mutate(r.id) : void 0}
                    onDelete={() => deleteM.mutate(r.id)}
                    isRtl={isRtl}
                  />
                </Reveal>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Submit modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {formOpen && (
          <ReviewFormModal
            productName={displayName}
            existing={myReviewQ.data ?? null}
            onClose={() => setFormOpen(false)}
            onSubmit={handleSubmit}
            isSubmitting={submitM.isPending}
            isRtl={isRtl}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Review Toolbar ─────────────────────────────────────────────────────────

function ReviewToolbar({
  sort, setSort, starFilter, setStarFilter,
  verifiedOnly, setVerifiedOnly, withPhotosOnly, setWithPhotosOnly,
  total, visible, isRtl,
}: {
  sort: ReviewSort;
  setSort: (s: ReviewSort) => void;
  starFilter: number | undefined;
  setStarFilter: (n: number | undefined) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (v: boolean) => void;
  withPhotosOnly: boolean;
  setWithPhotosOnly: (v: boolean) => void;
  total: number;
  visible: number;
  isRtl: boolean;
}) {
  const sortOptions: { key: ReviewSort; ar: string; en: string }[] = [
    { key: "helpful", ar: "الأكثر إفادة", en: "Most helpful" },
    { key: "recent",  ar: "الأحدث",       en: "Most recent"  },
    { key: "highest", ar: "الأعلى تقييماً", en: "Highest rated" },
    { key: "lowest",  ar: "الأقل تقييماً",  en: "Lowest rated"  },
  ];

  const hasFilters = starFilter !== undefined || verifiedOnly || withPhotosOnly;

  return (
    <div className={cn("mt-7 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-4 py-3", isRtl && "flex-row-reverse")}>
      {/* Sort */}
      <div className={cn("flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-50 p-1", isRtl && "flex-row-reverse")}>
        {sortOptions.map((opt) => {
          const active = sort === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSort(opt.key)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-[11.5px] font-black transition-colors",
                active ? "bg-white text-[#0A1220] shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {isRtl ? opt.ar : opt.en}
            </button>
          );
        })}
      </div>

      {/* Filter chips */}
      <div className={cn("flex flex-wrap items-center gap-2", isRtl && "flex-row-reverse")}>
        <button
          type="button"
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors",
            verifiedOnly
              ? "border-[#0E7E74]/40 bg-[#0E7E74]/10 text-[#0E7E74]"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            isRtl && "flex-row-reverse",
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {isRtl ? "موثّق فقط" : "Verified only"}
        </button>
        <button
          type="button"
          onClick={() => setWithPhotosOnly(!withPhotosOnly)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors",
            withPhotosOnly
              ? "border-[#0E7E74]/40 bg-[#0E7E74]/10 text-[#0E7E74]"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            isRtl && "flex-row-reverse",
          )}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {isRtl ? "بصور فقط" : "With photos"}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setStarFilter(undefined); setVerifiedOnly(false); setWithPhotosOnly(false); }}
            className={cn("inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-600", isRtl && "flex-row-reverse")}
          >
            <X className="h-3 w-3" />
            {isRtl ? "مسح" : "Clear"}
          </button>
        )}
        <span className="text-[11px] font-bold text-slate-400">
          {isRtl ? `${visible} من ${total}` : `${visible} of ${total}`}
        </span>
      </div>
    </div>
  );
}

// ─── Review Card ────────────────────────────────────────────────────────────

function ReviewCard({
  review, isMine, isHelpful, onToggleHelpful, onDelete, isRtl,
}: {
  review: ReviewRow;
  isMine: boolean;
  isHelpful: boolean;
  onToggleHelpful: () => void;
  onDelete: () => void;
  isRtl: boolean;
}) {
  const date = new Date(review.created_at);
  const dateLabel = date.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  const initial = review.author_name.trim().charAt(0).toUpperCase();

  return (
    <article className={cn("group rounded-3xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300", isRtl && "text-right")}>
      {/* Top row */}
      <div className={cn("flex items-start justify-between gap-3", isRtl && "flex-row-reverse")}>
        <div className={cn("flex items-start gap-3", isRtl && "flex-row-reverse")}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0E7E74] to-[#0A6B62] text-[14px] font-black text-white">
            {initial || "?"}
          </span>
          <div>
            <p className={cn("flex flex-wrap items-center gap-2 text-[14px] font-black text-[#0A1220]", isRtl && "flex-row-reverse")}>
              {review.author_name}
              {review.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0E7E74]/12 px-2 py-0.5 text-[10px] font-black text-[#0E7E74]">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {isRtl ? "شراء موثّق" : "Verified purchase"}
                </span>
              )}
              {isMine && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                  {isRtl ? "تقييمك" : "You"}
                </span>
              )}
            </p>
            <div className={cn("mt-1 flex items-center gap-2", isRtl && "flex-row-reverse")}>
              <div className={cn("flex items-center gap-0.5", isRtl && "flex-row-reverse")}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn("h-3.5 w-3.5", i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200")}
                  />
                ))}
              </div>
              <span className="text-[11px] font-bold text-slate-400">{dateLabel}</span>
            </div>
          </div>
        </div>

        {isMine && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={isRtl ? "حذف" : "Delete"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Title + body */}
      {review.title && (
        <h4 className="mt-3 text-[14.5px] font-black leading-snug text-[#0A1220]">{review.title}</h4>
      )}
      {review.body && (
        <p className="mt-2 text-[14px] font-semibold leading-[1.75] text-slate-600 whitespace-pre-line">
          {review.body}
        </p>
      )}

      {/* Photos */}
      {review.photos.length > 0 && (
        <div className={cn("mt-3 flex flex-wrap gap-2", isRtl && "flex-row-reverse")}>
          {review.photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`photo ${i + 1}`}
              className="h-20 w-20 rounded-xl object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* Actions row */}
      <div className={cn("mt-4 flex items-center justify-between border-t border-slate-100 pt-3", isRtl && "flex-row-reverse")}>
        <button
          type="button"
          onClick={onToggleHelpful}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-black transition-colors",
            isHelpful
              ? "border-[#0E7E74]/40 bg-[#0E7E74]/10 text-[#0E7E74]"
              : "border-slate-200 bg-white text-slate-600 hover:border-[#0E7E74]/40 hover:text-[#0A1220]",
            isRtl && "flex-row-reverse",
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {isRtl
            ? `مفيد · ${review.helpful_count}`
            : `Helpful · ${review.helpful_count}`}
        </button>
      </div>
    </article>
  );
}

// ─── Review Form Modal ──────────────────────────────────────────────────────

function ReviewFormModal({
  productName, existing, onClose, onSubmit, isSubmitting, isRtl,
}: {
  productName: string;
  existing: ReviewRow | null;
  onClose: () => void;
  onSubmit: (input: { rating: number; title?: string; body?: string }) => Promise<void>;
  isSubmitting: boolean;
  isRtl: boolean;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [hover,  setHover]  = useState<number | null>(null);
  const [title,  setTitle]  = useState(existing?.title ?? "");
  const [body,   setBody]   = useState(existing?.body  ?? "");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (typeof document === "undefined") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      rating,
      title: title.trim() || undefined,
      body:  body.trim()  || undefined,
    });
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A1220]/60 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.form
        onSubmit={handleSubmit}
        initial={{ y: 30, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className={cn("w-full max-w-lg overflow-hidden rounded-3xl bg-white", isRtl && "text-right")}
      >
        {/* Header */}
        <div className={cn("flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5", isRtl && "flex-row-reverse")}>
          <div>
            <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
              {existing ? (isRtl ? "تعديل تقييمك" : "Edit your review") : (isRtl ? "اكتب تقييمك" : "Write a review")}
            </p>
            <h3 className="mt-1 line-clamp-1 text-[18px] font-black text-[#0A1220]">{productName}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-6">
          {/* Stars */}
          <div className={isRtl ? "text-right" : ""}>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {isRtl ? "تقييمك" : "Your rating"}
            </p>
            <div className={cn("mt-2 flex items-center gap-1", isRtl && "flex-row-reverse")}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = (hover ?? rating) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(null)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className="rounded p-1"
                  >
                    <Star className={cn("h-8 w-8 transition-colors", filled ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {isRtl ? "العنوان (اختياري)" : "Title (optional)"}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={isRtl ? "ملخص رأيك في كلمات قليلة" : "Sum it up in a few words"}
              className="mt-1.5 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 text-[14px] font-bold text-[#0A1220] outline-none transition-colors focus:border-[#0E7E74] focus:bg-white"
            />
          </label>

          {/* Body */}
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {isRtl ? "تجربتك (اختياري)" : "Your experience (optional)"}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={isRtl ? "ماذا أعجبك؟ هل ساعدك؟ ما الذي يستحق المشاركة؟" : "What did you like? Did it help? What's worth sharing?"}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-[14px] font-semibold leading-relaxed text-[#0A1220] outline-none transition-colors focus:border-[#0E7E74] focus:bg-white"
            />
            <span className="mt-1 block text-[10px] font-bold text-slate-400">{body.length} / 2000</span>
          </label>
        </div>

        {/* Footer */}
        <div className={cn("flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/40 px-6 py-4", isRtl && "flex-row-reverse")}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2.5 text-[13px] font-black text-slate-500 hover:text-[#0A1220]"
          >
            {isRtl ? "إلغاء" : "Cancel"}
          </button>
          <motion.button
            type="submit"
            disabled={isSubmitting || rating < 1}
            whileHover={!isSubmitting && rating >= 1 ? { scale: 1.02 } : {}}
            whileTap={!isSubmitting ? { scale: 0.97 } : {}}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-[13px] font-black text-white",
              isSubmitting || rating < 1 ? "cursor-not-allowed bg-slate-300" : "bg-[#0E7E74] hover:bg-[#0A6B62]",
            )}
          >
            {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {existing
              ? (isRtl ? "تحديث التقييم" : "Update review")
              : (isRtl ? "نشر التقييم"   : "Publish review")}
          </motion.button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  RECOMMENDATION SECTION — horizontal scrolling carousel
// ═══════════════════════════════════════════════════════════════════════════

function RecommendationSection({
  products, eyebrow, title, subtitle, icon: Icon, isRtl, background, viewAllHref,
  labels, showBrand,
}: {
  products: CatalogProduct[];
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: typeof Sparkles;
  isRtl: boolean;
  background: "white" | "slate";
  viewAllHref?: string;
  labels?: Map<string, AltLabel>;
  showBrand?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: "back" | "fwd") => {
    const el = railRef.current;
    if (!el) return;
    const step = 320;
    const sign = (dir === "fwd" ? 1 : -1) * (isRtl ? -1 : 1);
    el.scrollBy({ left: sign * step, behavior: "smooth" });
  };

  const LeftIcon  = isRtl ? ChevronRight : ChevronLeft;
  const RightIcon = isRtl ? ChevronLeft  : ChevronRight;

  return (
    <section className={cn("py-14 lg:py-18", background === "slate" ? "bg-slate-50/50" : "bg-white", "border-t border-slate-100")}>
      <div className="page-section">
        <Reveal direction="up">
          <div className={cn("mb-7 flex items-end justify-between gap-4", isRtl && "flex-row-reverse")}>
            <div className={cn("flex items-start gap-4", isRtl && "flex-row-reverse text-right")}>
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0E7E74]/10 lg:flex">
                <Icon className="h-5 w-5 text-[#0E7E74]" />
              </span>
              <div>
                <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                  {eyebrow}
                </p>
                <h2 className="mt-1.5 text-[clamp(1.4rem,2.6vw,2rem)] font-black leading-tight text-[#0A1220]">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1.5 text-[13px] font-semibold text-slate-500">{subtitle}</p>
                )}
              </div>
            </div>

            <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
              {viewAllHref && (
                <Link
                  to={viewAllHref}
                  className={cn(
                    "hidden h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-black text-slate-600 hover:border-[#0E7E74]/40 hover:text-[#0A1220] sm:inline-flex",
                    isRtl && "flex-row-reverse",
                  )}
                >
                  {isRtl ? "عرض الكل" : "View all"}
                  <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                </Link>
              )}
              <button
                type="button"
                onClick={() => scrollBy("back")}
                aria-label={isRtl ? "السابق" : "Previous"}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:-translate-y-0.5 hover:border-[#0E7E74] hover:text-[#0E7E74] hover:shadow-[0_8px_20px_rgba(14,126,116,0.12)]"
              >
                <LeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy("fwd")}
                aria-label={isRtl ? "التالي" : "Next"}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:-translate-y-0.5 hover:border-[#0E7E74] hover:text-[#0E7E74] hover:shadow-[0_8px_20px_rgba(14,126,116,0.12)]"
              >
                <RightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Reveal>

        <div
          ref={railRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((p, i) => (
            <Reveal key={p.id} direction="up" delay={i * 40}>
              <MiniProductCard
                product={p}
                isRtl={isRtl}
                label={labels?.get(p.id)}
                showBrand={showBrand}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniProductCard({
  product, isRtl, label, showBrand,
}: {
  product: CatalogProduct;
  isRtl: boolean;
  label?: AltLabel;
  showBrand?: boolean;
}) {
  const { lang, t } = useLanguage();
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);
  const imageUrl = getCatalogProductImage(product);
  const name = getLocalizedProductName(product, lang);
  const brand = showBrand ? extractBrand(product.nameEn) : "";

  const onAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock || adding) return;
    setAdding(true);
    await addToCart(product);
    setTimeout(() => setAdding(false), 1200);
  };

  return (
    <Link
      to={`/products/${product.id}`}
      className={cn(
        "group relative flex w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#0E7E74]/30 hover:shadow-[0_18px_40px_rgba(10,18,32,0.08)]",
        isRtl && "text-right",
      )}
    >
      {/* Image area */}
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-slate-50/30 via-white to-slate-50/30 p-6">
        <ImageWithFallback
          src={imageUrl}
          alt={name}
          className="h-full w-full object-contain drop-shadow-[0_8px_20px_rgba(10,18,32,0.08)] transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />

        {/* Smart label (alternatives only) */}
        {label && (
          <span className={cn(
            "absolute bottom-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9.5px] font-black",
            isRtl ? "right-3" : "left-3",
            TONE_CLASSES[label.tone],
          )}>
            {isRtl ? label.ar : label.en}
          </span>
        )}

        {/* Stock badge */}
        <span className={cn(
          "absolute top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-black backdrop-blur",
          isRtl ? "right-3" : "left-3",
          product.inStock
            ? "bg-emerald-50/95 text-emerald-600"
            : "bg-rose-50/95 text-rose-500",
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", product.inStock ? "bg-emerald-500" : "bg-rose-500")} />
          {product.inStock
            ? (isRtl ? "متاح" : "In stock")
            : (isRtl ? "غير متاح" : "Out")}
        </span>

        {/* Wishlist */}
        <span className={cn("absolute top-3", isRtl ? "left-3" : "right-3")}>
          <FavoriteHeartButton productId={product.id} size="sm" className="h-9 w-9 rounded-full border border-slate-200 bg-white/95 backdrop-blur" />
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 border-t border-slate-100 p-4">
        <div className={cn("flex items-center justify-between gap-2", isRtl && "flex-row-reverse")}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0E7E74]">
            {isRtl ? product.categoryName : (product.categoryNameEn || product.categoryName)}
          </p>
          {brand && (
            <p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
              {brand}
            </p>
          )}
        </div>
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13.5px] font-black leading-snug text-[#0A1220]">
          {name}
        </h3>
        <div className={cn("mt-auto flex items-end justify-between gap-2 pt-2", isRtl && "flex-row-reverse")}>
          <div className={cn("flex items-baseline gap-1.5", isRtl && "flex-row-reverse")}>
            <span className="text-[18px] font-black leading-none text-[#0A1220]">
              {product.price.toFixed(2)}
            </span>
            <span className="text-[11px] font-black text-slate-400">{t("currency")}</span>
          </div>
          <motion.button
            type="button"
            onClick={onAdd}
            disabled={!product.inStock || adding}
            whileTap={{ scale: 0.9 }}
            aria-label={t("add_to_cart")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors",
              product.inStock
                ? adding ? "bg-emerald-500" : "bg-[#0E7E74] hover:bg-[#0A6B62]"
                : "cursor-not-allowed bg-slate-200 text-slate-400",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {adding ? (
                <motion.span key="ok" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                  <CheckCircle2 className="h-4 w-4" />
                </motion.span>
              ) : (
                <motion.span key="add" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                  <Plus className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  FAQ — category-aware static answers
// ═══════════════════════════════════════════════════════════════════════════

function FaqSection({ categoryId, isRtl }: { categoryId: string; isRtl: boolean }) {
  const isMeds = categoryId === "medications" || categoryId === "vitamins-supplements";

  const faqs: { q: string; a: string }[] = isRtl
    ? [
        { q: "كيف يتم التوصيل؟", a: "نوصّل عبر شبكة الفروع المعتمدة داخل القاهرة. تظهر نافذة التوصيل المتوقعة في صفحة الدفع بناءً على عنوانك." },
        { q: "هل المنتجات أصلية؟", a: "نعم، كل المنتجات يتم توريدها من موزعين مرخصين ومصنّعين معتمدين، مع تتبّع رقم التشغيلة عند الحاجة." },
        ...(isMeds ? [{ q: "هل أحتاج إلى وصفة طبية؟", a: "بعض الأدوية تتطلب وصفة طبية. إن كان كذلك، يمكنك رفع الوصفة عند تأكيد الطلب وسيقوم الصيدلي بمراجعتها." }] : []),
        { q: "ما سياسة الاسترجاع؟", a: "يمكن استرجاع المنتجات غير المفتوحة خلال 14 يوماً من الاستلام، باستثناء المنتجات الباردة أو المُخصصة طبياً." },
        { q: "كيف يتم التخزين؟", a: "احفظ المنتج في درجة حرارة الغرفة بعيداً عن الرطوبة وأشعة الشمس المباشرة، إلا إذا أشارت العبوة إلى غير ذلك." },
        { q: "ماذا أفعل إذا تأخر طلبي؟", a: "تواصل معنا مباشرة عبر الواتساب أو الهاتف وسنقوم بمتابعة الطلب فوراً." },
      ]
    : [
        { q: "How is delivery handled?", a: "We fulfill orders through our authorized Cairo branch network. The estimated delivery window appears at checkout based on your address." },
        { q: "Are these products authentic?", a: "Yes — every product is sourced from licensed distributors and approved manufacturers, with lot-traceability available on request." },
        ...(isMeds ? [{ q: "Do I need a prescription?", a: "Some medicines require a prescription. If yours does, you can upload it during checkout and a pharmacist will review it before fulfillment." }] : []),
        { q: "What is the returns policy?", a: "Unopened products can be returned within 14 days of delivery — excluding cold-chain or medically personalized items." },
        { q: "How should I store this product?", a: "Store at room temperature, away from moisture and direct sunlight, unless the packaging specifies otherwise." },
        { q: "What if my order is delayed?", a: "Reach out to us directly on WhatsApp or by phone — we'll track the order and resolve it immediately." },
      ];

  return (
    <section className="bg-white py-14 lg:py-20">
      <div className="page-section">
        <Reveal direction="up">
          <SectionHeader
            eyebrow={isRtl ? "أسئلة شائعة" : "Frequently asked"}
            title={isRtl ? "ربما يكون لديك هذه الأسئلة" : "Answers to common questions"}
            isRtl={isRtl}
          />
        </Reveal>

        <div className="mx-auto mt-8 max-w-3xl space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={faq.q} direction="up" delay={i * 50}>
              <FaqItem question={faq.q} answer={faq.a} isRtl={isRtl} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer, isRtl }: { question: string; answer: string; isRtl: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all", open && "border-[#0E7E74]/30 shadow-[0_8px_28px_rgba(14,126,116,0.06)]")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn("flex w-full items-center justify-between gap-4 px-5 py-4 text-start", isRtl && "flex-row-reverse text-right")}
      >
        <span className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors", open ? "bg-[#0E7E74] text-white" : "bg-slate-100 text-slate-500")}>
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
          <span className="text-[14px] font-black text-[#0A1220]">{question}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className={cn("px-5 pb-5 text-[14px] font-semibold leading-[1.8] text-slate-600", isRtl && "text-right")}>
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  STICKY BUY BAR — appears on scroll past hero
// ═══════════════════════════════════════════════════════════════════════════

function StickyBuyBar({
  product, displayName, imageUrl, currency, addToCartLabel,
  qty, setQty, onAdd, added, visible, isRtl,
}: {
  product: CatalogProduct;
  displayName: string;
  imageUrl: string;
  currency: string;
  addToCartLabel: string;
  qty: number;
  setQty: (n: number) => void;
  onAdd: () => void;
  added: boolean;
  visible: boolean;
  isRtl: boolean;
}) {
  // Portal'd to document.body — any ancestor with `will-change: transform`
  // (e.g. .route-shell) would otherwise create a containing block and break
  // `position: fixed; bottom: 0` for this bar.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 backdrop-blur-xl shadow-[0_-12px_36px_rgba(10,18,32,0.08)] transition-all duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
          <div className={cn("page-section flex items-center justify-between gap-4 py-3", isRtl && "flex-row-reverse")}>
            {/* Product chip */}
            <div className={cn("flex items-center gap-3 overflow-hidden", isRtl && "flex-row-reverse")}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5">
                <ImageWithFallback src={imageUrl} alt={displayName} className="h-full w-full object-contain" />
              </div>
              <div className={cn("min-w-0", isRtl && "text-right")}>
                <p className="truncate text-[13px] font-black text-[#0A1220]">{displayName}</p>
                <p className={cn("flex items-baseline gap-1 text-[11px] font-bold text-slate-400", isRtl && "flex-row-reverse")}>
                  <span className="text-[15px] font-black text-[#0A1220]">{product.price.toFixed(2)}</span>
                  <span>{currency}</span>
                </p>
              </div>
            </div>

            {/* Qty + CTA */}
            <div className={cn("flex shrink-0 items-stretch gap-2", isRtl && "flex-row-reverse")}>
              <div className={cn("hidden h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white sm:flex", isRtl && "flex-row-reverse")}>
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={qty <= 1 || !product.inStock}
                  aria-label={isRtl ? "تقليل" : "Decrease"}
                  className="flex h-full w-9 items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="flex h-full w-9 items-center justify-center text-[13px] font-black tabular-nums text-[#0A1220]">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  disabled={!product.inStock}
                  aria-label={isRtl ? "زيادة" : "Increase"}
                  className="flex h-full w-9 items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <motion.button
                whileHover={product.inStock && !added ? { scale: 1.02 } : {}}
                whileTap={product.inStock ? { scale: 0.96 } : {}}
                onClick={onAdd}
                disabled={!product.inStock}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-xl px-5 text-[13px] font-black",
                  product.inStock
                    ? added ? "bg-emerald-500 text-white" : "bg-[#0E7E74] text-white hover:bg-[#0A6B62]"
                    : "cursor-not-allowed bg-slate-200 text-slate-400",
                  isRtl && "flex-row-reverse",
                )}
              >
                {added ? <CheckCircle2 className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                {added ? (isRtl ? "تمت الإضافة" : "Added") : addToCartLabel}
              </motion.button>
            </div>
          </div>
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  LIGHTBOX
// ═══════════════════════════════════════════════════════════════════════════

function Lightbox({ imageUrl, alt, onClose }: { imageUrl: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A1220]/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <motion.img
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        src={imageUrl}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-[88vw] object-contain"
      />
    </motion.div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION HEADER (shared)
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({ eyebrow, title, isRtl }: { eyebrow: string; title: string; isRtl: boolean }) {
  return (
    <div className={isRtl ? "text-right" : ""}>
      <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">{eyebrow}</p>
      <h2 className="mt-2 text-[clamp(1.6rem,3vw,2.4rem)] font-black leading-tight text-[#0A1220]">{title}</h2>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  LOADING / NOT-FOUND
// ═══════════════════════════════════════════════════════════════════════════

function ProductDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-slate-100">
        <div className="page-section py-3">
          <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="page-section py-12">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-[28px] bg-slate-100" />
          <div className="space-y-4">
            <div className="h-6 w-40 animate-pulse rounded-full bg-slate-100" />
            <div className="h-12 w-4/5 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-5 w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="h-5 w-2/3 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-56 animate-pulse rounded-3xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductNotFound({ isRtl }: { isRtl: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className="text-center"
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50">
          <PackageSearch className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-3xl font-black text-[#0A1220]">
          {isRtl ? "المنتج غير متوفر" : "Product not found"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] font-semibold leading-relaxed text-slate-500">
          {isRtl
            ? "تعذر العثور على هذا المنتج داخل الكتالوج الحالي."
            : "We couldn't find this item inside the current catalog."}
        </p>
        <Link
          to="/products"
          className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#0E7E74] px-6 py-3.5 text-[14px] font-black text-white transition-colors hover:bg-[#0A6B62]"
        >
          <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
          {isRtl ? "العودة إلى المنتجات" : "Back to products"}
        </Link>
      </motion.div>
    </div>
  );
}
