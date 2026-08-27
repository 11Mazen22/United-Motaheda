import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn, Mail } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { AccountInactiveError, AccountSuspendedError } from "../../contexts/AuthContext";
import { cn } from "../components/UI";
import { createLoginSchema, type LoginFormValues } from "./authSchemas";
import { AuthDivider, GoogleButton } from "./GoogleButton";

const TEAL = "#0E7E74";

type LoginFormProps = {
  defaultEmail?: string;
  from?: string;
  registrationComplete?: boolean;
};

export default function LoginForm({
  defaultEmail = "",
  from = "",
  registrationComplete = false,
}: LoginFormProps) {
  const { login }     = useAuth();
  const { lang }      = useLanguage();
  const navigate      = useNavigate();
  const isArabic      = lang === "ar";
  const schema        = useMemo(() => createLoginSchema(lang), [lang]);
  const [showPwd, setShowPwd] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver:      zodResolver(schema),
    defaultValues: { email: defaultEmail, password: "" },
  });

  useEffect(() => {
    form.reset({ email: defaultEmail, password: "" });
  }, [defaultEmail, form]);

  const isSubmitting = form.formState.isSubmitting;
  const rootError    = form.formState.errors.root?.message;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await login({ email: values.email, password: values.password });
      toast.success(isArabic ? "تم تسجيل الدخول بنجاح." : "Signed in successfully.");
      const role = result.user?.role;
      const dest =
        role === "admin" || role === "manager" || role === "pharmacist" ? "/admin" :
        role === "driver" ? "/driver" : "/";
      navigate(from.trim() || dest, { replace: true });
    } catch (error) {
      if (error instanceof AccountSuspendedError) {
        navigate("/suspended", { state: error.suspensionData, replace: true });
        return;
      }
      if (error instanceof AccountInactiveError) {
        const msg = isArabic
          ? "هذا الحساب غير نشط. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ."
          : "This account has been deactivated. Contact support if you think this is a mistake.";
        form.setError("root", { message: msg });
        return;
      }
      const message = error instanceof Error
        ? error.message
        : isArabic ? "تعذر تسجيل الدخول الآن." : "Unable to sign in right now.";
      form.setError("root", { message });
      toast.error(message);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">

      {/* Google sign-in */}
      <GoogleButton label={isArabic ? "المتابعة باستخدام Google" : "Continue with Google"} />
      <AuthDivider label={isArabic ? "أو بالبريد الإلكتروني" : "or with email"} />

      {/* Registration-complete banner */}
      {registrationComplete && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {isArabic
            ? "تم إنشاء الحساب — راجع بريدك الإلكتروني ثم سجل الدخول."
            : "Account created — check your email, then sign in below."}
        </div>
      )}

      {/* Email-prefill note (no registration) */}
      {defaultEmail && !registrationComplete && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {isArabic
            ? "إذا أكدت بريدك للتو، يمكنك المتابعة بنفس البريد هنا."
            : "If you just confirmed your email, continue with the same address."}
        </div>
      )}

      {/* Root error */}
      {rootError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {rootError}
        </div>
      )}

      {/* Email field */}
      <AuthField
        error={form.formState.errors.email?.message}
        icon={Mail}
        isArabic={isArabic}
        label={isArabic ? "البريد الإلكتروني" : "Email"}
      >
        <input
          type="email"
          autoComplete="email"
          dir="ltr"
          placeholder="name@example.com"
          className={inputClass(Boolean(form.formState.errors.email))}
          {...form.register("email")}
        />
      </AuthField>

      {/* Password field */}
      <AuthField
        error={form.formState.errors.password?.message}
        icon={LockKeyhole}
        isArabic={isArabic}
        label={isArabic ? "كلمة المرور" : "Password"}
        labelEnd={
          <Link
            to="/forgot-password"
            tabIndex={-1}
            className="text-xs font-bold transition-colors hover:underline"
            style={{ color: TEAL }}
          >
            {isArabic ? "نسيت كلمة المرور؟" : "Forgot password?"}
          </Link>
        }
        end={
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd((v) => !v)}
            className="text-slate-400 transition-colors hover:text-slate-700"
            aria-label={showPwd ? (isArabic ? "إخفاء" : "Hide password") : (isArabic ? "إظهار" : "Show password")}
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      >
        <input
          type={showPwd ? "text" : "password"}
          autoComplete="current-password"
          dir="ltr"
          placeholder="••••••••"
          className={inputClass(Boolean(form.formState.errors.password), true)}
          {...form.register("password")}
        />
      </AuthField>

      {/* Submit */}
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
          <>
            <LogIn className="h-4 w-4" />
            {isArabic ? "تسجيل الدخول" : "Sign in"}
          </>
        )}
      </motion.button>

      {/* Link to register */}
      <p className="text-center text-sm font-semibold text-slate-500">
        {isArabic ? "ليس لديك حساب؟" : "No account yet?"}{" "}
        <Link
          to="/login?tab=register"
          state={from ? { from } : undefined}
          className="font-bold transition-colors hover:underline"
          style={{ color: TEAL }}
        >
          {isArabic ? "إنشاء حساب" : "Create one"}
        </Link>
      </p>
    </form>
  );
}

/* ── Shared field wrapper ──────────────────────────────────────────────── */

function AuthField({
  children,
  className,
  end,
  error,
  icon: Icon,
  isArabic,
  label,
  labelEnd,
}: {
  children: ReactNode;
  className?: string;
  end?: ReactNode;
  error?: string;
  icon: typeof Mail;
  isArabic: boolean;
  label: string;
  labelEnd?: ReactNode;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        {labelEnd}
      </span>
      <div className="relative">
        <Icon
          className={cn(
            "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
            isArabic ? "right-3.5" : "left-3.5",
          )}
        />
        {children}
        {end ? (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2",
              isArabic ? "left-3.5" : "right-3.5",
            )}
          >
            {end}
          </div>
        ) : null}
      </div>
      {error ? (
        <span className="text-xs font-semibold text-rose-600">{error}</span>
      ) : null}
    </label>
  );
}

/* ── Input class helper ────────────────────────────────────────────────── */

function inputClass(hasError: boolean, hasEnd = false): string {
  return cn(
    "h-12 w-full rounded-xl border bg-slate-50/60 ps-11 text-sm font-semibold text-slate-900 outline-none transition-all",
    "shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] placeholder:text-slate-400",
    "focus:bg-white focus:shadow-[0_0_0_0px_transparent]",
    hasEnd ? "pe-11" : "pe-4",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-50/70"
      : "border-slate-200 focus:border-teal-400 focus:ring-4 focus:ring-teal-50",
  );
}
