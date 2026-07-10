import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";

interface SuspensionPageState {
  suspendedAt?: string;
  durationType?: "permanent" | "temporary";
  expiresAt?: string;
  reasonCodes?: string[];
  adminNotes?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: "easeOut" as const } },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

export default function SuspendedPage() {
  const { lang } = useLanguage();
  const isArabic = lang === "ar";
  const navigate = useNavigate();
  const location = useLocation();
  // Normal path: React Router navigation state, set by the interactive
  // login()/AccountSuspendedError flow. Fallback: sessionStorage, set by
  // AuthContext's realtime listener when a session gets suspended live
  // mid-visit — that path uses a hard window.location redirect (the
  // AuthProvider sits above BrowserRouter, so no navigate() is available
  // there), which can't carry React Router state directly.
  const state = ((): SuspensionPageState | null => {
    if (location.state) return location.state as SuspensionPageState;
    try {
      const raw = sessionStorage.getItem("pending_suspension_detail");
      if (!raw) return null;
      sessionStorage.removeItem("pending_suspension_detail");
      return JSON.parse(raw) as SuspensionPageState;
    } catch {
      return null;
    }
  })();

  /* ── No state: generic fallback ── */
  if (!state) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#F2F5F9] px-4 py-12"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <div className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <path
                d="M18 3L3 31h30L18 3z"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinejoin="round"
                fill="rgba(244,63,94,0.08)"
              />
              <rect x="16.5" y="14" width="3" height="9" rx="1.5" fill="#f43f5e" />
              <circle cx="18" cy="26.5" r="1.5" fill="#f43f5e" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            {isArabic ? "تم تعليق الحساب" : "Account Suspended"}
          </h1>
          <p className="mt-3 text-sm font-medium text-slate-500">
            {isArabic
              ? "حسابك موقوف حاليًا. يرجى التواصل مع الدعم لمزيد من المعلومات."
              : "Your account has been suspended. Please contact support for more information."}
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-bold text-white shadow-[0_4px_14px_rgba(14,126,116,0.3)] transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
          >
            {isArabic ? "العودة للرئيسية" : "Return to Home"}
          </button>
        </div>
      </div>
    );
  }

  const { suspendedAt, durationType, expiresAt, reasonCodes, adminNotes } = state;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isArabic ? "ar-EG" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const durationLabel = () => {
    if (!durationType) return null;
    if (durationType === "permanent") return isArabic ? "تعليق دائم" : "Permanent";
    if (expiresAt)
      return isArabic
        ? `مؤقت — ينتهي في ${fmtDate(expiresAt)}`
        : `Temporary — expires ${fmtDate(expiresAt)}`;
    return isArabic ? "مؤقت" : "Temporary";
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[#F2F5F9] px-4 py-12"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-lg"
      >
        {/* ── Card ── */}
        <motion.div
          variants={fadeUp}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
        >
          {/* Top rose stripe + illustration */}
          <div className="relative flex flex-col items-center bg-rose-50 px-8 pt-10 pb-8">
            {/* Decorative background rings */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-72 w-72 rounded-full border border-rose-100/60" />
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-52 w-52 rounded-full border border-rose-200/50" />
            </div>

            {/* Inline SVG shield-with-lock illustration */}
            <svg
              width="80"
              height="88"
              viewBox="0 0 80 88"
              fill="none"
              aria-hidden="true"
              className="relative z-10 drop-shadow-md"
            >
              {/* Shield body */}
              <path
                d="M40 4L8 16v24c0 18.78 13.65 36.35 32 40 18.35-3.65 32-21.22 32-40V16L40 4z"
                fill="rgba(244,63,94,0.12)"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {/* Lock body */}
              <rect x="29" y="41" width="22" height="17" rx="4" fill="#f43f5e" opacity="0.85" />
              {/* Lock shackle */}
              <path
                d="M33 41v-4a7 7 0 0 1 14 0v4"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Keyhole */}
              <circle cx="40" cy="49" r="2.5" fill="white" />
              <rect x="38.5" y="50" width="3" height="4" rx="1" fill="white" />
            </svg>

            {/* Heading + badge */}
            <h1 className="relative z-10 mt-5 text-2xl font-black text-slate-900">
              {isArabic ? "تم تعليق الحساب" : "Account Suspended"}
            </h1>
            <span className="relative z-10 mt-3 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-100 px-3.5 py-1 text-xs font-black uppercase tracking-wide text-rose-700">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {isArabic ? "موقوف" : "Suspended"}
            </span>
          </div>

          {/* ── Body ── */}
          <div className="px-8 py-7 space-y-6">

            {/* Suspension date */}
            {suspendedAt && (
              <motion.div variants={fadeUp} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <rect x="2" y="3" width="16" height="15" rx="3" stroke="#64748b" strokeWidth="1.5" />
                    <path d="M6 1v4M14 1v4M2 8h16" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {isArabic ? "تاريخ التعليق" : "Suspended on"}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">{fmtDate(suspendedAt)}</p>
                </div>
              </motion.div>
            )}

            {/* Duration */}
            {durationType && (
              <motion.div variants={fadeUp} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" stroke="#64748b" strokeWidth="1.5" />
                    <path d="M10 6v4l3 2" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {isArabic ? "المدة" : "Duration"}
                  </p>
                  <p
                    className={`mt-0.5 text-sm font-semibold ${
                      durationType === "permanent" ? "text-rose-700" : "text-amber-700"
                    }`}
                  >
                    {durationLabel()}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Policy codes */}
            {reasonCodes && reasonCodes.length > 0 && (
              <motion.div variants={fadeUp}>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  {isArabic ? "بنود السياسة المطبقة" : "Policies Applied"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {reasonCodes.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black text-rose-700"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Admin notes */}
            {adminNotes && (
              <motion.div
                variants={fadeUp}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {isArabic ? "ملاحظة الإدارة" : "Administrator Note"}
                </p>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-700">
                  {adminNotes}
                </p>
              </motion.div>
            )}

            {/* ── Action buttons ── */}
            <motion.div variants={fadeUp} className="grid gap-3 pt-1">
              {/* Learn more */}
              {reasonCodes && reasonCodes.length > 0 && (
                <button
                  onClick={() =>
                    navigate("/suspension-info", { state: { reasonCodes } })
                  }
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(14,126,116,0.3)] transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M10 9v5M10 7v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {isArabic ? "اعرف المزيد" : "Learn More"}
                </button>
              )}

              {/* Contact support */}
              <a
                href="mailto:support@unitedpharmacies.net"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="2" y="4" width="16" height="12" rx="2.5" stroke="#475569" strokeWidth="1.5" />
                  <path d="M2 7l8 5 8-5" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {isArabic ? "التواصل مع الدعم" : "Contact Support"}
              </a>

              {/* Return home */}
              <button
                onClick={() => navigate("/")}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <rect x="7.5" y="11" width="5" height="7" rx="1" stroke="#94a3b8" strokeWidth="1.5" />
                </svg>
                {isArabic ? "العودة للرئيسية" : "Return to Home"}
              </button>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Security note ── */}
        <motion.p
          variants={fadeUp}
          className="mt-6 text-center text-xs font-semibold text-slate-400"
        >
          {isArabic
            ? "إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع فريق الدعم لمراجعة حالة حسابك."
            : "If you believe this is a mistake, contact our support team to review your account status."}
        </motion.p>
      </motion.div>
    </div>
  );
}
