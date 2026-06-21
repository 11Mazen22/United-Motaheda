import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  HeartPulse,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { images, locations } from "../data";
import { cn } from "./UI";

type FooterNavLink   = { name: string; path: string; icon: LucideIcon };
type FooterSocialLink = { href: string; Icon: LucideIcon; label: string };

export function SiteFooter({
  lang,
  t,
  brandNameAr,
  brandNameEn,
  phoneDisplay,
  phoneHref,
  whatsappUrl,
  email,
  navLinks,
  socialLinks,
}: {
  lang: "ar" | "en";
  t: (key: "quick_links" | "support" | "faq" | "shipping_policy" | "returns_policy" | "terms" | "privacy" | "rights") => string;
  brandNameAr: string;
  brandNameEn: string;
  phoneDisplay: string;
  phoneHref: string;
  whatsappUrl: string;
  email: string;
  navLinks: FooterNavLink[];
  socialLinks: FooterSocialLink[];
}) {
  const isArabic = lang === "ar";
  const brandName   = isArabic ? brandNameAr : brandNameEn;
  const primaryBranch = locations.find((l) => l.isPrimary) ?? locations[0];

  const [newsletterEmail,  setNewsletterEmail]  = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "success">("idle");

  const supportLinks = [
    { to: "/faq",      label: isArabic ? "الأسئلة الشائعة"       : t("faq") },
    { to: "/shipping", label: isArabic ? "سياسة الشحن والتوصيل"  : t("shipping_policy") },
    { to: "/returns",  label: isArabic ? "الإرجاع"               : t("returns_policy") },
    { to: "/terms",    label: isArabic ? "الشروط والأحكام"        : t("terms") },
    { to: "/privacy",  label: isArabic ? "سياسة الخصوصية"        : t("privacy") },
  ];

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setNewsletterStatus("loading");
    setTimeout(() => {
      setNewsletterStatus("success");
      setNewsletterEmail("");
      setTimeout(() => setNewsletterStatus("idle"), 3500);
    }, 800);
  };

  function ColHeading({ children }: { children: React.ReactNode }) {
    return (
      <p className="mb-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
        {children}
      </p>
    );
  }

  return (
    // No dir attribute — the page-level <html dir="rtl/ltr"> already handles
    // direction. Setting dir here AND using flex-row-reverse inside would
    // double-reverse everything and mis-place icons.
    <footer className="border-t border-slate-200 bg-white">

      {/* ══ CONTACT STRIP ══════════════════════════════════════════════════
          Phone · WhatsApp · Email — topmost, never buried under nav links  */}
      <div className="border-b border-slate-100 bg-[#F8FAFC]">
        <div className="page-section">
          <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Brand mark */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <img src={images.logoMark} alt={brandName} className="h-10 w-10 object-contain" />
              </div>
              <div>
                <p className="text-[13px] font-black text-[#0A1220]">{brandName}</p>
                <p className="text-[10px] font-semibold text-slate-400">
                  {isArabic ? "صيدلية رقمية — القاهرة" : "Digital Pharmacy — Cairo"}
                </p>
              </div>
            </div>

            {/* Contact chips — dir=ltr so phone numbers always read left→right */}
            <div className="flex flex-wrap items-center gap-2">
              <a href={`tel:${phoneHref}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-[#0A1220] shadow-sm transition-all hover:border-[#0E7E74]/40 hover:bg-[#0E7E74]/[0.04] hover:text-[#0E7E74]"
                dir="ltr">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[#0E7E74]" />
                {phoneDisplay}
              </a>
              <a href={whatsappUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/[0.06] px-4 py-2.5 text-[12px] font-black text-[#16A34A] shadow-sm transition-all hover:border-[#22C55E]/50 hover:bg-[#22C55E]/[0.10]"
                dir="ltr">
                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#22C55E]" />
                {isArabic ? "واتساب" : "WhatsApp"}
              </a>
              <a href={`mailto:${email}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-[#0A1220] shadow-sm transition-all hover:border-[#0E7E74]/40 hover:bg-[#0E7E74]/[0.04] hover:text-[#0E7E74]">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#0E7E74]" />
                <span className="max-w-[160px] truncate">{email}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MAIN GRID ═══════════════════════════════════════════════════════ */}
      <div className="page-section">
        <div className="grid gap-10 py-12 lg:grid-cols-[1.5fr_0.9fr_0.9fr_1.1fr]">

          {/* Col 1 — Brand + primary branch */}
          <Reveal direction="up">
            <div>
              <p
                className="font-bold text-[#0A1220]"
                style={{
                  fontFamily: isArabic ? undefined : "var(--font-serif)",
                  fontSize: "1.5rem",
                  lineHeight: 1.1,
                }}
              >{brandName}</p>
              <p className="mt-3 text-[13px] font-medium leading-[1.75] text-slate-500">
                {isArabic
                  ? "صيدلية رقمية متكاملة لعرض المنتجات والطلبات والدعم داخل القاهرة."
                  : "A complete digital pharmacy for products, ordering, and support across Cairo."}
              </p>

              {primaryBranch && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <MapPin className="h-4 w-4 text-[#0E7E74]" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-[#0A1220]">
                      {isArabic ? primaryBranch.fullNameAr : primaryBranch.fullNameEn}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium leading-[1.6] text-slate-500">
                      {isArabic ? primaryBranch.addressAr : primaryBranch.addressEn}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{isArabic ? primaryBranch.hoursAr : primaryBranch.hoursEn}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/products"
                  className="group inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0A1220] px-5 text-[12px] font-black text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(10,18,32,0.22)]">
                  {isArabic ? "تصفح المنتجات" : "Browse Products"}
                  <ArrowRight className={cn("h-3.5 w-3.5", isArabic && "rotate-180")} />
                </Link>
                <Link to="/about"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-5 text-[12px] font-black text-slate-600 transition-all hover:border-[#0A1220] hover:text-[#0A1220]">
                  {isArabic ? "من نحن" : "About Us"}
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Col 2 — Quick nav links
              Note: NO flex-row-reverse on the Link items.
              The page-level dir="rtl" already reverses flex direction so the
              icon (DOM-first) naturally appears on the trailing (right) side
              of the text in Arabic — exactly the correct Arabic UI pattern.  */}
          <Reveal direction="up" delay={60}>
            <div>
              <ColHeading>{isArabic ? "روابط سريعة" : t("quick_links")}</ColHeading>
              <ul className="space-y-3.5">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <Link to={item.path}
                        className="group flex items-center gap-2.5 text-[13px] font-semibold text-slate-600 transition-colors hover:text-[#0A1220]">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-[#0E7E74]" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>

          {/* Col 3 — Support / policy links */}
          <Reveal direction="up" delay={100}>
            <div>
              <ColHeading>{isArabic ? "الدعم والمساعدة" : t("support")}</ColHeading>
              <ul className="space-y-3.5">
                {supportLinks.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to}
                      className="text-[13px] font-semibold text-slate-600 transition-colors hover:text-[#0A1220]">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Col 4 — Newsletter + social */}
          <Reveal direction="up" delay={140}>
            <div>
              <ColHeading>{isArabic ? "النشرة البريدية" : "Newsletter"}</ColHeading>
              <p className="text-[13px] font-medium leading-[1.7] text-slate-500">
                {isArabic
                  ? "اشترك للحصول على آخر العروض والأخبار."
                  : "Get the latest offers and updates."}
              </p>

              <form onSubmit={handleNewsletter} className="mt-4 space-y-2">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={isArabic ? "بريدك الإلكتروني" : "Your email address"}
                  dir="ltr"
                  disabled={newsletterStatus === "loading"}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-[#0A1220] outline-none placeholder:text-slate-400 transition-all focus:border-[#0E7E74]/50 focus:ring-2 focus:ring-[#0E7E74]/12"
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === "loading" || !newsletterEmail}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A1220] text-[13px] font-black text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(10,18,32,0.22)] disabled:opacity-50">
                  {newsletterStatus === "loading"
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    : <><Send className="h-3.5 w-3.5" />{isArabic ? "اشتراك" : "Subscribe"}</>}
                </button>
                {newsletterStatus === "success" && (
                  <p className="text-[12px] font-black text-[#0E7E74]">
                    {isArabic ? "تم الاشتراك بنجاح!" : "Subscribed successfully!"}
                  </p>
                )}
              </form>

              {socialLinks.length > 0 && (
                <div className="mt-6">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {isArabic ? "تابعنا" : "Follow Us"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {socialLinks.map(({ href, Icon, label }) => (
                      <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-[#0A1220] hover:bg-[#0A1220] hover:text-white">
                        <Icon className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>

        {/* ══ TRUST SIGNALS ═══════════════════════════════════════════════════ */}
        <Reveal direction="up">
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 py-8 sm:grid-cols-4">
            {[
              { Icon: ShieldCheck, ar: "صرف آمن ومنظم",           en: "Safe & regulated"       },
              { Icon: Truck,       ar: "توصيل داخل القاهرة",       en: "Delivery across Cairo"   },
              { Icon: Sparkles,    ar: "رسوم التوصيل حسب المنطقة", en: "Delivery fee by area"    },
              { Icon: HeartPulse, ar: "خدمة أقرب للاحتياج",       en: "Care closer to the need" },
            ].map(({ Icon, ar, en }) => (
              <div key={en} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E7E74]/[0.08]">
                  <Icon className="h-4 w-4 text-[#0E7E74]" />
                </div>
                <p className="text-[11.5px] font-bold text-slate-600">{isArabic ? ar : en}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ══ COPYRIGHT BAR ═══════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-3 border-t border-slate-100 py-6 text-[11px] font-semibold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brandName} — {t("rights")}</p>
          <div className="flex flex-wrap items-center gap-4">
            {supportLinks.slice(2).map((item) => (
              <Link key={item.to} to={item.to} className="transition-colors hover:text-[#0A1220]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

    </footer>
  );
}
