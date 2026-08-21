/**
 * Pharmacist persona design tokens — efficient, precise, operational.
 *
 * Additive extension of @pharmacy/design-tokens.
 */

import { motion } from "./semantic";

export const pharmacistSurface = {
  light: {
    base:    "#F8FAFC",
    s1:      "#FFFFFF",
    s2:      "#F1F5F9",
    s3:      "#E2E8F0",
    overlay: "rgba(2, 29, 46, 0.55)",
    sheet:   "#FFFFFF",
  },
  dark: {
    base:    "#0F172A",
    s1:      "#1E293B",
    s2:      "#334155",
    s3:      "#475569",
    overlay: "rgba(0, 0, 0, 0.72)",
    sheet:   "#1E293B",
  },
} as const;

export const pharmacistType = {
  navLabel:    { fontSize: 11, lineHeight: 14, letterSpacing: 0.1,  weight: "semibold" as const },
  screenTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3, weight: "bold"     as const },
  sectionHead: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2, weight: "semibold" as const },
  body:        { fontSize: 15, lineHeight: 22, letterSpacing: 0,    weight: "regular"  as const },
  bodySm:      { fontSize: 14, lineHeight: 20, letterSpacing: 0,    weight: "regular"  as const },
  caption:     { fontSize: 12, lineHeight: 17, letterSpacing: 0.1,  weight: "regular"  as const },
  badge:       { fontSize: 11, lineHeight: 14, letterSpacing: 0.2,  weight: "bold"     as const },
  priceLg:     { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, weight: "bold"     as const },
  priceMd:     { fontSize: 18, lineHeight: 24, letterSpacing: -0.3, weight: "semibold" as const },
  priceSm:     { fontSize: 14, lineHeight: 20, letterSpacing: -0.2, weight: "semibold" as const },
  buttonMd:    { fontSize: 15, lineHeight: 20, letterSpacing: 0.1,  weight: "semibold" as const },
  buttonSm:    { fontSize: 13, lineHeight: 18, letterSpacing: 0.1,  weight: "semibold" as const },
  metric:      { fontSize: 28, lineHeight: 34, letterSpacing: -0.5, weight: "black"    as const },
  metricSm:    { fontSize: 20, lineHeight: 26, letterSpacing: -0.3, weight: "bold"    as const },
} as const;

export const pharmacistSpace = {
  0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 4: 16,
  5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96,
} as const;

export const pharmacistRadius = {
  sm: 6, md: 10, lg: 14, xl: 18, card: 14, input: 10, button: 10, chip: 999,
} as const;

export const pharmacistShadow = {
  sm: { elevation: 1, x: 0, y: 1, blur: 2, spread: 0, color: "#0C2240", opacity: 0.05 },
  md: { elevation: 2, x: 0, y: 2, blur: 6, spread: 0, color: "#0C2240", opacity: 0.07 },
  lg: { elevation: 4, x: 0, y: 4, blur: 12, spread: 0, color: "#0C2240", opacity: 0.10 },
} as const;

export const pharmacistInteraction = {
  light: {
    pressedTint:     "rgba(14, 126, 116, 0.07)",
    hoverTint:       "rgba(14, 126, 116, 0.04)",
    focusRingColor:  "#0E7E74",
    focusRingWidth:  2,
    disabledOpacity: 0.38,
  },
  dark: {
    pressedTint:     "rgba(44, 203, 189, 0.10)",
    hoverTint:       "rgba(44, 203, 189, 0.06)",
    focusRingColor:  "#2CCBBD",
    focusRingWidth:  2,
    disabledOpacity: 0.38,
  },
} as const;

export const pharmacistSize = {
  touchTarget: 48,
  buttonHeightLg: 52,
  buttonHeightMd: 46,
  buttonHeightSm: 38,
  inputHeight: 50,
  tabBarHeight: 60,
  headerHeight: 54,
  avatarSm: 28,
  avatarMd: 40,
  avatarLg: 64,
} as const;

export const pharmacist = {
  surface: pharmacistSurface,
  type: pharmacistType,
  space: pharmacistSpace,
  radius: pharmacistRadius,
  shadow: pharmacistShadow,
  motion,
  interaction: pharmacistInteraction,
  size: pharmacistSize,
} as const;

export type PharmacistTokens = typeof pharmacist;
