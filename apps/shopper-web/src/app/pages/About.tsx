import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Award,
  CheckCircle2,
  Clock,
  Globe2,
  HeartPulse,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Store,
  Truck,
  Users,
  Zap,
  ArrowUpRight,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import unitedIcon from "@assets/brand/about-icon.png";
import { useCatalog } from "../../contexts/CatalogContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { images, locations, siteContact } from "../data";
import { BranchMap } from "../components/BranchMap";
import {
  getDeliveryWindowCompactLabel,
  getDeliveryWindowLabel,
  getServiceHoursLabel,
} from "../config";
import { PageHero, SectionIntro, InfoTile, StatTile } from "../components/BrandPrimitives";
import { Reveal } from "../components/Reveal";
import { cn } from "../components/UI";
import { useIsShopperShell } from "../components/ui/use-mobile";
import { AboutMobile } from "./AboutMobile";

/* ─────────────────────────────────────────────
   Global audio mute hook
   Targets ALL <audio> elements present in the
   document at call time — including any background
   music player mounted at the app root level.
───────────────────────────────────────────── */

function useGlobalAudioMute() {
  const [isMuted, setIsMuted] = useState(false);
  // Track nodes we've touched so we can restore their state on unmount
  const touchedNodesRef = useRef<HTMLAudioElement[]>([]);

  // Read initial muted state from the first audio element found
  useEffect(() => {
    const first = document.querySelector<HTMLAudioElement>("audio");
    if (first) {
      setIsMuted(first.muted);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audioElements = Array.from(document.querySelectorAll<HTMLAudioElement>("audio"));

    if (audioElements.length === 0) return;

    // Determine next state based on the first element
    const nextMuted = !audioElements[0].muted;

    audioElements.forEach((el) => {
      el.muted = nextMuted;
      // Also pause background/ambient audio when muting (optional, graceful)
      if (nextMuted && !el.paused && el.dataset.ambient === "true") {
        el.pause();
      } else if (!nextMuted && el.dataset.ambient === "true") {
        void el.play().catch(() => {
          // Autoplay policy may block; ignore silently
        });
      }
    });

    touchedNodesRef.current = audioElements;
    setIsMuted(nextMuted);
  }, []);

  return { isMuted, toggleMute };
}

/* ─────────────────────────────────────────────
   Tiny internal primitives used only in About
───────────────────────────────────────────── */

interface SignalPillProps {
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  valueAr: string;
  valueEn: string;
  isArabic: boolean;
}

function SignalPill({ icon: Icon, labelAr, labelEn, valueAr, valueEn, isArabic }: SignalPillProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
          {isArabic ? labelAr : labelEn}
        </p>
      </div>
      <p className="text-sm font-black text-slate-900" dir="ltr">
        {isArabic ? valueAr : valueEn}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */

export default function About() {
  const isShopperShell = useIsShopperShell();
  const { lang, t } = useLanguage();
  const { metrics } = useCatalog();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMuted, toggleMute } = useGlobalAudioMute();

  if (isShopperShell) {
    return <AboutMobile />;
  }
  const isArabic = lang === "ar";
  const brandName = isArabic ? "صيدليات المتحدة" : "United Pharmacies";
  const defaultBranchId = locations.find((branch) => branch.isPrimary)?.id ?? locations[0]?.id ?? "cairo";
  const selectedBranchMapId = searchParams.get("branch") ?? defaultBranchId;
  const defaultBranch = locations.find((branch) => branch.id === defaultBranchId) ?? locations[0];
  const selectedBranch = locations.find((branch) => branch.id === selectedBranchMapId) ?? defaultBranch;
  const selectedDirectionsUrl = selectedBranch?.mapsDirectionsUrl ?? null;
  const branchDetailHref = (branchId: string) => `/about?branch=${branchId}#branch-details`;

  /* ── Data ── */

  const values = [
    {
      icon: HeartPulse,
      tint: "rose" as const,
      titleAr: "رعاية عملية",
      titleEn: "Practical Care",
      descAr: "نرتب التجربة حول ما يحتاجه العميل فعلاً من وضوح وسرعة ودعم مباشر.",
      descEn: "We shape the experience around what customers actually need: clarity, speed, and direct support.",
    },
    {
      icon: ShieldCheck,
      tint: "teal" as const,
      titleAr: "ثقة قابلة للملاحظة",
      titleEn: "Visible Trust",
      descAr: "نقدم معلومات أوضح عن المنتجات والعروض وسياسات الخدمة بدون تعقيد.",
      descEn: "We present products, offers, and service policies in a clearer and more dependable way.",
    },
    {
      icon: Truck,
      tint: "amber" as const,
      titleAr: "تنفيذ منظم",
      titleEn: "Structured Fulfillment",
      descAr: "من التصفح إلى التوصيل، نحاول تقليل الاحتكاك في كل خطوة داخل القاهرة.",
      descEn: "From browsing to delivery, we reduce friction across each step of the Cairo journey.",
    },
    {
      icon: Users,
      tint: "blue" as const,
      titleAr: "مفهومة للجميع",
      titleEn: "Accessible to All",
      descAr: "واجهة أبسط يمكن قراءتها واستخدامها بسهولة لمختلف الفئات العمرية.",
      descEn: "A simpler interface that stays readable and usable for different age groups.",
    },
  ];

  const operatingModel = [
    {
      icon: Store,
      tint: "teal" as const,
      titleAr: "واجهة صيدلية أوضح",
      titleEn: "A clearer pharmacy interface",
      descAr: "نرتب الأقسام والمنتجات والعروض لتقليل التشتت ومساعدة العميل على الوصول بسرعة.",
      descEn: "We organize categories, products, and offers to reduce noise and help customers reach what they need faster.",
    },
    {
      icon: Zap,
      tint: "blue" as const,
      titleAr: "استجابة أسرع للاحتياج",
      titleEn: "Faster response to need",
      descAr: "نربط بين الاكتشاف والشراء والدعم بطريقة مباشرة تناسب الاستخدام اليومي.",
      descEn: "We connect discovery, ordering, and support in a more direct flow for everyday use.",
    },
    {
      icon: Award,
      tint: "amber" as const,
      titleAr: "جودة تركز على التفاصيل",
      titleEn: "Quality with attention to detail",
      descAr: "نراجع العرض البصري والمحتوى والخدمة بما يعكس صورة احترافية أكثر ثباتاً.",
      descEn: "We refine presentation, content, and service details to maintain a more professional experience.",
    },
  ];

  const milestones = [
    {
      yearAr: "٢٠١٧",
      yearEn: "2017",
      titleAr: "بداية العلامة",
      titleEn: "Brand launch",
      descAr: "بدأت المتحدة من فرع موثوق في القاهرة مع تركيز واضح على الخدمة اليومية.",
      descEn: "United began with a trusted Cairo branch and a clear focus on daily pharmacy service.",
      icon: Store,
      color: "#24B8B5",
      bgColor: "#24B8B515",
    },
    {
      yearAr: "٢٠٢١",
      yearEn: "2021",
      titleAr: "تنظيم التجربة الرقمية",
      titleEn: "Digital structure",
      descAr: "تم تطوير المسار الرقمي ليصبح أوضح في عرض الأقسام والطلبات والمحتوى.",
      descEn: "The digital journey was expanded to present categories, orders, and content more clearly.",
      icon: Globe2,
      color: "#3B82F6",
      bgColor: "#3B82F615",
    },
    {
      yearAr: "٢٠٢٣",
      yearEn: "2023",
      titleAr: "كتالوج أوسع",
      titleEn: "Broader catalog",
      descAr: "توسعت التغطية لتشمل الأدوية والمكملات والعناية الشخصية والأجهزة الطبية.",
      descEn: "Coverage expanded across medicines, supplements, personal care, and medical devices.",
      icon: CheckCircle2,
      color: "#F59E0B",
      bgColor: "#F59E0B15",
    },
    {
      yearAr: "اليوم",
      yearEn: "Today",
      titleAr: "تركيز على الثقة والوضوح",
      titleEn: "Clarity-first today",
      descAr: "الهدف الحالي هو تجربة صيدلية رقمية أكثر هدوءاً وثقة وأسهل في الاستخدام.",
      descEn: "Today the focus is a calmer, more trustworthy, and easier digital pharmacy experience.",
      icon: Star,
      color: "#8B5CF6",
      bgColor: "#8B5CF615",
    },
  ];

  const serviceSignals = [
    {
      icon: Clock,
      labelAr: "خدمة يومية",
      labelEn: "Daily service",
      valueAr: getServiceHoursLabel("ar"),
      valueEn: getServiceHoursLabel("en"),
    },
    {
      icon: Truck,
      labelAr: "توصيل القاهرة",
      labelEn: "Cairo delivery",
      valueAr: getDeliveryWindowLabel("ar"),
      valueEn: getDeliveryWindowLabel("en"),
    },
    {
      icon: Phone,
      labelAr: "دعم مباشر",
      labelEn: "Direct support",
      valueAr: siteContact.phoneDisplay,
      valueEn: siteContact.phoneDisplay,
    },
  ];

  const heroStats = [
    { id: "branches", value: String(locations.length), labelAr: "فروع", labelEn: "Branches" },
    { id: "products", value: metrics.totalProducts.toLocaleString(), labelAr: "منتج", labelEn: "Products" },
    {
      id: "delivery",
      value: getDeliveryWindowCompactLabel(lang),
      labelAr: "توصيل القاهرة",
      labelEn: "Cairo Delivery",
    },
    { id: "categories", value: metrics.totalCategories.toString(), labelAr: "أقسام", labelEn: "Categories" },
  ];

  const promiseItems = [
    {
      icon: ShieldCheck,
      textAr: "عرض أوضح للمنتجات والمعلومات الأساسية",
      textEn: "Clearer presentation for products and essential information",
    },
    {
      icon: Truck,
      textAr: "تنظيم أفضل لمسار الطلب والتوصيل داخل القاهرة",
      textEn: "Better ordering and delivery structure across Cairo",
    },
    {
      icon: Globe2,
      textAr: "تجربة رقمية أسهل استخداماً وأكثر هدوءاً",
      textEn: "A calmer and easier digital experience",
    },
  ];

  /* ── Render ── */

  return (
    <div className="about-page medical-page medical-shell bg-[#F5FDFC]">

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <PageHero
        lang={lang}
        crumbs={[{ label: t("home"), to: "/" }, { label: t("about") }]}
        eyebrow={
          <span className="badge-teal">
            <Store className="h-4 w-4" />
            {isArabic ? "قصة العلامة والثقة" : "Brand Story & Trust"}
          </span>
        }
        title={brandName}
        description={
          isArabic
            ? "من صيدلية محلية موثوقة إلى تجربة رقمية أكثر وضوحاً وتنظيماً لخدمة احتياجاتك الصحية اليومية."
            : "From a trusted local pharmacy to a more structured digital experience for everyday health needs."
        }
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              to="/products"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-black text-white shadow-[0_18px_38px_rgba(36,184,181,0.24)] transition-all hover:bg-[var(--primary-strong)] hover:shadow-[0_22px_44px_rgba(36,184,181,0.32)]"
            >
              {isArabic ? "تصفح المنتجات" : "Browse Products"}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[#0A1220]/20 bg-[#0A1220]/[0.07] px-6 text-sm font-black text-[#0A1220] backdrop-blur-sm transition-all hover:bg-[#0A1220]/[0.13] hover:border-[#0A1220]/35"
            >
              {isArabic ? "تواصل معنا" : "Contact Us"}
            </Link>
            {/* ── FIXED: Global audio mute/unmute button ─────────────────── */}
            <button
              type="button"
              onClick={toggleMute}
              aria-label={
                isMuted
                  ? isArabic ? "تشغيل الصوت" : "Unmute audio"
                  : isArabic ? "كتم الصوت" : "Mute audio"
              }
              title={
                isMuted
                  ? isArabic ? "تشغيل الصوت" : "Unmute audio"
                  : isArabic ? "كتم الصوت" : "Mute audio"
              }
              className={cn(
                "inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition-all",
                isMuted
                  ? "border-rose-300/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                  : "border-white/15 bg-white/10 text-white hover:bg-white/20",
              )}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
          </div>
        }
        aside={
          <div className="space-y-4">
            {/* Identity card — light surface */}
            <div className="about-identity-card panel-soft rounded-[1.85rem] border border-slate-100 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="mb-5 flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_6px_18px_rgba(10,18,32,0.10)]">
                  <img
                    src={unitedIcon}
                    alt={brandName}
                    className="h-full w-full object-contain p-1.5"
                  />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                    {isArabic ? "هويتنا" : "Our Identity"}
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">{brandName}</p>
                </div>
              </div>

              <p className="text-sm font-semibold leading-7 text-slate-500">
                {isArabic
                  ? "نعمل على تقديم صيدلية أكثر هدوءاً وثقة، تجمع بين الوصول السريع للمعلومة والدعم المباشر عندما يحتاج العميل ذلك."
                  : "We aim to deliver a calmer, more dependable pharmacy experience, combining faster information access with direct support when customers need it."}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { id: "aside-branches", value: String(locations.length), labelAr: "فروع", labelEn: "Branches" },
                  { id: "aside-products", value: metrics.totalProducts.toLocaleString(), labelAr: "منتج", labelEn: "Products" },
                  { id: "aside-categories", value: metrics.totalCategories.toString(), labelAr: "أقسام", labelEn: "Categories" },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.1rem] border border-slate-200 bg-slate-50/70 px-3 py-3 text-center"
                  >
                    <p className="text-sm font-black text-slate-600">{item.value}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {isArabic ? item.labelAr : item.labelEn}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Service signals */}
            <div className="rounded-[1.85rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f5fbfb_100%)] p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-black text-slate-950">
                  {isArabic ? "مؤشرات الخدمة" : "Service Signals"}
                </p>
              </div>
              <div className="grid gap-3">
                {serviceSignals.map((signal) => (
                  <SignalPill
                    key={signal.labelEn}
                    icon={signal.icon}
                    labelAr={signal.labelAr}
                    labelEn={signal.labelEn}
                    valueAr={signal.valueAr}
                    valueEn={signal.valueEn}
                    isArabic={isArabic}
                  />
                ))}
              </div>
            </div>
          </div>
        }
        stats={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {heroStats.map((s) => (
              <StatTile
                key={s.id}
                value={s.value}
                label={isArabic ? s.labelAr : s.labelEn}
              />
            ))}
          </div>
        }
      />

      {/* ══════════════════════════════════════
          VALUES
      ══════════════════════════════════════ */}
      <section className="about-values page-section py-12 md:py-16">
        <SectionIntro
          eyebrow={
            <span className="badge-teal">
              <Sparkles className="h-4 w-4" />
              {isArabic ? "ما الذي يميزنا" : "What Defines Us"}
            </span>
          }
          title={isArabic ? "تجربة صيدلية أوضح وأكثر ثباتاً" : "A clearer and more dependable pharmacy experience"}
          description={
            isArabic
              ? "نبني التجربة حول الوضوح والثقة والتنفيذ العملي، بحيث تبدو الصيدلية الرقمية أقرب وأسهل وأكثر مهنية."
              : "We build around clarity, trust, and practical execution so the digital pharmacy feels closer, easier, and more professional."
          }
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {values.map((value, index) => (
            <InfoTile
              key={value.titleEn}
              icon={value.icon}
              tint={value.tint}
              title={isArabic ? value.titleAr : value.titleEn}
              description={isArabic ? value.descAr : value.descEn}
              delay={index * 80}
            />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          VISUAL IDENTITY + OPERATING MODEL
      ══════════════════════════════════════ */}
      <section className="page-section pb-14">
        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">

          {/* Left — gallery card */}
          <Reveal direction="up">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 px-6 py-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                  {isArabic ? "الهوية البصرية" : "Visual Identity"}
                </p>
                <h2
                  className="mt-2 font-black tracking-tight text-slate-900"
                  style={{ fontSize: "clamp(1.5rem, 2.8vw, 2.2rem)", lineHeight: 1.12, ...(isArabic ? {} : { fontFamily: "var(--font-serif)" }) }}
                >
                  {isArabic
                    ? "شكل بصري يعكس الثقة والوضوح"
                    : "A visual system built for trust and clarity"}
                </h2>
              </div>

              <div className="grid grid-cols-2 grid-rows-2 gap-3 p-5" style={{ minHeight: 340 }}>
                <div className="row-span-2 overflow-hidden rounded-[1.4rem]">
                  <img
                    src={images.pic1}
                    alt={isArabic ? "من داخل صيدلية المتحدة" : "Inside United Pharmacies"}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="overflow-hidden rounded-[1.4rem]">
                  <img
                    src={images.pic0}
                    alt={isArabic ? "تفاصيل الهوية داخل الفرع" : "Brand details inside the branch"}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="overflow-hidden rounded-[1.1rem]">
                    <img
                      src={images.pic3}
                      alt={isArabic ? "أرفف ومنتجات الفرع" : "Branch shelves and products"}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2 rounded-[1.1rem] border border-slate-200 bg-slate-50/60 p-3">
                    <img
                      src={images.heroLogo}
                      alt={brandName}
                      className="h-10 w-10 object-contain"
                      loading="lazy"
                    />
                    <p className="text-center text-[10px] font-black uppercase leading-4 tracking-[0.14em] text-slate-600">
                      {isArabic ? "الهوية" : "Identity"}
                    </p>
                    <p className="text-center text-[10px] font-semibold leading-4 text-slate-500">
                      {isArabic ? "حضور بصري موحد" : "Unified visual presence"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right — how we work + operating model */}
          <div className="grid gap-5">
            <Reveal direction="up" delay={60}>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                  {isArabic ? "كيف نعمل" : "How We Work"}
                </p>
                <h3
                  className="mt-2 font-black tracking-tight text-slate-950"
                  style={{ fontSize: "clamp(1.4rem, 2.5vw, 2rem)", lineHeight: 1.15, ...(isArabic ? {} : { fontFamily: "var(--font-serif)" }) }}
                >
                  {isArabic
                    ? "كل جزء في الصفحة يخدم قراراً أوضح"
                    : "Each section is designed to support a clearer decision"}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
                  {isArabic
                    ? "نركز على سهولة الوصول إلى المنتجات، إبراز العروض الفعلية، وتقديم معلومات خدمة مفهومة دون ازدحام بصري."
                    : "We focus on easier product discovery, clearer active offers, and service information that stays understandable without visual clutter."}
                </p>
              </div>
            </Reveal>

            <div className="grid gap-4">
              {operatingModel.map((item, index) => (
                <InfoTile
                  key={item.titleEn}
                  icon={item.icon}
                  tint={item.tint}
                  title={isArabic ? item.titleAr : item.titleEn}
                  description={isArabic ? item.descAr : item.descEn}
                  delay={120 + index * 60}
                  className="h-full"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TIMELINE / MILESTONES
      ══════════════════════════════════════ */}
      <section className="page-section pb-14">
        <SectionIntro
          eyebrow={
            <span className="badge-teal">
              <Clock className="h-4 w-4" />
              {isArabic ? "رحلتنا" : "Our Journey"}
            </span>
          }
          title={isArabic ? "محطات شكلت مسار المتحدة" : "Milestones that shaped United"}
          description={
            isArabic
              ? "تطورنا كان تدريجياً، لكنه حافظ دائماً على نفس الفكرة الأساسية: خدمة أكثر وضوحاً وموثوقية."
              : "Our growth has been gradual, but it has stayed rooted in the same idea: clearer and more dependable pharmacy service."
          }
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {milestones.map((item, index) => (
            <Reveal key={item.titleEn} delay={index * 80} direction="up">
              <div className="group flex h-full flex-col gap-4 rounded-[1.85rem] border-2 border-[#0A1220] bg-white p-6 shadow-[0_4px_18px_rgba(10,18,32,0.06)] transition-all duration-200 hover:bg-[#0A1220] hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(10,18,32,0.22)]">
                <div className="flex items-center justify-between gap-4">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 group-hover:bg-white/[0.12]"
                    style={{ backgroundColor: item.bgColor }}
                  >
                    <item.icon className="h-5 w-5 transition-colors duration-200" style={{ color: item.color }} />
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] transition-all duration-200 group-hover:bg-white/[0.12] group-hover:text-white"
                    style={{ color: item.color, backgroundColor: item.bgColor }}
                  >
                    {isArabic ? item.yearAr : item.yearEn}
                  </span>
                </div>
                <div>
                  <h3
                    className="font-black text-slate-900 transition-colors duration-200 group-hover:text-white"
                    style={{ fontSize: "clamp(1.05rem, 2vw, 1.2rem)", ...(isArabic ? {} : { fontFamily: "var(--font-serif)" }) }}
                  >
                    {isArabic ? item.titleAr : item.titleEn}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 transition-colors duration-200 group-hover:text-white/60">
                    {isArabic ? item.descAr : item.descEn}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          BRANCHES & SERVICE
      ══════════════════════════════════════ */}
      <section className="page-section pb-16">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[linear-gradient(160deg,#ffffff_0%,#f4fbfb_55%,#eef8f7_100%)] p-8 text-slate-950 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-10">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle at 0% 20%, rgba(44,190,181,0.14), transparent 35%)" }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
            style={{ background: "radial-gradient(circle at 100% 80%, rgba(59,130,246,0.1), transparent 45%)" }}
            aria-hidden="true"
          />

          {/* Section Header */}
          <Reveal direction="up">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                  {isArabic ? "فروعنا وخدمتنا" : "Branches & Service"}
                </p>
                <h3
                  className="mt-2 font-black tracking-tight text-slate-950"
                  style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", lineHeight: 1.1, ...(isArabic ? {} : { fontFamily: "var(--font-serif)" }) }}
                >
                  {isArabic
                    ? `${locations.length} فروع تخدم القاهرة على مدار الساعة`
                    : `${locations.length} branches serving Cairo around the clock`}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                  {isArabic
                    ? "كل فرع يوفر خدمة مباشرة وتوصيل منظم وساعات عمل ثابتة. اختر الأقرب لك."
                    : "Every branch provides direct service, structured delivery, and stable working hours. Choose the nearest one."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[340px]">
                {serviceSignals.map((signal) => (
                  <div
                    key={signal.labelEn}
                    className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                  >
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-600">
                      <signal.icon className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {isArabic ? signal.labelAr : signal.labelEn}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950" dir="ltr">
                      {isArabic ? signal.valueAr : signal.valueEn}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Branch Cards Grid */}
          <div id="branch-details" className="mt-8">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-slate-600">
              {t("branches_directory")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {locations.map((location, index) => {
                const isSelected = location.id === selectedBranch.id;
                return (
                  <Reveal key={location.id} direction="up" delay={index * 60}>
                    <button
                      type="button"
                      onClick={() => navigate(branchDetailHref(location.id))}
                      className={cn(
                        "group relative w-full overflow-hidden rounded-[1.5rem] border-2 p-5 text-start transition-all duration-200",
                        isSelected
                          ? "border-teal-500 bg-white shadow-[0_12px_36px_rgba(20,184,166,0.12)]"
                          : "border-slate-200 bg-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.04)] hover:border-teal-300 hover:shadow-[0_12px_36px_rgba(15,23,42,0.08)]",
                      )}
                    >
                      {isSelected && (
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-50/60 to-transparent" />
                      )}
                      <div className="relative">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] bg-slate-50 text-teal-600 transition-colors group-hover:bg-teal-50">
                            <MapPin className="h-5 w-5" />
                          </div>
                          <div className="flex items-center gap-2">
                            {location.isPrimary && (
                              <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-teal-700">
                                {isArabic ? "الرئيسي" : "Primary"}
                              </span>
                            )}
                            {isSelected && (
                              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-teal-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              </span>
                            )}
                          </div>
                        </div>

                        <h4 className="mt-3 text-sm font-black text-slate-950">
                          {isArabic ? location.nameAr : location.nameEn}
                        </h4>
                        <p className="mt-1 text-[11px] font-bold text-teal-700">
                          {isArabic ? location.area : location.area}
                        </p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                          {isArabic ? location.addressAr : location.addressEn}
                        </p>

                        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <Clock className="h-3 w-3" />
                            <span>24/7</span>
                          </div>
                          {location.deliveryEnabled && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-600">
                              <Truck className="h-3 w-3" />
                              <span>{isArabic ? "توصيل" : "Delivery"}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {/* Selected Branch Details + Map */}
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Reveal direction="up">
              <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">
                        {isArabic ? "تفاصيل الفرع" : "Branch Details"}
                      </p>
                      <p className="text-base font-black text-slate-950">
                        {isArabic ? selectedBranch.fullNameAr : selectedBranch.fullNameEn}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
                      <div className="mb-2 flex items-center gap-2 text-slate-600">
                        <MapPin className="h-4 w-4" />
                        <span className="text-[11px] font-black uppercase tracking-[0.16em]">
                          {isArabic ? "العنوان" : "Address"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold leading-7 text-slate-700">
                        {isArabic ? selectedBranch.addressAr : selectedBranch.addressEn}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
                      <div className="mb-2 flex items-center gap-2 text-slate-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-[11px] font-black uppercase tracking-[0.16em]">
                          {isArabic ? "ساعات العمل" : "Working Hours"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold leading-7 text-slate-700">
                        {isArabic ? selectedBranch.hoursAr : selectedBranch.hoursEn}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                      {isArabic ? "أرقام التواصل" : "Contact Numbers"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedBranch.phones.map((phone) => (
                        <a
                          key={phone}
                          href={`tel:${phone}`}
                          dir="ltr"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition-all hover:border-teal-200 hover:bg-teal-50/50"
                        >
                          <Phone className="h-4 w-4 text-teal-600" />
                          {phone}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                    {selectedDirectionsUrl && (
                      <a
                        href={selectedDirectionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-teal-700"
                      >
                        <MapPin className="h-4 w-4" />
                        {isArabic ? "افتح في خرائط جوجل" : "Open in Google Maps"}
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    )}
                    <Link
                      to={`/contact?branch=${selectedBranch.id}#branch-details`}
                      className="inline-flex items-center gap-1.5 text-sm font-black text-slate-600 transition-colors hover:text-teal-700"
                    >
                      {isArabic ? "عرض تواصل الفرع" : "View branch contacts"}
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal direction="up" delay={120}>
              <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    {t("branch_map_hint")}
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-900">
                    {isArabic ? selectedBranch.fullNameAr : selectedBranch.fullNameEn}
                  </p>
                </div>
                <div className="p-5">
                  <BranchMap
                    locations={locations}
                    selectedBranchId={selectedBranch.id}
                    isArabic={isArabic}
                    onSelectBranch={(branchId) => setSearchParams((prev) => { prev.set("branch", branchId); return prev; }, { replace: true })}
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          THE UNITED PROMISE (CTA)
      ══════════════════════════════════════ */}
      <section className="page-section pb-16">
        <Reveal direction="up">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#0A1220] p-8 shadow-[0_24px_60px_rgba(10,18,32,0.28)] md:p-12">
            {/* dot texture */}
            <div aria-hidden className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }} />
            {/* teal glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse 55% 80% at 90% 50%, rgba(14,126,116,0.22), transparent)" }} />

            <div className={cn("relative z-10 grid gap-10 xl:grid-cols-[1.1fr_0.9fr] xl:items-center", isArabic && "xl:grid-cols-[0.9fr_1.1fr]")}>
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2DD4C0]">
                  {isArabic ? "وعد المتحدة" : "The United Promise"}
                </p>
                <h3
                  className="mt-3 font-bold text-white"
                  style={{
                    fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                    lineHeight: 1.1,
                    ...(isArabic ? {} : { fontFamily: "var(--font-serif)" }),
                  }}
                >
                  {isArabic
                    ? "نعمل على جعل الصيدلية الرقمية أقرب وأوضح"
                    : "Making digital pharmacy feel closer and clearer"}
                </h3>
                <p className="mt-4 max-w-xl text-[14px] font-medium leading-[1.8] text-white/60">
                  {isArabic
                    ? "سواء كنت تبحث عن دواء، مكمل غذائي، أو خدمة دعم مباشرة، هدفنا أن تبدو الرحلة أبسط وأكثر مهنية من أول خطوة حتى إتمام الطلب."
                    : "Whether you are looking for medicine, supplements, or direct support — our goal is a simpler, more professional journey from first click to fulfilled order."}
                </p>

                <div className={cn("mt-7 flex flex-wrap gap-3", isArabic && "flex-row-reverse")}>
                  <Link
                    to="/products"
                    className={cn("inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-8 text-[13px] font-black text-[#0A1220] shadow-[0_8px_24px_rgba(255,255,255,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(255,255,255,0.26)]", isArabic && "flex-row-reverse")}
                  >
                    {isArabic ? "تصفح المنتجات" : "Browse Products"}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/contact"
                    className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-white/[0.08] px-7 text-[13px] font-black text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.15] hover:-translate-y-0.5"
                  >
                    {isArabic ? "تواصل معنا" : "Contact Us"}
                  </Link>
                </div>
              </div>

              <div className="grid gap-3">
                {promiseItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.textEn}
                      className={cn("flex items-center gap-3.5 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-5 py-4 backdrop-blur-sm", isArabic && "flex-row-reverse")}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.10]">
                        <Icon className="h-4 w-4 text-[#2DD4C0]" />
                      </div>
                      <p className={cn("text-[13px] font-semibold text-white/80", isArabic && "text-right leading-7")}>
                        {isArabic ? item.textAr : item.textEn}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
