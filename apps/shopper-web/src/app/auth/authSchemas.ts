import { z } from "zod";

export const EGYPTIAN_MOBILE_REGEX = /^(?:\+?20|0)?1[0125]\d{8}$/;

export type LoginFormValues = {
  email: string;
  password: string;
};

export type RegisterFormValues = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

export type ForgotPasswordFormValues = {
  email: string;
};

export type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

export function createLoginSchema(lang: "ar" | "en") {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, lang === "ar" ? "أدخل البريد الإلكتروني." : "Enter your email address.")
      .email(lang === "ar" ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address."),
    password: z
      .string()
      .min(1, lang === "ar" ? "أدخل كلمة المرور." : "Enter your password."),
  });
}

function passwordRulesSchema(lang: "ar" | "en") {
  return z
    .string()
    .min(8, lang === "ar" ? "يجب أن تكون كلمة المرور 8 أحرف على الأقل." : "Password must be at least 8 characters.")
    .refine(
      (value) => /[a-z]/.test(value),
      lang === "ar" ? "أضف حرفًا صغيرًا واحدًا على الأقل." : "Include at least one lowercase letter.",
    )
    .refine(
      (value) => /[A-Z]/.test(value),
      lang === "ar" ? "أضف حرفًا كبيرًا واحدًا على الأقل." : "Include at least one uppercase letter.",
    )
    .refine(
      (value) => /\d/.test(value),
      lang === "ar" ? "أضف رقمًا واحدًا على الأقل." : "Include at least one number.",
    )
    .refine(
      (value) => /[^A-Za-z0-9]/.test(value),
      lang === "ar" ? "أضف رمزًا خاصًا واحدًا على الأقل." : "Include at least one special character.",
    );
}

export function createRegisterSchema(lang: "ar" | "en") {
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(1, lang === "ar" ? "أدخل الاسم الكامل." : "Enter your full name."),
      email: z
        .string()
        .trim()
        .min(1, lang === "ar" ? "أدخل البريد الإلكتروني." : "Enter your email address.")
        .email(lang === "ar" ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address."),
      phone: z
        .string()
        .trim()
        .refine(
          (value) => value.length === 0 || EGYPTIAN_MOBILE_REGEX.test(value),
          lang === "ar"
            ? "أدخل رقم هاتف مصري صحيحًا مثل 01012345678 أو +201012345678."
            : "Enter a valid Egyptian mobile number such as 01012345678 or +201012345678.",
        ),
      password: passwordRulesSchema(lang),
      confirmPassword: z
        .string()
        .min(1, lang === "ar" ? "أكد كلمة المرور." : "Confirm your password."),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: lang === "ar" ? "تأكيد كلمة المرور غير مطابق." : "Password confirmation does not match.",
      path: ["confirmPassword"],
    });
}

export function createForgotPasswordSchema(lang: "ar" | "en") {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, lang === "ar" ? "أدخل البريد الإلكتروني." : "Enter your email address.")
      .email(lang === "ar" ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address."),
  });
}

export function createResetPasswordSchema(lang: "ar" | "en") {
  return z
    .object({
      password: passwordRulesSchema(lang),
      confirmPassword: z
        .string()
        .min(1, lang === "ar" ? "أكد كلمة المرور." : "Confirm your password."),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: lang === "ar" ? "تأكيد كلمة المرور غير مطابق." : "Password confirmation does not match.",
      path: ["confirmPassword"],
    });
}

export function getPasswordStrength(password: string, lang: "ar" | "en") {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  const score = checks.filter(Boolean).length;

  if (score <= 1) {
    return {
      color: "bg-rose-500",
      label: lang === "ar" ? "ضعيفة" : "Weak",
      score,
    };
  }

  if (score === 2) {
    return {
      color: "bg-amber-500",
      label: lang === "ar" ? "مقبولة" : "Fair",
      score,
    };
  }

  if (score === 3) {
    return {
      color: "bg-cyan-500",
      label: lang === "ar" ? "جيدة" : "Good",
      score,
    };
  }

  return {
    color: "bg-emerald-500",
    label: lang === "ar" ? "قوية" : "Strong",
    score,
  };
}
