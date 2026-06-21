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

type FooterNavLink  = { name: string; path: string; icon: LucideIcon };
type FooterSocialLink = { href: string; Icon: LucideIcon; label: string };

export function SiteFooter({
  lang,
  t,
  brandNameAr,
  brandNameEn,
  phoneDisplay,
  phoneHref,
  whatsappDisplay,
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
  whatsappDisplay: string;
  whatsappUrl: string;
  email: string;
  navLinks: FooterNavLink[];
  socialLinks: FooterSocialLink[];
}) {
  const isArabic = lang === "ar";
  const brandName   = isArabic ? brandNameAr : brandNameEn;
  const primaryBranch  = locations.find((l) => l.isPrimary) ?? locations[0];

  const [newsletterEmail,  setNewsletterEmail]  = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "success">("idle");

  const supportLinks = [
    { to: "/faq",      label: t("faq") },
    { to: "/shipping", label: t("shipping_policy") },
    { to: "/returns",  label: t("returns_policy") },
    { to: "/terms",    label: t("terms") },
    { to: "/privacy",  label: t("privacy") },
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

  return (
    <footer className="relative overflow-hidden bg-[#0A1220]" dir={isArabic ? "rtl" : "ltr"}>

      {/* ── dot-grid texture ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }} />
      {/* ── teal corner glow ── */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-[#0E7E74]/12 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-[#0E7E74]/08 blur-3xl" />

      <div className="page-section relative z-10">

        {/* ══ TOP BAND — brand + CTA ═══════════════════════════════ */}
        <Reveal direction="up">
          <div className="flex flex-col gap-6 border-b border-white/[0.08] py-12 sm:flex-row sm:items-center sm:justify-between">
            <div className={cn("flex items-center gap-4", isArabic && "flex-row-reverse")}>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.06]">
                <img src={images.logoMark} alt={brandName} className="h-9 w-9 object-contain" />
              </div>
              <div className={isArabic ? "text-right" : "text-left"}>
                <p
                  className="font-bold text-white"
                  style={{ fontFamily: isArabic ? undefined : "var(--font-serif)", fontSize: "1.35rem", lineHeight: 1.1 }}
                >{brandName}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-white/50">
                  {isArabic ? "صيدلية رقمية — القاهرة" : "Digital Pharmacy — Cairo, Egypt"}
                </p>
              </div>
            </div>

            <div className={cn("flex flex-wrap gap-3", isArabic && "flex-row-reverse")}>
              <Link to="/products"
                className={cn("inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-[13px] font-black text-[#0A1220] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(255,255,255,0.20)]", isArabic && "flex-row-reverse")}>
                {isArabic ? "تصفح المنتجات" : "Browse Products"}
                <ArrowRight className={cn("h-3.5 w-3.5", isArabic && "rotate-180")} />
              </Link>
              <Link to="/contact"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 px-6 text-[13px] font-black text-white transition-all duration-200 hover:bg-white/[0.08] hover:-translate-y-0.5">
                {isArabic ? "تواصل معنا" : "Contact Us"}
              </Link>
            </div>
          </div>
        </Reveal>

        {/* ══ MAIN GRID ════════════════════════════════════════════ */}
        <div className="grid gap-10 py-12 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">

          {/* Col 1 — Contact info */}
          <Reveal direction="up">
            <div className={isArabic ? "text-right" : "text-left"}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2DD4C0]">
                {isArabic ? "التواصل معنا" : "Get in Touch"}
              </p>
              <p className="mt-4 text-[13px] font-medium leading-[1.8] text-white/55">
                {isArabic
                  ? "اختر وسيلة التواصل المناسبة أو راجع عنوان الفرع الأقرب إليك."
                  : "Choose a contact method or find the branch closest to you."}
              </p>

              {/* Contact chips */}
              <div className="mt-5 flex flex-col gap-2.5">
                <a href={`tel:${phoneHref}`}
                  className={cn("group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-all duration-200 hover:border-[#0E7E74]/40 hover:bg-white/[0.08]", isArabic && "flex-row-reverse")}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E7E74]/20">
                    <Phone className="h-3.5 w-3.5 text-[#2DD4C0]" />
                  </div>
                  <div className={isArabic ? "text-right" : "text-left"}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                      {isArabic ? "الخط الساخن" : "Hotline"}
                    </p>
                    <p className="text-[13px] font-black text-white" dir="ltr">{phoneDisplay}</p>
                  </div>
                </a>

                <a href={whatsappUrl} target="_blank" rel="noreferrer"
                  className={cn("group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-all duration-200 hover:border-[#0E7E74]/40 hover:bg-white/[0.08]", isArabic && "flex-row-reverse")}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E7E74]/20">
                    <MessageCircle className="h-3.5 w-3.5 text-[#2DD4C0]" />
                  </div>
                  <div className={isArabic ? "text-right" : "text-left"}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">WhatsApp</p>
                    <p className="text-[13px] font-black text-white" dir="ltr">{whatsappDisplay}</p>
                  </div>
                </a>

                <a href={`mailto:${email}`}
                  className={cn("group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-all duration-200 hover:border-[#0E7E74]/40 hover:bg-white/[0.08]", isArabic && "flex-row-reverse")}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E7E74]/20">
                    <Mail className="h-3.5 w-3.5 text-[#2DD4C0]" />
                  </div>
                  <div className={cn("min-w-0 flex-1", isArabic ? "text-right" : "text-left")}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Email</p>
                    <p className="truncate text-[13px] font-black text-white">{email}</p>
                  </div>
                </a>
              </div>

              {/* Primary branch */}
              {primaryBranch && (
                <div className={cn("mt-4 flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5", isArabic && "flex-row-reverse")}>
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2DD4C0]" />
                  <div className={isArabic ? "text-right" : "text-left"}>
                    <p className="text-[11px] font-black text-white">
                      {isArabic ? primaryBranch.fullNameAr : primaryBranch.fullNameEn}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium leading-5 text-white/50">
                      {isArabic ? primaryBranch.addressAr : primaryBranch.addressEn}
                    </p>
                    <div className={cn("mt-2 flex items-center gap-2", isArabic && "flex-row-reverse")}>
                      <Clock className="h-3 w-3 text-white/40" />
                      <span className="text-[10px] font-semibold text-white/40">
                        {isArabic ? primaryBranch.hoursAr : primaryBranch.hoursEn}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Reveal>

          {/* Col 2 — Quick links */}
          <Reveal direction="up" delay={60}>
            <div className={isArabic ? "text-right" : "text-left"}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2DD4C0]">
                {t("quick_links")}
              </p>
              <ul className="mt-5 space-y-3">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <Link to={item.path}
                        className={cn("group flex items-center gap-2.5 text-[13px] font-semibold text-white/60 transition-colors duration-150 hover:text-white", isArabic && "flex-row-reverse")}>
                        <Icon className="h-3.5 w-3.5 text-white/30 transition-colors group-hover:text-[#2DD4C0]" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>

          {/* Col 3 — Support */}
          <Reveal direction="up" delay={100}>
            <div className={isArabic ? "text-right" : "text-left"}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2DD4C0]">
                {t("support")}
              </p>
              <ul className="mt-5 space-y-3">
                {supportLinks.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to}
                      className="text-[13px] font-semibold text-white/60 transition-colors duration-150 hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Col 4 — Newsletter + Social */}
          <Reveal direction="up" delay={140}>
            <div className={isArabic ? "text-right" : "text-left"}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2DD4C0]">
                {isArabic ? "ابقَ على اطلاع" : "Stay Updated"}
              </p>
              <p className="mt-3 text-[13px] font-medium leading-[1.7] text-white/55">
                {isArabic
                  ? "اشترك للحصول على آخر العروض والأخبار."
                  : "Subscribe for exclusive offers and updates."}
              </p>

              <form onSubmit={handleNewsletter} className="mt-4 flex flex-col gap-2.5">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={isArabic ? "بريدك الإلكتروني" : "Your email address"}
                  dir={isArabic ? "rtl" : "ltr"}
                  disabled={newsletterStatus === "loading"}
                  className="h-11 w-full rounded-xl border border-white/[0.10] bg-white/[0.06] px-4 text-[13px] font-medium text-white outline-none placeholder:text-white/30 transition-all focus:border-[#0E7E74]/60 focus:bg-white/[0.09]"
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === "loading" || !newsletterEmail}
                  className={cn("inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-[13px] font-black text-[#0A1220] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(255,255,255,0.18)] disabled:opacity-50", isArabic && "flex-row-reverse")}
                >
                  {newsletterStatus === "loading"
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0A1220] border-t-transparent" />
                    : <><Send className="h-3.5 w-3.5" />{isArabic ? "اشتراك" : "Subscribe"}</>}
                </button>
                {newsletterStatus === "success" && (
                  <p className="text-[12px] font-black text-[#2DD4C0]">
                    {isArabic ? "تم الاشتراك بنجاح!" : "Subscribed successfully!"}
                  </p>
                )}
              </form>

              {/* Social icons */}
              {socialLinks.length > 0 && (
                <div className="mt-6">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    {isArabic ? "تابعنا" : "Follow Us"}
                  </p>
                  <div className={cn("flex flex-wrap gap-2", isArabic && "flex-row-reverse")}>
                    {socialLinks.map(({ href, Icon, label }) => (
                      <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.05] text-white/60 transition-all duration-200 hover:border-[#0E7E74]/40 hover:bg-[#0E7E74]/20 hover:text-[#2DD4C0]">
                        <Icon className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>

        {/* ══ TRUST SIGNALS STRIP ═════════════════════════════════ */}
        <Reveal direction="up">
          <div className="grid grid-cols-2 gap-3 border-t border-white/[0.08] py-8 sm:grid-cols-4">
            {[
              { Icon: ShieldCheck, labelAr: "صرف آمن ومنظم",           labelEn: "Safe & regulated service"    },
              { Icon: Truck,       labelAr: "توصيل داخل القاهرة",       labelEn: "Delivery across Cairo"        },
              { Icon: Sparkles,    labelAr: "رسوم التوصيل حسب المنطقة", labelEn: "Delivery fee by area"        },
              { Icon: HeartPulse, labelAr: "خدمة أقرب للاحتياج",       labelEn: "Care closer to the need"      },
            ].map(({ Icon, labelAr, labelEn }) => (
              <div key={labelEn}
                className={cn("flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5", isArabic && "flex-row-reverse")}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E7E74]/20">
                  <Icon className="h-4 w-4 text-[#2DD4C0]" />
                </div>
                <p className={cn("text-[12px] font-bold text-white/65", isArabic ? "text-right" : "text-left")}>
                  {isArabic ? labelAr : labelEn}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ══ COPYRIGHT BAR ═══════════════════════════════════════ */}
        <div className={cn(
          "flex flex-col gap-3 border-t border-white/[0.06] py-6 text-[11px] font-semibold text-white/35 sm:flex-row sm:items-center sm:justify-between",
          isArabic && "sm:flex-row-reverse",
        )}>
          <p>© {new Date().getFullYear()} {brandName} — {t("rights")}</p>
          <div className={cn("flex flex-wrap items-center gap-4", isArabic && "flex-row-reverse")}>
            {supportLinks.slice(2).map((item) => (
              <Link key={item.to} to={item.to}
                className="transition-colors duration-150 hover:text-white/70">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
