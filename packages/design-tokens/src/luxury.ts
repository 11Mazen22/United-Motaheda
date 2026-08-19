/**
 * luxury.ts — Project Luxury 2.0 design token extension.
 *
 * ADDITIVE ONLY. Extends @pharmacy/design-tokens without touching
 * lightColors, darkColors, or any existing exports. These tokens define
 * the customer-app-specific layer: premium surface hierarchy, motion system,
 * component sizing, and interaction states. All commerce / auth / order
 * services remain completely unchanged.
 */

// ─── Surface Hierarchy ────────────────────────────────────────────────────────
// Five elevation levels. Light: progressively lighter tint on off-white canvas.
// Dark: progressively lighter navy on a near-black OLED base — NOT plain gray.

export const luxurySurface = {
  light: {
    base:    "#F6F8FB",
    s1:      "#FFFFFF",
    s2:      "#F1F4F9",
    s3:      "#E9EEF5",
    s4:      "#DDE4EE",
    overlay: "rgba(7, 18, 42, 0.48)",
    sheet:   "#FFFFFF",
  },
  dark: {
    base:    "#080C14",   // OLED near-black
    s1:      "#111827",   // first lift — cards
    s2:      "#1A2437",   // second lift — wells, inputs
    s3:      "#233049",   // third lift — chips
    s4:      "#2D3D5C",   // fourth lift — separators
    overlay: "rgba(0, 0, 0, 0.70)",
    sheet:   "#111827",
  },
} as const;

// ─── Typography Scale ─────────────────────────────────────────────────────────
// Named roles keyed to commerce semantic purpose.

export const luxuryType = {
  navLabel:    { fontSize: 11, lineHeight: 14, letterSpacing: 0.1,  weight: "semibold" as const },
  screenTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3, weight: "bold"     as const },
  sectionHead: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2, weight: "semibold" as const },
  productName: { fontSize: 16, lineHeight: 22, letterSpacing: -0.1, weight: "semibold" as const },
  productMeta: { fontSize: 13, lineHeight: 18, letterSpacing: 0,    weight: "regular"  as const },
  priceLg:     { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, weight: "bold"     as const },
  priceMd:     { fontSize: 18, lineHeight: 24, letterSpacing: -0.3, weight: "semibold" as const },
  priceSm:     { fontSize: 14, lineHeight: 20, letterSpacing: -0.2, weight: "semibold" as const },
  priceStruck: { fontSize: 13, lineHeight: 18, letterSpacing: 0,    weight: "regular"  as const },
  buttonLg:    { fontSize: 16, lineHeight: 20, letterSpacing: 0.1,  weight: "semibold" as const },
  buttonMd:    { fontSize: 15, lineHeight: 20, letterSpacing: 0.1,  weight: "semibold" as const },
  buttonSm:    { fontSize: 13, lineHeight: 18, letterSpacing: 0.1,  weight: "semibold" as const },
  body:        { fontSize: 15, lineHeight: 22, letterSpacing: 0,    weight: "regular"  as const },
  bodySm:      { fontSize: 14, lineHeight: 20, letterSpacing: 0,    weight: "regular"  as const },
  caption:     { fontSize: 12, lineHeight: 17, letterSpacing: 0.1,  weight: "regular"  as const },
  eyebrow:     { fontSize: 11, lineHeight: 16, letterSpacing: 0.6,  weight: "bold"     as const },
  label:       { fontSize: 13, lineHeight: 18, letterSpacing: 0.1,  weight: "semibold" as const },
  badge:       { fontSize: 10, lineHeight: 14, letterSpacing: 0.2,  weight: "bold"     as const },
  metric:      { fontSize: 28, lineHeight: 34, letterSpacing: -0.5, weight: "black"    as const },
  metricSm:    { fontSize: 20, lineHeight: 26, letterSpacing: -0.3, weight: "bold"     as const },
} as const;

// ─── Spacing Scale ────────────────────────────────────────────────────────────
// 4pt grid with semantic aliases. Eliminates magic numbers in screens.

export const luxurySpace = {
  px:   1,
  0.5:  2,
  1:    4,
  1.5:  6,
  2:    8,
  2.5: 10,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  10:  40,
  12:  48,
  16:  64,
  20:  80,
  // Semantic aliases
  screenH:    20,
  screenV:    16,
  cardH:      16,
  cardV:      14,
  sectionGap: 24,
  rowGap:     12,
  chipGap:     8,
} as const;

// ─── Radius Scale ─────────────────────────────────────────────────────────────

export const luxuryRadius = {
  xs:    4,
  sm:    8,
  md:   12,
  lg:   16,
  xl:   20,
  "2xl": 24,
  pill: 9999,
  card:   12,
  input:  10,
  button: 12,
  sheet:  24,
  badge:   6,
  chip:  999,
} as const;

// ─── Motion System ────────────────────────────────────────────────────────────
// One motion language. Groups by purpose, not raw duration.

export const luxuryMotion = {
  duration: {
    instant:    80,
    micro:     120,
    fast:      180,
    standard:  260,
    emphasized: 380,
    long:      500,
  },
  spring: {
    snappy:   { damping: 22, stiffness: 360, mass: 0.8 },
    standard: { damping: 26, stiffness: 280, mass: 1.0 },
    gentle:   { damping: 30, stiffness: 180, mass: 1.2 },
    wobbly:   { damping: 16, stiffness: 220, mass: 1.0 },
  },
  easing: {
    standard:   [0.2, 0, 0, 1] as const,
    decelerate: [0, 0, 0.2, 1] as const,
    accelerate: [0.4, 0, 1, 1] as const,
    emphasized: [0.2, 0, 0, 1] as const,
    sharp:      [0.4, 0, 0.6, 1] as const,
  },
} as const;

// ─── Interaction States ───────────────────────────────────────────────────────

export const luxuryInteraction = {
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

// ─── Component Sizing ─────────────────────────────────────────────────────────

export const luxurySize = {
  touchTarget:        48,
  buttonHeightLg:     56,
  buttonHeightMd:     48,
  buttonHeightSm:     36,
  inputHeight:        52,
  tabBarHeight:       64,
  headerHeight:       56,
  productCardWidth:   172,
  productCardImageH:  172,
  cartItemImageSize:   72,
  avatarSm:  32,
  avatarMd:  44,
  avatarLg:  72,
  iconSm:    16,
  iconMd:    20,
  iconLg:    24,
  iconXl:    32,
} as const;

// ─── Shadow System ────────────────────────────────────────────────────────────

export const luxuryShadow = {
  none:     { elevation: 0 },
  hairline: { elevation: 1, shadowOffset: { width: 0, height: 1  }, shadowOpacity: 0.05, shadowRadius: 0  },
  card:     { elevation: 2, shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.06, shadowRadius: 6  },
  raised:   { elevation: 4, shadowOffset: { width: 0, height: 4  }, shadowOpacity: 0.09, shadowRadius: 12 },
  sheet:    { elevation: 8, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.12, shadowRadius: 16 },
  floating: { elevation: 12, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20 },
  brandFocus: { elevation: 0, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.20, shadowRadius: 8, shadowColor: "#0E7E74" },
} as const;

// ─── Combined Export ──────────────────────────────────────────────────────────

export const luxury = {
  surface:     luxurySurface,
  type:        luxuryType,
  space:       luxurySpace,
  radius:      luxuryRadius,
  motion:      luxuryMotion,
  interaction: luxuryInteraction,
  size:        luxurySize,
  shadow:      luxuryShadow,
} as const;

export type LuxuryTokens = typeof luxury;
