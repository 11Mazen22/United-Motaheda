import { PageHero } from "../components/BrandPrimitives";
import { siteContact } from "../data";
import { useLanguage } from "../../contexts/LanguageContext";

export default function Contact() {
  const { lang } = useLanguage();
  return (
    <div className="space-y-6">
      <PageHero
        title={lang === "ar" ? "اتصل بنا" : "Contact"}
        eyebrow={lang === "ar" ? "نحن هنا لخدمتك" : "We are here to help"}
        lang={lang}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="mb-2 text-lg font-black text-slate-900">{lang === "ar" ? "خط الدعم" : "Support Line"}</h3>
          <p className="text-sm text-slate-600">{siteContact.phoneDisplay}</p>
          <p className="mt-2 text-sm text-slate-600">{siteContact.email}</p>
          <a className="mt-4 inline-block text-sm font-bold text-teal-600" href={siteContact.whatsappUrl} target="_blank" rel="noreferrer">{lang === "ar" ? "دردشة عبر واتساب" : "Chat on WhatsApp"}</a>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="mb-2 text-lg font-black text-slate-900">{lang === "ar" ? "أوقات العمل" : "Opening hours"}</h3>
          <p className="text-sm text-slate-600">{lang === "ar" ? "على مدار الساعة" : "24/7"}</p>
          <p className="mt-2 text-sm text-slate-600">{lang === "ar" ? "يمكنك أيضاً زيارة أحد فروعنا" : "You can also visit one of our branches"}</p>
        </div>
      </div>
    </div>
  );
}
