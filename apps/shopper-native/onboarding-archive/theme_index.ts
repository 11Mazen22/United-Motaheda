/**
 * Design system barrel (self‑contained, 2026 Unified).
 *
 * This is the ONLY theme file you need. It exports:
 *   • `kit` — the single source of truth (V3, compatible with all current tokens)
 *   • `theme` — legacy shim built FROM kit, so old code works with zero changes
 *
 * Both share the same underlying values, so you can migrate incrementally.
 *
 * Recommended new code:
 *   import { kit } from "@/shared/theme";
 *
 * Legacy code (still works):
 *   import { theme } from "@/shared/theme";
 */

import { Platform } from "react-native";

// ── Shadow factory ──────────────────────────────────────────────────────
function makeShadow(
  color: string,
  yOffset: number,
  opacity: number,
  blur: number,
  elevation: number,
): object {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: yOffset },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
    android: { elevation },
    default: {},
  }) ?? {};
}

// ── kit (your existing V3, fully intact) ─────────────────────────────────
export const kit = {
  sp: (n: number): number => n * 4,

  spacing: {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
    "5xl": 48,
    "6xl": 64,
  },

  color: {
    accent: "#06b6d4",
    accentDeep: "#0ea5b7",
    accentTint: "#e6f7f8",
    onAccent: "#ffffff",
    onInk: "#ffffff",

    ink: "#07122a",
    inkSoft: "#475569",
    inkFaint: "#94a3b8",

    canvas: "#f8fafc",
    surface: "#ffffff",
    well: "#f1f5f9",

    line: "#e6eef6",
    lineStrong: "rgba(15, 23, 42, 0.12)",

    success: "#059669",
    successTint: "#ecfdf5",

    warn: "#f59e0b",
    warnTint: "#fff7ed",

    danger: "#ef4444",
    dangerTint: "#fff1f0",
  },

  radius: {
    sm: 6,
    md: 8,
    card: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    pill: 999,
    control: 10,
    sheet: 20,
  },

  shadow: {
    raised: makeShadow("#0f172a", 1, 0.06, 3, 2),
    floating: makeShadow("#0f172a", 4, 0.10, 12, 6),
    deep: makeShadow("#0f172a", 8, 0.14, 20, 10),
    brandGlow: makeShadow("#06b6d4", 0, 0.12, 12, 2),
  },

  type: {
    display: { fontSize: 26, lineHeight: 32 },
    title: { fontSize: 20, lineHeight: 26 },
    heading: { fontSize: 17, lineHeight: 24 },
    body: { fontSize: 14, lineHeight: 20 },
    caption: { fontSize: 12, lineHeight: 17 },
    micro: { fontSize: 10, lineHeight: 14 },
  },
} as const;

// ── Legacy `theme` shim — built from kit so old imports still work ───────
export const theme = {
  colors: {
    brand: {
      base: kit.color.accent,
      deep: kit.color.accentDeep,
      tint: kit.color.accentTint,
      700: kit.color.accentDeep, // commonly used in AppLogo
    },
    text: {
      primary: kit.color.ink,
      secondary: kit.color.inkSoft,
      muted: kit.color.inkFaint,
      tertiary: kit.color.inkFaint,
      disabled: kit.color.inkFaint,
      inverse: kit.color.onInk,
      inverseSoft: kit.color.onInk,
    },
    error: { base: kit.color.danger },
    warning: { base: kit.color.warn },
    success: { base: kit.color.success },
    info: { base: kit.color.accentDeep },
  },

  fonts: {
    black: "Inter-Black",
    extrabold: "Inter-Bold", // closest you have
    bold: "Inter-Bold",
    semibold: "Inter-SemiBold",
    medium: "Inter-Medium",
    regular: "Inter-Regular",
    light: "Inter-Light",
  },

  typography: {
    size: {
      xs: { fontSize: 11, lineHeight: 16 },
      sm: { fontSize: 12, lineHeight: 17 },
      md: { fontSize: 14, lineHeight: 20 },
      lg: { fontSize: 15, lineHeight: 21 },
      xl: { fontSize: 16, lineHeight: 22 },
      "2xl": { fontSize: 18, lineHeight: 24 },
      "3xl": { fontSize: 20, lineHeight: 26 },
      "4xl": { fontSize: 24, lineHeight: 30 },
      "5xl": { fontSize: 28, lineHeight: 34 },
      "6xl": { fontSize: 32, lineHeight: 38 },
      "7xl": { fontSize: 36, lineHeight: 40 },
    },
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
      widest: 1.0,
    },
  },
} as const;