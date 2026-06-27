// Home.tsx — luxury editorial redesign with animations
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Apple, ArrowRight, Baby, Brain,
  ChevronLeft, ChevronRight,
  Clock3, Crown, Dumbbell, Eye, Flame, FlaskConical, Heart,
  Leaf, MapPin, PackageSearch, Pill, ShieldCheck,
  ShoppingBag, Sparkles, Star, Stethoscope,
  Thermometer, TrendingUp, Truck, Zap,
} from "lucide-react";
import { cn } from "../components/UI";
import { ProductCard } from "../components/ProductCard";
import { Reveal } from "../components/Reveal";
import { SearchBar } from "../components/SearchBar";
import { useIsShopperShell } from "../components/ui/use-mobile";
import { useCatalog } from "../../contexts/CatalogContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSearch } from "../../contexts/SearchContext";
import { locations } from "../data";
import { useCatalogCategorySearch } from "../hooks/useCatalogCategorySearch";
import { getCatalogProductImage }  from "../catalog";
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

/* ─── daily shuffle helpers ───────────────────────────── */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

  /* Featured leaderboard carousel state */
  const [picksSlide,  setPicksSlide]  = useState(0);
  const [picksKey,    setPicksKey]    = useState(0);
  const [picksDir,    setPicksDir]    = useState<"fwd" | "back">("fwd");
  const [picksPaused, setPicksPaused] = useState(false);

  /* Catalog picks — active category filter */
  const [catalogCat, setCatalogCat] = useState<string | null>(null);

  const isInitialLoading = isLoading && featuredProducts.length === 0;

  const categoryResults = useCatalogCategorySearch(categories, searchQuery);
  const catSuggestions  = searchQuery.trim().length >= 2 ? categoryResults.slice(0, 3) : [];
  const prodSuggestions = searchQuery.trim().length >= 2 ? suggestions.slice(0, 5) : [];

  const primaryLocation = locations.find((l) => l.isPrimary) ?? locations[0];
  const categoryChips   = categories.slice(0, 14);
  const serviceHours    = getServiceHoursSentence(lang);

  /* Featured leaderboard — paginated 4 per page (1 hero + 3 ranked), infinite wrap */
  const PICKS_PER_PAGE = 4;
  const dailySeed  = hashStr(new Date().toDateString());
  // Different seed so catalog picks never mirror the leaderboard on the same day
  const catalogPool = useMemo(
    () => seededShuffle(featuredProducts, (dailySeed ^ 0x1A2B3C4D) >>> 0).slice(0, 80),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featuredProducts, dailySeed],
  );
  const catalogCats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of catalogPool) {
      if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
  }, [catalogPool]);
  const visiblePicks = useMemo(() => {
    const base = catalogCat
      ? catalogPool.filter((p) => p.category === catalogCat)
      : catalogPool;
    return base.slice(0, 8);
  }, [catalogPool, catalogCat]);
  const picksPool  = useMemo(
    () => seededShuffle(featuredProducts, dailySeed).slice(0, 32),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featuredProducts, dailySeed],
  );
  const picksPages     = Math.max(1, Math.ceil(picksPool.length / PICKS_PER_PAGE));
  const picksClamped   = picksPages > 0 ? picksSlide % picksPages : 0;
  const picksStart     = picksClamped * PICKS_PER_PAGE;
  const pageItems      = picksPool.slice(picksStart, picksStart + PICKS_PER_PAGE);

  const picksPrev = () => {
    setPicksDir(isRtl ? "fwd" : "back");
    setPicksSlide((s) => (s - 1 + picksPages) % picksPages);
    setPicksKey((k) => k + 1);
  };
  const picksNext = () => {
    setPicksDir(isRtl ? "back" : "fwd");
    setPicksSlide((s) => (s + 1) % picksPages);
    setPicksKey((k) => k + 1);
  };
  const picksGoTo = (i: number) => {
    setPicksDir(i > picksClamped ? (isRtl ? "back" : "fwd") : (isRtl ? "fwd" : "back"));
    setPicksSlide(i);
    setPicksKey((k) => k + 1);
  };

  /* Auto-advance every 5.5s; pauses on hover; restarts on any navigation */
  useEffect(() => {
    if (picksPaused || picksPages <= 1) return;
    const t = window.setInterval(() => {
      setPicksDir(isRtl ? "back" : "fwd");
      setPicksSlide((s) => (s + 1) % picksPages);
      setPicksKey((k) => k + 1);
    }, 5500);
    return () => window.clearInterval(t);
  }, [picksPaused, picksPages, picksKey, isRtl]);

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
          3. FEATURED PRODUCTS — Editor's Showcase (light)
      ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#F7F9FB] py-16 sm:py-24">

        {/* Dot texture */}
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(10,18,32,0.04) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }} />
        {/* Teal blooms */}
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-[#0E7E74]/[0.07] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full bg-[#0E7E74]/[0.05] blur-3xl" />
        {/* Giant editorial watermark — current page's top rank */}
        <span aria-hidden
          className={cn("pointer-events-none absolute -top-6 select-none text-[#0A1220]/[0.025] transition-all duration-500", isRtl ? "left-0" : "right-0")}
          style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(8rem, 18vw, 20rem)", fontWeight: 700, lineHeight: 0.8 }}>
          {String(picksStart + 1).padStart(2, "0")}
        </span>

        <div className="page-section relative z-10">

          {/* ── Section header ── */}
          <Reveal direction="up">
            <div className={cn("mb-10 flex flex-wrap items-end justify-between gap-4", isRtl && "flex-row-reverse")}>
              <div className={isRtl ? "text-right" : "text-left"}>
                {/* Eyebrow badge */}
                <span className={cn("inline-flex items-center gap-2 rounded-full border border-[#0E7E74]/25 bg-[#0E7E74]/[0.07] px-3 py-1", isRtl && "flex-row-reverse")}>
                  <Flame className="h-3.5 w-3.5 text-[#0E7E74]" />
                  <span className="text-[10.5px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                    {isRtl ? "الأكثر طلباً" : "Top Picks"}
                  </span>
                </span>
                <h2
                  className="mt-3 font-bold text-[#0A1220]"
                  style={{
                    fontSize: "clamp(1.9rem, 3.6vw, 3.1rem)",
                    lineHeight: 1.06,
                    ...(isRtl ? {} : { fontFamily: "var(--font-serif)" }),
                  }}
                >
                  {isRtl ? "منتجات مميزة" : "Featured Products"}
                </h2>
                {/* Accent underline */}
                <span className={cn("mt-3 block h-1 w-16 rounded-full bg-[#0E7E74]", isRtl && "ms-auto")} aria-hidden />
              </div>
              <Link to="/products"
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0A1220] bg-white px-5 py-2.5 text-[12px] font-black text-[#0A1220] transition-all duration-200 hover:bg-[#0A1220] hover:text-white",
                  isRtl && "flex-row-reverse",
                )}>
                {isRtl ? "كل المنتجات" : "All products"}
                <ArrowRight className={cn("h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180 group-hover:-translate-x-0.5")} />
              </Link>
            </div>
          </Reveal>

          {picksPool.length > 0 ? (
            <>
              {/* ════ Leaderboard carousel ════ */}
              <div
                className="relative"
                onMouseEnter={() => setPicksPaused(true)}
                onMouseLeave={() => setPicksPaused(false)}
              >
                {/* Side arrows */}
                {picksPages > 1 && (
                  <>
                    <button
                      type="button" onClick={picksPrev} aria-label={isRtl ? "السابق" : "Previous"}
                      className="absolute left-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#0A1220] bg-white text-[#0A1220] shadow-[0_6px_20px_rgba(10,18,32,0.16)] transition-all duration-200 hover:bg-[#0A1220] hover:text-white hover:scale-105 active:scale-95">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button" onClick={picksNext} aria-label={isRtl ? "التالي" : "Next"}
                      className="absolute right-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#0A1220] bg-white text-[#0A1220] shadow-[0_6px_20px_rgba(10,18,32,0.16)] transition-all duration-200 hover:bg-[#0A1220] hover:text-white hover:scale-105 active:scale-95">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}

                {/* Viewport — side padding leaves room for the arrows */}
                <div className="px-7 sm:px-16" style={{ overflowX: "clip" }}>
                  <AnimatePresence mode="wait" custom={picksDir}>
                    <motion.div
                      key={picksKey}
                      custom={picksDir}
                      variants={{
                        enter:  (dir: "fwd" | "back") => ({ x: dir === "fwd" ? 90 : -90, opacity: 0 }),
                        center: {
                          x: 0, opacity: 1,
                          transition: {
                            x:               { type: "spring", stiffness: 300, damping: 32 },
                            opacity:         { duration: 0.2 },
                            staggerChildren: 0.08,
                            delayChildren:   0.05,
                          },
                        },
                        exit:   (dir: "fwd" | "back") => ({
                          x: dir === "fwd" ? -90 : 90, opacity: 0,
                          transition: { x: { type: "spring", stiffness: 400, damping: 38 }, opacity: { duration: 0.14 } },
                        }),
                      }}
                      initial="enter" animate="center" exit="exit"
                      className="grid gap-4 lg:grid-cols-[1.15fr_1fr]"
                    >

                      {/* ── HERO CARD ── */}
                      {pageItems[0] && (() => {
                        const hero     = pageItems[0];
                        const heroRank = picksStart + 1;
                        const heroImg  = getCatalogProductImage(hero);
                        const heroName = getLocalizedProductName(hero, lang);
                        const heroCat  = isRtl
                          ? (hero.categoryName ?? "منتج")
                          : (hero.categoryNameEn ?? hero.categoryName ?? "Product");
                        const heroDisc = hero.isSale && hero.originalPrice && hero.originalPrice > hero.price
                          ? Math.round(((hero.originalPrice - hero.price) / hero.originalPrice) * 100) : 0;
                        return (
                          <motion.div variants={{
                            enter: { opacity: 0, y: 18 },
                            center: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 26 } },
                          }}>
                            <Link to={`/products/${hero.id}`}
                              className="group relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-3xl border-2 border-[#0A1220] bg-white shadow-[0_4px_18px_rgba(10,18,32,0.06)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_rgba(10,18,32,0.20)]">

                              {/* ── Rank ribbon — top start ── */}
                              <div className={cn(
                                "absolute top-0 z-20 flex items-center gap-1.5 rounded-br-2xl bg-[#0A1220] py-2 pe-3.5 ps-3 text-white shadow-[0_6px_18px_rgba(10,18,32,0.30)]",
                                isRtl ? "right-0 rounded-bl-2xl rounded-br-none ps-3.5 pe-3" : "left-0",
                              )}>
                                {heroRank === 1 ? (
                                  <>
                                    <Crown className="h-3.5 w-3.5 text-[#FFD166]" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                                      {isRtl ? "الاختيار الأول" : "Top Pick"}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <TrendingUp className="h-3.5 w-3.5 text-[#2DD4C0]" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                                      {isRtl ? `المركز ${heroRank}` : `Rank #${heroRank}`}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* ── Image stage ── */}
                              <div className="relative flex flex-1 items-center justify-center overflow-hidden border-b-2 border-[#0A1220] bg-gradient-to-br from-[#F7F9FB] to-[#EAEFF4] p-8">

                                {/* Spotlight rings */}
                                <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                                  style={{ background: "radial-gradient(circle, rgba(14,126,116,0.10) 0%, transparent 65%)" }} />
                                <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0E7E74]/10" />
                                <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#0E7E74]/[0.14]" />

                                {/* Discount badge */}
                                {heroDisc > 0 && (
                                  <span className={cn(
                                    "absolute top-5 z-10 inline-flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1.5 text-[11px] font-black text-white shadow-[0_4px_14px_rgba(244,63,94,0.45)]",
                                    isRtl ? "left-5" : "right-5",
                                  )}>
                                    <Flame className="h-3 w-3" />
                                    {isRtl ? `${heroDisc}% خصم` : `${heroDisc}% OFF`}
                                  </span>
                                )}

                                {heroImg ? (
                                  <img src={heroImg} alt={heroName}
                                    className="relative z-0 h-48 w-auto max-w-[78%] object-contain drop-shadow-[0_16px_30px_rgba(10,18,32,0.16)] transition-transform duration-500 ease-out group-hover:-translate-y-1.5 group-hover:scale-[1.07]" />
                                ) : (
                                  <PackageSearch className="relative z-0 h-14 w-14 text-slate-300" />
                                )}
                              </div>

                              {/* ── Info zone ── */}
                              <div className={cn("p-6", isRtl ? "text-right" : "text-left")}>
                                <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-[#0E7E74]/[0.10] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0E7E74]", isRtl && "flex-row-reverse")}>
                                  <Pill className="h-3 w-3" />
                                  {heroCat}
                                </span>

                                <p className="mt-3 line-clamp-2 text-[18px] font-black leading-[1.35] text-[#0A1220] transition-colors duration-200 group-hover:text-[#0E7E74]">
                                  {heroName}
                                </p>

                                <div className={cn("mt-3 flex items-center gap-3", isRtl && "flex-row-reverse")}>
                                  <span className="tabular-nums text-[26px] font-black leading-none text-[#0A1220]">
                                    {hero.price.toFixed(2)}
                                    <span className="ms-1.5 text-[12px] font-semibold text-slate-400">{isRtl ? "ج.م" : "EGP"}</span>
                                  </span>
                                  {heroDisc > 0 && hero.originalPrice && (
                                    <span className="tabular-nums text-[14px] font-bold text-slate-400 line-through">
                                      {hero.originalPrice.toFixed(2)}
                                    </span>
                                  )}
                                  <span className={cn(
                                    "rounded-full px-2.5 py-0.5 text-[9.5px] font-black",
                                    hero.inStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400",
                                  )}>
                                    {isRtl
                                      ? (hero.inStock ? "✓ متاح" : "نفد المخزون")
                                      : (hero.inStock ? "✓ In stock" : "Out of stock")}
                                  </span>
                                </div>

                                <div className={cn("mt-3 flex items-center gap-4 text-[10.5px] font-bold text-slate-400", isRtl && "flex-row-reverse")}>
                                  <span className={cn("inline-flex items-center gap-1.5", isRtl && "flex-row-reverse")}>
                                    <ShieldCheck className="h-3.5 w-3.5 text-[#0E7E74]" />
                                    {isRtl ? "أصلي 100%" : "100% Genuine"}
                                  </span>
                                  <span className={cn("inline-flex items-center gap-1.5", isRtl && "flex-row-reverse")}>
                                    <Truck className="h-3.5 w-3.5 text-[#0E7E74]" />
                                    {isRtl ? "توصيل سريع" : "Fast delivery"}
                                  </span>
                                </div>

                                <span className={cn(
                                  "mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0A1220] text-[13px] font-black text-white shadow-[0_8px_22px_rgba(10,18,32,0.22)] transition-all duration-200 group-hover:bg-[#0E7E74] group-hover:shadow-[0_10px_26px_rgba(14,126,116,0.45)]",
                                  isRtl && "flex-row-reverse",
                                )}>
                                  {isRtl ? "عرض المنتج" : "View Product"}
                                  <ArrowRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180 group-hover:-translate-x-0.5")} />
                                </span>
                              </div>
                            </Link>
                          </motion.div>
                        );
                      })()}

                      {/* ── RANKED COLUMN ── */}
                      <motion.div
                        variants={{
                          enter: { opacity: 0, y: 18 },
                          center: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 26 } },
                        }}
                        className="flex h-full flex-col gap-3"
                      >
                        {pageItems.slice(1).map((product, idx) => {
                          const rank = picksStart + 2 + idx;
                          const img  = getCatalogProductImage(product);
                          const name = getLocalizedProductName(product, lang);
                          const disc = product.isSale && product.originalPrice && product.originalPrice > product.price
                            ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
                          return (
                            <Link key={product.id} to={`/products/${product.id}`}
                              className={cn(
                                "group relative flex min-h-[92px] flex-1 items-center gap-4 overflow-hidden rounded-2xl border-2 border-[#0A1220] bg-white p-3.5 ps-5 shadow-[0_2px_10px_rgba(10,18,32,0.05)] transition-all duration-200 hover:bg-[#0A1220] hover:shadow-[0_14px_32px_rgba(10,18,32,0.22)]",
                                isRtl && "flex-row-reverse pe-5 ps-3.5",
                              )}>

                              {/* Growing accent bar */}
                              <span aria-hidden className={cn(
                                "absolute inset-y-0 w-1.5 origin-center scale-y-0 bg-[#0E7E74] transition-transform duration-200 group-hover:scale-y-100",
                                isRtl ? "right-0" : "left-0",
                              )} />

                              {/* Rank */}
                              <span
                                className="w-8 shrink-0 text-center text-[24px] font-black tabular-nums leading-none text-[#0A1220]/20 transition-colors duration-200 group-hover:text-[#2DD4C0]"
                                style={{ fontFamily: "var(--font-serif)" }}
                              >
                                {String(rank).padStart(2, "0")}
                              </span>

                              {/* Thumbnail */}
                              <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl border border-[#0A1220]/10 bg-[#F7F9FB] transition-colors duration-200 group-hover:bg-white">
                                {img
                                  ? <img src={img} alt="" className="h-full w-full object-contain p-1.5" />
                                  : <div className="flex h-full w-full items-center justify-center"><PackageSearch className="h-5 w-5 text-slate-300" /></div>
                                }
                                {disc > 0 && (
                                  <span className={cn(
                                    "absolute top-0 rounded-br-md bg-rose-500 px-1 py-0.5 text-[8px] font-black leading-none text-white",
                                    isRtl ? "right-0 rounded-bl-md rounded-br-none" : "left-0",
                                  )}>
                                    -{disc}%
                                  </span>
                                )}
                              </div>

                              {/* Name + category */}
                              <div className={cn("min-w-0 flex-1", isRtl ? "text-right" : "text-left")}>
                                <p className="line-clamp-2 text-[13.5px] font-black leading-snug text-[#0A1220] transition-colors duration-200 group-hover:text-white">
                                  {name}
                                </p>
                                <p className={cn("mt-1 flex items-center gap-1.5 truncate text-[10.5px] font-medium text-slate-400 transition-colors duration-200 group-hover:text-white/55", isRtl && "flex-row-reverse")}>
                                  <TrendingUp className="h-3 w-3 shrink-0 text-[#0E7E74] group-hover:text-[#2DD4C0]" />
                                  <span className="truncate">{isRtl ? product.categoryName : (product.categoryNameEn ?? product.categoryName)}</span>
                                </p>
                              </div>

                              {/* Price */}
                              <div className={cn("flex shrink-0 flex-col gap-0.5", isRtl ? "items-start" : "items-end")}>
                                <span className="tabular-nums text-[15px] font-black text-[#0A1220] transition-colors duration-200 group-hover:text-white">
                                  {product.price.toFixed(2)}
                                </span>
                                <span className="text-[9.5px] font-semibold text-slate-400 transition-colors duration-200 group-hover:text-white/40">
                                  {isRtl ? "ج.م" : "EGP"}
                                </span>
                              </div>

                              <ArrowRight className={cn("h-3.5 w-3.5 shrink-0 text-[#0A1220]/20 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#2DD4C0]", isRtl && "rotate-180 group-hover:-translate-x-0.5")} />
                            </Link>
                          );
                        })}
                      </motion.div>

                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Pager: dots + counter ── */}
              {picksPages > 1 && (
                <div className={cn("mt-7 flex items-center justify-center gap-4", isRtl && "flex-row-reverse")}>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: picksPages }).map((_, i) => (
                      <button
                        key={i} type="button" onClick={() => picksGoTo(i)}
                        aria-label={`${isRtl ? "صفحة" : "Page"} ${i + 1}`}
                        className={cn(
                          "h-[5px] rounded-full transition-all duration-300",
                          i === picksClamped ? "w-8 bg-[#0A1220]" : "w-[5px] bg-slate-300 hover:bg-slate-400",
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-black tabular-nums text-slate-400">
                    {picksClamped + 1} <span className="text-slate-300">/</span> {picksPages}
                  </span>
                </div>
              )}

              {/* ── Quick-access strip (static) ── */}
              <Reveal direction="up" delay={120}>
                <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { to: "/offers",     Icon: Star,        labelAr: "العروض",   labelEn: "Offers",     subAr: "أحدث الخصومات", subEn: "Latest deals" },
                    { to: "/categories", Icon: ShoppingBag, labelAr: "الأقسام",  labelEn: "Categories", subAr: "تصفح بالقسم",   subEn: "By category"  },
                    { to: "/products",   Icon: Zap,         labelAr: "تصفح الكل", labelEn: "Browse All", subAr: "كل المنتجات",   subEn: "Full catalog" },
                  ].map(({ to, Icon, labelAr, labelEn, subAr, subEn }) => (
                    <Link key={labelEn} to={to}
                      className={cn(
                        "group flex items-center justify-center gap-3 rounded-2xl border-2 border-[#0A1220] bg-white px-4 py-3.5 text-center shadow-[0_2px_10px_rgba(10,18,32,0.05)] transition-all duration-200 hover:bg-[#0A1220] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(10,18,32,0.20)]",
                        isRtl && "flex-row-reverse",
                      )}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A1220] transition-colors duration-200 group-hover:bg-white/[0.12]">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className={isRtl ? "text-right" : "text-left"}>
                        <p className="text-[12px] font-black text-[#0A1220] transition-colors duration-200 group-hover:text-white">
                          {isRtl ? labelAr : labelEn}
                        </p>
                        <p className="text-[9.5px] font-semibold text-slate-400 transition-colors duration-200 group-hover:text-white/45">
                          {isRtl ? subAr : subEn}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Reveal>
            </>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white">
              <PackageSearch className="h-8 w-8 text-slate-300" />
            </div>
          )}

        </div>
      </section>


      {/* ══════════════════════════════════════════
          4. CATALOG PICKS — category-filtered daily grid
      ══════════════════════════════════════════ */}
      {visiblePicks.length > 0 && (
        <section className="bg-white py-14 sm:py-20">
          <div className="page-section">

            {/* ── Header ── */}
            <Reveal direction="up">
              <div className={cn("flex flex-wrap items-end justify-between gap-4", isRtl && "flex-row-reverse")}>
                <div className={isRtl ? "text-right" : "text-left"}>
                  <span className={cn("inline-flex items-center gap-2 rounded-full border border-[#0E7E74]/25 bg-[#0E7E74]/[0.07] px-3 py-1", isRtl && "flex-row-reverse")}>
                    <TrendingUp className="h-3.5 w-3.5 text-[#0E7E74]" />
                    <span className="text-[10.5px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                      {isRtl ? "مختارات يومية" : "Daily picks"}
                    </span>
                  </span>
                  <h2
                    className="mt-3 font-bold text-[#0A1220]"
                    style={{
                      fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                      lineHeight: 1.1,
                      ...(isRtl ? {} : { fontFamily: "var(--font-serif)" }),
                    }}
                  >
                    {isRtl ? "متاح الآن" : "Available Now"}
                  </h2>
                  <span className={cn("mt-2 block h-1 w-12 rounded-full bg-[#0E7E74]", isRtl && "ms-auto")} aria-hidden />
                </div>
                <Link
                  to="/products"
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0A1220] bg-white px-5 py-2.5 text-[12px] font-black text-[#0A1220] transition-all duration-200 hover:bg-[#0A1220] hover:text-white",
                    isRtl && "flex-row-reverse",
                  )}
                >
                  {isRtl ? "كل المنتجات" : "All products"}
                  <ArrowRight className={cn("h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180 group-hover:-translate-x-0.5")} />
                </Link>
              </div>
            </Reveal>

            {/* ── Category filter chips ── */}
            {catalogCats.length > 0 && (
              <Reveal direction="up" delay={40}>
                <div
                  className={cn(
                    "mt-6 flex gap-2 overflow-x-auto pb-1",
                    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    isRtl && "flex-row-reverse",
                  )}
                >
                  {/* All */}
                  <button
                    onClick={() => setCatalogCat(null)}
                    className={cn(
                      "shrink-0 rounded-full border-2 px-4 py-1.5 text-[12px] font-black transition-all duration-200",
                      catalogCat === null
                        ? "border-[#0A1220] bg-[#0A1220] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-[#0A1220] hover:text-[#0A1220]",
                    )}
                  >
                    {isRtl ? "الكل" : "All"}
                  </button>
                  {catalogCats.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCatalogCat(cat === catalogCat ? null : cat)}
                      className={cn(
                        "shrink-0 rounded-full border-2 px-4 py-1.5 text-[12px] font-black transition-all duration-200",
                        cat === catalogCat
                          ? "border-[#0E7E74] bg-[#0E7E74] text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#0E7E74] hover:text-[#0E7E74]",
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </Reveal>
            )}

            {/* ── Product grid — animated on category switch ── */}
            <div className="mt-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={catalogCat ?? "__all__"}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                  className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
                >
                  {visiblePicks.map((product) => (
                    <ProductCard key={product.id} product={product} animate={false} />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Bottom CTA ── */}
            <Reveal direction="up" delay={80}>
              <div className={cn("mt-10 flex flex-col items-center gap-2", isRtl && "text-center")}>
                <Link
                  to={catalogCat ? `/products?category=${encodeURIComponent(catalogCat)}` : "/products"}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-2xl bg-[#0A1220] px-8 py-3.5 text-[13px] font-black text-white shadow-[0_4px_20px_rgba(10,18,32,0.18)] transition-all duration-200 hover:bg-[#0E7E74] hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(14,126,116,0.28)]",
                    isRtl && "flex-row-reverse",
                  )}
                >
                  {catalogCat
                    ? (isRtl ? `تصفح كل ${catalogCat}` : `Browse all in ${catalogCat}`)
                    : (isRtl ? "تصفح الكتالوج كاملاً" : "Browse full catalog")}
                  <ArrowRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", isRtl && "rotate-180 group-hover:-translate-x-0.5")} />
                </Link>
                <p className="text-[11px] font-semibold text-slate-400">
                  {isRtl ? "تتجدد المنتجات يومياً" : "Products refresh every day"}
                </p>
              </div>
            </Reveal>

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
