/** A semantic color value that is independent of any rendering platform. */
export type ColorValue = string;

/** The complete semantic color contract shared by light and dark themes. */
export interface SemanticColors {
  readonly brand: {
    readonly primary: ColorValue;
    readonly primaryLight: ColorValue;
    readonly primaryDark: ColorValue;
    readonly accent: ColorValue;
    readonly accentLight: ColorValue;
  };
  readonly canvas: {
    readonly screen: ColorValue;
    readonly surface: ColorValue;
    readonly elevated: ColorValue;
    readonly background: ColorValue;
    readonly surfaceElevated: ColorValue;
    readonly surfaceMuted: ColorValue;
    readonly overlay: ColorValue;
  };
  readonly text: {
    readonly primary: ColorValue;
    readonly secondary: ColorValue;
    readonly muted: ColorValue;
    readonly disabled: ColorValue;
    readonly inverse: ColorValue;
    readonly link: ColorValue;
  };
  readonly status: {
    readonly success: ColorValue;
    readonly warning: ColorValue;
    readonly error: ColorValue;
    readonly info: ColorValue;
  };
  /** Soft desaturated bg/text pairs for status fills — chips, badges, banners.
   *  `status.*` above stays saturated for dots/icons/scannability; this is
   *  for surfaces, per the soft-luxury direction (restrained, not clinical). */
  readonly statusSoft: {
    readonly success: { readonly bg: ColorValue; readonly text: ColorValue };
    readonly warning: { readonly bg: ColorValue; readonly text: ColorValue };
    readonly error: { readonly bg: ColorValue; readonly text: ColorValue };
    readonly info: { readonly bg: ColorValue; readonly text: ColorValue };
  };
  /** Soft purple accent — prescription/premium/loyalty moments. Replaces the
   *  crashing kit.color.purple[N] ramp that never actually existed. */
  readonly tertiary: {
    readonly base: ColorValue;
    readonly bg: ColorValue;
    readonly text: ColorValue;
  };
  /** Cool-neutral ramp (deliberately not warmed, unlike canvas/border — chips
   *  and badges need to stay legible/versatile). Replaces kit.color.slate[N]. */
  readonly neutrals: {
    readonly 100: ColorValue;
    readonly 200: ColorValue;
    readonly 300: ColorValue;
    readonly 400: ColorValue;
    readonly 500: ColorValue;
    readonly 600: ColorValue;
    readonly 700: ColorValue;
  };
  readonly delivery: {
    readonly pickup: ColorValue;
    readonly dropoff: ColorValue;
    readonly inTransit: ColorValue;
    readonly pending: ColorValue;
    readonly confirmed: ColorValue;
    readonly preparing: ColorValue;
    readonly outForDelivery: ColorValue;
    readonly delivered: ColorValue;
    readonly cancelled: ColorValue;
  };
  readonly chart: {
    readonly series1: ColorValue;
    readonly series2: ColorValue;
    readonly series3: ColorValue;
    readonly series4: ColorValue;
    readonly series5: ColorValue;
  };
  readonly pharmacy: {
    readonly navy: ColorValue;
    readonly navyLight: ColorValue;
    readonly navyDark: ColorValue;
    readonly orb: ColorValue;
    readonly prescription: ColorValue;
    readonly overTheCounter: ColorValue;
    readonly wellness: ColorValue;
  };
  readonly border: {
    readonly light: ColorValue;
    readonly medium: ColorValue;
    readonly subtle: ColorValue;
    readonly default: ColorValue;
    readonly strong: ColorValue;
    readonly focus: ColorValue;
  };
}

/**
 * Semantic colors for light surfaces — "soft luxury" palette.
 * Canvas is warm ivory (not cool blue-gray) with near-white cards, so warmth
 * reads in the negative space rather than on content. Text stays neutral —
 * softness must never cost readability.
 */
export const lightColors = {
  brand: {
    primary: "#0E7E74",
    primaryLight: "#E6F4F2",
    primaryDark: "#0A5F58",
    accent: "#E8A23D",
    accentLight: "#FBEEDA",
  },
  canvas: {
    screen: "#FAF8F4",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    background: "#FAF8F4",
    surfaceElevated: "#FFFFFF",
    surfaceMuted: "#F5F1EA",
    overlay: "rgba(28, 22, 14, 0.50)",
  },
  text: {
    primary: "#0F172A",
    secondary: "#475569",
    muted: "#64748B",
    disabled: "#94A3B8",
    inverse: "#FFFFFF",
    link: "#0E7490",
  },
  status: {
    success: "#4E9B72",
    warning: "#C98A3E",
    error: "#C2564F",
    info: "#4C7FB0",
  },
  statusSoft: {
    success: { bg: "#EDF5EE", text: "#2F6146" },
    warning: { bg: "#FBF1E2", text: "#8A5A22" },
    error: { bg: "#FBECEA", text: "#8C3A34" },
    info: { bg: "#EAF1F8", text: "#2E5478" },
  },
  tertiary: {
    base: "#8767C9",
    bg: "#F1ECFB",
    text: "#5B4291",
  },
  neutrals: {
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
  },
  delivery: {
    pickup: "#16A34A",
    dropoff: "#DC2626",
    inTransit: "#0891B2",
    pending: "#D97706",
    confirmed: "#2563EB",
    preparing: "#7C3AED",
    outForDelivery: "#0891B2",
    delivered: "#16A34A",
    cancelled: "#DC2626",
  },
  chart: {
    series1: "#0E7E74",
    series2: "#2563EB",
    series3: "#7C3AED",
    series4: "#D97706",
    series5: "#E11D48",
  },
  pharmacy: {
    navy: "#0A1220",
    navyLight: "#0E2230",
    navyDark: "#030C18",
    orb: "rgba(14, 126, 116, 0.28)",
    prescription: "#7C3AED",
    overTheCounter: "#0E7E74",
    wellness: "#16A34A",
  },
  border: {
    light: "#F5F1EA",
    medium: "#D3C6A9",
    subtle: "#ECE6D9",
    default: "#E3DBC8",
    strong: "#D3C6A9",
    focus: "#0E7E74",
  },
} as const satisfies SemanticColors;

/**
 * Semantic colors for dark surfaces — teal-tinted near-black (not a plain
 * navy/gray), so dark mode still reads as *this brand's* dark mode.
 */
export const darkColors = {
  brand: {
    primary: "#2CCBBD",
    primaryLight: "#123E3A",
    primaryDark: "#99F0E6",
    accent: "#F0C68C",
    accentLight: "#2B2013",
  },
  canvas: {
    screen: "#0B1210",
    surface: "#121B19",
    elevated: "#1A2624",
    background: "#0B1210",
    surfaceElevated: "#1A2624",
    surfaceMuted: "#16211F",
    overlay: "rgba(0, 0, 0, 0.72)",
  },
  text: {
    primary: "#F8FAFC",
    secondary: "#CBD5E1",
    muted: "#94A3B8",
    disabled: "#64748B",
    inverse: "#0F172A",
    link: "#67E8F9",
  },
  status: {
    success: "#6FBE93",
    warning: "#E0A85E",
    error: "#E2837B",
    info: "#7CA8D6",
  },
  statusSoft: {
    success: { bg: "#16261C", text: "#9FDBB8" },
    warning: { bg: "#2B2013", text: "#F0C68C" },
    error: { bg: "#2B1917", text: "#F0AFA9" },
    info: { bg: "#16212B", text: "#ADCBE9" },
  },
  tertiary: {
    base: "#A98EDD",
    bg: "#241C33",
    text: "#CBB8EE",
  },
  neutrals: {
    100: "#1E293B",
    200: "#334155",
    300: "#475569",
    400: "#64748B",
    500: "#94A3B8",
    600: "#CBD5E1",
    700: "#E2E8F0",
  },
  delivery: {
    pickup: "#4ADE80",
    dropoff: "#FB7185",
    inTransit: "#22D3EE",
    pending: "#FBBF24",
    confirmed: "#60A5FA",
    preparing: "#C084FC",
    outForDelivery: "#22D3EE",
    delivered: "#4ADE80",
    cancelled: "#FB7185",
  },
  chart: {
    series1: "#2CCBBD",
    series2: "#60A5FA",
    series3: "#C084FC",
    series4: "#FBBF24",
    series5: "#FB7185",
  },
  pharmacy: {
    navy: "#0A1220",
    navyLight: "#0E2230",
    navyDark: "#030C18",
    orb: "rgba(44, 203, 189, 0.32)",
    prescription: "#C084FC",
    overTheCounter: "#2CCBBD",
    wellness: "#4ADE80",
  },
  border: {
    light: "#16211F",
    medium: "#2C413D",
    subtle: "#223330",
    default: "#2C413D",
    strong: "#3A5450",
    focus: "#2CCBBD",
  },
} as const satisfies SemanticColors;

/** Default semantic colors. This intentionally resolves to the light palette. */
export const colors = lightColors;

/**
 * Platform-neutral Cairo typography tokens.
 *
 * Weight convention (bundled weights are 400/600/700/800/900 only — no 500,
 * so "medium" is not a real weight in this app):
 *   400 body/caption/meta — never bump body to semibold, keeps copy quiet.
 *   600 the single emphasis weight — labels, buttons, nav, tabs, chips.
 *   700 section heads, screen titles, product names, price.
 *   800 display/metric/hero-numeral roles only.
 *   900 not part of the routine role system — reserved for rare single-digit
 *       hero numerals if ever needed; do not use it for screen titles.
 *
 * `roles` are size/lineHeight/weight only — never bake a color into a
 * typography token (kit.textStyle did this; colors must always come from
 * theme.colors at the call site so the same role works in light and dark).
 */
export const typography = {
  fontFamily: "Cairo",
  sizes: {
    10: 10,
    12: 12,
    14: 14,
    16: 16,
    18: 18,
    20: 20,
    24: 24,
    28: 28,
    32: 32,
    40: 40,
    48: 48,
  },
  weights: {
    regular: 400,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  /** Arabic/Latin vertical-rhythm rule: roles ≤18px use ≥1.4×; display/
   *  headline roles >18px floor at 1.3× (Cairo's Arabic glyphs run visually
   *  heavier than Latin at the same size). */
  lineHeights: {
    tight: 1.3,
    normal: 1.4,
    relaxed: 1.6,
  },
  letterSpacings: {
    tight: -0.25,
    normal: 0,
    wide: 0.25,
  },
  /** Named size/lineHeight/weight roles — the replacement for kit.type.*. */
  roles: {
    display:     { fontSize: 32, lineHeight: 42, weight: 800 },
    metric:      { fontSize: 28, lineHeight: 36, weight: 800 },
    title:       { fontSize: 20, lineHeight: 28, weight: 700 },
    heading:     { fontSize: 17, lineHeight: 24, weight: 700 },
    sectionHead: { fontSize: 18, lineHeight: 25, weight: 700 },
    body:        { fontSize: 14, lineHeight: 20, weight: 400 },
    bodyEmphasized: { fontSize: 14, lineHeight: 20, weight: 600 },
    price:       { fontSize: 18, lineHeight: 25, weight: 700 },
    priceLarge:  { fontSize: 22, lineHeight: 29, weight: 800 },
    priceStruck: { fontSize: 14, lineHeight: 20, weight: 400 },
    label:       { fontSize: 13, lineHeight: 18, weight: 600 },
    button:      { fontSize: 15, lineHeight: 21, weight: 600 },
    caption:     { fontSize: 12, lineHeight: 17, weight: 400 },
    micro:       { fontSize: 10, lineHeight: 15, weight: 400 },
    eyebrow:     { fontSize: 11, lineHeight: 16, weight: 600 },
    badge:       { fontSize: 11, lineHeight: 15, weight: 600 },
    navLabel:    { fontSize: 11, lineHeight: 16, weight: 600 },
    status:      { fontSize: 12, lineHeight: 17, weight: 600 },
  },
} as const;

/**
 * A 4-point spacing scale with half-steps for information-dense (pharmacist)
 * screens, plus named role aliases (replaces kit.spacing/kit.sp()/kit.inset).
 */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  /** Named roles — canonical baseline; personas may use a tighter step. */
  screenH: 20,
  cardH: 16,
  cardV: 14,
  tight: 12,
  sectionGap: 24,
  rowGap: 12,
  chipGap: 8,
} as const;

/**
 * Platform-neutral corner-radius tokens — "smooth rounded forms." Named role
 * aliases replace kit.radius; personas may tighten (pharmacist) or loosen
 * (customer) which alias maps to which numeric step.
 */
export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  "2xl": 28,
  full: 9999,
  /** Role aliases. */
  control: 10,
  input: 10,
  button: 14,
  card: 14,
  cardLarge: 18,
  sheet: 28,
  badge: 8,
  chip: 9999,
  pill: 9999,
} as const;

/** A renderer-agnostic shadow description. */
export interface ShadowDescriptor {
  readonly elevation: number;
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  readonly color: ColorValue;
  readonly opacity: number;
}

/**
 * Five elevation levels, warm-neutral tinted, opacity capped at 0.10 in light
 * mode — a hard ceiling that *is* the "restrained depth" guardrail (nothing
 * in the system should read as an aggressive shadow). Kept as 5 named levels
 * (not 4) because `theme.shadows` resolves to a numerically-indexed array at
 * runtime (Object.values order) and existing screens already reference
 * theme.shadows[0..4] by index — changing the count would silently break
 * every one of those call sites.
 */
export const shadows = {
  hairline: { elevation: 1, x: 0, y: 1, blur: 2, spread: 0, color: "#241F17", opacity: 0.04 },
  card:     { elevation: 2, x: 0, y: 1, blur: 4, spread: 0, color: "#241F17", opacity: 0.06 },
  raised:   { elevation: 4, x: 0, y: 3, blur: 10, spread: 0, color: "#241F17", opacity: 0.08 },
  sheet:    { elevation: 8, x: 0, y: 6, blur: 20, spread: 0, color: "#241F17", opacity: 0.10 },
  floating: { elevation: 10, x: 0, y: 8, blur: 28, spread: 0, color: "#241F17", opacity: 0.10 },
} as const satisfies Record<string, ShadowDescriptor>;

/** Dark-mode shadow opacities for the same 5 levels — colored shadows are
 *  nearly invisible on near-black, so dark elevation leans on pure-black
 *  opacity plus the surface-lightness ramp and a 1px border, not color. */
export const darkShadowOpacity = {
  hairline: 0.16,
  card: 0.20,
  raised: 0.28,
  sheet: 0.36,
  floating: 0.36,
} as const;

/**
 * Platform-neutral motion durations, easing curves, and Reanimated spring
 * configs. Duration ceiling is 420ms system-wide — nothing "long." Springs
 * are all critically-damped-or-close; bouncy/overshoot configs are
 * deliberately not part of this set.
 */
export const motion = {
  durations: {
    fast: 120,
    normal: 220,
    slow: 320,
    micro: 120,
    standard: 260,
    emphasized: 320,
    slowest: 420,
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    decelerate: [0, 0, 0.2, 1],
    accelerate: [0.4, 0, 1, 1],
    easeInOut: [0.4, 0, 0.2, 1],
    soft: [0.3, 0, 0.2, 1],
  },
  /** Reanimated spring configs (damping/stiffness/mass) — zero overshoot. */
  springs: {
    press: { damping: 28, stiffness: 460, mass: 0.9 },
    standard: { damping: 24, stiffness: 300, mass: 1.0 },
    gentle: { damping: 26, stiffness: 220, mass: 1.1 },
  },
} as const;

/** Responsive layout, accessibility, and icon-size tokens (merged with the
 *  legacy shopper-native layout constants). */
export const layout = {
  maxContentWidth: {
    phone: "100%",
    tablet: 1200,
  },
  touchTarget: 48,
  iconSizes: {
    16: 16,
    20: 20,
    24: 24,
    32: 32,
  },
  tabBarHeight: 96,
  headerHeight: 56,
  bottomSheetRadius: 28,
  inputHeight: 52,
  buttonHeight: 52,
  iconButtonSize: 44,
  pagePaddingH: 20,
  maxWidth: 480,
} as const;

/** Utility opacities (replaces kit.opacity). */
export const opacity = {
  disabled: 0.38,
  subtle: 0.12,
  medium: 0.24,
  heavy: 0.54,
} as const;

/** Stacking-order tokens (salvaged from legacy.ts). */
export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 20,
  sticky: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
  tooltip: 70,
} as const;

/** Gradient stops (salvaged from legacy.ts — brand/category/status gradients
 *  used across hero surfaces, category art, and celebratory moments; used
 *  sparingly per the soft-luxury direction, never as a default fill). */
export const gradients = {
  heroPrimary: ["#021D2E", "#053348", "#0A4A65"] as string[],
  heroMid: ["#053348", "#0A4A65"] as string[],
  heroLight: ["#0A4A65", "#0D6080", "#0891B2"] as string[],
  brandPrimary: ["#0E7E74", "#0A5F58"] as string[],
  brandStrong: ["#0A5F58", "#0E7E74"] as string[],
  brandSoft: ["#E6FAF8", "#CFFAFE"] as string[],
  categories: [
    ["#0891B2", "#0E7490"],
    ["#7C3AED", "#6D28D9"],
    ["#0284C7", "#0369A1"],
    ["#DC2626", "#B91C1C"],
    ["#D97706", "#B45309"],
    ["#06B6D4", "#0891B2"],
    ["#0D9488", "#0F766E"],
    ["#DB2777", "#BE185D"],
    ["#2563EB", "#1D4ED8"],
    ["#9333EA", "#7E22CE"],
  ] as [string, string][],
  shimmer: ["#F1F5F9", "#E2E8F0", "#F1F5F9"] as string[],
  success: ["#10B981", "#059669"] as string[],
  warning: ["#F59E0B", "#D97706"] as string[],
  error: ["#EF4444", "#DC2626"] as string[],
  loyalty: ["#7C3AED", "#9333EA", "#DB2777"] as string[],
  premium: ["#B45309", "#D97706", "#FBBF24"] as string[],
} as const;

/** Names accepted by the semantic theme resolver. */
export type ThemeName = "light" | "dark";

const sharedThemeTokens = {
  typography,
  spacing,
  radii,
  shadows,
  motion,
  layout,
  opacity,
  zIndex,
  gradients,
} as const;

/** Complete light semantic theme. */
export const lightTheme = {
  name: "light",
  colors: lightColors,
  ...sharedThemeTokens,
} as const;

/** Complete dark semantic theme. */
export const darkTheme = {
  name: "dark",
  colors: darkColors,
  ...sharedThemeTokens,
} as const;

/** Type of the light semantic theme. */
export type LightTheme = typeof lightTheme;

/** Type of the dark semantic theme. */
export type DarkTheme = typeof darkTheme;

/** Union of all resolved semantic themes. */
export type SemanticTheme = LightTheme | DarkTheme;

/** Resolve a semantic theme by name without relying on a platform runtime. */
export function resolveTheme(name: "light"): LightTheme;
export function resolveTheme(name: "dark"): DarkTheme;
export function resolveTheme(name: ThemeName): SemanticTheme;
export function resolveTheme(name: ThemeName): SemanticTheme {
  return name === "dark" ? darkTheme : lightTheme;
}
