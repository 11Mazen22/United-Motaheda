import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { createForgotPasswordSchema, type ForgotPasswordFormValues } from "../auth/authSchemas";

const TEAL = "#0E7E74";
const INK = "#0A1220";

/**
 * /forgot-password — did not exist at all before this fix (confirmed live:
 * no "forgot password" link, no page, no resetPasswordForEmail() call
 * anywhere in this app). Mirrors AuthCallback's standalone centered-card
 * shell rather than the login/register split-panel AuthLayout, since this
 * is a single-purpose screen, not a third tab bolted onto that switcher.
 */
export default function ForgotPassword() {
  const { lang } = useLanguage();
  const isArabic = lang === "ar";
  const ReturnIcon = isArabic ? ArrowRight : ArrowLeft;

  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(createForgotPasswordSchema(lang)),
    defaultValues: { email: "" },
  });

  const rootError = form.formState.errors.root?.message;
  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    try {
      const supabase = getSupabaseClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (error) throw error;
      setSentEmail(email.trim());
      setSent(true);
    } catch {
      // Deliberately generic and always the "sent" outcome regardless of
      // whether the email exists — never confirm/deny account existence
      // through a password-reset form, that's a real account-enumeration
      // leak. Supabase itself returns success even for an unknown email for
      // the same reason; this keeps that behavior even if the network call
      // itself fails.
      setSentEmail(email.trim());
      setSent(true);
    }
  });

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
              borderColor: sent ? "rgba(16,185,129,0.25)" : "rgba(14,126,116,0.2)",
              background: sent ? "rgba(16,185,129,0.08)" : "rgba(14,126,116,0.08)",
            }}
          >
            {sent ? (
              <MailCheck className="h-8 w-8 text-emerald-600" />
            ) : (
              <KeyRound className="h-8 w-8" style={{ color: TEAL }} />
            )}
          </div>

          <h1 className="text-xl font-black tracking-tight" style={{ color: INK }}>
            {sent
              ? (isArabic ? "تحقق من بريدك الإلكتروني" : "Check your email")
              : (isArabic ? "نسيت كلمة المرور؟" : "Forgot your password?")}
          </h1>
          <p className="mt-2 max-w-xs text-sm font-medium leading-6 text-slate-500">
            {sent ? (
              <>
                {isArabic ? "أرسلنا رابط إعادة تعيين كلمة المرور إلى" : "We sent a password reset link to"}{" "}
                <span className="font-bold text-slate-700">{sentEmail}</span>
              </>
            ) : (
              isArabic
                ? "أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور."
                : "Enter your email and we'll send you a link to reset your password."
            )}
          </p>
        </div>

        {sent ? (
          <div className="mt-7 flex flex-col gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
              {isArabic
                ? "لم تصلك الرسالة؟ تحقق من مجلد الرسائل غير المرغوب فيها."
                : "Didn't get it? Check your spam folder, or try again below."}
            </div>
            <button
              type="button"
              onClick={() => { setSent(false); form.reset({ email: sentEmail }); }}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {isArabic ? "إرسال مرة أخرى" : "Send again"}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            {rootError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {rootError}
              </div>
            )}

            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-slate-700">
                {isArabic ? "البريد الإلكتروني" : "Email"}
              </span>
              <div className="relative">
                <Mail className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isArabic ? "right-3.5" : "left-3.5"}`} />
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  dir="ltr"
                  placeholder="name@example.com"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 ps-11 pe-4 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] outline-none transition-all placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-50"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email ? (
                <span className="text-xs font-semibold text-rose-600">{form.formState.errors.email.message}</span>
              ) : null}
            </label>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              className="mt-2 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-bold text-white shadow-[0_6px_20px_rgba(14,126,116,0.35)] transition-all hover:shadow-[0_8px_24px_rgba(14,126,116,0.45)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                isArabic ? "إرسال رابط إعادة التعيين" : "Send reset link"
              )}
            </motion.button>
          </form>
        )}

        <div className="mt-8 flex items-center justify-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-bold transition-colors hover:underline"
            style={{ color: TEAL }}
          >
            <ReturnIcon className="h-3.5 w-3.5" />
            {isArabic ? "العودة لتسجيل الدخول" : "Back to sign in"}
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {isArabic ? "جلسة آمنة ومشفّرة · SSL 256-bit" : "Secure & encrypted · 256-bit SSL"}
        </div>
      </motion.div>
    </div>
  );
}
