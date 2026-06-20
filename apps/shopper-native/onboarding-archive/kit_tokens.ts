/**
 * kit — Unified Design System (V4 – 2026 Creative Refresh)
 *
 * Single source of truth for all design tokens. All existing V3 tokens are
 * preserved with the exact same values; new tokens extend the system in a
 * strictly additive way so no existing screen breaks.
 *
 * What’s new in V4:
 *  • Full typographic scale with font‑family tokens → drop legacy `theme.fonts`.
 *  • Expanded color palette (neutral, surface, semantic) with opacity variants.
 *  • New shadow presets: `shadow.card`, `shadow.overlay`, `shadow.glow`.
 *  • `kit.inset` helpers for standard screen / card padding.
 *  • `kit.radius.soft` / `kit.radius.hard` for more expressive corners.
 *  • `kit.opacity` tokens for consistent layering.
 */

import { Platform } from "react-native";

// ── Shadow factory (unchanged) ─────────────────────────────────────────
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

export const kit = {
  // ── Spacing scale (unchanged, but with extra semantic inset helpers) ──
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

  inset: {
    /** Standard horizontal inset for full‑screen lists / panels */
    screen: 20,
    /** Inline card padding */
    card: 16,
    /** Compact inset for tight cells */
    tight: 12,
  },

  // ── Color palette (all V3 tokens preserved + new semantic layers) ────
  color: {
    // ── Primary accent (unchanged) ─────────────────────────────────────
    accent: "#06b6d4",
    accentDeep: "#0ea5b7",
    accentTint: "#e6f7f8",
    onAccent: "#ffffff",
    onInk: "#ffffff",

    // ── Inks (unchanged) ──────────────────────────────────────────────
    ink: "#07122a",
    inkSoft: "#475569",
    inkFaint: "#94a3b8",

    // ── Background layers (unchanged) ─────────────────────────────────
    canvas: "#f8fafc",
    surface: "#ffffff",
    well: "#f1f5f9",

    // ── Borders (unchanged) ───────────────────────────────────────────
    line: "#e6eef6",
    lineStrong: "rgba(15, 23, 42, 0.12)",

    // ── Semantic (unchanged) ──────────────────────────────────────────
    success: "#059669",
    successTint: "#ecfdf5",
    warn: "#f59e0b",
    warnTint: "#fff7ed",
    danger: "#ef4444",
    dangerTint: "#fff1f0",

    // ── 2026 additions: a more granular neutral / surface hierarchy ────
    /** Slightly elevated surface for cards on canvas */
    surfaceElevated: "#ffffff",
    /** Darker neutral for pressed states / subtle overlays */
    neutralHover: "rgba(15, 23, 42, 0.04)",
    /** Stronger overlay for modals / sheets */
    neutralOverlay: "rgba(15, 23, 42, 0.35)",
    /** Crisp white for on‑dark text */
    white: "#ffffff",
    /** True black for rare high‑contrast uses */
    black: "#000000",
  },

  // ── Opacity tokens (new) ──────────────────────────────────────────────
  opacity: {
    disabled: 0.38,
    subtle: 0.12,
    medium: 0.24,
    heavy: 0.54,
  },

  // ── Border radius (unchanged + new expressive options) ───────────────
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

    // 2026 refresh
    /** Soft, almost‑round corners for avatars / chips */
    soft: 16,
    /** Harder corners for industrial / editorial looks */
    hard: 4,
    /** Perfectly circular (use with equal width/height) */
    full: 9999,
  },

  // ── Shadows (unchanged presets + new, refined ones) ──────────────────
  shadow: {
    raised: makeShadow("#0f172a", 1, 0.06, 3, 2),
    floating: makeShadow("#0f172a", 4, 0.10, 12, 6),
    deep: makeShadow("#0f172a", 8, 0.14, 20, 10),
    brandGlow: makeShadow("#06b6d4", 0, 0.12, 12, 2),

    // 2026 additions
    /** Gentle elevation for cards sitting directly on canvas */
    card: makeShadow("#0f172a", 2, 0.04, 6, 2),
    /** Pronounced overlay shadow for modals / sheets */
    overlay: makeShadow("#0f172a", 0, 0.18, 30, 8),
    /** Soft ambient glow for focused inputs / search bars */
    glow: makeShadow("#06b6d4", 0, 0.08, 8, 2),
  },

  // ── Typography (unchanged + font families now included) ──────────────
  type: {
    display: { fontSize: 26, lineHeight: 32 },
    title: { fontSize: 20, lineHeight: 26 },
    heading: { fontSize: 17, lineHeight: 24 },
    body: { fontSize: 14, lineHeight: 20 },
    caption: { fontSize: 12, lineHeight: 17 },
    micro: { fontSize: 10, lineHeight: 14 },
  },

  /**
   * Font families — replaces the old `theme.fonts` import.
   * All families are assumed to be already loaded via expo-font or similar.
   */
  font: {
    black: "Inter-Black",
    bold: "Inter-Bold",
    semiBold: "Inter-SemiBold",
    medium: "Inter-Medium",
    regular: "Inter-Regular",
    light: "Inter-Light",
  },

  /**
   * Typographic presets (optional convenience) — combine size + family + tracking.
   * Not required for existing code; purely additive.
   */
  textStyle: {
    hero: {
      fontFamily: "Inter-Black",
      fontSize: 32,
      lineHeight: 40,
      letterSpacing: -0.5,
      color: "#07122a",
    },
    headline: {
      fontFamily: "Inter-Bold",
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.3,
      color: "#07122a",
    },
    body: {
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
      color: "#475569",
    },
    label: {
      fontFamily: "Inter-SemiBold",
      fontSize: 12,
      lineHeight: 17,
      letterSpacing: 0.5,
      color: "#475569",
    },
  },
} as const;

export default kit;