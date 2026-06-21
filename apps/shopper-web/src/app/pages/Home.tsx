// Home.tsx – luxury editorial redesign
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  Apple,
  ArrowRight,
  Baby,
  Brain,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Eye,
  FlaskConical,
  Heart,
  Leaf,
  MapPin,
  PackageSearch,
  Pill,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  Thermometer,
  Truck,
  Zap,
} from "lucide-react";
import { cn } from "../components/UI";
import { ProductGrid } from "../components/ProductGrid";
import { Reveal } from "../components/Reveal";
import { SearchBar } from "../components/SearchBar";
import { useIsShopperShell } from "../components/ui/use-mobile";
import { useCatalog } from "../../contexts/CatalogContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSearch } from "../../contexts/SearchContext";
import { locations } from "../data";
import { useCatalogCategorySearch } from "../hooks/useCatalogCategorySearch";
import { getLocalizedProductName } from "../localization";
import { getServiceHoursSentence } from "../config";
import { HomeMobile } from "./HomeMobile";

/* ─── Category icon pool ────────────────────────────────── */
const CAT_GRADIENTS = [
  "from-teal-500 to-emerald-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-700",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-lime-500 to-green-600",
  "from-cyan-400 to-teal-600",
  "from-fuchsia-500 to-pink-700",
  "from-indigo-500 to-violet-600",
  "from-orange-500 to-red-500",
];

const CAT_ICONS = [
  Pill, Activity, Baby, Sparkles, Stethoscope,
  FlaskConical, Thermometer, Eye, Leaf, Apple,
  Dumbbell, Brain, ShieldCheck, Star, Zap, Heart,
];

/* ─── Skeleton ───────────────────────────────────────────── */
function HomeSkeleton() {
  return (
    <div className="home-page min-h-screen bg-[#0A1220]">
      <div className="py-20">
        <div className="page-section text-center">
          <div className="mx-auto h-6 w-40 animate-pulse rounded-full bg-white/10" />
          <div className="mx-auto mt-6 h-16 w-3/4 animate-pulse rounded-2xl bg-white/10" />
          <div className="mx-auto mt-4 h-14 max-w-2xl animate-pulse rounded-2xl bg-white/10" />
        </div>
      </div>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────── */
export default function Home() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <HomeMobile />;
  return <HomeDesktop />;
}

/* ─── Desktop view ───────────────────────────────────────── */
function HomeDesktop() {
  const navigate                                             = useNavigate();
  const { lang }                                            = useLanguage();
  const { searchQuery, setSearchQuery, commitQuery, suggestions } = useSearch();
  const { categories, featuredProducts, isLoading, error }  = useCatalog();
  const isRtl                                               = lang === "ar";

  const [catSlide, setCatSlide] = useState(0);

  const isInitialLoading = isLoading && featuredProducts.length === 0;

  const categoryResults  = useCatalogCategorySearch(categories, searchQuery);
  const catSuggestions   = searchQuery.trim().length >= 2 ? categoryResults.slice(0, 3) : [];
  const prodSuggestions  = searchQuery.trim().length >= 2 ? suggestions.slice(0, 5) : [];

  const primaryLocation  = locations.find((l) => l.isPrimary) ?? locations[0];
  const categoryChips    = categories.slice(0, 11);
  const featuredA        = featuredProducts.slice(0, 4);
  const featuredB        = featuredProducts.slice(4, 12);
  const featuredC        = featuredProducts.slice(12, 24);
  const serviceHours     = getServiceHoursSentence(lang);

  /* Carousel: "All" slot (null) + every category chip, 3 per page */
  const carouselItems = [null, ...categoryChips] as (typeof categoryChips[number] | null)[];
  const totalSlides   = Math.ceil(carouselItems.length / 3);
  const prevSlide     = () => setCatSlide((s) => (s - 1 + totalSlides) % totalSlides);
  const nextSlide     = () => setCatSlide((s) => (s + 1) % totalSlides);
  const visibleItems  = [0, 1, 2].map((i) => carouselItems[(catSlide * 3 + i) % carouselItems.length]);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) { navigate("/products"); return; }
    commitQuery(q);
    navigate(`/products?search=${encodeURIComponent(q)}`);
  };

  if (isInitialLoading) return <HomeSkeleton />;

  return (
    <div className="home-page overflow-x-hidden bg-white">

      {/* ══════ 1. HERO ══════ */}
      <section className="relative overflow-hidden bg-[#0A1220]">

        {/* Subtle dot-grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Single soft teal glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% -10%, rgba(14,126,116,0.22), transparent)" }}
        />

        <div className="page-section relative z-10 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">

            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.07] px-4 py-1.5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0E7E74]" aria-hidden />
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">
                {isRtl ? "الصيدلية الموثوقة — القاهرة" : "United Pharmacies — Cairo"}
              </span>
            </div>

            {/* Headline — Playfair Display serif for luxury feel */}
            <h1
              className={cn(
                "mt-6 text-white",
                isRtl
                  ? "font-black text-[2.4rem] leading-[1.3] sm:text-[3.6rem]"
                  : "text-[3rem] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[4.4rem]",
              )}
              style={isRtl ? undefined : { fontFamily: "var(--font-serif)" }}
            >
              {isRtl ? (
                <>دواؤك بكلمة واحدة<br /><span className="text-[#2DD4C0]">8,000+ منتج دوائي</span></>
              ) : (
                <>Your medicine,<br /><em className="not-italic text-[#2DD4C0]">one search away.</em></>
              )}
            </h1>

            <p className="mx-auto mt-5 max-w-lg text-[15px] font-medium leading-7 text-white/50">
              {isRtl
                ? "ابحث عن آلاف الأدوية والمستلزمات الطبية — لكل داء دواء"
                : "Browse thousands of medicines, vitamins, and health essentials — all in one place."}
            </p>

            {error && (
              <div className="mx-auto mt-4 max-w-lg rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-300">
                {isRtl ? "تعذر تحديث الكتالوج — تُعرض آخر البيانات المتاحة." : "Catalog refresh issue — showing last available data."}
              </div>
            )}

            {/* Search */}
            <form className="relative mx-auto mt-8 max-w-2xl" onSubmit={handleSearch}>
              <SearchBar
                value={searchQuery}
                onChange={(v) => { setSearchQuery(v); commitQuery(v); }}
                onClear={() => { setSearchQuery(""); commitQuery(""); }}
                placeholder={isRtl ? "ابحث بالاسم أو الكود أو القسم…" : "Search by name, code, or category…"}
                lang={lang}
                shellClassName="rounded-2xl border-white/20 bg-white shadow-[0_0_0_3px_rgba(14,126,116,0.25),0_20px_48px_rgba(0,0,0,0.4)]"
                suggestions={
                  prodSuggestions.length > 0 || catSuggestions.length > 0 ? (
                    <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_48px_rgba(15,23,42,0.20)] text-start">
                      {prodSuggestions.length > 0 && (
                        <div>
                          <p className="px-2 pb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{isRtl ? "منتجات" : "Products"}</p>
                          <div className="space-y-0.5">
                            {prodSuggestions.map((p) => (
                              <Link key={p.id} to={`/products/${p.id}`}
                                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-900">{getLocalizedProductName(p, lang)}</p>
                                  <p className="text-xs font-semibold text-slate-500">{lang === "ar" ? p.categoryName : p.categoryNameEn}</p>
                                </div>
                                <span className="shrink-0 text-xs font-black text-slate-400">{p.price.toFixed(2)} {isRtl ? "ج.م" : "EGP"}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                      {catSuggestions.length > 0 && (
                        <div className={cn(prodSuggestions.length > 0 && "mt-2 border-t border-slate-100 pt-2")}>
                          <p className="px-2 pb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{isRtl ? "أقسام" : "Categories"}</p>
                          <div className="space-y-0.5">
                            {catSuggestions.map((c) => (
                              <Link key={c.id}
                                to={`/products?category=${encodeURIComponent(c.id)}${searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : ""}`}
                                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50">
                                <div>
                                  <p className="text-sm font-black text-slate-900">{isRtl ? c.name : c.nameEn}</p>
                                  <p className="text-xs font-semibold text-slate-500">{isRtl ? "قسم" : "Category"}</p>
                                </div>
                                <ArrowRight className={cn("h-4 w-4 text-slate-400", isRtl && "rotate-180")} />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null
                }
              />
            </form>

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to="/products"
                className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-7 text-sm font-black text-[#0A1220] shadow-[0_8px_28px_rgba(0,0,0,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.38)]">
                {isRtl ? "تصفح المنتجات" : "Browse Products"}
                <ArrowRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180")} />
              </Link>
              <Link to="/offers"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-7 text-sm font-black text-white backdrop-blur-sm transition-all hover:bg-white/[0.16] hover:-translate-y-0.5">
                {isRtl ? "العروض الحالية" : "Current Offers"}
                <Sparkles className="h-4 w-4 text-[#2DD4C0]" />
              </Link>
            </div>

            {/* Stats row */}
            <div className="mt-10 grid grid-cols-4 divide-x divide-white/[0.08] border-t border-white/[0.08] pt-8">
              {[
                { value: "8K+",  labelAr: "منتج متاح",       labelEn: "Products"     },
                { value: "5",    labelAr: "فروع القاهرة",    labelEn: "Branches"     },
                { value: "100%", labelAr: "أدوية أصلية",     labelEn: "Genuine"      },
                { value: "24h",  labelAr: "توصيل سريع",      labelEn: "Delivery"     },
              ].map(({ value, labelAr, labelEn }) => (
                <div key={labelEn} className="flex flex-col items-center gap-1 px-4">
                  <span
                    className="text-2xl font-black text-white sm:text-3xl"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >{value}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                    {isRtl ? labelAr : labelEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom edge — fade to white */}
        <div
          aria-hidden
          className="h-12 sm:h-16"
          style={{ background: "linear-gradient(to bottom, #0A1220, white)" }}
        />
      </section>

      {/* ══════ 2. CATEGORY CAROUSEL ══════ */}
      {categoryChips.length > 0 && (
        <section className="bg-white py-12 sm:py-16">
          <div className="page-section">

            {/* Header */}
            <div className={cn("mb-8 flex items-end justify-between gap-4", isRtl && "flex-row-reverse")}>
              <div className={isRtl ? "text-right" : "text-left"}>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                  {isRtl ? "كتالوج المنتجات" : "Product Catalog"}
                </p>
                <h2
                  className="mt-1 text-2xl font-bold text-[#0A1220] sm:text-3xl"
                  style={isRtl ? undefined : { fontFamily: "var(--font-serif)" }}
                >
                  {isRtl ? "تسوق حسب القسم" : "Shop by Category"}
                </h2>
              </div>

              {/* Slide controls */}
              <div className={cn("flex shrink-0 items-center gap-3", isRtl && "flex-row-reverse")}>
                <span className="text-[11px] font-black text-slate-400">
                  {catSlide + 1} / {totalSlides}
                </span>
                <button
                  type="button"
                  onClick={isRtl ? nextSlide : prevSlide}
                  aria-label="Previous"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#0A1220] bg-white transition-all hover:bg-[#0A1220] hover:text-white [&>svg]:text-[#0A1220] hover:[&>svg]:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={isRtl ? prevSlide : nextSlide}
                  aria-label="Next"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#0A1220] bg-[#0A1220] text-white transition-all hover:bg-white hover:text-[#0A1220] [&>svg]:text-white hover:[&>svg]:text-[#0A1220]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 3-card carousel row */}
            <div className="grid grid-cols-3 gap-4">
              {visibleItems.map((cat, i) => {
                if (cat === null) {
                  /* "All" anchor card */
                  return (
                    <Link
                      key="all"
                      to="/products"
                      className={cn(
                        "group flex h-[110px] items-center gap-5 rounded-2xl border-2 border-[#0A1220] bg-[#0A1220] px-6 transition-all duration-200 hover:border-[#0E7E74] hover:shadow-[0_12px_32px_rgba(10,18,32,0.28)]",
                        isRtl && "flex-row-reverse",
                      )}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.12]">
                        <ShoppingBag className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-black text-white">
                          {isRtl ? "الكل" : "All"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-white/40">
                          {isRtl ? "تصفح جميع المنتجات" : "Browse everything"}
                        </p>
                      </div>
                      <ArrowRight className={cn("h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180")} />
                    </Link>
                  );
                }

                const IconComp = CAT_ICONS[(carouselItems.indexOf(cat) - 1) % CAT_ICONS.length];
                const label = isRtl ? cat.name : (cat.nameEn ?? cat.name);

                return (
                  <Link
                    key={cat.id + "-" + i}
                    to={`/products?category=${encodeURIComponent(cat.id)}`}
                    className={cn(
                      "group flex h-[110px] items-center gap-5 rounded-2xl border-2 border-[#0A1220] bg-white px-6 transition-all duration-200 hover:bg-[#0A1220] hover:shadow-[0_12px_32px_rgba(10,18,32,0.22)]",
                      isRtl && "flex-row-reverse",
                    )}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0A1220] transition-colors duration-200 group-hover:bg-white/[0.14]">
                      <IconComp className="h-5 w-5 text-white" />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[15px] font-black text-[#0A1220] transition-colors duration-200 group-hover:text-white">
                      {label}
                    </p>
                    <ArrowRight className={cn("h-4 w-4 shrink-0 text-[#0A1220]/20 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/40", isRtl && "rotate-180")} />
                  </Link>
                );
              })}
            </div>

            {/* Slide dots */}
            <div className="mt-6 flex items-center justify-center gap-1.5">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCatSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    i === catSlide ? "w-6 bg-[#0A1220]" : "w-1.5 bg-slate-200 hover:bg-slate-300",
                  )}
                />
              ))}
            </div>

          </div>
        </section>
      )}

      {/* ══════ 3. PRODUCT SPOTLIGHT ══════ */}
      <section className="bg-[#F8FAFB] py-10 sm:py-14">
        <div className="page-section">
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

            {/* Left: Featured products */}
            <div>
              <div className={cn("mb-5 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
                  <div className="h-6 w-[3px] rounded-full bg-[#0E7E74]" aria-hidden />
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0E7E74]">
                      {isRtl ? "الأكثر طلباً" : "Top picks"}
                    </p>
                    <h2 className="text-[17px] font-black text-[#0A1220]">
                      {isRtl ? "منتجات مميزة" : "Featured Products"}
                    </h2>
                  </div>
                </div>
                <Link to="/offers"
                  className={cn("inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black text-slate-600 shadow-sm transition-all hover:border-[#0E7E74]/30 hover:text-[#0E7E74]", isRtl && "flex-row-reverse")}>
                  {isRtl ? "كل العروض" : "All offers"}
                  <ArrowRight className={cn("h-3 w-3", isRtl && "rotate-180")} />
                </Link>
              </div>

              {featuredA.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {featuredA.map((product) => {
                    const name = getLocalizedProductName(product, lang);
                    const catLabel = isRtl ? product.categoryName : product.categoryNameEn;
                    return (
                      <Link key={product.id} to={`/products/${product.id}`}
                        className="group flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-[#0A1220]/[0.08] bg-white p-4 shadow-sm transition-all hover:border-[#0A1220]/25 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(10,18,32,0.09)]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate rounded-full bg-[#0E7E74]/10 px-2.5 py-0.5 text-[10px] font-black text-[#0E7E74]">
                            {catLabel ?? (isRtl ? "دواء" : "Product")}
                          </span>
                          <span className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black",
                            product.inStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400",
                          )}>
                            {isRtl ? (product.inStock ? "متاح" : "نفد") : (product.inStock ? "In stock" : "Out")}
                          </span>
                        </div>
                        <p className="line-clamp-2 flex-1 text-[13px] font-black leading-[1.45] text-[#0A1220] transition-colors group-hover:text-[#0E7E74]">
                          {name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-base font-black text-[#0A1220]">
                            {product.price.toFixed(2)}
                            <span className="ms-1 text-[11px] font-semibold text-slate-400">{isRtl ? "ج.م" : "EGP"}</span>
                          </span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0A1220] text-white opacity-0 transition-all group-hover:opacity-100">
                            <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white">
                  <PackageSearch className="h-8 w-8 text-slate-300" />
                </div>
              )}
            </div>

            {/* Right: Quick-link editorial cards */}
            <div className="flex flex-col gap-3">
              {[
                {
                  to: "/offers",
                  labelAr: "عروض",     labelEn: "Offers",
                  titleAr: "العروض الحالية",   titleEn: "Current Offers",
                  descAr:  "أحدث العروض من الكتالوج", descEn: "Latest deals from our catalog",
                  Icon: Star,
                },
                {
                  to: "/categories",
                  labelAr: "الأقسام",  labelEn: "Categories",
                  titleAr: "تصفح بالقسم المناسب", titleEn: "Browse by category",
                  descAr:  "ابدأ من القسم وانتقل للمنتج", descEn: "Start with a section, go to the item",
                  Icon: ShoppingBag,
                },
                {
                  to: "/products",
                  labelAr: "بحث فوري", labelEn: "Quick search",
                  titleAr: "ابحث بالاسم أو الكود", titleEn: "Search by name or code",
                  descAr:  "اكتب واحصل على النتيجة فورًا", descEn: "Type and get results instantly",
                  Icon: Zap,
                },
              ].map((b) => {
                const Icon = b.Icon;
                return (
                  <Link key={b.titleEn} to={b.to}
                    className={cn(
                      "group flex flex-1 flex-col justify-between gap-4 overflow-hidden rounded-2xl border-2 border-[#0A1220] bg-white p-5 transition-all duration-200 hover:bg-[#0A1220] hover:shadow-[0_12px_32px_rgba(10,18,32,0.22)]",
                    )}>
                    <div className={cn("flex items-start justify-between", isRtl && "flex-row-reverse")}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A1220] transition-colors group-hover:bg-white/[0.14]">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="rounded-full border border-[#0A1220]/15 bg-[#0A1220]/[0.05] px-2.5 py-0.5 text-[10px] font-black text-[#0A1220] transition-colors group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white">
                        {isRtl ? b.labelAr : b.labelEn}
                      </span>
                    </div>
                    <div className={cn(isRtl ? "text-right" : "text-left")}>
                      <p className="text-[14px] font-black leading-snug text-[#0A1220] transition-colors group-hover:text-white">
                        {isRtl ? b.titleAr : b.titleEn}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500 transition-colors group-hover:text-white/50">
                        {isRtl ? b.descAr : b.descEn}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* ══════ 4. PRODUCT CATALOG ══════ */}
      {featuredB.length > 0 && (
        <section className="bg-white py-10 sm:py-14">
          <div className="page-section">
            <Reveal direction="up">
              <div className={cn("mb-6 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0E7E74]">
                    {isRtl ? "مختارات من الكتالوج" : "Catalog picks"}
                  </p>
                  <h2
                    className="mt-1 text-2xl font-bold text-[#0A1220] sm:text-3xl"
                    style={isRtl ? undefined : { fontFamily: "var(--font-serif)" }}
                  >
                    {isRtl ? "منتجات متاحة الآن" : "Available Now"}
                  </h2>
                </div>
                <Link to="/products"
                  className={cn("inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0A1220] bg-white px-4 py-2 text-xs font-black text-[#0A1220] transition-all hover:bg-[#0A1220] hover:text-white", isRtl && "flex-row-reverse")}>
                  {isRtl ? "كل المنتجات" : "All products"}
                  <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                </Link>
              </div>
            </Reveal>
            <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <ProductGrid products={featuredB} />
            </div>
            {featuredC.length > 0 && (
              <Reveal direction="up" delay={60}>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                  <ProductGrid products={featuredC} />
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ══════ 5. STATS BAND ══════ */}
      <section className="bg-[#0A1220] py-14 sm:py-20">
        <div className="page-section">
          <Reveal direction="up">
            <div className={cn("mb-10 text-center")}>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                {isRtl ? "لماذا نحن" : "Why United Pharmacies"}
              </p>
              <h2
                className="mt-2 text-3xl font-bold text-white sm:text-4xl"
                style={isRtl ? undefined : { fontFamily: "var(--font-serif)" }}
              >
                {isRtl ? "الجودة والثقة أولاً" : "Quality & Trust, Always"}
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-px bg-white/[0.07] sm:grid-cols-4">
            {[
              { Icon: ShoppingBag, stat: "8,000+",  labelAr: "منتج متاح",      labelEn: "Products in stock",  descAr: "أدوية ومستلزمات", descEn: "Medicines & supplies" },
              { Icon: MapPin,      stat: "5",        labelAr: "فروع في القاهرة", labelEn: "Cairo branches",    descAr: "في أرجاء القاهرة", descEn: "Across Cairo"         },
              { Icon: ShieldCheck, stat: "100%",     labelAr: "أدوية أصلية",    labelEn: "Genuine meds",      descAr: "معتمدة ومضمونة",  descEn: "Certified & verified" },
              { Icon: Truck,       stat: "24h",      labelAr: "توصيل سريع",     labelEn: "Fast delivery",     descAr: "لباب البيت",      descEn: "Door-to-door"         },
            ].map(({ Icon, stat, labelAr, labelEn, descAr, descEn }, i) => (
              <Reveal key={labelEn} direction="up" delay={i * 80}>
                <div className="flex flex-col items-center bg-[#0A1220] py-10 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                    <Icon className="h-5 w-5 text-[#2DD4C0]" />
                  </div>
                  <p
                    className="text-4xl font-bold text-white sm:text-5xl"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >{stat}</p>
                  <p className="mt-2 text-[13px] font-black text-white/80">{isRtl ? labelAr : labelEn}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-white/35">{isRtl ? descAr : descEn}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ 6. TRUST CARDS + CTA ══════ */}
      <section className="bg-white py-12 sm:py-16">
        <div className="page-section">

          <Reveal direction="up">
            <div className="mb-8 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                {isRtl ? "ماذا نقدم" : "What we offer"}
              </p>
              <h2
                className="mt-2 text-2xl font-bold text-[#0A1220] sm:text-3xl"
                style={isRtl ? undefined : { fontFamily: "var(--font-serif)" }}
              >
                {isRtl ? "تجربة تسوق متكاملة" : "A Complete Pharmacy Experience"}
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { Icon: Truck,       stat: "24h",   titleAr: "توصيل سريع",   titleEn: "Fast Delivery",    descAr: "لباب البيت في القاهرة", descEn: "Door-to-door, Cairo"    },
              { Icon: ShieldCheck, stat: "100%",  titleAr: "أدوية أصلية", titleEn: "Genuine Meds",     descAr: "معتمدة ومضمونة",       descEn: "Certified & verified"   },
              { Icon: MapPin,      stat: "5",     titleAr: "فروع القاهرة", titleEn: "Cairo Branches",   descAr: "في أرجاء القاهرة",     descEn: "Across Cairo"           },
              { Icon: Clock3,      stat: "24/7",  titleAr: "دعم متواصل",  titleEn: "Always-on Support", descAr: serviceHours,            descEn: serviceHours             },
            ].map(({ Icon, stat, titleAr, titleEn, descAr, descEn }, i) => (
              <Reveal key={titleEn} direction="up" delay={i * 60}>
                <div className="group flex flex-col items-center overflow-hidden rounded-2xl border-2 border-[#0A1220] bg-white p-6 text-center transition-all duration-200 hover:bg-[#0A1220]">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A1220] transition-colors group-hover:bg-white/[0.14]">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p
                    className="text-3xl font-bold text-[#0A1220] transition-colors group-hover:text-white"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >{stat}</p>
                  <p className="mt-2 text-[12px] font-black text-[#0A1220] transition-colors group-hover:text-white">
                    {isRtl ? titleAr : titleEn}
                  </p>
                  <p className="mt-1 text-[10.5px] font-medium text-slate-400 transition-colors group-hover:text-white/40">
                    {isRtl ? descAr : descEn}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* CTA Banner */}
          <Reveal direction="up" delay={200}>
            <div className="relative mt-10 overflow-hidden rounded-3xl bg-[#0A1220] p-8 sm:p-12">
              {/* Subtle dot texture */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(ellipse 50% 70% at 80% 50%, rgba(14,126,116,0.18), transparent)" }}
              />
              <div className={cn("relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between", isRtl && "sm:flex-row-reverse")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <p
                    className="text-2xl font-bold text-white sm:text-3xl"
                    style={isRtl ? undefined : { fontFamily: "var(--font-serif)" }}
                  >
                    {isRtl ? "ابدأ التسوق الآن" : "Start Shopping Today"}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-white/40">
                    {isRtl
                      ? `${primaryLocation.fullNameAr} — ${primaryLocation.hoursAr}`
                      : `${primaryLocation.fullNameEn} — ${primaryLocation.hoursEn}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <Link to="/products"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-sm font-black text-[#0A1220] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(255,255,255,0.20)]">
                    {isRtl ? "تسوق الآن" : "Shop now"}
                    <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                  </Link>
                  <Link to="/contact"
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-7 text-sm font-black text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/[0.16]">
                    {isRtl ? "تواصل معنا" : "Contact us"}
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>

        </div>
      </section>

    </div>
  );
}
