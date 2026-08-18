import { I18nManager } from "react-native";

export function formatPrice(amount: number, lang: "ar" | "en" = "ar"): string {
  const formatted = amount.toFixed(2);
  return lang === "ar" ? `${formatted} ج.م` : `EGP ${formatted}`;
}

export function formatCount(count: number, lang: "ar" | "en" = "ar"): string {
  if (lang === "ar") {
    if (count === 0) return "لا يوجد";
    if (count === 1) return "منتج واحد";
    if (count === 2) return "منتجان";
    if (count <= 10) return `${count} منتجات`;
    return `${count} منتج`;
  }
  return count === 1 ? "1 product" : `${count} products`;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

export function isRtl(): boolean {
  return I18nManager.isRTL;
}

export function localeName(nameAr?: string, nameEn?: string, lang: "ar" | "en" = "ar"): string {
  if (lang === "ar") return nameAr ?? nameEn ?? "";
  return nameEn ?? nameAr ?? "";
}

/**
 * Safe number formatter. `toLocaleString(locale)` can throw on some Hermes
 * builds depending on which ICU subsets shipped — and a render-path throw
 * drops the whole screen onto the ErrorBoundary. Never let number
 * formatting throw.
 */
export function fmtN(n: unknown): string {
  const num = typeof n === "number" ? n : Number(n ?? 0);
  if (!Number.isFinite(num)) return "0";
  try {
    return num.toLocaleString("ar-EG");
  } catch {
    try { return num.toLocaleString(); } catch { return String(num); }
  }
}

/**
 * Defensively coerce to a valid http(s) URI string; returns null for
 * null/empty/malformed values so callers can fall back to a placeholder
 * instead of letting a bad value reach <Image>.
 */
export function safeUri(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const trimmed = u.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}
