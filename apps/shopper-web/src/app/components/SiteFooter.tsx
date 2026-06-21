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
  whatsappDisplay: _whatsappDisplay,
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
  const primaryBranch = locations.find((l) => l.isPrimary) ?? locations[0];

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
    <footer className="border-t border-slate-200 bg-white" dir={isArabic ? "rtl" : "ltr"}>

      {/* ══ CONTACT STRIP (top) ══════════════════════════════════════
          Phone + WhatsApp + Email — always visible, never buried    */}
      <div className="border-b border-slate-100 bg-[#F8FAFC]">
        <div className="page-section">
          <div className={cn(
            "flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between",
            isArabic && "sm:flex-row-reverse",
          )}>
            {/* Brand mark */}
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <img src={images.logoMark} alt={brandName} className="h-7 w-7 object-contain" />
              </div>
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="text-[13px] font-black text-[#0A1220]">{brandName}</p>
                <p className="text-[10px] font-semibold text-slate-400">
                  {isArabic ? "صيدلية رقمية — القاهرة" : "Digital Pharmacy — Cairo"}
                </p>
              </div>
            </div>

            {/* Contact trio */}
            <div className={cn("flex flex-wrap items-center gap-2", isArabic && "flex-row-reverse")}>
              <a href={`tel:${phoneHref}`}
                className={cn("inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-[#0A1220] shadow-sm transition-all hover:border-[#0E7E74]/40 hover:bg-[#0E7E74]/[0.04] hover:text-[#0E7E74]", isArabic && "flex-row-reverse")}
                dir="ltr">
                <Phone className="h-3.5 w-3.5 text-[#0E7E74]" />
                {phoneDisplay}
              </a>
              <a href={whatsappUrl} target="_blank" rel="noreferrer"
                className={cn("inline-flex items-center gap-2 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/[0.06] px-4 py-2.5 text-[12px] font-black text-[#16A34A] shadow-sm transition-all hover:border-[#22C55E]/50 hover:bg-[#22C55E]/[0.10]", isArabic && "flex-row-reverse")}
                dir="ltr">
                <MessageCircle className="h-3.5 w-3.5 text-[#22C55E]" />
                {isArabic ? "واتساب" : "WhatsApp"}
              </a>
              <a href={`mailto:${email}`}
                className={cn("inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-[#0A1220] shadow-sm transition-all hover:border-[#0E7E74]/40 hover:bg-[#0E7E74]/[0.04] hover:text-[#0E7E74]", isArabic && "flex-row-reverse")}>
                <Mail className="h-3.5 w-3.5 text-[#0E7E74]" />
                <span className="max-w-[160px] truncate">{email}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MAIN GRID ════════════════════════════════════════════════ */}
      <div className="page-section">
        <div className="grid gap-10 py-12 lg:grid-cols-[1.5fr_0.9fr_0.9fr_1.1fr]">

          {/* Col 1 — Brand info + branch */}
          <Reveal direction="up">
            <div className={isArabic ? "text-right" : "text-left"}>
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

              {/* Primary branch card */}
              {primaryBranch && (
                <div className={cn("mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4", isArabic && "flex-row-reverse")}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <MapPin className="h-4 w-4 text-[#0E7E74]" />
                  </div>
                  <div className={isArabic ? "text-right" : "text-left"}>
                    <p className="text-[12px] font-black text-[#0A1220]">
                      {isArabic ? primaryBranch.fullNameAr : primaryBranch.fullNameEn}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium leading-[1.6] text-slate-500">
                      {isArabic ? primaryBranch.addressAr : primaryBranch.addressEn}
                    </p>
                    <div className={cn("mt-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400", isArabic && "flex-row-reverse justify-end")}>
                      <Clock className="h-3 w-3" />
                      <span>{isArabic ? primaryBranch.hoursAr : primaryBranch.hoursEn}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA row */}
              <div className={cn("mt-5 flex flex-wrap gap-2", isArabic && "flex-row-reverse")}>
                <Link to="/products"
                  className={cn("inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0A1220] px-5 text-[12px] font-black text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(10,18,32,0.22)]", isArabic && "flex-row-reverse")}>
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

          {/* Col 2 — Quick links */}
          <Reveal direction="up" delay={60}>
            <div className={isArabic ? "text-right" : "text-left"}>
              <p className="mb-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                {t("quick_links")}
              </p>
              <ul className="space-y-3">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <Link to={item.path}
                        className={cn("group flex items-center gap-2.5 text-[13px] font-semibold text-slate-600 transition-colors hover:text-[#0A1220]", isArabic && "flex-row-reverse")}>
                        <Icon className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-[#0E7E74]" />
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
              <p className="mb-5 text-[10px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                {t("support")}
              </p>
              <ul className="space-y-3">
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

          {/* Col 4 — Newsletter */}
          <Reveal direction="up" delay={140}>
            <div className={isArabic ? "text-right" : "text-left"}>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#0E7E74]">
                {isArabic ? "النشرة البريدية" : "Newsletter"}
              </p>
              <p className="mt-3 text-[13px] font-medium leading-[1.7] text-slate-500">
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
                  dir={isArabic ? "rtl" : "ltr"}
                  disabled={newsletterStatus === "loading"}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-[#0A1220] outline-none placeholder:text-slate-400 transition-all focus:border-[#0E7E74]/50 focus:ring-2 focus:ring-[#0E7E74]/12"
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === "loading" || !newsletterEmail}
                  className={cn("inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A1220] text-[13px] font-black text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(10,18,32,0.22)] disabled:opacity-50", isArabic && "flex-row-reverse")}>
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

              {/* Social */}
              {socialLinks.length > 0 && (
                <div className="mt-6">
                  <p className={cn("mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400")}>
                    {isArabic ? "تابعنا" : "Follow Us"}
                  </p>
                  <div className={cn("flex flex-wrap gap-2", isArabic && "flex-row-reverse")}>
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

        {/* ══ TRUST SIGNALS ══════════════════════════════════════════ */}
        <Reveal direction="up">
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 py-8 sm:grid-cols-4">
            {[
              { Icon: ShieldCheck, labelAr: "صرف آمن ومنظم",           labelEn: "Safe & regulated"       },
              { Icon: Truck,       labelAr: "توصيل داخل القاهرة",       labelEn: "Delivery across Cairo"   },
              { Icon: Sparkles,    labelAr: "رسوم التوصيل حسب المنطقة", labelEn: "Delivery fee by area"    },
              { Icon: HeartPulse, labelAr: "خدمة أقرب للاحتياج",       labelEn: "Care closer to the need" },
            ].map(({ Icon, labelAr, labelEn }) => (
              <div key={labelEn}
                className={cn("flex items-center gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3.5", isArabic && "flex-row-reverse")}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E7E74]/[0.08]">
                  <Icon className="h-4 w-4 text-[#0E7E74]" />
                </div>
                <p className={cn("text-[11.5px] font-bold text-slate-600", isArabic ? "text-right" : "text-left")}>
                  {isArabic ? labelAr : labelEn}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ══ COPYRIGHT BAR ══════════════════════════════════════════ */}
        <div className={cn(
          "flex flex-col gap-3 border-t border-slate-100 py-6 text-[11px] font-semibold text-slate-400 sm:flex-row sm:items-center sm:justify-between",
          isArabic && "sm:flex-row-reverse",
        )}>
          <p>© {new Date().getFullYear()} {brandName} — {t("rights")}</p>
          <div className={cn("flex flex-wrap items-center gap-4", isArabic && "flex-row-reverse")}>
            {supportLinks.slice(2).map((item) => (
              <Link key={item.to} to={item.to}
                className="transition-colors hover:text-[#0A1220]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

    </footer>
  );
}
