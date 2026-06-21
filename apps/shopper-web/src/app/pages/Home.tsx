// Home.tsx – premium marketplace redesign
import { type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  Apple,
  ArrowRight,
  Baby,
  Brain,
  Clock3,
  Dumbbell,
  Eye,
  FlaskConical,
  Heart,
  LayoutGrid,
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

/* ─── Category icon pool (pharmacy-relevant) ────────────────── */
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


/* ─── Skeleton ──────────────────────────────────────────────── */
function HomeSkeleton() {
  return (
    <div className="home-page min-h-screen bg-white">
      <div className="border-b border-slate-100 bg-white py-10">
        <div className="page-section">
          <div className="mx-auto h-10 w-1/2 animate-pulse rounded-full bg-slate-100" />
          <div className="mx-auto mt-4 h-14 max-w-2xl animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
      <div className="border-b border-slate-100 bg-white py-6">
        <div className="page-section flex gap-6 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-shrink-0 flex-col items-center gap-2">
              <div className="h-16 w-16 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-3 w-14 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="py-8">
        <div className="page-section grid gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────── */
export default function Home() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <HomeMobile />;
  return <HomeDesktop />;
}

/* ─── Desktop view ──────────────────────────────────────────── */
function HomeDesktop() {
  const navigate   = useNavigate();
  const { lang }   = useLanguage();
  const { searchQuery, setSearchQuery, commitQuery, suggestions } = useSearch();
  const { categories, featuredProducts, isLoading, error } = useCatalog();
  const isRtl = lang === "ar";

  const isInitialLoading = isLoading && featuredProducts.length === 0;

  const categoryResults   = useCatalogCategorySearch(categories, searchQuery);
  const catSuggestions    = searchQuery.trim().length >= 2 ? categoryResults.slice(0, 3) : [];
  const prodSuggestions   = searchQuery.trim().length >= 2 ? suggestions.slice(0, 5) : [];

  const primaryLocation   = locations.find((l) => l.isPrimary) ?? locations[0];
  const categoryChips     = categories.slice(0, 11);
  const featuredA         = featuredProducts.slice(0, 4);
  const featuredB         = featuredProducts.slice(4, 12);
  const featuredC         = featuredProducts.slice(12, 24);
  const serviceHours      = getServiceHoursSentence(lang);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) { navigate("/products"); return; }
    commitQuery(q);
    navigate(`/products?search=${encodeURIComponent(q)}`);
  };

  /* Focus banners */
  const focusBanners = [
    {
      to: "/offers",
      labelAr: "مميز", labelEn: "Featured",
      titleAr: "العروض الحالية",         titleEn: "Current Offers",
      descAr:  "أحدث العروض من الكتالوج", descEn: "Latest deals from the catalog",
      from: "from-amber-400", via: "via-orange-500", to_color: "to-rose-500",
      Icon: Star,
    },
    {
      to: "/categories",
      labelAr: "الأقسام", labelEn: "Categories",
      titleAr: "تصفح بالقسم المناسب",   titleEn: "Browse by category",
      descAr:  "ابدأ من القسم وانتقل للمنتج", descEn: "Start from a section, jump to the item",
      from: "from-violet-500", via: "via-purple-600", to_color: "to-indigo-600",
      Icon: LayoutGrid,
    },
    {
      to: "/products",
      labelAr: "بحث فوري", labelEn: "Instant search",
      titleAr: "ابحث بالاسم أو الكود",  titleEn: "Search by name or code",
      descAr:  "اكتب واحصل على النتيجة فورًا", descEn: "Type and get results instantly",
      from: "from-teal-500", via: "via-cyan-500", to_color: "to-sky-600",
      Icon: Zap,
    },
  ];

  if (isInitialLoading) return <HomeSkeleton />;

  return (
    <div className="home-page overflow-x-hidden bg-white">

      {/* ══════ 1. HERO ══════ */}
      <section className="relative overflow-hidden">

        {/* ── Dark gradient backdrop ── */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950 via-teal-800 to-emerald-800" aria-hidden />

        {/* ── Ambient glow blobs (CSS-only, no JS) ── */}
        <div aria-hidden className="absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-teal-400/20 blur-3xl animate-pulse" />
        <div aria-hidden className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl animate-pulse [animation-delay:1.2s]" />
        <div aria-hidden className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/10 blur-3xl animate-pulse [animation-delay:0.6s]" />

        {/* ── Floating pharmacy icons (decorative, RTL-aware) ── */}
        <div aria-hidden className={cn("absolute top-10 opacity-20 animate-bounce [animation-duration:3.2s]", isRtl ? "left-[8%]" : "right-[8%]")}>
          <Pill className="h-8 w-8 text-teal-300" />
        </div>
        <div aria-hidden className={cn("absolute top-1/3 opacity-[0.13] animate-bounce [animation-duration:4.1s] [animation-delay:0.8s]", isRtl ? "right-[6%]" : "left-[6%]")}>
          <ShieldCheck className="h-10 w-10 text-emerald-300" />
        </div>
        <div aria-hidden className={cn("absolute bottom-1/3 opacity-[0.13] animate-bounce [animation-duration:3.7s] [animation-delay:1.5s]", isRtl ? "right-[12%]" : "left-[12%]")}>
          <Heart className="h-7 w-7 text-rose-300" />
        </div>
        <div aria-hidden className={cn("absolute top-16 opacity-[0.17] animate-pulse [animation-delay:2s]", isRtl ? "right-[22%]" : "left-[22%]")}>
          <Activity className="h-6 w-6 text-cyan-300" />
        </div>
        <div aria-hidden className={cn("absolute bottom-14 opacity-[0.12] animate-bounce [animation-duration:5s] [animation-delay:0.4s]", isRtl ? "left-[18%]" : "right-[18%]")}>
          <Stethoscope className="h-9 w-9 text-teal-200" />
        </div>

        {/* ── Geometric accent ring ── */}
        <div aria-hidden className="absolute right-[-6rem] top-[-6rem] h-[22rem] w-[22rem] rounded-full border border-white/5" />
        <div aria-hidden className="absolute right-[-3rem] top-[-3rem] h-[16rem] w-[16rem] rounded-full border border-white/5" />

        {/* ── Content ── */}
        <div className="page-section relative z-10 py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">

            {/* Headline */}
            <h1 className={cn(
              "mt-6 font-black text-white",
              isRtl
                ? "text-[2.2rem] leading-[1.28] sm:text-[3.4rem] sm:leading-[1.18]"
                : "text-[2.4rem] leading-[1.1] tracking-tight sm:text-[3.8rem] sm:leading-[1.06]",
            )}>
              {isRtl ? (
                <>دواؤك بكلمة واحدة<br /><span className="text-teal-300">8,000+ منتج دوائي</span></>
              ) : (
                <>Your medicine,<br /><span className="text-teal-300">one search away</span></>
              )}
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-[15px] font-semibold leading-8 text-teal-100/80 sm:text-[16px]">
              {isRtl ? (
                <>
                  <span className="font-black text-amber-300">مش لاقي دواك؟</span>
                  {" "}
                  <span className="font-black text-white">احنا معاك!</span>
                  {" ابحث عن اكتر من آلاف الأدوية عشان تساعدك في داءك — "}
                  <span className="italic text-teal-300">لكل داء دواء</span>
                </>
              ) : (
                <>
                  <span className="font-black text-amber-300">Can't find your medicine?</span>
                  {" "}
                  <span className="font-black text-white">We've got you!</span>
                  {" Search thousands of medicines — "}
                  <span className="italic text-teal-300">because every illness has a cure</span>
                </>
              )}
            </p>

            {/* Error banner */}
            {error && (
              <div className="mx-auto mt-4 max-w-lg rounded-xl border border-amber-400/40 bg-amber-500/20 px-4 py-2.5 text-sm font-bold text-amber-200 backdrop-blur-sm">
                {isRtl ? "تعذر تحديث الكتالوج — تُعرض آخر البيانات المتاحة." : "Catalog refresh issue — showing latest available data."}
              </div>
            )}

            {/* Search — glowing white card */}
            <form className="relative mx-auto mt-8 max-w-2xl" onSubmit={handleSearch}>
              <SearchBar
                value={searchQuery}
                onChange={(v) => { setSearchQuery(v); commitQuery(v); }}
                onClear={() => { setSearchQuery(""); commitQuery(""); }}
                placeholder={isRtl ? "ابحث بالاسم أو الكود أو القسم…" : "Search by name, code, or category…"}
                lang={lang}
                shellClassName="rounded-2xl border-white/20 bg-white shadow-[0_0_0_4px_rgba(20,184,166,0.30),0_24px_56px_rgba(0,0,0,0.35)]"
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
                className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-7 text-sm font-black text-teal-800 shadow-[0_8px_28px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.34)]">
                {isRtl ? "تصفح المنتجات" : "Browse Products"}
                <ArrowRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180 group-hover:translate-x-[-2px]")} />
              </Link>
              <Link to="/offers"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/25 bg-white/12 px-7 text-sm font-black text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:-translate-y-0.5">
                {isRtl ? "العروض الحالية" : "Current Offers"}
                <Sparkles className="h-4 w-4 text-amber-300" />
              </Link>
              <Link to="/categories"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/15 bg-transparent px-7 text-sm font-black text-white transition-all hover:border-white/30 hover:text-white">
                {isRtl ? "الأقسام" : "Categories"}
              </Link>
            </div>

            {/* Stats strip */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 border-t border-white/10 pt-8">
              {[
                { value: "8K+",   labelAr: "منتج متاح",         labelEn: "Products in stock"  },
                { value: "5",     labelAr: "فروع في القاهرة",   labelEn: "Cairo branches"     },
                { value: "100%",  labelAr: "أدوية أصلية",       labelEn: "Genuine medicines"  },
                { value: "🚚",    labelAr: "توصيل لباب البيت",  labelEn: "Door-to-door delivery" },
              ].map(({ value, labelAr, labelEn }) => (
                <div key={labelEn} className="flex flex-col items-center gap-0.5">
                  <span className="text-2xl font-black text-white">{value}</span>
                  <span className="text-[11px] font-semibold text-teal-200/70">
                    {isRtl ? labelAr : labelEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom wave: white fill so next section transitions seamlessly ── */}
        <div className="relative z-10 h-10 sm:h-14" aria-hidden>
          <svg
            viewBox="0 0 1440 56"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,56 L0,28 C180,56 360,0 540,28 C720,56 900,0 1080,28 C1260,56 1380,14 1440,28 L1440,56 Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* ══════ 2. CATEGORY GRID ══════ */}
      {categoryChips.length > 0 && (
        <section className="bg-[#F8FAFB] py-10 sm:py-14">
          <div className="page-section">
            {/* Header */}
            <div className={cn("mb-8 flex items-end justify-between gap-4", isRtl && "flex-row-reverse")}>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {isRtl ? "كتالوج المنتجات" : "Product Catalog"}
                </p>
                <h2 className="mt-1 text-xl font-black text-[#0A1220] sm:text-2xl">
                  {isRtl ? "تسوق حسب القسم" : "Shop by Category"}
                </h2>
              </div>
              <Link
                to="/categories"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-black text-slate-600 shadow-sm transition-all hover:border-[#0E7E74]/40 hover:text-[#0E7E74] hover:shadow-md",
                  isRtl && "flex-row-reverse",
                )}
              >
                {isRtl ? "كل الأقسام" : "All categories"}
                <ArrowRight className={cn("h-3 w-3", isRtl && "rotate-180")} />
              </Link>
            </div>

            {/* Rectangle category cards — white + bold black border, inverts on hover */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

              {/* "All" anchor — pre-filled dark navy */}
              <Link
                to="/products"
                className={cn(
                  "group flex h-[90px] items-center gap-4 rounded-2xl border-2 border-[#0A1220] bg-[#0A1220] px-5 transition-all duration-200 hover:border-[#0E7E74] hover:shadow-[0_8px_24px_rgba(10,18,32,0.22)]",
                  isRtl && "flex-row-reverse",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.12]">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-white">
                    {isRtl ? "الكل" : "All"}
                  </p>
                  <p className="mt-0.5 truncate text-[10.5px] font-medium text-white/45">
                    {isRtl ? "تصفح الجميع" : "Browse all"}
                  </p>
                </div>
                <ArrowRight className={cn("h-3.5 w-3.5 shrink-0 text-white/35 transition-transform duration-200 group-hover:translate-x-0.5", isRtl && "rotate-180")} />
              </Link>

              {categoryChips.map((cat, i) => {
                const IconComp = CAT_ICONS[i % CAT_ICONS.length];
                const label = isRtl ? cat.name : (cat.nameEn ?? cat.name);
                return (
                  <Link
                    key={cat.id}
                    to={`/products?category=${encodeURIComponent(cat.id)}`}
                    className={cn(
                      "group flex h-[90px] items-center gap-4 rounded-2xl border-2 border-[#0A1220] bg-white px-5 transition-all duration-200 hover:bg-[#0A1220] hover:shadow-[0_8px_24px_rgba(10,18,32,0.22)]",
                      isRtl && "flex-row-reverse",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A1220] transition-colors duration-200 group-hover:bg-white/[0.13]">
                      <IconComp className="h-5 w-5 text-white" />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[13px] font-black text-[#0A1220] transition-colors duration-200 group-hover:text-white">
                      {label}
                    </p>
                    <ArrowRight className={cn("h-3.5 w-3.5 shrink-0 text-[#0A1220]/25 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/45", isRtl && "rotate-180")} />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════ 3. PRODUCT SPOTLIGHT ══════ */}
      <section className="bg-slate-50/70 py-8 sm:py-10">
        <div className="page-section">
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

            {/* Left: Featured product cards */}
            <div>
              <div className={cn("mb-4 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div className={cn("flex items-center gap-2.5", isRtl && "flex-row-reverse")}>
                  <div className="h-5 w-1 rounded-full bg-teal-500" aria-hidden />
                  <h2 className="text-[15px] font-black text-slate-950">
                    {isRtl ? "منتجات مميزة" : "Featured Products"}
                  </h2>
                </div>
                <Link to="/offers"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm transition-colors hover:border-teal-200 hover:text-teal-700">
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
                        className="group flex flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-black text-teal-700">
                            {catLabel ?? (isRtl ? "دواء" : "Product")}
                          </span>
                          <span className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black",
                            product.inStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400",
                          )}>
                            {isRtl ? (product.inStock ? "متاح" : "نفد") : (product.inStock ? "In stock" : "Out")}
                          </span>
                        </div>
                        <p className="line-clamp-2 flex-1 text-[13px] font-black leading-[1.45] text-slate-900 transition-colors group-hover:text-teal-700">
                          {name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-base font-black text-slate-950">
                            {product.price.toFixed(2)}
                            <span className="ms-1 text-[11px] font-semibold text-slate-400">{isRtl ? "ج.م" : "EGP"}</span>
                          </span>
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500 text-white opacity-0 transition-all group-hover:opacity-100">
                            <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white">
                  <PackageSearch className="h-8 w-8 text-slate-300" />
                </div>
              )}
            </div>

            {/* Right: Action banners */}
            <div className="flex flex-col gap-3">
              {focusBanners.map((b) => {
                const Icon = b.Icon;
                return (
                  <Link key={b.to + b.titleEn} to={b.to}
                    className={cn(
                      "group relative flex min-h-[9rem] flex-1 flex-col justify-between overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.22)]",
                      `bg-gradient-to-br ${b.from} ${b.via} ${b.to_color}`,
                    )}>
                    {/* Layered decorative blobs */}
                    <div aria-hidden className="absolute -bottom-10 -end-10 h-40 w-40 rounded-full bg-white/10" />
                    <div aria-hidden className="absolute -top-6 end-10 h-20 w-20 rounded-full bg-white/[0.07]" />

                    {/* Label badge */}
                    <div className="relative z-10 inline-flex items-center gap-1.5 self-start rounded-full bg-white/25 px-3 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                      <Icon className="h-3 w-3" />
                      {isRtl ? b.labelAr : b.labelEn}
                    </div>

                    {/* Title + desc + CTA */}
                    <div className={cn("relative z-10", isRtl ? "text-right" : "text-left")}>
                      <p className="text-[15px] font-black leading-snug text-white">
                        {isRtl ? b.titleAr : b.titleEn}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-white/70">
                        {isRtl ? b.descAr : b.descEn}
                      </p>
                      <div className={cn(
                        "mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-black text-white transition-all group-hover:bg-white/30 group-hover:gap-2.5",
                        isRtl && "flex-row-reverse",
                      )}>
                        {isRtl ? "اكتشف الآن" : "Explore now"}
                        <ArrowRight className={cn("h-3 w-3", isRtl && "rotate-180")} />
                      </div>
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
        <section className="bg-white py-8 sm:py-10">
          <div className="page-section">
            <Reveal direction="up">
              <div className={cn("mb-6 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                    <Sparkles className="h-3 w-3" />
                    {isRtl ? "مختارات من الكتالوج" : "Catalog picks"}
                  </div>
                  <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
                    {isRtl ? "منتجات متاحة الآن" : "Available now"}
                  </h2>
                </div>
                <Link to="/products"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700">
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

      {/* ══════ 5. CATEGORY TILES (dark) ══════ */}
      {categories.length > 0 && (
        <section className="bg-slate-950 py-10 sm:py-14">
          <div className="page-section">
            <Reveal direction="up">
              <div className={cn("mb-7 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-400">
                    {isRtl ? "تصفح حسب القسم" : "Browse by category"}
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                    {isRtl ? "ابدأ من القسم الصح" : "Start from the right section"}
                  </h2>
                </div>
                <Link to="/categories"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white transition-all hover:bg-white/20">
                  {isRtl ? "كل الأقسام" : "All categories"}
                  <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                </Link>
              </div>
            </Reveal>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.slice(0, 8).map((cat, i) => {
                const gradient = CAT_GRADIENTS[i % CAT_GRADIENTS.length];
                const IconComp = CAT_ICONS[i % CAT_ICONS.length];
                const label    = isRtl ? cat.name : (cat.nameEn ?? cat.name);
                return (
                  <Reveal key={cat.id} direction="up" delay={i * 35}>
                    <Link to={`/categories/${cat.id}`}
                      className={cn(
                        "group relative flex min-h-[9rem] flex-col justify-between overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.40)]",
                        `bg-gradient-to-br ${gradient}`,
                      )}>
                      <div aria-hidden className="absolute inset-0 bg-black/0 transition-all group-hover:bg-black/10" />
                      <IconComp className="relative z-10 h-8 w-8 text-white drop-shadow" />
                      <div className="relative z-10">
                        <p className={cn("text-sm font-black text-white", isRtl && "text-right")}>{label}</p>
                        <div className={cn("mt-1.5 inline-flex items-center gap-1 text-[11px] font-black text-white transition-all group-hover:gap-2", isRtl && "flex-row-reverse")}> 
                          {isRtl ? "افتح القسم" : "Open section"}
                          <ArrowRight className={cn("h-3 w-3", isRtl && "rotate-180")} />
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════ 6. TRUST + CTA ══════ */}
      <section className="bg-white py-10 sm:py-16">
        <div className="page-section">

          {/* Section heading */}
          <div className="mb-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              {isRtl ? "لماذا تختارنا" : "Why choose us"}
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
              {isRtl ? "الجودة والثقة أولاً" : "Quality & trust, always"}
            </h2>
          </div>

          {/* Centered portrait cards */}
          <div className="mx-auto max-w-[660px]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[
                {
                  Icon: Truck,       stat: "24h",
                  titleAr: "توصيل سريع",    titleEn: "Fast Delivery",
                  descAr:  "لباب البيت في القاهرة", descEn: "Door-to-door, Cairo",
                  bar: "bg-teal-500",    iconBg: "bg-teal-50",     iconC: "text-teal-600",    statC: "text-teal-600",
                  border: "border-teal-100 hover:border-teal-300",
                  dotBg: "bg-teal-500/15",
                },
                {
                  Icon: ShieldCheck, stat: "100%",
                  titleAr: "أدوية أصلية",  titleEn: "Genuine Meds",
                  descAr:  "معتمدة ومضمونة",        descEn: "Certified & verified",
                  bar: "bg-emerald-500", iconBg: "bg-emerald-50",  iconC: "text-emerald-600", statC: "text-emerald-600",
                  border: "border-emerald-100 hover:border-emerald-300",
                  dotBg: "bg-emerald-500/15",
                },
                {
                  Icon: MapPin,      stat: "5",
                  titleAr: "فروع بالقاهرة", titleEn: "Cairo Branches",
                  descAr:  "في أرجاء القاهرة",      descEn: "Across Cairo",
                  bar: "bg-violet-500",  iconBg: "bg-violet-50",   iconC: "text-violet-600",  statC: "text-violet-600",
                  border: "border-violet-100 hover:border-violet-300",
                  dotBg: "bg-violet-500/15",
                },
                {
                  Icon: Clock3,      stat: "24/7",
                  titleAr: "دعم متواصل",   titleEn: "Always-on Support",
                  descAr:  serviceHours,              descEn: serviceHours,
                  bar: "bg-amber-500",   iconBg: "bg-amber-50",    iconC: "text-amber-600",   statC: "text-amber-600",
                  border: "border-amber-100 hover:border-amber-300",
                  dotBg: "bg-amber-500/15",
                },
              ].map(({ Icon, stat, titleAr, titleEn, descAr, descEn, bar, iconBg, iconC, statC, border, dotBg }, i) => (
                <Reveal key={titleEn} direction="up" delay={i * 60}>
                  <div className={cn(
                    "group relative flex min-h-[230px] flex-col items-center overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.10)]",
                    border,
                  )}>
                    {/* Top accent bar */}
                    <div className={cn("h-[3px] w-full", bar)} aria-hidden />

                    {/* Decorative glow blob */}
                    <div className={cn("absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl", dotBg)} aria-hidden />

                    <div className="flex flex-1 flex-col items-center justify-between gap-0 px-4 py-5 text-center">

                      {/* Icon bubble */}
                      <div className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
                        iconBg,
                      )}>
                        <Icon className={cn("h-7 w-7", iconC)} />
                      </div>

                      {/* Stat + divider + labels */}
                      <div className="flex flex-col items-center gap-1">
                        <p className={cn("text-[2.1rem] font-black leading-none tabular-nums", statC)}>
                          {stat}
                        </p>
                        <div className={cn("my-1.5 h-px w-7 rounded-full opacity-50", bar)} aria-hidden />
                        <p className="text-[11px] font-black leading-tight text-slate-900">
                          {isRtl ? titleAr : titleEn}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold leading-[1.45] text-slate-400">
                          {isRtl ? descAr : descEn}
                        </p>
                      </div>

                    </div>

                    {/* Bottom accent bar */}
                    <div className={cn("h-[2px] w-full opacity-30", bar)} aria-hidden />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

        </div>
        <div className="page-section mt-10">

          <Reveal direction="up" delay={200}>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 p-8 shadow-[0_24px_64px_rgba(20,184,166,0.22)] sm:p-12">
              <div aria-hidden className="absolute -end-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
              <div aria-hidden className="absolute -bottom-16 -start-16 h-56 w-56 rounded-full bg-black/10" />
              <div className={cn("relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between", isRtl && "sm:flex-row-reverse")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <p className="text-2xl font-black text-white sm:text-3xl">
                    {isRtl ? "ابدأ التسوق الآن" : "Start shopping now"}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-white/70">
                    {isRtl
                      ? `${primaryLocation.fullNameAr} — ${primaryLocation.hoursAr}`
                      : `${primaryLocation.fullNameEn} — ${primaryLocation.hoursEn}`}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-3">
                  <Link to="/products"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-sm font-black text-teal-700 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-teal-50">
                    {isRtl ? "تسوق الآن" : "Shop now"}
                    <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                  </Link>
                  <Link to="/contact"
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-7 text-sm font-black text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/25">
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
