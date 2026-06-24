import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock3,
  HeartPulse,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { getServiceHoursLabel } from "../config";
import { images } from "../data";
import { cn } from "../components/UI";

type AuthLayoutProps = {
  children: ReactNode;
  mode: "login" | "register";
  from?: string;
  loginSearch?: string;
  registerSearch?: string;
};

const TEAL = "#0E7E74";
const INK  = "#0A1220";

/* Pharmacy cross SVG pattern — on-brand subtle background texture */
const CROSS_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Crect x='21' y='10' width='10' height='32' rx='5' fill='rgba(255%2C255%2C255%2C0.032)'/%3E%3Crect x='10' y='21' width='32' height='10' rx='5' fill='rgba(255%2C255%2C255%2C0.032)'/%3E%3C/svg%3E")`;

const slideUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.44, ease: "easeOut" as const } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08, delayChildren: 0.14 } },
};

export default function AuthLayout({
  children,
  mode,
  from = "",
  loginSearch   = "?tab=login",
  registerSearch = "?tab=register",
}: AuthLayoutProps) {
  const { lang } = useLanguage();
  const isArabic   = lang === "ar";
  const ReturnIcon = isArabic ? ArrowRight : ArrowLeft;

  const copy = {
    heading: mode === "login"
      ? (isArabic ? "تسجيل الدخول"  : "Sign in")
      : (isArabic ? "إنشاء حساب"    : "Create account"),
    subtext: mode === "login"
      ? (isArabic ? "مرحباً بعودتك." : "Welcome back.")
      : (isArabic ? "انضم إلينا واطلب في دقيقة." : "Join us and order in a minute."),
  };

  const headline = isArabic
    ? ["صيدلية راقية،", "تجربة رقمية", "متكاملة."]
    : ["Premium pharmacy,", "digital-first", "experience."];

  const subtext = isArabic
    ? "أوردرك في دقائق، توصيل سريع، ومنتجات أصلية مضمونة."
    : "Your order ready in minutes. Fast Cairo delivery. 100% original.";

  const valueProps = [
    { label: isArabic ? "توصيل سريع لكل أرجاء القاهرة" : "Fast delivery across all of Cairo"   },
    { label: isArabic ? "منتجات أصلية مضمونة 100%"      : "100% authentic & guaranteed products" },
    { label: isArabic ? "رعاية صيدلانية متخصصة"         : "Expert pharmacy care, always"         },
  ];

  const stats = [
    { label: isArabic ? "فروع نشطة"    : "Active branches", value: "6"                           },
    { label: isArabic ? "ساعات الخدمة" : "Service hours",   value: getServiceHoursLabel(lang)    },
    { label: isArabic ? "التغطية"      : "Delivery area",   value: isArabic ? "القاهرة" : "Cairo" },
  ];

  /* Glow positions mirror for RTL */
  const glowA = isArabic
    ? "radial-gradient(ellipse 75% 60% at 10% 5%, rgba(14,126,116,0.52) 0%, transparent 58%)"
    : "radial-gradient(ellipse 75% 60% at 90% 5%, rgba(14,126,116,0.52) 0%, transparent 58%)";
  const glowB = isArabic
    ? "radial-gradient(ellipse 55% 45% at 90% 95%, rgba(14,126,116,0.18) 0%, transparent 55%)"
    : "radial-gradient(ellipse 55% 45% at 10% 95%, rgba(14,126,116,0.18) 0%, transparent 55%)";

  return (
    <div className="flex min-h-screen flex-col bg-[#F2F5F9] lg:flex-row">

      {/* ── Mobile compact header ──────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg"
            style={{ background: "white", boxShadow: "0 1px 6px rgba(0,0,0,0.18)" }}
          >
            <img
              src={images.logoMark}
              alt="United Pharmacies"
              className="h-7 w-7 object-contain"
            />
          </div>
          <span className="text-sm font-black tracking-tight" style={{ color: INK }}>
            United Pharmacies
          </span>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <ReturnIcon className="h-3.5 w-3.5" />
          {isArabic ? "المتجر" : "Back"}
        </Link>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          LEFT — Brand panel
      ══════════════════════════════════════════════════════════════ */}
      <motion.aside
        initial={{ opacity: 0, x: isArabic ? 56 : -56 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative hidden overflow-hidden lg:flex lg:flex-1 lg:flex-col"
        style={{ background: INK }}
      >
        {/* Pharmacy cross tile pattern */}
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: CROSS_BG }} />

        {/* Teal corner glows */}
        <div className="pointer-events-none absolute inset-0" style={{ background: glowA }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: glowB }} />

        {/* Pharmacy interior — ultra-subtle texture */}
        <img
          src={images.homePortrait}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.10] mix-blend-luminosity"
        />

        {/* Dark vignette on edges */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(10,18,32,0.55) 100%)",
          }}
        />

        {/* ── Content ── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative flex h-full flex-col p-10 xl:p-14"
        >
          {/* Top nav row */}
          <motion.div variants={slideUp} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl"
                style={{ background: "white", boxShadow: "0 2px 10px rgba(0,0,0,0.22)" }}
              >
                <img
                  src={images.logoMark}
                  alt=""
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-white/85">United</p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
                  Pharmacies
                </p>
              </div>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-150 hover:text-white/90"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <ReturnIcon className="h-3.5 w-3.5" />
              {isArabic ? "العودة للمتجر" : "Back to store"}
            </Link>
          </motion.div>

          {/* ── Hero: Ring emblem + Headline ── */}
          <motion.div
            variants={slideUp}
            className="flex flex-1 flex-col items-center justify-center py-10 text-center"
          >
            {/* Glowing ring emblem */}
            <div className="relative mb-10 flex items-center justify-center">
              {/* Outermost ambient glow */}
              <div
                className="absolute h-[280px] w-[280px] rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(14,126,116,0.14) 0%, transparent 70%)",
                }}
              />
              {/* Ring 3 */}
              <div
                className="absolute h-[210px] w-[210px] rounded-full"
                style={{ border: "1px solid rgba(78,206,198,0.1)" }}
              />
              {/* Ring 2 */}
              <div
                className="absolute h-[155px] w-[155px] rounded-full"
                style={{ border: "1px solid rgba(78,206,198,0.18)" }}
              />
              {/* Ring 1 – inner halo */}
              <div
                className="absolute h-[110px] w-[110px] rounded-full"
                style={{
                  border: "1px solid rgba(78,206,198,0.28)",
                  background: "rgba(14,126,116,0.09)",
                }}
              />
              {/* Logo card — white background so the brand mark renders in true color */}
              <div
                className="relative z-10 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[1.4rem]"
                style={{
                  background: "white",
                  boxShadow:
                    "0 0 0 1px rgba(78,206,198,0.22), 0 0 48px rgba(14,126,116,0.55), 0 8px 32px rgba(0,0,0,0.28)",
                }}
              >
                <img
                  src={images.logoMark}
                  alt="United Pharmacies"
                  className="h-[60px] w-[60px] object-contain"
                />
              </div>
            </div>

            {/* Headline */}
            <h1
              className="font-black leading-[1.06] tracking-[-0.04em] text-white"
              style={{ fontSize: "clamp(2.2rem, 3.2vw, 4rem)" }}
            >
              {headline[0]}
              <br />
              <span style={{ color: "#4ecec6" }}>{headline[1]}</span>
              <br />
              {headline[2]}
            </h1>

            {/* Subtext */}
            <p
              className="mt-5 max-w-[22rem] text-sm font-semibold leading-7"
              style={{ color: "rgba(255,255,255,0.46)" }}
            >
              {subtext}
            </p>

            {/* Value props — thin teal line style */}
            <div className="mt-9 flex flex-col gap-3">
              {valueProps.map(({ label }) => (
                <div key={label} className="flex items-center justify-center gap-3.5">
                  <div
                    className="h-px flex-shrink-0"
                    style={{ width: "20px", background: "#4ecec6", opacity: 0.7 }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "rgba(255,255,255,0.62)" }}
                  >
                    {label}
                  </span>
                  <div
                    className="h-px flex-shrink-0"
                    style={{ width: "20px", background: "#4ecec6", opacity: 0.7 }}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Stats strip ── */}
          <motion.div
            variants={slideUp}
            className="grid grid-cols-3 border-t pt-7"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  "flex flex-col items-center gap-1",
                  i > 0 && "border-s",
                )}
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.22em]"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </motion.aside>

      {/* ══════════════════════════════════════════════════════════════
          RIGHT — Form panel
      ══════════════════════════════════════════════════════════════ */}
      <motion.main
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.52, ease: "easeOut", delay: 0.1 }}
        className={cn(
          "flex flex-1 items-center justify-center bg-white px-7 py-10",
          "lg:flex-none lg:w-[32rem] xl:w-[36rem]",
          "lg:border-s lg:border-slate-100/80",
        )}
      >
        <div className="w-full max-w-[23rem]">

          {/* ── Tab switcher — editorial underline style ── */}
          <div
            className="flex gap-7 border-b"
            style={{ borderColor: "#e5e9ef" }}
          >
            {(
              [
                { id: "login"    as const, label: isArabic ? "الدخول"    : "Sign in",  to: `/login${loginSearch}`    },
                { id: "register" as const, label: isArabic ? "حساب جديد" : "Register", to: `/login${registerSearch}` },
              ]
            ).map((tab) => {
              const active = mode === tab.id;
              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  state={from ? { from } : undefined}
                  className={cn(
                    "relative pb-4 text-sm font-black transition-colors",
                    active ? "text-slate-900" : "text-slate-400 hover:text-slate-600",
                  )}
                >
                  {tab.label}
                  {active ? (
                    <motion.div
                      layoutId="auth-underline"
                      className="absolute bottom-0 inset-x-0 h-0.5 rounded-full"
                      style={{ background: TEAL }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>

          {/* ── Heading ── */}
          <div className="mt-9">
            <h2
              className="text-[1.75rem] font-black tracking-[-0.03em]"
              style={{ color: INK }}
            >
              {copy.heading}
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
              {copy.subtext}
            </p>
          </div>

          {/* ── Form children ── */}
          <div className="mt-8">{children}</div>

          {/* ── Security note ── */}
          <div className="mt-8 flex items-center justify-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-300" />
            <span className="text-[11px] font-semibold text-slate-400">
              {isArabic
                ? "مؤمّن بـ Supabase Auth · تشفير 256-bit SSL"
                : "Secured by Supabase Auth · 256-bit SSL"}
            </span>
          </div>
        </div>
      </motion.main>
    </div>
  );
}
