/**
 * getAuthError — map Supabase auth errors → language-aware user-facing messages.
 *
 * Pass the current i18n language as the second argument so the returned string
 * matches the language the user has selected. Defaults to Arabic so legacy
 * callers that haven't been migrated yet still see Arabic (safe fallback).
 *
 * Fall-through behaviour: surfaces the raw error message rather than swallowing
 * it (a catch-all "something went wrong" hides root causes from users and makes
 * support tickets impossible to triage).
 */

// Small helper — pick Arabic or English based on lang.
const bi = (lang: string, ar: string, en: string): string =>
  lang === "en" ? en : ar;

export function getAuthError(err: unknown, lang = "ar"): string {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  // Email already registered
  if (
    msg.includes("already registered") ||
    msg.includes("user already") ||
    msg.includes("duplicate")
  ) {
    return bi(
      lang,
      "هذا البريد مسجّل مسبقاً. سجّل دخولك بدلاً من ذلك.",
      "This email is already registered. Sign in instead.",
    );
  }

  // Weak / too-short password
  if (
    msg.includes("password") &&
    (msg.includes("short") || msg.includes("weak") || msg.includes("least"))
  ) {
    return bi(
      lang,
      "كلمة المرور ضعيفة جداً. استخدم 6 أحرف على الأقل مع مزيج من الأرقام والحروف.",
      "Password is too weak. Use at least 6 characters including letters and numbers.",
    );
  }

  // Invalid email format
  if (
    msg.includes("invalid email") ||
    msg.includes("email format") ||
    msg.includes("invalid_email")
  ) {
    return bi(
      lang,
      "صيغة البريد الإلكتروني غير صحيحة.",
      "Invalid email address format.",
    );
  }

  // Rate limited
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return bi(
      lang,
      "محاولات كثيرة في وقت قصير. انتظر دقيقة وحاول مجدداً.",
      "Too many attempts. Please wait a moment and try again.",
    );
  }

  // Email confirmation pending
  if (msg.includes("email not confirmed") || msg.includes("confirmation")) {
    return bi(
      lang,
      "تحقق من بريدك الإلكتروني وأكّد الحساب قبل تسجيل الدخول.",
      "Please check your email and confirm your account before signing in.",
    );
  }

  // Network / fetch failures
  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch")
  ) {
    return bi(
      lang,
      "تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مجدداً.",
      "Could not connect to the server. Check your internet connection and try again.",
    );
  }

  // Server-side 504 timeout (GoTrue/Railway slowness on signup)
  if (
    msg.includes("request_timeout") ||
    msg.includes("timed out") ||
    msg.includes("504")
  ) {
    return bi(
      lang,
      "الخادم يستغرق وقتاً أطول من المعتاد. انتظر لحظة ثم حاول مجدداً.",
      "The server is taking too long to respond. Please wait a moment and try again.",
    );
  }

  // Invalid credentials (sign-in path)
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return bi(
      lang,
      "البريد أو كلمة المرور غير صحيحين.",
      "Incorrect email or password.",
    );
  }

  // Account not created (signUp path — language-neutral throw from api.ts)
  if (msg.includes("account was not created") || msg.includes("لم يتم إنشاء الحساب")) {
    return bi(
      lang,
      "لم يتم إنشاء الحساب. حاول مرة أخرى.",
      "Account could not be created. Please try again.",
    );
  }

  // Fall through — surface raw message for diagnosability.
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return bi(
    lang,
    "حدث خطأ غير متوقع. حاول مرة أخرى أو تواصل مع الدعم.",
    "An unexpected error occurred. Please try again or contact support.",
  );
}

// Legacy alias — kept so any call-site I missed still compiles and returns Arabic.
export const authErrorToArabic = (err: unknown): string => getAuthError(err, "ar");
