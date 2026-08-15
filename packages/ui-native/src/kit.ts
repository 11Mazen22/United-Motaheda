/**
 * kit - Unified Design System (V4 - 2026 Creative Refresh)
 *
 * Single source of truth for all design tokens. All existing V3 tokens are
 * preserved with the exact same values; new tokens extend the system in a
 * strictly additive way so no existing screen breaks.
 *
 * The Platform import intentionally comes from React Native's public API.
 * Do not import internal react-native-web paths here because Expo web and
 * native builds resolve the package through different module graphs.
 */

import { Platform } from "react-native";

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function makeShadow(
  color: string,
  yOffset: number,
  opacity: number,
  blur: number,
  _elevation: number,
): object {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: yOffset },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
    android: {
      boxShadow: `0px ${yOffset}px ${blur}px ${hexToRgba(color, opacity)}`,
    },
    default: {},
  }) ?? {};
}

export const kit = {
  sp: (n: number): number => n * 4,
  spacing: { "1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 40, "5xl": 48, "6xl": 64 },
  inset: { screen: 20, card: 16, tight: 12 },
  color: {
    accent: "#0E7E74", accentDeep: "#0A5F58", accentTint: "#E6F4F2", onAccent: "#ffffff", onInk: "#ffffff",
    ink: "#0A1220", inkSoft: "#475569", inkFaint: "#5E6A7C", canvas: "#f8fafc", surface: "#ffffff", well: "#f1f5f9",
    line: "#e6eef6", lineStrong: "rgba(15, 23, 42, 0.12)", success: "#059669", successTint: "#ecfdf5", warn: "#f59e0b", warnTint: "#fff7ed", danger: "#ef4444", dangerTint: "#fff1f0",
    surfaceElevated: "#ffffff", neutralHover: "rgba(15, 23, 42, 0.04)", neutralOverlay: "rgba(15, 23, 42, 0.35)", white: "#ffffff", black: "#000000",
  },
  opacity: { disabled: 0.38, subtle: 0.12, medium: 0.24, heavy: 0.54 },
  radius: { sm: 6, md: 8, card: 12, lg: 16, xl: 20, "2xl": 24, pill: 999, control: 10, sheet: 20, soft: 16, hard: 4, full: 9999 },
  shadow: {
    raised: makeShadow("#0f172a", 1, 0.06, 3, 2), floating: makeShadow("#0f172a", 4, 0.10, 12, 6), deep: makeShadow("#0f172a", 8, 0.14, 20, 10), brandGlow: makeShadow("#0E7E74", 0, 0.12, 12, 2),
    card: makeShadow("#0f172a", 2, 0.04, 6, 2), overlay: makeShadow("#0f172a", 0, 0.18, 30, 8), glow: makeShadow("#0E7E74", 0, 0.08, 8, 2),
  },
  type: { display: { fontSize: 26, lineHeight: 32 }, title: { fontSize: 20, lineHeight: 26 }, heading: { fontSize: 17, lineHeight: 24 }, body: { fontSize: 14, lineHeight: 20 }, caption: { fontSize: 12, lineHeight: 17 }, micro: { fontSize: 10, lineHeight: 14 } },
  font: { black: "Cairo_900Black", bold: "Cairo_700Bold", semiBold: "Cairo_600SemiBold", medium: "Cairo_400Regular", regular: "Cairo_400Regular", light: "Cairo_400Regular" },
  textStyle: {
    hero: { fontFamily: "Cairo_900Black", fontSize: 32, lineHeight: 40, letterSpacing: -0.5, color: "#07122a" },
    headline: { fontFamily: "Cairo_700Bold", fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: "#07122a" },
    body: { fontFamily: "Cairo_400Regular", fontSize: 14, lineHeight: 20, color: "#475569" },
    label: { fontFamily: "Cairo_600SemiBold", fontSize: 12, lineHeight: 17, letterSpacing: 0.5, color: "#475569" },
  },
} as const;

export default kit;
