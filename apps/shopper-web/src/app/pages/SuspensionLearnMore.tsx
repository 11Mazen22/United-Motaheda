import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { POLICIES, getPolicyByCode, type Policy } from "../../data/policyData";

/* ── Animation helpers ──────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.44, ease: "easeOut" as const } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

/* ── Severity colour map ─────────────────────────────────────────── */
const severityStyle: Record<string, { bg: string; text: string; border: string; label: string; labelAr: string }> = {
  low:      { bg: "bg-slate-100",  text: "text-slate-700",  border: "border-slate-200",  label: "Low",      labelAr: "منخفض"    },
  medium:   { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200",  label: "Medium",   labelAr: "متوسط"    },
  high:     { bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200", label: "High",     labelAr: "عالي"     },
  critical: { bg: "bg-rose-50",    text: "text-rose-700",   border: "border-rose-200",   label: "Critical", labelAr: "حرج"      },
};

interface LearnMoreState {
  reasonCodes?: string[];
}

export default function SuspensionLearnMore() {
  const { lang } = useLanguage();
  const isArabic = lang === "ar";
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LearnMoreState | null) ?? null;

  const reasonCodes: string[] = state?.reasonCodes ?? [];

  /* Build policy list: matched codes first; fall back to all policies */
  const matchedPolicies: Policy[] = reasonCodes
    .map((code) => getPolicyByCode(code))
    .filter((p): p is Policy => Boolean(p));

  const displayPolicies: Policy[] = matchedPolicies.length > 0 ? matchedPolicies : POLICIES;
  const showViolated = matchedPolicies.length > 0;

  const faqs = [
    {
      q: isArabic ? "كم مدة التعليق؟" : "How long will my account be suspended?",
      a: isArabic
        ? "تعتمد المدة على طبيعة المخالفة. التعليق المؤقت ينتهي بالتاريخ المحدد في إشعار التعليق. التعليق الدائم يستلزم مراجعة الفريق."
        : "Duration depends on the nature of the violation. Temporary suspensions end on the date shown in your suspension notice. Permanent suspensions require a team review.",
    },
    {
      q: isArabic ? "هل يمكنني إنشاء حساب جديد؟" : "Can I create a new account?",
      a: isArabic
        ? "إنشاء حساب جديد للتحايل على قرار التعليق يُعدّ انتهاكًا إضافيًا لسياساتنا وقد يؤدي إلى حظر دائم."
        : "Creating a new account to circumvent a suspension is an additional violation of our policies and may result in a permanent ban.",
    },
    {
      q: isArabic ? "كيف أتواصل مع الدعم؟" : "How do I contact support?",
      a: isArabic
        ? "يمكنك التواصل معنا عبر البريد الإلكتروني support@unitedpharmacies.net. يُرجى ذكر بريدك الإلكتروني المرتبط بالحساب وسبب طلب المراجعة."
        : "Email us at support@unitedpharmacies.net. Please include your account email address and the reason for your review request.",
    },
    {
      q: isArabic ? "ماذا يحدث لسجل طلباتي؟" : "What happens to my order history?",
      a: isArabic
        ? "يظل سجل طلباتك محفوظًا كاملًا طوال فترة التعليق. في حال رُفع التعليق، ستتمكن من الوصول إلى جميع بياناتك السابقة."
        : "Your order history is fully preserved during the suspension period. If the suspension is lifted, you will have access to all your previous data.",
    },
  ];

  return (
    <div
      className="min-h-screen bg-[#F2F5F9]"
      dir={isArabic ? "rtl" : "ltr"}
    >
      {/* ══ HERO — dark ink panel ══════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{ background: "#0A1220" }}
      >
        {/* Teal corner glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isArabic
              ? "radial-gradient(ellipse 70% 60% at 10% 5%, rgba(14,126,116,0.48) 0%, transparent 60%)"
              : "radial-gradient(ellipse 70% 60% at 90% 5%, rgba(14,126,116,0.48) 0%, transparent 60%)",
          }}
        />
        {/* Cross pharmacy texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Crect x='21' y='10' width='10' height='32' rx='5' fill='rgba(255%2C255%2C255%2C0.025)'/%3E%3Crect x='10' y='21' width='32' height='10' rx='5' fill='rgba(255%2C255%2C255%2C0.025)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative mx-auto max-w-4xl px-6 py-14">
          {/* Back button */}
          <button
            onClick={() => navigate("/suspended", { state })}
            className="mb-8 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {/* Chevron pointing logically backward */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              style={{ transform: isArabic ? "rotate(0deg)" : "rotate(180deg)" }}
            >
              <path d="M8.5 3.5L5 7l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isArabic ? "العودة" : "Back"}
          </button>

          {/* Shield icon */}
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <path
                d="M15 2L3 7v9c0 7.04 5.12 13.63 12 15 6.88-1.37 12-7.96 12-15V7L15 2z"
                fill="rgba(78,206,198,0.18)"
                stroke="#4ecec6"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M10 15l3.5 3.5L20 11" stroke="#4ecec6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1
            className="font-black leading-tight tracking-tight text-white"
            style={{ fontSize: "clamp(1.7rem, 3vw, 2.6rem)" }}
          >
            {isArabic ? "معايير المجتمع والسياسات" : "Community Standards & Policies"}
          </h1>
          <p
            className="mt-4 max-w-xl text-sm font-semibold leading-7"
            style={{ color: "rgba(255,255,255,0.46)" }}
          >
            {isArabic
              ? "نلتزم بتوفير بيئة آمنة وموثوقة لجميع مستخدمينا. تساعدنا هذه السياسات على ضمان جودة الخدمة وحماية الجميع."
              : "We are committed to providing a safe and trusted environment for all our users. These policies help us ensure service quality and protect everyone."}
          </p>
        </div>
      </div>

      {/* ══ MAIN CONTENT ════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-4xl px-6 py-12">

        {/* ── Violated Policies section ──────────────────────────────── */}
        <motion.section
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mb-14"
        >
          <motion.div variants={fadeUp} className="mb-6">
            {showViolated ? (
              <div className="flex items-center gap-3">
                <span className="h-5 w-1 rounded-full bg-rose-500" />
                <h2 className="text-lg font-black text-slate-900">
                  {isArabic ? "السياسات المطبقة على حسابك" : "Policies Applied to Your Account"}
                </h2>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="h-5 w-1 rounded-full bg-teal-600" />
                <h2 className="text-lg font-black text-slate-900">
                  {isArabic ? "جميع السياسات كمرجع" : "All Policies for Reference"}
                </h2>
              </div>
            )}
          </motion.div>

          <div className="space-y-5">
            {displayPolicies.map((policy) => {
              const sev = severityStyle[policy.severity] ?? severityStyle.medium;
              return (
                <motion.div
                  key={policy.code}
                  variants={fadeUp}
                  className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">
                      {policy.code}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${sev.bg} ${sev.text} ${sev.border}`}
                    >
                      {isArabic ? sev.labelAr : sev.label}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {isArabic ? policy.categoryAr : policy.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mt-4 text-base font-black text-slate-900">
                    {isArabic ? policy.titleAr : policy.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                    {isArabic ? policy.descriptionAr : policy.description}
                  </p>

                  {/* Examples */}
                  {policy.examples && policy.examples.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        {isArabic ? "أمثلة" : "Examples"}
                      </p>
                      <ul className="space-y-1">
                        {(isArabic && policy.examplesAr ? policy.examplesAr : policy.examples).map((ex, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                            {ex}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Consequences */}
                  {policy.consequences && (
                    <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-rose-500">
                        {isArabic ? "العواقب" : "Consequences"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {isArabic ? policy.consequencesAr : policy.consequences}
                      </p>
                    </div>
                  )}

                  {/* Why this matters */}
                  {policy.whyItMatters && (
                    <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-teal-600">
                        {isArabic ? "لماذا هذا مهم؟" : "Why this matters"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {isArabic ? policy.whyItMattersAr : policy.whyItMatters}
                      </p>
                    </div>
                  )}

                  {/* Appeal eligibility */}
                  <div className="mt-4 flex items-center gap-2">
                    {policy.appealEligible ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <circle cx="8" cy="8" r="7" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.5" />
                          <path d="M5 8l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-xs font-bold text-emerald-700">
                          {isArabic ? "قابل للاستئناف" : "Appeal eligible"}
                        </span>
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <circle cx="8" cy="8" r="7" fill="rgba(244,63,94,0.1)" stroke="#f43f5e" strokeWidth="1.5" />
                          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span className="text-xs font-bold text-rose-700">
                          {isArabic ? "غير قابل للاستئناف" : "Not eligible for appeal"}
                        </span>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Appeal Process ─────────────────────────────────────────── */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mb-14"
        >
          <motion.div variants={fadeUp} className="mb-6 flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-teal-600" />
            <h2 className="text-lg font-black text-slate-900">
              {isArabic ? "عملية الاستئناف" : "Appeal Process"}
            </h2>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-slate-200/80 bg-white p-7 shadow-sm"
          >
            <div className="space-y-6">
              {[
                {
                  step: "01",
                  title: isArabic ? "راجع السياسات" : "Review the Policies",
                  desc: isArabic
                    ? "اقرأ السياسات المطبقة على حسابك بعناية لفهم سبب القرار."
                    : "Carefully read the policies applied to your account to understand the reason for the decision.",
                },
                {
                  step: "02",
                  title: isArabic ? "تواصل مع الدعم" : "Contact Support",
                  desc: isArabic
                    ? "أرسل طلبك إلى support@unitedpharmacies.net مع ذكر بريدك الإلكتروني وأسباب الاستئناف."
                    : "Send your request to support@unitedpharmacies.net with your email and reasons for appeal.",
                },
                {
                  step: "03",
                  title: isArabic ? "انتظر المراجعة" : "Await Review",
                  desc: isArabic
                    ? "يستغرق الرد عادةً من 2 إلى 5 أيام عمل. سنتواصل معك عبر البريد الإلكتروني."
                    : "We typically respond within 2–5 business days. We will contact you via email.",
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-5">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-black text-white"
                    style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
                  >
                    {step}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="mailto:support@unitedpharmacies.net"
              className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-[0_4px_14px_rgba(14,126,116,0.3)] transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2" y="4" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 7l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              support@unitedpharmacies.net
            </a>
          </motion.div>
        </motion.section>

        {/* ── FAQ ────────────────────────────────────────────────────── */}
        <motion.section
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mb-14"
        >
          <motion.div variants={fadeUp} className="mb-6 flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-slate-400" />
            <h2 className="text-lg font-black text-slate-900">
              {isArabic ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
            </h2>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
              >
                <p className="font-bold text-slate-900">{faq.q}</p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Footer navigation ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8"
        >
          <button
            onClick={() => navigate("/suspended", { state })}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              style={{ transform: isArabic ? "rotate(0deg)" : "rotate(180deg)" }}
            >
              <path d="M8.5 3.5L5 7l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isArabic ? "العودة لصفحة التعليق" : "Back to suspension page"}
          </button>

          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
          >
            {isArabic ? "الصفحة الرئيسية" : "Return to Home"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
