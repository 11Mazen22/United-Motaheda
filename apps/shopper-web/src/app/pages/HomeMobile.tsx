import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Clock3,
  LayoutGrid,
  Lock,
  MapPin,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCatalog } from "../../contexts/CatalogContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  getDeliveryWindowCompactLabel,
  getServiceHoursSentence,
} from "../config";
import { CatalogSkeletonGrid } from "../components/CatalogPrimitives";
import { DailyPicksSection } from "../components/DailyPicksSection";
import {
  ShopperCategoryTile,
  ShopperPage,
  ShopperSectionHeader,
} from "../components/ShopperPrimitives";
import { cn } from "../components/UI";
import { images, locations } from "../data";

/* ─────────────────────────────────────── types ─ */
type QuickTile = {
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
  accent: string;
  iconBg: string;
  cardGradient: string;
  borderAccent: string;
};

/* ─────────────────────────────────────── keyframes (extracted) ─ */
const homeStyles = `
  @keyframes homeReveal {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tapGlow {
    0% { box-shadow: 0 0 0 0 rgba(36,184,181,0.45); }
    100% { box-shadow: 0 0 0 12px rgba(36,184,181,0); }
  }
  @keyframes tickerScroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .home-reveal { animation: homeReveal 0.52s cubic-bezier(0.22,1,0.36,1) both; }
  .tap-glow:active { animation: tapGlow 0.65s ease-out; }
  .ticker-scroll { animation: tickerScroll 22s linear infinite; }
`;

/* ─────────────────────────────────────── component ─ */
export function HomeMobile() {
  const { lang } = useLanguage();
  const { categories, featuredProducts, isLoading } = useCatalog();

  const primaryLocation = locations.find((loc) => loc.isPrimary) ?? locations[0];
  const categoryShortcuts = categories.slice(0, 8);

  const deliveryWindowLabel = getDeliveryWindowCompactLabel(lang);
  const serviceHoursLabel = getServiceHoursSentence(lang);
  const branchAddress = lang === "ar" ? primaryLocation.addressAr : primaryLocation.addressEn;
  const isRTL = lang === "ar";

  /* ── trust marquee items (4× duplicated for a seamless loop) ── */
  const trustItems = useMemo(
    () =>
      isRTL
        ? ["٨٢٨٦+ منتج", "توصيل سريع", "دفع آمن", "خدمة متواصلة", "موثوق من آلاف العملاء", "أسعار مميزة"]
        : ["8,286+ products", "Fast delivery", "Secure checkout", "Always open", "Trusted by thousands", "Best prices"],
    [isRTL]
  );
  const marqueeItems = useMemo(() => [...trustItems, ...trustItems, ...trustItems, ...trustItems], [trustItems]);

  /* ── quick access tiles ── */
  const quickTiles = useMemo<QuickTile[]>(
    () => [
      {
        icon: PackageSearch,
        title: isRTL ? "كل المنتجات" : "All Products",
        description: isRTL
          ? "سوق الصيدلية الكامل مع بحث وفرز وتصفية فورية."
          : "Full pharmacy marketplace with instant search & filter.",
        to: "/products",
        accent: "text-[var(--primary,#24b8b5)]",
        iconBg: "bg-[var(--primary,#24b8b5)]/12",
        cardGradient: "bg-[linear-gradient(145deg,#ffffff_0%,#f0fdfc_100%)]",
        borderAccent: "border-t-[var(--primary,#24b8b5)]/30",
      },
      {
        icon: LayoutGrid,
        title: isRTL ? "الأقسام" : "Categories",
        description: isRTL
          ? "ابدأ من شبكة الأقسام للوصول السريع."
          : "Browse the category grid for a faster path in.",
        to: "/categories",
        accent: "text-cyan-600",
        iconBg: "bg-cyan-50",
        cardGradient: "bg-[linear-gradient(145deg,#ffffff_0%,#ecfeff_100%)]",
        borderAccent: "border-t-cyan-200",
      },
      {
        icon: Sparkles,
        title: isRTL ? "العروض" : "Offers",
        description: isRTL
          ? "كل العروض المميزة من الصفحة الرئيسية مباشرة."
          : "All featured deals, visible directly from home.",
        to: "/offers",
        accent: "text-amber-600",
        iconBg: "bg-amber-50",
        cardGradient: "bg-[linear-gradient(145deg,#ffffff_0%,#fffbeb_100%)]",
        borderAccent: "border-t-amber-200",
      },
      {
        icon: ClipboardList,
        title: isRTL ? "نواقص" : "Shortages",
        description: isRTL
          ? "اطلب صنفاً غير متوفر ونرد في ١–٢٤ ساعة."
          : "Request out-of-stock items. Response in 1–24 hrs.",
        to: "/special-orders",
        accent: "text-rose-600",
        iconBg: "bg-rose-50",
        cardGradient: "bg-[linear-gradient(145deg,#ffffff_0%,#fff1f2_100%)]",
        borderAccent: "border-t-rose-200",
      },
    ],
    [isRTL]
  );

  return (
    <ShopperPage docked={false} className="w-full">
      <style>{homeStyles}</style>

      <div
        className="flex flex-col gap-5 w-full"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* ══════════════════════════════════════════════════ HERO */}
        <div
          className="home-reveal overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white shadow-[0_24px_56px_rgba(15,23,42,0.11)]"
          style={{ animationDelay: "0ms" }}
        >
          {/* ── Image layer ── */}
          <div className="relative overflow-hidden bg-slate-950">
            <img
              src={images.homeWide}
              alt={isRTL ? "الصفحة الرئيسية للتسوق" : "Main shopping banner"}
              className="aspect-[1.58] w-full object-cover"
              loading="eager"
              decoding="async"
            />

            {/* Cinematic gradient overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(175deg,rgba(15,23,42,0.04)_0%,rgba(15,23,42,0.18)_40%,rgba(15,23,42,0.82)_100%)]" />

            {/* Subtle noise grain */}
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                backgroundRepeat: "repeat",
                backgroundSize: "128px",
              }}
            />

            {/* Top-start: live brand badge */}
            <div className="absolute start-4 top-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 backdrop-blur-[10px]">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary,#24b8b5)] opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--primary,#24b8b5)]" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  {isRTL ? "صيدلية المتحدة" : "United Pharmacies"}
                </span>
              </span>
            </div>

            {/* Top-end: offers counter */}
            <div className="absolute end-4 top-4">
              <div className="flex flex-col items-center rounded-[0.9rem] border border-white/25 bg-white/15 px-3.5 py-2 backdrop-blur-[10px]">
                <span className="text-[20px] font-black leading-none text-white">
                  {featuredProducts.length}
                </span>
                <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/75">
                  {isRTL ? "عرض" : "Offers"}
                </span>
              </div>
            </div>

            {/* Bottom: headline */}
            <div className="absolute inset-x-0 bottom-0 p-5 pb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/55">
                {isRTL ? "شعار صيدليتنا" : "Your pharmacy, delivered"}
              </p>
              <h1 className="mt-1.5 text-[1.65rem] font-black leading-[1.08] tracking-tight text-white">
                {isRTL ? (
                  <>
                    لكل داء{" "}
                    <span
                      className="text-[#24b8b5]"
                      style={{ textShadow: "0 0 24px rgba(36,184,181,0.6)" }}
                    >
                      دواء
                    </span>
                  </>
                ) : (
                  <>
                    Everything you need,{" "}
                    <span
                      className="text-[#24b8b5]"
                      style={{ textShadow: "0 0 24px rgba(36,184,181,0.6)" }}
                    >
                      at home.
                    </span>
                  </>
                )}
              </h1>
            </div>
          </div>

          {/* ── Card body ── */}
          <div className="space-y-3 p-4 pt-3.5">
            {/* Address pill */}
            <div className="flex items-center gap-2 rounded-[0.85rem] border border-slate-100 bg-slate-50 px-3.5 py-2.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--primary,#24b8b5)]" />
              <p className="truncate text-[12px] font-semibold text-slate-600">{branchAddress}</p>
            </div>

            {/* CTA buttons – white background, tap glow animation */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/products"
                className={cn(
                  "tap-glow inline-flex h-12 items-center justify-center gap-1.5 rounded-[1rem]",
                  "bg-white border border-slate-200 text-slate-900 text-[13.5px] font-black",
                  "shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition-transform active:scale-95 focus-visible:scale-[0.97]",
                )}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <PackageSearch className="h-[1.05rem] w-[1.05rem] text-[var(--primary,#24b8b5)]" />
                {isRTL ? "كل المنتجات" : "All Products"}
              </Link>
              <Link
                to="/offers"
                className={cn(
                  "tap-glow inline-flex h-12 items-center justify-center gap-1.5 rounded-[1rem]",
                  "bg-white border border-slate-200 text-slate-900 text-[13.5px] font-black",
                  "shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition-transform active:scale-95 focus-visible:scale-[0.97]",
                )}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Sparkles className="h-[1.05rem] w-[1.05rem] text-[var(--primary,#24b8b5)]" />
                {isRTL ? "شاهد العروض" : "See Offers"}
              </Link>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════ TRUST MARQUEE (seamless, fixed Arabic) */}
        <div
          className="home-reveal overflow-hidden rounded-[1.1rem] border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.05)]"
          style={{ animationDelay: "80ms" }}
        >
          <div className="overflow-hidden py-3" dir="ltr">
            <div className="flex w-max gap-0 ticker-scroll">
              {marqueeItems.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 px-5">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--primary,#24b8b5)]" />
                  <span className="whitespace-nowrap text-[12px] font-black text-slate-700">{item}</span>
                  <span className="mx-1 h-1 w-1 rounded-full bg-slate-300" />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════ SERVICE STRIP */}
        <div
          className="home-reveal overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)]"
          style={{ animationDelay: "160ms" }}
        >
          <div className="grid grid-cols-3 divide-x divide-slate-100 rtl:divide-x-reverse">
            <div className="flex flex-col items-center gap-2 px-2 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] bg-[var(--primary,#24b8b5)]/10">
                <Truck className="h-4 w-4 text-[var(--primary,#24b8b5)]" />
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-[11.5px] font-black leading-tight text-slate-900">{deliveryWindowLabel}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {isRTL ? "نافذة التوصيل" : "Delivery"}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 px-2 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] bg-emerald-50">
                <Zap className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-[11.5px] font-black leading-tight text-slate-900">
                  {isRTL ? "حسب المنطقة" : "By area"}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {isRTL ? "رسوم التوصيل" : "Delivery fee"}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 px-2 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] bg-violet-50">
                <Clock3 className="h-4 w-4 text-violet-600" />
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-[11.5px] font-black leading-tight text-slate-900">{serviceHoursLabel}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {isRTL ? "ساعات الخدمة" : "Service hours"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════ QUICK ACCESS */}
        <div className="home-reveal space-y-3 w-full" style={{ animationDelay: "240ms" }}>
          <ShopperSectionHeader
            eyebrow={isRTL ? "وصول سريع" : "Quick access"}
            title={isRTL ? "ابدأ من أي نقطة" : "Start from any point"}
          />
          <div className="grid grid-cols-2 gap-3">
            {quickTiles.map(({ icon: Icon, title, description, to, accent, iconBg, cardGradient, borderAccent }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col gap-3 rounded-[1.4rem] border border-t-2 p-4",
                  "shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all active:scale-[0.965] active:shadow-sm",
                  cardGradient,
                  borderAccent,
                  "border-x-slate-200/70 border-b-slate-200/70",
                )}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-[0.85rem]", iconBg, accent)}>
                  <Icon className="h-[1.15rem] w-[1.15rem]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-black leading-tight text-slate-950">{title}</p>
                  <p className="mt-1 text-[11.5px] font-medium leading-[1.48] text-slate-500">{description}</p>
                </div>
                <span className={cn("inline-flex items-center gap-1 text-[11px] font-black", accent)}>
                  {isRTL ? "افتح الآن" : "Open now"}
                  <ArrowRight className={cn("h-3 w-3", isRTL && "rotate-180")} />
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════ DAILY PICKS */}
        <div
          className="home-reveal w-full"
          style={{ animationDelay: "320ms" }}
        >
          <DailyPicksSection
            products={featuredProducts}
            lang={lang}
            isLoading={isLoading}
            embedded
          />
        </div>

        {/* ══════════════════════════════════════ CATEGORIES */}
        <div
          className="home-reveal w-full overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)]"
          style={{ animationDelay: "400ms" }}
        >
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-[linear-gradient(90deg,#ecfeff,#f8fafc)] px-4 py-3.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[0.6rem] bg-cyan-100">
              <LayoutGrid className="h-3.5 w-3.5 text-cyan-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                {isRTL ? "تسوق حسب القسم" : "Shop by category"}
              </p>
              <p className="text-[14px] font-black leading-tight text-slate-950">
                {isRTL ? "شبكة الأقسام" : "Category grid"}
              </p>
            </div>
            <Link
              to="/categories"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-[11.5px] font-black text-slate-700 shadow-sm transition-all active:scale-95"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isRTL ? "الكل" : "View all"}
            </Link>
          </div>

          <div className="p-3">
            {isLoading && categories.length === 0 ? (
              <CatalogSkeletonGrid variant="category" count={8} />
            ) : categories.length === 0 ? (
              <p className="py-6 text-center text-[13px] font-semibold text-slate-400">
                {isRTL ? "لا توجد أقسام متوفرة" : "No categories available"}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {categoryShortcuts.map((category) => (
                  <ShopperCategoryTile key={category.id} category={category} compact />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════ ACCOUNT + CART */}
        <div
          className="home-reveal overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)]"
          style={{ animationDelay: "480ms" }}
        >
          <div className="bg-[linear-gradient(130deg,#f0fdfc_0%,#e0f7fa_40%,#f1f5f9_100%)] px-5 py-4 border-b border-slate-100/80">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {isRTL ? "منطقتك الشخصية" : "Your space"}
            </p>
            <p className="mt-0.5 text-[17px] font-black tracking-tight text-slate-950">
              {isRTL ? "الحساب والسلة" : "Account & Cart"}
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-100 rtl:divide-x-reverse">
            <Link
              to="/profile"
              className="group flex flex-col gap-3.5 p-4 transition-colors active:bg-slate-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[0.9rem] bg-slate-100 transition-colors group-active:bg-slate-200">
                <ShieldCheck className="h-[1.3rem] w-[1.3rem] text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-black text-slate-950">{isRTL ? "الحساب" : "Account"}</p>
                <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-slate-500">
                  {isRTL ? "الطلبات والتفضيلات" : "Orders & preferences"}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500">
                {isRTL ? "افتح الحساب" : "Open account"}
                <ArrowRight className={cn("h-3 w-3", isRTL && "rotate-180")} />
              </span>
            </Link>

            <Link
              to="/cart"
              className="group flex flex-col gap-3.5 p-4 transition-colors active:bg-[var(--primary,#24b8b5)]/5"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[0.9rem] bg-[var(--primary,#24b8b5)]/12 transition-colors group-active:bg-[var(--primary,#24b8b5)]/20">
                <ShoppingBag className="h-[1.3rem] w-[1.3rem] text-[var(--primary,#24b8b5)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-black text-slate-950">{isRTL ? "السلة" : "Cart"}</p>
                <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-slate-500">
                  {isRTL ? "مراجعة الطلب والدفع" : "Review & checkout"}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-[var(--primary,#24b8b5)]">
                {isRTL ? "افتح السلة" : "Open cart"}
                <ArrowRight className={cn("h-3 w-3", isRTL && "rotate-180")} />
              </span>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/60 py-2.5">
            <Lock className="h-3 w-3 text-slate-400" />
            <p className="text-[10.5px] font-semibold text-slate-400">
              {isRTL ? "جلسة آمنة ومشفرة" : "Secure encrypted session"}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════ BRAND FOOTER */}
        <div className="home-reveal flex items-center justify-center gap-3 pb-1" style={{ animationDelay: "560ms" }}>
          <div className="h-px flex-1 bg-slate-200" />
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">
            {isRTL ? "صيدليات المتحدة · القاهرة" : "United Pharmacies · Cairo"}
          </p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      </div>
    </ShopperPage>
  );
}
