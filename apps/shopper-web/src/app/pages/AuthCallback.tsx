import { motion } from "framer-motion";
import { Loader2, MailOpen, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";

/**
 * /auth/callback — the landing page Google (and any future OAuth provider)
 * redirects back to after signInWithOAuth(). Mirrors the native app's
 * /auth-callback screen so the transitional moment feels the same on both
 * platforms, and is where the suspended/inactive check that login() does
 * inline for the password path runs for this one.
 *
 * No manual exchangeCodeForSession() here — the web Supabase client keeps
 * detectSessionInUrl:true (its default), so it auto-exchanges the ?code= in
 * this URL and fires onAuthStateChange(SIGNED_IN) before this component's
 * effect even needs to look. We just wait for AuthContext's `user`/`loading`
 * to settle and then route.
 */
export default function AuthCallback() {
  const { user, loading, signOut } = useAuth();
  const { lang } = useLanguage();
  const isArabic = lang === "ar";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [timedOut, setTimedOut] = useState(false);
  const settledRef = useRef(false);

  const errorDescription = searchParams.get("error_description");

  useEffect(() => {
    // Provider (or Supabase) sent us back with an error — e.g. the user
    // declined consent. Nothing to wait for.
    if (errorDescription) return;

    const timer = setTimeout(() => {
      if (!settledRef.current) setTimedOut(true);
    }, 12_000);
    return () => clearTimeout(timer);
  }, [errorDescription]);

  useEffect(() => {
    if (loading || !user || settledRef.current) return;
    settledRef.current = true;

    if (user.status === "Suspended") {
      void signOut().then(() => {
        navigate("/suspended", { replace: true });
      });
      return;
    }
    if (user.status === "Inactive") {
      void signOut().then(() => {
        toast.error(
          isArabic
            ? "هذا الحساب غير نشط. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ."
            : "This account has been deactivated. Contact support if you think this is a mistake.",
        );
        navigate("/login", { replace: true });
      });
      return;
    }

    const dest =
      user.role === "admin" || user.role === "manager" || user.role === "pharmacist" ? "/admin" :
      user.role === "driver" ? "/driver" : "/";
    navigate(dest, { replace: true });
  }, [loading, user, navigate, signOut]);

  const failed = Boolean(errorDescription) || timedOut;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F9FB] px-6" dir={isArabic ? "rtl" : "ltr"}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex w-full max-w-sm flex-col items-center text-center"
      >
        <div
          className={
            failed
              ? "mb-6 flex h-[76px] w-[76px] items-center justify-center rounded-[22px] border border-rose-200 bg-rose-50"
              : "mb-6 flex h-[76px] w-[76px] items-center justify-center rounded-[22px] border border-teal-200 bg-teal-50 shadow-[0_10px_30px_rgba(14,126,116,0.18)]"
          }
        >
          <MailOpen className={failed ? "h-8 w-8 text-rose-500" : "h-8 w-8 text-teal-700"} />
        </div>

        {failed ? (
          <>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              {isArabic ? "تعذّر تسجيل الدخول" : "Couldn't sign you in"}
            </h1>
            <p className="mt-2 max-w-xs text-sm font-medium leading-6 text-slate-500">
              {errorDescription
                ? decodeURIComponent(errorDescription)
                : isArabic
                  ? "العملية تستغرق وقتاً أطول من المعتاد. تحقق من اتصالك وحاول مرة أخرى."
                  : "This is taking longer than expected. Check your connection and try again."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="mt-7 inline-flex h-12 w-60 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              {isArabic ? "العودة لتسجيل الدخول" : "Back to sign in"}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              {isArabic ? "جارٍ تأكيد تسجيل الدخول" : "Confirming your sign-in"}
            </h1>
            <p className="mt-2 max-w-xs text-sm font-medium leading-6 text-slate-500">
              {isArabic ? "ثوانٍ معدودة ثم نعود بك إلى المتجر" : "Just a moment — redirecting you back"}
            </p>
            <div className="mt-7">
              <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
            </div>
          </>
        )}

        <div className="mt-10 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {isArabic ? "جلسة آمنة ومشفّرة" : "Secure & encrypted session"}
        </div>
      </motion.div>
    </div>
  );
}
