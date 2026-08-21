/**
 * Driver (courier) persona design tokens — focused, action-oriented, mobile-first.
 *
 * Additive extension of @pharmacy/design-tokens.
 */

import { motion } from "./semantic";

export const courierSurface = {
  light: {
    base:    "#F8FAFC",
    s1:      "#FFFFFF",
    s2:      "#F1F5F9",
    s3:      "#E2E8F0",
    overlay: "rgba(2, 29, 46, 0.55)",
    sheet:   "#FFFFFF",
  },
  dark: {
    base:    "#020617",
    s1:      "#0F172A",
    s2:      "#1E293B",
    s3:      "#334155",
    overlay: "rgba(0, 0, 0, 0.72)",
    sheet:   "#0F172A",
  },
} as const;

export const courierType = {
  navLabel:    { fontSize: 11, lineHeight: 14, letterSpacing: 0.1,  weight: "semibold" as const },
  screenTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3, weight: "bold"     as const },
  sectionHead: { fontSize: 17, lineHeight: 24, letterSpacing: -0.2, weight: "semibold" as const },
  body:        { fontSize: 15, lineHeight: 22, letterSpacing: 0,    weight: "regular"  as const },
  bodySm:      { fontSize: 14, lineHeight: 20, letterSpacing: 0,    weight: "regular"  as const },
  caption:     { fontSize: 12, lineHeight: 17, letterSpacing: 0.1,  weight: "regular"  as const },
  badge:       { fontSize: 10, lineHeight: 14, letterSpacing: 0.2,  weight: "bold"     as const },
  priceLg:     { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, weight: "bold"     as const },
  priceMd:     { fontSize: 18, lineHeight: 24, letterSpacing: -0.3, weight: "semibold" as const },
  priceSm:     { fontSize: 14, lineHeight: 20, letterSpacing: -0.2, weight: "semibold" as const },
  buttonMd:    { fontSize: 15, lineHeight: 20, letterSpacing: 0.1,  weight: "semibold" as const },
  buttonSm:    { fontSize: 13, lineHeight: 18, letterSpacing: 0.1,  weight: "semibold" as const },
  metric:      { fontSize: 32, lineHeight: 38, letterSpacing: -0.5, weight: "black"    as const },
} as const;

export const courierSpace = {
  0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 4: 16,
  5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96,
} as const;

export const courierRadius = {
  sm: 6, md: 10, lg: 14, xl: 18, card: 14, input: 10, button: 10, chip: 999,
} as const;

export const courierShadow = {
  sm: { elevation: 1, x: 0, y: 1, blur: 2, spread: 0, color: "#0C2240", opacity: 0.05 },
  md: { elevation: 2, x: 0, y: 2, blur: 6, spread: 0, color: "#0C2240", opacity: 0.07 },
  lg: { elevation: 4, x: 0, y: 4, blur: 12, spread: 0, color: "#0C2240", opacity: 0.10 },
} as const;

export const courierStatus = {
  online:      "#22C55E",
  offline:     "#6B7280",
  accepted:    "#3B82F6",
  enRoute:     "#8B5CF6",
  arrived:     "#F59E0B",
  delivered:   "#22C55E",
  cancelled:   "#EF4444",
} as const;

export const courierMap = {
  route:    "#0E7E74",
  pickup:   "#3B82F6",
  delivery: "#EF4444",
  driver:   "#0E7E74",
} as const;

export const courierInteraction = {
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

export const courierSize = {
  touchTarget: 48,
  buttonHeightLg: 54,
  buttonHeightMd: 48,
  buttonHeightSm: 38,
  inputHeight: 50,
  tabBarHeight: 64,
  headerHeight: 56,
  cardImageH: 160,
} as const;

export const courier = {
  surface: courierSurface,
  type: courierType,
  space: courierSpace,
  radius: courierRadius,
  shadow: courierShadow,
  motion,
  interaction: courierInteraction,
  size: courierSize,
  status: courierStatus,
  map: courierMap,
} as const;

export type CourierTokens = typeof courier;
