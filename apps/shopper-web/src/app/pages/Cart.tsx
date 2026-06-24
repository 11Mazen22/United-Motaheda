import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  GripVertical,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate }       from "react-router-dom";
import { type CartItem, useCart }  from "../../contexts/CartContext";
import { useLanguage }             from "../../contexts/LanguageContext";
import type { TranslationKey }    from "../../i18n/translationData";
import {
  getDeliveryWindowLabel,
  getOrderPricing,
} from "../config";
import { getCatalogProductImage }           from "../catalog";
import { GeofenceStatusBanner }             from "../components/GeofenceStatusBanner";
import { ImageWithFallback }                from "../components/figma/ImageWithFallback";
import { cn }                               from "../components/UI";
import { useIsShopperShell }               from "../components/ui/use-mobile";
import { useDeliveryContext }              from "../hooks/useDeliveryContext";
import { getLocalizedProductName }         from "../localization";
import { MobileCartView }                  from "./ShopperMobileViews";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const TEAL = "#0E7E74";
const INK  = "#0A1220";

// ─── Route shell ─────────────────────────────────────────────────────────────

export default function Cart() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <MobileCartView />;
  return <CartDesktop />;
}

// ─── CartDesktop ──────────────────────────────────────────────────────────────

function CartDesktop() {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const delivery = useDeliveryContext();

  // ── Drag-order state ──────────────────────────────────────────────────────
  // Mirrors `cart` but preserves the user's drag-reorder sequence.
  // Syncs when items are added / removed while keeping user-set positions.
  const [orderedItems, setOrderedItems] = useState<CartItem[]>(() => cart);

  useEffect(() => {
    setOrderedItems((prev) => {
      const cartMap = new Map(cart.map((i) => [i.id, i]));
      const prevIds = new Set(prev.map((i) => i.id));
      // Keep existing items in user order, with updated data (price / qty) from cart
      const kept  = prev.filter((i) => cartMap.has(i.id)).map((i) => cartMap.get(i.id)!);
      // Append genuinely new items at the end
      const added = cart.filter((i) => !prevIds.has(i.id));
      return [...kept, ...added];
    });
  }, [cart]);

  const itemCount  = orderedItems.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal   = orderedItems.reduce((sum, i) => sum + (i.product?.price ?? 0) * i.quantity, 0);
  const dynamicFee = delivery.fee ?? 0;
  const pricing    = getOrderPricing(subtotal, false, dynamicFee);

  const feeDisplay = delivery.isLoading
    ? (lang === "ar" ? "جارٍ الحساب…" : "Calculating…")
    : delivery.fee !== null
    ? `${delivery.fee} ${t("currency")}`
    : (lang === "ar" ? "يُحسب عند الإتمام" : "Calculated at checkout");

  if (cart.length === 0) {
    return <CartEmpty lang={lang} t={t} />;
  }

  return (
    <div className="cart-page min-h-screen bg-[#F8FAFB]">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="page-section py-6">
          {/* Breadcrumb */}
          <nav className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Link to="/" className="transition-colors hover:text-slate-600">
              {lang === "ar" ? "الرئيسية" : "Home"}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-600">{t("cart_title")}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">{t("cart_title")}</h1>
            <span
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-black text-white"
              style={{ backgroundColor: INK }}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {itemCount} {lang === "ar" ? "قطعة" : itemCount === 1 ? "item" : "items"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="page-section py-8 md:py-12">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_24rem]">

          {/* ── LEFT: item list ───────────────────────────────────────────────── */}
          <div>
            {/* Row label + clear all */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                {lang === "ar" ? "المنتجات" : "Products"} ({orderedItems.length})
              </span>
              <button
                type="button"
                onClick={() => { cart.forEach((i) => removeFromCart(i.id)); }}
                className="text-[11px] font-black text-rose-400 transition-colors hover:text-rose-600"
              >
                {lang === "ar" ? "إزالة الكل" : "Remove all"}
              </button>
            </div>

            {/* Draggable cart item list */}
            <Reorder.Group
              axis="y"
              values={orderedItems}
              onReorder={setOrderedItems}
              as="div"
              className="space-y-3"
            >
              <AnimatePresence initial={false}>
                {orderedItems.map((item) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    lang={lang}
                    t={t}
                    removeFromCart={removeFromCart}
                    updateQuantity={updateQuantity}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>

            {/* Continue shopping */}
            <div className="mt-5">
              <Link
                to="/products"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50"
              >
                <Package className="h-4 w-4" />
                {t("continue_shopping")}
              </Link>
            </div>
          </div>

          {/* ── RIGHT: order summary ──────────────────────────────────────────── */}
          <aside className="xl:sticky xl:top-28 xl:self-start">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08),0_1px_4px_rgba(15,23,42,0.04)]">

              {/* Header */}
              <div className="border-b border-slate-100 px-6 py-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {lang === "ar" ? "ملخص الطلب" : "Order summary"}
                </p>
                <p className="mt-0.5 text-xl font-black text-slate-900">{t("order_summary")}</p>
              </div>

              {/* Mini item list */}
              <div
                className="max-h-52 overflow-y-auto px-5 py-4"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}
              >
                <div className="space-y-2.5">
                  {orderedItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[#F7FAFB]">
                        <ImageWithFallback
                          src={item.product ? getCatalogProductImage(item.product) : undefined}
                          alt=""
                          className="h-full w-full object-contain p-1"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-600">
                        {item.product ? getLocalizedProductName(item.product, lang) : ""}
                        <span className="ms-1 font-black text-slate-400">×{item.quantity}</span>
                      </p>
                      <p className="shrink-0 text-xs font-black tabular-nums text-slate-900">
                        {((item.product?.price ?? 0) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing breakdown */}
              <div className="space-y-3 border-t border-slate-100 px-6 py-5">
                <PricingRow
                  label={t("subtotal")}
                  value={`${pricing.subtotal.toFixed(2)} ${t("currency")}`}
                />
                <PricingRow
                  label={lang === "ar" ? "رسوم التوصيل" : "Delivery fee"}
                  value={feeDisplay}
                  valueClass={delivery.isLoading ? "text-slate-400 animate-pulse" : undefined}
                />
                {/* Delivery window chip */}
                <div className="flex items-center gap-2 rounded-lg bg-[#F7FAFB] px-3 py-2.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500">
                    {lang === "ar" ? "النافذة الزمنية:" : "Window:"}{" "}
                    <span className="font-black text-slate-700">{getDeliveryWindowLabel(lang)}</span>
                  </span>
                </div>

                {/* Grand total */}
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-black text-slate-500">{t("total")}</span>
                  <div className="text-end">
                    <span className="text-2xl font-black text-slate-900 tabular-nums">
                      {pricing.total.toFixed(2)}
                    </span>
                    <span className="ms-1.5 text-xs font-bold text-slate-400">{t("currency")}</span>
                  </div>
                </div>
              </div>

              {/* Geofence banner */}
              {delivery.status !== null && (
                <div className="px-6 pb-2">
                  <GeofenceStatusBanner status={delivery.status} lang={lang} />
                </div>
              )}

              {/* CTA + trust */}
              <div className="space-y-3 px-6 pb-6">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => void navigate("/checkout")}
                  disabled={delivery.isAvailable === false}
                  className="flex h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-xl text-sm font-black text-white shadow-[0_8px_28px_rgba(10,18,32,0.18)] transition-[background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7E74]/50 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: INK }}
                  onMouseEnter={(e) => { if (delivery.isAvailable !== false) e.currentTarget.style.backgroundColor = TEAL; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = INK; }}
                >
                  {t("checkout_btn")}
                  <ArrowRight className={cn("h-4 w-4 shrink-0", lang === "ar" && "rotate-180")} />
                </motion.button>

                {/* Trust chips */}
                <div className="grid grid-cols-2 gap-2">
                  <TrustChip
                    icon={<Truck className="h-3.5 w-3.5" />}
                    label={lang === "ar" ? "توصيل سريع" : "Fast delivery"}
                  />
                  <TrustChip
                    icon={<ShieldCheck className="h-3.5 w-3.5" />}
                    label={lang === "ar" ? "دفع آمن" : "Secure checkout"}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── CartItemCard ─────────────────────────────────────────────────────────────
// Extracted as its own component because useDragControls() must be called once
// per item — it cannot live inside a .map() callback.

interface CartItemCardProps {
  item:           CartItem;
  lang:           "ar" | "en";
  t:              (key: TranslationKey) => string;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
}

function CartItemCard({
  item,
  lang,
  t,
  removeFromCart,
  updateQuantity,
}: CartItemCardProps) {
  const dragControls = useDragControls();
  const price     = item.product?.price ?? 0;
  const lineTotal = price * item.quantity;
  const name      = item.product ? getLocalizedProductName(item.product, lang) : "";

  return (
    <Reorder.Item
      value={item}
      dragControls={dragControls}
      dragListener={false}
      as="article"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: lang === "ar" ? 32 : -32, scale: 0.96 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      whileDrag={{
        scale: 1.018,
        zIndex: 20,
        boxShadow: "0 24px 56px rgba(10,18,32,0.18), 0 6px 16px rgba(10,18,32,0.1)",
        cursor: "grabbing",
      }}
      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05),0_2px_8px_rgba(15,23,42,0.03)] transition-shadow hover:shadow-[0_6px_28px_rgba(15,23,42,0.09)]"
    >
      {/* Teal left accent line */}
      <div
        className="absolute inset-y-0 start-0 w-[3px] rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ backgroundColor: TEAL }}
        aria-hidden
      />

      <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">

        {/* ── Drag handle ─────────────────────────────────────────────────────
            touch-none prevents the browser's scroll from fighting the drag.
            dragListener={false} on Reorder.Item means ONLY this handle
            initiates drag — clicks on buttons / links are never captured. */}
        <div
          onPointerDown={(e) => { e.preventDefault(); dragControls.start(e); }}
          className="flex shrink-0 touch-none select-none cursor-grab items-center self-stretch px-0.5 text-slate-300 opacity-0 transition-opacity duration-150 group-hover:opacity-100 active:cursor-grabbing"
          aria-label={lang === "ar" ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
          role="button"
          tabIndex={-1}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Thumbnail */}
        <Link
          to={`/products/${item.product_id}`}
          className="shrink-0 focus-visible:outline-none"
          tabIndex={-1}
        >
          <div className="relative h-[5.5rem] w-[5.5rem] overflow-hidden rounded-xl bg-[#F7FAFB] sm:h-24 sm:w-24">
            <ImageWithFallback
              src={item.product ? getCatalogProductImage(item.product) : undefined}
              alt={name}
              className="h-full w-full object-contain p-2.5 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              loading="lazy"
              decoding="async"
            />
          </div>
        </Link>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Name + remove */}
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/products/${item.product_id}`}
              className="min-w-0 flex-1 focus-visible:outline-none"
            >
              <h3 className="line-clamp-2 text-[0.95rem] font-black leading-snug text-slate-900 transition-colors duration-150 group-hover:text-[#0E7E74]">
                {name}
              </h3>
            </Link>
            <button
              type="button"
              onClick={() => removeFromCart(item.id)}
              aria-label={lang === "ar" ? "حذف المنتج" : "Remove item"}
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Unit price */}
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {lang === "ar" ? "سعر الوحدة:" : "Unit:"}{" "}
            <span className="font-black text-slate-600">
              {price.toFixed(2)} {t("currency")}
            </span>
          </p>

          {/* Bottom row: qty stepper + line total */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {/* Qty stepper */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                aria-label={lang === "ar" ? "تقليل الكمية" : "Decrease qty"}
                className="flex h-9 w-9 items-center justify-center rounded-l-xl text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-black text-slate-900 tabular-nums">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                aria-label={lang === "ar" ? "زيادة الكمية" : "Increase qty"}
                className="flex h-9 w-9 items-center justify-center rounded-r-xl text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Line total */}
            <div className="text-end">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                {lang === "ar" ? "الإجمالي" : "Total"}
              </p>
              <p className="mt-0.5 text-lg font-black leading-none text-slate-900">
                {lineTotal.toFixed(2)}
                <span className="ms-1 text-[10px] font-bold text-slate-400">{t("currency")}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

// ─── CartEmpty ────────────────────────────────────────────────────────────────

function CartEmpty({
  lang,
  t,
}: {
  lang: "ar" | "en";
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="cart-page flex min-h-screen flex-col items-center justify-center bg-[#F8FAFB] px-6 py-24 text-center">
      {/* Icon tile */}
      <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-slate-100 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
        <ShoppingBag className="h-10 w-10 text-slate-200" />
      </div>

      <h2 className="text-2xl font-black text-slate-900">{t("empty_cart")}</h2>
      <p className="mt-2 max-w-xs text-sm font-semibold leading-relaxed text-slate-400">
        {t("empty_cart_desc")}
      </p>

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/products"
          className="inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-black text-white shadow-[0_6px_20px_rgba(10,18,32,0.16)] transition-[background-color] duration-200 hover:bg-[#0E7E74]"
          style={{ backgroundColor: INK }}
        >
          <Package className="h-4 w-4" />
          {t("browse_products")}
        </Link>
        <Link
          to="/offers"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Tag className="h-4 w-4 text-amber-400" />
          {lang === "ar" ? "العروض" : "Today's offers"}
        </Link>
      </div>
    </div>
  );
}

// ─── PricingRow ───────────────────────────────────────────────────────────────

function PricingRow({
  label,
  value,
  valueClass,
}: {
  label:       string;
  value:       string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className={cn("font-black text-slate-900", valueClass)}>{value}</span>
    </div>
  );
}

// ─── TrustChip ────────────────────────────────────────────────────────────────

function TrustChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-[#F8FAFB] px-2.5 py-2 text-[11px] font-black text-slate-500">
      <span className="text-slate-400">{icon}</span>
      {label}
    </div>
  );
}
