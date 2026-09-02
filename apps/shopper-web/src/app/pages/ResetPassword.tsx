import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { createResetPasswordSchema, getPasswordStrength, type ResetPasswordFormValues } from "../auth/authSchemas";

const TEAL = "#0E7E74";
const INK = "#0A1220";

/** Reads Supabase's recovery-link error out of either the query string
 *  (PKCE flow: ?error=...&error_description=...) or the hash fragment
 *  (implicit flow: #error=...&error_description=...) — an expired/already-
 *  used recovery link surfaces in whichever shape this project's auth flow
 *  setting produces, and only one of the two is ever populated at once. */
function readLinkError(search: URLSearchParams): string | null {
  const fromQuery = search.get("error_description");
  if (fromQuery) return decodeURIComponent(fromQuery);

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return null;
  const hashParams = new URLSearchParams(hash);
  const fromHash = hashParams.get("error_description");
  return fromHash ? decodeURIComponent(fromHash.replace(/\+/g, " ")) : null;
}

/**
 * /reset-password — the page Supabase's password-reset email links to
 * (redirectTo set in ForgotPassword.tsx). The web client's
 * detectSessionInUrl:true auto-exchanges the recovery token in the URL and
 * establishes a short-lived session before this component's effects even
 * run — same mechanism AuthCallback.tsx relies on for the OAuth code
 * exchange. We just wait for that session, then let the user set a new
 * password via updateUser(), which is valid against a recovery session
 * specifically for this purpose.
 */
export default function ResetPassword() {
  const { lang } = useLanguage();
  const isArabic = lang === "ar";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();

  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const schema = useMemo(() => createResetPasswordSchema(lang), [lang]);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const password = form.watch("password");
  const strength = password ? getPasswordStrength(password, lang) : null;
  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  // Give detectSessionInUrl a moment to process the recovery token before
  // deciding the link is invalid — on first paint there's a real race
  // between "token still being exchanged" and "no session, ever".
  useEffect(() => {
    const upfrontError = readLinkError(searchParams);
    if (upfrontError) {
      setLinkError(upfrontError);
      setChecking(false);
      return;
    }
    const timer = setTimeout(() => setChecking(false), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasValidSession = !checking && !authLoading && Boolean(user) && !linkError;
  const linkInvalid = !checking && !authLoading && !user && !linkError;

  const onSubmit = form.handleSubmit(async ({ password: newPassword }) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setDone(true);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : isArabic ? "تعذّر تحديث كلمة المرور." : "Couldn't update your password.";
      form.setError("root", { message });
    }
  });

  const dest = user?.role === "admin" || user?.role === "manager" || user?.role === "pharmacist"
    ? "/admin"
    : user?.role === "driver" ? "/driver" : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2F5F9] px-6" dir={isArabic ? "rtl" : "ltr"}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[26rem] rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_20px_60px_rgba(10,18,32,0.08)]"
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border"
            style={{
              borderColor: done ? "rgba(16,185,129,0.25)" : linkInvalid ? "rgba(225,29,72,0.2)" : "rgba(14,126,116,0.2)",
              background: done ? "rgba(16,185,129,0.08)" : linkInvalid ? "rgba(225,29,72,0.06)" : "rgba(14,126,116,0.08)",
            }}
          >
            {done ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            ) : (
              <KeyRound className="h-8 w-8" style={{ color: linkInvalid ? "#e11d48" : TEAL }} />
            )}
          </div>

          <h1 className="text-xl font-black tracking-tight" style={{ color: INK }}>
            {done
              ? (isArabic ? "تم تحديث كلمة المرور" : "Password updated")
              : linkInvalid
                ? (isArabic ? "الرابط غير صالح" : "This link isn't valid")
                : (isArabic ? "تعيين كلمة مرور جديدة" : "Set a new password")}
          </h1>
          <p className="mt-2 max-w-xs text-sm font-medium leading-6 text-slate-500">
            {done
              ? (isArabic ? "يمكنك الآن المتابعة إلى حسابك." : "You can now continue to your account.")
              : linkInvalid
                ? (linkError ?? (isArabic ? "قد يكون رابط إعادة التعيين منتهي الصلاحية أو تم استخدامه من قبل." : "This reset link may have expired or already been used."))
                : (isArabic ? "اختر كلمة مرور قوية لحسابك." : "Choose a strong password for your account.")}
          </p>
        </div>

        {checking || authLoading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: TEAL }} />
          </div>
        ) : done ? (
          <button
            type="button"
            onClick={() => navigate(dest, { replace: true })}
            className="mt-7 inline-flex h-[52px] w-full items-center justify-center rounded-xl text-[15px] font-bold text-white shadow-[0_6px_20px_rgba(14,126,116,0.35)] transition-all hover:opacity-95"
            style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
          >
            {isArabic ? "المتابعة" : "Continue"}
          </button>
        ) : linkInvalid ? (
          <button
            type="button"
            onClick={() => navigate("/forgot-password", { replace: true })}
            className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            {isArabic ? "طلب رابط جديد" : "Request a new link"}
          </button>
        ) : (
          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            {rootError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {rootError}
              </div>
            )}

            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-slate-700">
                {isArabic ? "كلمة المرور الجديدة" : "New password"}
              </span>
              <div className="relative">
                <LockKeyhole className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isArabic ? "right-3.5" : "left-3.5"}`} />
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  dir="ltr"
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 ps-11 pe-11 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] outline-none transition-all placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-50"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPwd((v) => !v)}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700 ${isArabic ? "left-3.5" : "right-3.5"}`}
                  aria-label={showPwd ? (isArabic ? "إخفاء" : "Hide password") : (isArabic ? "إظهار" : "Show password")}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password ? (
                <span className="text-xs font-semibold text-rose-600">{form.formState.errors.password.message}</span>
              ) : null}
              {strength ? (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${(strength.score / 4) * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">{strength.label}</span>
                </div>
              ) : null}
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-slate-700">
                {isArabic ? "تأكيد كلمة المرور" : "Confirm password"}
              </span>
              <div className="relative">
                <LockKeyhole className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isArabic ? "right-3.5" : "left-3.5"}`} />
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="new-password"
                  dir="ltr"
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 ps-11 pe-4 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] outline-none transition-all placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-50"
                  {...form.register("confirmPassword")}
                />
              </div>
              {form.formState.errors.confirmPassword ? (
                <span className="text-xs font-semibold text-rose-600">{form.formState.errors.confirmPassword.message}</span>
              ) : null}
            </label>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting || !hasValidSession}
              className="mt-2 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-bold text-white shadow-[0_6px_20px_rgba(14,126,116,0.35)] transition-all hover:shadow-[0_8px_24px_rgba(14,126,116,0.45)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isArabic ? "تحديث كلمة المرور" : "Update password")}
            </motion.button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {isArabic ? "جلسة آمنة ومشفّرة · SSL 256-bit" : "Secure & encrypted · 256-bit SSL"}
        </div>
      </motion.div>
    </div>
  );
}
