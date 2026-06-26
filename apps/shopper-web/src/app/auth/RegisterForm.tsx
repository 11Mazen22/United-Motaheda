import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { cn } from "../components/UI";
import {
  createRegisterSchema,
  getPasswordStrength,
  type RegisterFormValues,
} from "./authSchemas";

const TEAL = "#0E7E74";

type RegisterFormProps = {
  from?: string;
};

export default function RegisterForm({ from = "" }: RegisterFormProps) {
  const { register: registerAccount } = useAuth();
  const { lang }     = useLanguage();
  const navigate     = useNavigate();
  const isArabic     = lang === "ar";
  const schema       = useMemo(() => createRegisterSchema(lang), [lang]);
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver:      zodResolver(schema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", confirmPassword: "" },
  });

  const password   = form.watch("password");
  const strength   = getPasswordStrength(password, lang);
  const isSubmitting = form.formState.isSubmitting;
  const rootError    = form.formState.errors.root?.message;

  const passwordChecks = [
    { done: password.length >= 8,                              label: isArabic ? "8 أحرف على الأقل"      : "At least 8 characters"     },
    { done: /[a-z]/.test(password) && /[A-Z]/.test(password), label: isArabic ? "حروف كبيرة وصغيرة"     : "Upper & lowercase letters"  },
    { done: /\d/.test(password),                               label: isArabic ? "رقم واحد على الأقل"    : "At least one number"        },
    { done: /[^A-Za-z0-9]/.test(password),                    label: isArabic ? "رمز خاص واحد على الأقل" : "At least one special char"  },
  ];

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await registerAccount({
        fullName: values.fullName,
        email:    values.email,
        password: values.password,
        phone:    values.phone || undefined,
        address:  "",
      });

      if (result.session) {
        toast.success(isArabic ? "تم إنشاء الحساب وتسجيل الدخول مباشرة." : "Account created and signed in.");
        navigate("/", { replace: true });
        return;
      }

      toast.success(
        isArabic
          ? "تم إنشاء الحساب. راجع بريدك الإلكتروني ثم سجل الدخول."
          : "Account created. Check your email then sign in.",
      );
      navigate(
        `/login?tab=login&registered=1&email=${encodeURIComponent(values.email.trim())}`,
        { replace: true, state: from ? { from } : undefined },
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : isArabic ? "تعذر إنشاء الحساب الآن." : "Unable to create your account right now.";
      form.setError("root", { message });
      toast.error(message);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">

      {/* Root error */}
      {rootError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {rootError}
        </div>
      )}

      {/* ── Fields ── */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Full name — spans both columns */}
        <AuthField
          className="sm:col-span-2"
          error={form.formState.errors.fullName?.message}
          icon={UserRound}
          isArabic={isArabic}
          label={isArabic ? "الاسم الكامل" : "Full name"}
        >
          <input
            type="text"
            autoComplete="name"
            placeholder={isArabic ? "الاسم كما سيظهر في الحساب" : "Your account display name"}
            className={inputClass(Boolean(form.formState.errors.fullName))}
            {...form.register("fullName")}
          />
        </AuthField>

        {/* Email */}
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

        {/* Phone */}
        <AuthField
          error={form.formState.errors.phone?.message}
          icon={Phone}
          isArabic={isArabic}
          label={isArabic ? "الهاتف (اختياري)" : "Phone (optional)"}
        >
          <input
            type="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="01012345678"
            className={inputClass(Boolean(form.formState.errors.phone))}
            {...form.register("phone")}
          />
        </AuthField>

        {/* Password */}
        <AuthField
          error={form.formState.errors.password?.message}
          icon={LockKeyhole}
          isArabic={isArabic}
          label={isArabic ? "كلمة المرور" : "Password"}
          end={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}
              className="text-slate-400 transition-colors hover:text-slate-700"
              aria-label={showPwd ? (isArabic ? "إخفاء" : "Hide") : (isArabic ? "إظهار" : "Show")}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        >
          <input
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            dir="ltr"
            placeholder="••••••••"
            className={inputClass(Boolean(form.formState.errors.password), true)}
            {...form.register("password")}
          />
        </AuthField>

        {/* Confirm password */}
        <AuthField
          error={form.formState.errors.confirmPassword?.message}
          icon={ShieldCheck}
          isArabic={isArabic}
          label={isArabic ? "تأكيد كلمة المرور" : "Confirm password"}
          end={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="text-slate-400 transition-colors hover:text-slate-700"
              aria-label={showConfirm ? (isArabic ? "إخفاء" : "Hide") : (isArabic ? "إظهار" : "Show")}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        >
          <input
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            dir="ltr"
            placeholder="••••••••"
            className={inputClass(Boolean(form.formState.errors.confirmPassword), true)}
            {...form.register("confirmPassword")}
          />
        </AuthField>
      </div>

      {/* ── Password strength ── */}
      {password.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          {/* Bar + label */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors duration-300",
                    i < strength.score ? strength.color : "bg-slate-200",
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-black text-slate-600">{strength.label}</span>
          </div>

          {/* Requirement chips */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {passwordChecks.map((check) => (
              <div
                key={check.label}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors",
                  check.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-400",
                )}
              >
                <CheckCircle2
                  className={cn("h-3.5 w-3.5 flex-shrink-0", check.done ? "text-emerald-500" : "text-slate-300")}
                />
                <span>{check.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Submit ── */}
      <motion.button
        type="submit"
        whileTap={{ scale: 0.98 }}
        disabled={isSubmitting}
        className="mt-1 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-bold text-white shadow-[0_6px_20px_rgba(14,126,116,0.35)] transition-all hover:shadow-[0_8px_24px_rgba(14,126,116,0.45)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
        style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            {isArabic ? "إنشاء الحساب" : "Create account"}
          </>
        )}
      </motion.button>

      {/* Link to login */}
      <p className="text-center text-sm font-semibold text-slate-500">
        {isArabic ? "لديك حساب بالفعل؟" : "Already have an account?"}{" "}
        <Link
          to="/login?tab=login"
          state={from ? { from } : undefined}
          className="font-bold transition-colors hover:underline"
          style={{ color: TEAL }}
        >
          {isArabic ? "تسجيل الدخول" : "Sign in"}
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
}: {
  children: ReactNode;
  className?: string;
  end?: ReactNode;
  error?: string;
  icon: typeof Mail;
  isArabic: boolean;
  label: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-sm font-bold text-slate-700">{label}</span>
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
