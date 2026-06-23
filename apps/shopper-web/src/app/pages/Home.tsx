// Home.tsx — luxury editorial redesign with animations
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Apple, ArrowRight, Baby, Brain,
  ChevronLeft, ChevronRight,
  Clock3, Dumbbell, Eye, FlaskConical, Heart,
  Leaf, MapPin, PackageSearch, Pill, ShieldCheck,
  ShoppingBag, Sparkles, Star, Stethoscope,
  Thermometer, Truck, Zap,
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

/* ─── icon pool ───────────────────────────────────────── */
const CAT_ICONS = [
  Pill, Activity, Baby, Sparkles, Stethoscope,
  FlaskConical, Thermometer, Eye, Leaf, Apple,
  Dumbbell, Brain, ShieldCheck, Star, Zap, Heart,
];

/* ─── skeleton ────────────────────────────────────────── */
function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-[#0A1220]">
      <div className="page-section flex min-h-[80vh] flex-col items-center justify-center gap-6 py-20 text-center">
        <div className="h-5 w-44 animate-pulse rounded-full bg-white/10" />
        <div className="h-20 w-3/4 max-w-2xl animate-pulse rounded-2xl bg-white/10" />
        <div className="h-14 w-full max-w-xl animate-pulse rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

/* ─── main ────────────────────────────────────────────── */
export default function Home() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <HomeMobile />;
  return <HomeDesktop />;
}

/* ─── desktop ─────────────────────────────────────────── */
function HomeDesktop() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { searchQuery, setSearchQuery, commitQuery, suggestions } = useSearch();
  const { categories, featuredProducts, isLoading, error } = useCatalog();
  const isRtl = lang === "ar";

  const [catSlide, setCatSlide]   = useState(0);
  const [animKey,  setAnimKey]    = useState(0);
  const [slideDir, setSlideDir]   = useState<"fwd" | "back">("fwd");

  const isInitialLoading = isLoading && featuredProducts.length === 0;

  const categoryResults = useCatalogCategorySearch(categories, searchQuery);
  const catSuggestions  = searchQuery.trim().length >= 2 ? categoryResults.slice(0, 3) : [];
  const prodSuggestions = searchQuery.trim().length >= 2 ? suggestions.slice(0, 5) : [];

  const primaryLocation = locations.find((l) => l.isPrimary) ?? locations[0];
  const categoryChips   = categories.slice(0, 14);
  const featuredA       = featuredProducts.slice(0, 4);
  const featuredB       = featuredProducts.slice(4, 12);
  const featuredC       = featuredProducts.slice(12, 24);
  const serviceHours    = getServiceHoursSentence(lang);

  /* carousel — "All" slot + categories, 3 per page, infinite wrap */
  const carouselItems = [null, ...categoryChips] as (typeof categoryChips[number] | null)[];
  const totalSlides   = Math.ceil(carouselItems.length / 3);

  const goPrev = () => {
    setSlideDir(isRtl ? "fwd" : "back");
    setCatSlide((s) => (s - 1 + totalSlides) % totalSlides);
    setAnimKey((k) => k + 1);
  };
  const goNext = () => {
    setSlideDir(isRtl ? "back" : "fwd");
    setCatSlide((s) => (s + 1) % totalSlides);
    setAnimKey((k) => k + 1);
  };
  const visible = [0, 1, 2].map((i) => carouselItems[(catSlide * 3 + i) % carouselItems.length]);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) { navigate("/products"); return; }
    commitQuery(q);
    navigate(`/products?search=${encodeURIComponent(q)}`);
  };

  if (isInitialLoading) return <HomeSkeleton />;

  /* ── Suggestion dropdown ── */
  const searchDropdown =
    prodSuggestions.length > 0 || catSuggestions.length > 0 ? (
      <div className="absolute inset-x-0 top-[calc(100%+0.6rem)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_56px_rgba(15,23,42,0.18)] text-start">
        {prodSuggestions.length > 0 && (
          <div className="p-2">
            <p className="px-3 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {isRtl ? "منتجات" : "Products"}
            </p>
            {prodSuggestions.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`}
                className={cn("flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50", isRtl && "flex-row-reverse")}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{getLocalizedProductName(p, lang)}</p>
                  <p className="text-xs font-semibold text-slate-400">{lang === "ar" ? p.categoryName : p.categoryNameEn}</p>
                </div>
                <span className="shrink-0 text-xs font-black text-slate-400">{p.price.toFixed(2)} {isRtl ? "ج.م" : "EGP"}</span>
              </Link>
            ))}
          </div>
        )}
        {catSuggestions.length > 0 && (
          <div className={cn("p-2", prodSuggestions.length > 0 && "border-t border-slate-100")}>
            <p className="px-3 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {isRtl ? "أقسام" : "Categories"}
            </p>
            {catSuggestions.map((c) => (
              <Link key={c.id}
                to={`/products?category=${encodeURIComponent(c.id)}${searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : ""}`}
                className={cn("flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50", isRtl && "flex-row-reverse")}>
                <div>
                  <p className="text-sm font-black text-slate-900">{isRtl ? c.name : c.nameEn}</p>
                  <p className="text-xs font-semibold text-slate-400">{isRtl ? "قسم" : "Category"}</p>
                </div>
                <ArrowRight className={cn("h-4 w-4 text-slate-300", isRtl && "rotate-180")} />
              </Link>
            ))}
          </div>
        )}
      </div>
    ) : null;

  return (
    <div className="home-page overflow-x-hidden">

      {/* ══════════════════════════════════════════
          1. HERO — powerful light mode
      ══════════════════════════════════════════ */}
      {/* NO overflow-hidden on section — keeps search dropdown visible above stats */}
      <section className="relative flex min-h-[94vh] flex-col items-center justify-center bg-white">

        {/* Decorative layer — overflow-hidden isolated so dropdown can escape */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* dot-grid texture */}
          <div className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(10,18,32,0.05) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }} />
          {/* top-right teal bloom */}
          <div className="absolute -top-48 -right-48 h-[550px] w-[550px] rounded-full bg-[#0E7E74]/[0.10] blur-3xl" />
          {/* bottom-left accent */}
          <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[#0E7E74]/[0.07] blur-3xl" />
          {/* center soft glow */}
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0E7E74]/[0.03] blur-3xl" />
        </div>

        {/* Content — z-20 so search dropdown stacks above stats */}
        <div className="page-section relative z-20 w-full py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">

            {/* Eyebrow pill */}
            <div className="animate-hero-text" style={{ animationDelay: "0ms" }}>
              <span className={cn(
                "inline-flex items-center gap-2.5 rounded-full border border-[#0E7E74]/25 bg-[#0E7E74]/[0.06] px-5 py-2",
                isRtl && "flex-row-reverse",
              )}>
                <span className="h-2 w-2 rounded-full bg-[#0E7E74] shadow-[0_0_10px_rgba(14,126,116,0.7)]" aria-hidden />
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                  {isRtl ? "لكل داء دواء — صيدليات المتحدة" : "For Every Disease, A Cure — United"}
                </span>
              </span>
            </div>

            {/* Heading */}
            {isRtl ? (
              <h1
                className="animate-hero-text mt-6 font-black text-[#0A1220]"
                style={{
                  animationDelay: "120ms",
                  fontSize: "clamp(2.6rem, 6vw, 4.4rem)",
                  lineHeight: 1.25,
                  direction: "rtl",
                }}
              >
                مش لاقي دواك؟{" "}
                <span className="text-[#0E7E74]">احنا معاك!</span>
              </h1>
            ) : (
              <h1
                className="animate-hero-text mt-6 font-bold text-[#0A1220]"
                style={{
                  animationDelay: "120ms",
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(3.2rem, 7vw, 6rem)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                }}
              >
                Can't find<br />
                your medicine?{" "}
                <em className="not-italic text-[#0E7E74]">We've got you.</em>
              </h1>
            )}

            {/* Subtext */}
            <p
              className="animate-hero-text mx-auto mt-5 text-[15px] font-medium leading-[1.85] text-[#0A1220]/55"
              style={{ animationDelay: "240ms", maxWidth: "34rem" }}
            >
              {isRtl
                ? "ابحث عن اكتر من آلاف الأدوية عشان تساعدك في داءك"
                : "Search over thousands of medicines and health essentials to help with your condition."}
            </p>

            {/* Error banner */}
            {error && (
              <div className="animate-hero-text mx-auto mt-4 max-w-lg rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700"
                style={{ animationDelay: "280ms" }}>
                {isRtl ? "تعذر تحديث الكتالوج — تُعرض آخر البيانات المتاحة." : "Catalog refresh issue — showing last available data."}
              </div>
            )}

            {/* Search — z-30 so dropdown floats above everything below */}
            <form
              className="animate-hero-text relative z-30 mx-auto mt-8 max-w-2xl"
              style={{ animationDelay: "320ms" }}
              onSubmit={handleSearch}
            >
              <SearchBar
                value={searchQuery}
                onChange={(v) => { setSearchQuery(v); commitQuery(v); }}
                onClear={() => { setSearchQuery(""); commitQuery(""); }}
                placeholder={isRtl ? "ابحث بالاسم أو الكود أو القسم…" : "Search by name, code, or category…"}
                lang={lang}
                shellClassName="h-14 rounded-2xl border-[#0A1220]/12 bg-white shadow-[0_0_0_3px_rgba(14,126,116,0.16),0_20px_52px_rgba(10,18,32,0.13)]"
                suggestions={searchDropdown}
              />
            </form>

            {/* CTAs */}
            <div
              className="animate-hero-text mt-6 flex flex-wrap items-center justify-center gap-3"
              style={{ animationDelay: "420ms" }}
            >
              <Link to="/products"
                className={cn(
                  "group inline-flex h-12 items-center gap-2.5 rounded-2xl bg-[#0A1220] px-8 text-[13px] font-black text-white shadow-[0_8px_28px_rgba(10,18,32,0.30)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0E1929] hover:shadow-[0_14px_36px_rgba(10,18,32,0.40)]",
                  isRtl && "flex-row-reverse",
                )}>
                {isRtl ? "تصفح المنتجات" : "Browse Products"}
                <ArrowRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180 group-hover:-translate-x-0.5")} />
              </Link>
              <Link to="/offers"
                className={cn("group inline-flex h-12 items-center gap-2 rounded-2xl border-2 border-[#0A1220] bg-white px-7 text-[13px] font-black transition-all duration-200 hover:bg-[#0A1220] hover:-translate-y-0.5", isRtl && "flex-row-reverse")}>
                <span className="text-[#0A1220] transition-colors duration-200 group-hover:text-white">
                  {isRtl ? "العروض الحالية" : "Current Offers"}
                </span>
                <Sparkles className="h-4 w-4 text-[#0E7E74] transition-colors duration-200 group-hover:text-white" />
              </Link>
            </div>

            {/* Stats row — z-10 stays below search dropdown */}
            <div
              className="animate-hero-text relative z-10 mt-12 border-t border-[#0A1220]/[0.07] pt-9"
              style={{ animationDelay: "540ms" }}
            >
              <div className={cn("flex items-center justify-center divide-x divide-[#0A1220]/[0.07]", isRtl && "divide-x-reverse flex-row-reverse")}>
                {[
                  { value: "8,000+", labelAr: "منتج متاح",    labelEn: "Products"  },
                  { value: "5",      labelAr: "فروع القاهرة", labelEn: "Branches"  },
                  { value: "100%",   labelAr: "أدوية أصلية",  labelEn: "Genuine"   },
                  { value: "24h",    labelAr: "توصيل سريع",   labelEn: "Delivery"  },
                ].map(({ value, labelAr, labelEn }) => (
                  <div key={labelEn} className="flex flex-1 flex-col items-center gap-1.5 px-3 sm:px-5">
                    <span
                      className="text-[1.75rem] font-bold leading-none text-[#0A1220] sm:text-[2.2rem]"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >{value}</span>
                    <span className="text-[9.5px] font-black uppercase tracking-[0.16em] text-[#0A1220]/40">
                      {isRtl ? labelAr : labelEn}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════
          2. CATEGORY CAROUSEL
      ══════════════════════════════════════════ */}
      {categoryChips.length > 0 && (
        <section className="bg-white py-16 sm:py-20">
          <div className="page-section">

            {/* Header row */}
            <Reveal direction="up">
              <div className={cn("mb-10 flex items-end justify-between gap-4", isRtl && "flex-row-reverse")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                    {isRtl ? "كتالوج المنتجات" : "Product Catalog"}
                  </p>
                  <h2
                    className="mt-2 font-bold text-[#0A1220]"
                    style={{
                      fontSize: "clamp(1.7rem, 3.5vw, 2.8rem)",
                      lineHeight: 1.1,
                      ...(isRtl ? {} : { fontFamily: "var(--font-serif)" }),
                    }}
                  >
                    {isRtl ? "تسوق حسب القسم" : "Shop by Category"}
                  </h2>
                </div>

                {/* Controls */}
                <div className={cn("flex shrink-0 items-center gap-3", isRtl && "flex-row-reverse")}>
                  <span className="text-[12px] font-black tabular-nums text-slate-400">
                    {catSlide + 1} <span className="text-slate-200">/</span> {totalSlides}
                  </span>
                  <motion.button
                    type="button" onClick={goPrev} aria-label={isRtl ? "التالي" : "Previous"}
                    whileHover={{ scale: 1.08, boxShadow: "0 8px 24px rgba(14,126,116,0.45)" }}
                    whileTap={{ scale: 0.84 }}
                    transition={{ type: "spring", stiffness: 420, damping: 18 }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#0E7E74] bg-[#0E7E74] text-white shadow-[0_4px_14px_rgba(14,126,116,0.30)]">
                    <ChevronLeft className={cn("h-4 w-4", isRtl && "rotate-180")} />
                  </motion.button>
                  <motion.button
                    type="button" onClick={goNext} aria-label={isRtl ? "السابق" : "Next"}
                    whileHover={{ scale: 1.08, boxShadow: "0 8px 24px rgba(14,126,116,0.45)" }}
                    whileTap={{ scale: 0.84 }}
                    transition={{ type: "spring", stiffness: 420, damping: 18 }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#0E7E74] bg-[#0E7E74] text-white shadow-[0_4px_14px_rgba(14,126,116,0.30)]">
                    <ChevronRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                  </motion.button>
                </div>
              </div>
            </Reveal>

            {/* Cards — overflow-x:clip clips the horizontal slide without touching y-axis,
                so hover:-translate-y-1 on cards is never clipped */}
            <div style={{ overflowX: "clip" }}>
              <AnimatePresence mode="popLayout" custom={slideDir}>
                <motion.div
                  key={animKey}
                  custom={slideDir}
                  variants={{
                    enter: (dir: "fwd" | "back") => ({
                      x: dir === "fwd" ? 80 : -80,
                      opacity: 0,
                    }),
                    center: {
                      x: 0,
                      opacity: 1,
                      transition: {
                        x:             { type: "spring", stiffness: 320, damping: 32 },
                        opacity:       { duration: 0.18 },
                        staggerChildren: 0.07,
                        delayChildren:   0.06,
                      },
                    },
                    exit: (dir: "fwd" | "back") => ({
                      x: dir === "fwd" ? -80 : 80,
                      opacity: 0,
                      transition: {
                        x:       { type: "spring", stiffness: 400, damping: 38 },
                        opacity: { duration: 0.14 },
                      },
                    }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="grid grid-cols-3 gap-4"
                >
                  {visible.map((cat, i) => {
                    if (cat === null) {
                      return (
                        <motion.div
                          key="all"
                          variants={{
                            enter:  { opacity: 0, y: 14, scale: 0.96 },
                            center: { opacity: 1, y: 0,  scale: 1,
                              transition: { type: "spring", stiffness: 380, damping: 26 } },
                            exit:   { opacity: 0, y: -8, scale: 0.97,
                              transition: { duration: 0.14 } },
                          }}
                        >
                          <Link to="/products"
                            className={cn(
                              "group flex h-[120px] items-center gap-5 overflow-hidden rounded-2xl border-2 border-[#0A1220] bg-[#0A1220] px-7 shadow-[0_6px_24px_rgba(10,18,32,0.18)] transition-all duration-200 hover:border-[#0E7E74] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(10,18,32,0.28)]",
                              isRtl && "flex-row-reverse",
                            )}>
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.10]">
                              <ShoppingBag className="h-5 w-5 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[16px] font-black text-white">
                                {isRtl ? "الكل" : "All"}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] font-semibold text-white/55">
                                {isRtl ? "تصفح جميع المنتجات" : "Browse everything"}
                              </p>
                            </div>
                            <ArrowRight className={cn("h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180")} />
                          </Link>
                        </motion.div>
                      );
                    }

                    const catIdx = categoryChips.findIndex((c) => c.id === cat.id);
                    const Icon   = CAT_ICONS[catIdx % CAT_ICONS.length];
                    const label  = isRtl ? cat.name : (cat.nameEn ?? cat.name);

                    return (
                      <motion.div
                        key={cat.id + "-" + i}
                        variants={{
                          enter:  { opacity: 0, scale: 0.97 },
                          center: { opacity: 1, scale: 1,
                            transition: { type: "spring", stiffness: 380, damping: 26 } },
                          exit:   { opacity: 0, scale: 0.97,
                            transition: { duration: 0.14 } },
                        }}
                      >
                        <Link
                          to={`/products?category=${encodeURIComponent(cat.id)}`}
                          className={cn(
                            "group flex h-[120px] items-center gap-5 overflow-hidden rounded-2xl border-2 border-[#0A1220] bg-white px-7 shadow-[0_4px_16px_rgba(10,18,32,0.06)] transition-all duration-200 hover:bg-[#0A1220] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(10,18,32,0.22)]",
                            isRtl && "flex-row-reverse",
                          )}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0A1220] transition-colors duration-200 group-hover:bg-white/[0.12]">
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <p className="min-w-0 flex-1 truncate text-[16px] font-black text-[#0A1220] transition-colors duration-200 group-hover:text-white">
                            {label}
                          </p>
                          <ArrowRight className={cn("h-4 w-4 shrink-0 text-[#0A1220]/20 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/50", isRtl && "rotate-180")} />
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Dot indicators */}
            <div className="mt-7 flex items-center justify-center gap-2">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSlideDir(i > catSlide ? (isRtl ? "back" : "fwd") : (isRtl ? "fwd" : "back"));
                    setCatSlide(i);
                    setAnimKey((k) => k + 1);
                  }}
                  aria-label={`Slide ${i + 1}`}
                  className={cn(
                    "h-[5px] rounded-full transition-all duration-300",
                    i === catSlide
                      ? "w-7 bg-[#0A1220]"
                      : "w-[5px] bg-slate-200 hover:bg-slate-400",
                  )}
                />
              ))}
            </div>

            {/* View all link */}
            <div className="mt-6 flex justify-center">
              <Link to="/categories"
                className={cn("inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-[#0A1220]", isRtl && "flex-row-reverse")}>
                {isRtl ? "عرض كل الأقسام" : "View all categories"}
                <ArrowRight className={cn("h-3 w-3", isRtl && "rotate-180")} />
              </Link>
            </div>

          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════
          3. PRODUCT SPOTLIGHT
      ══════════════════════════════════════════ */}
      <section className="bg-[#F7F9FB] py-14 sm:py-20">
        <div className="page-section">
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">

            {/* Featured products */}
            <div>
              <Reveal direction="up">
                <div className={cn("mb-6 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-3", isRtl && "flex-row-reverse")}>
                    <span className="h-7 w-[3px] rounded-full bg-[#0E7E74]" aria-hidden />
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0E7E74]">
                        {isRtl ? "الأكثر طلباً" : "Top picks"}
                      </p>
                      <h2 className="text-[18px] font-black text-[#0A1220]">
                        {isRtl ? "منتجات مميزة" : "Featured Products"}
                      </h2>
                    </div>
                  </div>
                  <Link to="/offers"
                    className={cn("inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black text-slate-600 shadow-sm transition-all hover:border-[#0E7E74]/40 hover:text-[#0E7E74]", isRtl && "flex-row-reverse")}>
                    {isRtl ? "كل العروض" : "All offers"}
                    <ArrowRight className={cn("h-3 w-3", isRtl && "rotate-180")} />
                  </Link>
                </div>
              </Reveal>

              {featuredA.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {featuredA.map((product, idx) => {
                    const name     = getLocalizedProductName(product, lang);
                    const catLabel = isRtl ? product.categoryName : product.categoryNameEn;
                    return (
                      <Reveal key={product.id} direction="up" delay={idx * 60}>
                        <Link to={`/products/${product.id}`}
                          className="group flex h-full flex-col gap-3 overflow-hidden rounded-2xl border-2 border-transparent bg-white p-4 shadow-sm transition-all duration-200 hover:border-[#0A1220]/12 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(10,18,32,0.10)]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate rounded-full bg-[#0E7E74]/[0.09] px-2.5 py-0.5 text-[10px] font-black text-[#0E7E74]">
                              {catLabel ?? (isRtl ? "دواء" : "Product")}
                            </span>
                            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black",
                              product.inStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                              {isRtl ? (product.inStock ? "متاح" : "نفد") : (product.inStock ? "In stock" : "Out")}
                            </span>
                          </div>
                          <p className="line-clamp-2 flex-1 text-[13px] font-black leading-[1.5] text-[#0A1220] transition-colors group-hover:text-[#0E7E74]">
                            {name}
                          </p>
                          <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                            <span className="text-[15px] font-black text-[#0A1220]">
                              {product.price.toFixed(2)}
                              <span className="ms-1 text-[11px] font-semibold text-slate-400">{isRtl ? "ج.م" : "EGP"}</span>
                            </span>
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0A1220] text-white opacity-0 transition-all duration-200 group-hover:opacity-100">
                              <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                            </div>
                          </div>
                        </Link>
                      </Reveal>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white">
                  <PackageSearch className="h-8 w-8 text-slate-300" />
                </div>
              )}
            </div>

            {/* Editorial link cards */}
            <div className="flex flex-col gap-3">
              {[
                { to: "/offers",     Icon: Star,        labelAr: "عروض",     labelEn: "Offers",
                  titleAr: "العروض الحالية",        titleEn: "Current Offers",
                  descAr:  "أحدث العروض من الكتالوج", descEn: "Latest deals from our catalog" },
                { to: "/categories", Icon: ShoppingBag, labelAr: "أقسام",    labelEn: "Categories",
                  titleAr: "تصفح بالقسم المناسب",   titleEn: "Browse by category",
                  descAr:  "ابدأ من القسم وانتقل للمنتج", descEn: "Jump straight to what you need" },
                { to: "/products",   Icon: Zap,         labelAr: "بحث فوري", labelEn: "Quick search",
                  titleAr: "ابحث بالاسم أو الكود",  titleEn: "Search by name or code",
                  descAr:  "اكتب واحصل على النتيجة فورًا", descEn: "Type and get instant results" },
              ].map((b, i) => {
                const Icon = b.Icon;
                return (
                  <Reveal key={b.titleEn} direction="left" delay={i * 80}>
                    <Link to={b.to}
                      className="group flex flex-1 flex-col gap-4 overflow-hidden rounded-2xl border-2 border-[#0A1220] bg-white p-5 transition-all duration-200 hover:bg-[#0A1220] hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(10,18,32,0.24)]">
                      <div className={cn("flex items-start justify-between", isRtl && "flex-row-reverse")}>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A1220] transition-colors group-hover:bg-white/[0.12]">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <span className="rounded-full border border-[#0A1220]/12 bg-[#0A1220]/[0.05] px-2.5 py-0.5 text-[10px] font-black text-[#0A1220] transition-colors group-hover:border-white/20 group-hover:bg-white/10 group-hover:text-white">
                          {isRtl ? b.labelAr : b.labelEn}
                        </span>
                      </div>
                      <div className={isRtl ? "text-right" : "text-left"}>
                        <p className="text-[14px] font-black leading-snug text-[#0A1220] transition-colors group-hover:text-white">
                          {isRtl ? b.titleAr : b.titleEn}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-slate-500 transition-colors group-hover:text-white/55">
                          {isRtl ? b.descAr : b.descEn}
                        </p>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>

          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════
          4. PRODUCT CATALOG
      ══════════════════════════════════════════ */}
      {featuredB.length > 0 && (
        <section className="bg-white py-14 sm:py-20">
          <div className="page-section">
            <Reveal direction="up">
              <div className={cn("mb-8 flex items-center justify-between", isRtl && "flex-row-reverse")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <p className="text-[10.5px] font-black uppercase tracking-[0.2em] text-[#0E7E74]">
                    {isRtl ? "مختارات من الكتالوج" : "Catalog picks"}
                  </p>
                  <h2
                    className="mt-2 font-bold text-[#0A1220]"
                    style={{
                      fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                      lineHeight: 1.1,
                      ...(isRtl ? {} : { fontFamily: "var(--font-serif)" }),
                    }}
                  >
                    {isRtl ? "منتجات متاحة الآن" : "Available Now"}
                  </h2>
                </div>
                <Link to="/products"
                  className={cn("inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0A1220] bg-white px-5 py-2.5 text-[12px] font-black text-[#0A1220] transition-all duration-200 hover:bg-[#0A1220] hover:text-white", isRtl && "flex-row-reverse")}>
                  {isRtl ? "كل المنتجات" : "All products"}
                  <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                </Link>
              </div>
            </Reveal>

            <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <ProductGrid products={featuredB} />
            </div>
            {featuredC.length > 0 && (
              <Reveal direction="up" delay={80}>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                  <ProductGrid products={featuredC} />
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════
          5. STATS BAND — dark navy editorial
      ══════════════════════════════════════════ */}
      <section className="bg-[#0A1220] py-16 sm:py-24">
        <div className="page-section">

          <Reveal direction="up">
            <div className="mb-12 text-center">
              <p className="text-[10.5px] font-black uppercase tracking-[0.24em] text-[#0E7E74]">
                {isRtl ? "لماذا نحن" : "Why United Pharmacies"}
              </p>
              <h2
                className="mt-3 font-bold text-white"
                style={{
                  fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
                  lineHeight: 1.1,
                  ...(isRtl ? {} : { fontFamily: "var(--font-serif)" }),
                }}
              >
                {isRtl ? "الجودة والثقة في كل خطوة" : "Quality & Trust at Every Step"}
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { Icon: ShoppingBag, stat: "8,000+", labelAr: "منتج متاح",      labelEn: "Products in stock",  descAr: "أدوية ومستلزمات", descEn: "Medicines & supplies" },
              { Icon: MapPin,      stat: "5",       labelAr: "فروع القاهرة",   labelEn: "Cairo branches",     descAr: "في أرجاء القاهرة",descEn: "Across Greater Cairo" },
              { Icon: ShieldCheck, stat: "100%",    labelAr: "أدوية أصلية",   labelEn: "Genuine meds",       descAr: "معتمدة ومضمونة",  descEn: "Certified & verified" },
              { Icon: Truck,       stat: "24h",     labelAr: "توصيل سريع",    labelEn: "Fast delivery",      descAr: "لباب البيت",       descEn: "Door-to-door Cairo"   },
            ].map(({ Icon, stat, labelAr, labelEn, descAr, descEn }, i) => (
              <Reveal key={labelEn} direction="up" delay={i * 90}>
                <div className="group flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 text-center transition-all duration-300 hover:border-[#0E7E74]/40 hover:bg-white/[0.07]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.07] transition-colors group-hover:bg-[#0E7E74]/20">
                    <Icon className="h-5 w-5 text-[#2DD4C0]" />
                  </div>
                  <p
                    className="leading-none text-white"
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "clamp(2.4rem, 5vw, 3.5rem)",
                      fontWeight: 700,
                    }}
                  >{stat}</p>
                  <p className="mt-3 text-[13px] font-black text-white/85">{isRtl ? labelAr : labelEn}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/50">{isRtl ? descAr : descEn}</p>
                </div>
              </Reveal>
            ))}
          </div>

        </div>
      </section>


      {/* ══════════════════════════════════════════
          6. TRUST CARDS + CTA
      ══════════════════════════════════════════ */}
      <section className="bg-white py-16 sm:py-24">
        <div className="page-section">

          <Reveal direction="up">
            <div className="mb-10 text-center">
              <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-slate-400">
                {isRtl ? "ماذا نقدم لك" : "What we offer"}
              </p>
              <h2
                className="mt-3 font-bold text-[#0A1220]"
                style={{
                  fontSize: "clamp(1.7rem, 3.5vw, 2.8rem)",
                  lineHeight: 1.1,
                  ...(isRtl ? {} : { fontFamily: "var(--font-serif)" }),
                }}
              >
                {isRtl ? "تجربة تسوق متكاملة" : "A Complete Pharmacy Experience"}
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { Icon: Truck,       stat: "24h",  titleAr: "توصيل سريع",   titleEn: "Fast Delivery",     descAr: "لباب البيت في القاهرة",  descEn: "Door-to-door, Cairo"    },
              { Icon: ShieldCheck, stat: "100%", titleAr: "أدوية أصلية",  titleEn: "Genuine Meds",      descAr: "معتمدة ومضمونة",         descEn: "Certified & verified"   },
              { Icon: MapPin,      stat: "5",    titleAr: "فروع القاهرة", titleEn: "Cairo Branches",    descAr: "في أرجاء القاهرة",       descEn: "Across Cairo"           },
              { Icon: Clock3,      stat: "24/7", titleAr: "دعم متواصل",   titleEn: "Always-on Support", descAr: serviceHours,              descEn: serviceHours             },
            ].map(({ Icon, stat, titleAr, titleEn, descAr, descEn }, i) => (
              <Reveal key={titleEn} direction="up" delay={i * 70}>
                <div className="group flex flex-col items-center overflow-hidden rounded-2xl border-2 border-[#0A1220] bg-white p-7 text-center transition-all duration-200 hover:bg-[#0A1220] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(10,18,32,0.22)]">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A1220] transition-colors group-hover:bg-white/[0.12]">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p
                    className="leading-none text-[#0A1220] transition-colors group-hover:text-white"
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "clamp(2rem, 4vw, 2.8rem)",
                      fontWeight: 700,
                    }}
                  >{stat}</p>
                  <p className="mt-3 text-[12px] font-black text-[#0A1220] transition-colors group-hover:text-white">
                    {isRtl ? titleAr : titleEn}
                  </p>
                  <p className="mt-1 text-[10.5px] font-medium text-slate-400 transition-colors group-hover:text-white/55">
                    {isRtl ? descAr : descEn}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* CTA Banner */}
          <Reveal direction="up" delay={200}>
            <div className="relative mt-12 overflow-hidden rounded-3xl bg-[#0A1220] p-10 sm:p-14">
              {/* dot texture */}
              <div aria-hidden className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
                  backgroundSize: "26px 26px",
                }} />
              {/* teal glow right */}
              <div aria-hidden className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(ellipse 55% 80% at 90% 50%, rgba(14,126,116,0.20), transparent)" }} />

              <div className={cn(
                "relative z-10 flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between",
                isRtl && "sm:flex-row-reverse",
              )}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2DD4C0]">
                    {isRtl ? "ابدأ الآن" : "Get started"}
                  </p>
                  <p
                    className="mt-2 font-bold text-white"
                    style={{
                      fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                      lineHeight: 1.12,
                      ...(isRtl ? {} : { fontFamily: "var(--font-serif)" }),
                    }}
                  >
                    {isRtl ? "ابدأ التسوق الآن" : "Start Shopping Today"}
                  </p>
                  <p className="mt-2 text-[13px] font-medium text-white/55">
                    {isRtl
                      ? `${primaryLocation.fullNameAr} — ${primaryLocation.hoursAr}`
                      : `${primaryLocation.fullNameEn} — ${primaryLocation.hoursEn}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <Link to="/products"
                    className={cn("inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 text-[13px] font-black text-[#0A1220] shadow-[0_8px_28px_rgba(255,255,255,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(255,255,255,0.22)]", isRtl && "flex-row-reverse")}>
                    {isRtl ? "تسوق الآن" : "Shop now"}
                    <ArrowRight className={cn("h-4 w-4", isRtl && "rotate-180")} />
                  </Link>
                  <Link to="/contact"
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-7 text-[13px] font-black text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.14] hover:-translate-y-0.5">
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
