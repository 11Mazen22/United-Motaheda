/**
 * United Pharmacies — Enterprise Design System
 * Complete token system: colors, typography, spacing, radius, shadow, animation, gradients
 */

// ─── Raw Palette ──────────────────────────────────────────────────────────────

const palette = {
  // Brand Teal
  teal: {
    25:  '#F0FDFB',
    50:  '#E6FAF8',
    100: '#CCFAF5',
    200: '#99F0E6',
    300: '#5CE0D2',
    400: '#2CCCBD',
    500: '#0DB8A8',
    600: '#0A9A8C',
    700: '#087A6F',
    800: '#065C54',
    900: '#044039',
    950: '#022C27',
  },
  // Navy (hero/background deepths)
  navy: {
    25:  '#F0F4F8',
    50:  '#E1EAF2',
    100: '#C3D5E5',
    200: '#87AAC9',
    300: '#4B7FAD',
    400: '#2B5F8F',
    500: '#1A4570',
    600: '#123255',
    700: '#0C2240',
    800: '#07152A',
    900: '#030C18',
    950: '#010609',
  },
  // Cyan (keeping existing brand)
  cyan: {
    50:  '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
    950: '#083344',
  },
  // Neutral Slate
  slate: {
    25:  '#FCFCFD',
    50:  '#F8FAFC',
    100: '#F1F5F9',
    150: '#EBF0F6',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  // Semantic Green
  green: {
    50:  '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },
  // Semantic Amber
  amber: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
  // Semantic Red
  red: {
    50:  '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    400: '#FB7185',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },
  // Purple (for premium/loyalty)
  purple: {
    50:  '#FAF5FF',
    100: '#F3E8FF',
    200: '#E9D5FF',
    400: '#C084FC',
    500: '#A855F7',
    600: '#9333EA',
    700: '#7E22CE',
    800: '#6B21A8',
    900: '#581C87',
  },
  // Rose (for favorites/wishlist)
  rose: {
    50:  '#FFF1F2',
    100: '#FFE4E6',
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48',
    700: '#BE123C',
  },
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
};

// ─── Semantic Color Tokens ────────────────────────────────────────────────────

/** Legacy shopper-native color tokens. Prefer the semantic `colors` export. */
export const legacyColors = {
  // ── Brand
  brand: {
    lightest:  palette.teal[25],
    lighter:   palette.teal[50],
    light:     palette.teal[200],
    soft:      palette.teal[300],
    base:      '#0E7E74',          // unified brand accent — single source with kit.color.accent
    strong:    '#0A5F58',          // === kit.color.accentDeep
    dark:      palette.teal[800],
    darkest:   palette.teal[900],
    // Cyan alias (existing brand)
    ...palette.cyan,
  },
  // ── Background / Surface
  bg:              '#F4F7FA',
  bgAlt:           '#EEF2F7',
  surface:         '#FFFFFF',
  surfaceRaised:   '#FFFFFF',
  surfaceOverlay:  'rgba(15, 23, 42, 0.60)',
  muted:           '#F8FAFC',
  subtle:          '#F1F5F9',
  // ── Text
  text: {
    primary:   '#0F1724',
    secondary: '#4A5568',
    muted:     '#647488',      // between secondary and tertiary — for body
    tertiary:  '#8896A4',
    disabled:  '#B8C4CF',
    inverse:   '#FFFFFF',
    inverseSoft: 'rgba(255,255,255,0.72)', // muted-on-dark for hero subcopy
    brand:     '#0E7E74',          // unified brand accent (=== kit.color.accent)
    link:      palette.cyan[600],
  },
  // ── Border
  border: {
    hairline: 'rgba(15, 23, 42, 0.05)',   // refined 1px separator (premium)
    default:  'rgba(15, 23, 42, 0.08)',
    medium:   'rgba(15, 23, 42, 0.12)',
    strong:   'rgba(15, 23, 42, 0.20)',
    focus:    palette.cyan[600],
    brand:    palette.teal[400],
    brandSoft:'rgba(13, 184, 168, 0.18)', // clinical brand-tinted hairline
  },
  // ── Extended surfaces (clinical layering — opt-in, doesn't touch `surface`)
  surfaceSunken:   '#FAFBFD',  // for muted wells / nested sections
  surfaceElevated: '#FFFFFF',  // explicit-elevation intent
  surfaceAccent:   '#F0FDFB',  // brand-tinted surface (teal[25])
  // ── Semantic
  success: {
    bg:     palette.green[50],
    light:  palette.green[100],
    base:   palette.green[500],
    strong: palette.green[700],
    text:   palette.green[800],
  },
  warning: {
    bg:     palette.amber[50],
    light:  palette.amber[100],
    base:   palette.amber[500],
    strong: palette.amber[600],
    text:   palette.amber[800],
  },
  error: {
    bg:     palette.red[50],
    light:  palette.red[100],
    base:   palette.red[500],
    strong: palette.red[600],
    text:   palette.red[800],
  },
  info: {
    bg:     '#EFF6FF',
    light:  '#DBEAFE',
    base:   '#3B82F6',
    strong: '#1D4ED8',
    text:   '#1E3A8A',
  },
  // ── Hero
  hero:       '#021D2E',
  heroMid:    '#053348',
  heroBright: '#0A4A65',
  heroLight:  '#0D6080',
  // ── Specialty
  glass:       'rgba(255,255,255,0.12)',
  glassDark:   'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.22)',
  overlay:     'rgba(2, 29, 46, 0.55)',
  scrim:       'rgba(0, 0, 0, 0.40)',
  // ── Palettes (shorthand access)
  slate:  palette.slate,
  amber:  palette.amber,
  green:  palette.green,
  red:    palette.red,
  purple: palette.purple,
  rose:   palette.rose,
  teal:   palette.teal,
  navy:   palette.navy,
  white:  palette.white,
  black:  palette.black,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

/** Legacy shopper-native typography tokens. */
export const legacyTypography = {
  fonts: {
    regular:   'Cairo_400Regular',
    medium:    'Cairo_400Regular',   // Cairo has no 500, use 400
    semibold:  'Cairo_600SemiBold',
    bold:      'Cairo_700Bold',
    extrabold: 'Cairo_800ExtraBold',
    black:     'Cairo_900Black',
  },
  // Size → { fontSize, lineHeight }
  size: {
    '2xs': { fontSize: 10, lineHeight: 14 },
    xs:    { fontSize: 11, lineHeight: 16 },
    sm:    { fontSize: 12, lineHeight: 18 },
    base:  { fontSize: 13, lineHeight: 19 },
    md:    { fontSize: 14, lineHeight: 20 },
    lg:    { fontSize: 15, lineHeight: 22 },
    xl:    { fontSize: 16, lineHeight: 24 },
    '2xl': { fontSize: 18, lineHeight: 26 },
    '3xl': { fontSize: 20, lineHeight: 28 },
    '4xl': { fontSize: 24, lineHeight: 32 },
    '5xl': { fontSize: 28, lineHeight: 36 },
    '6xl': { fontSize: 32, lineHeight: 40 },
    '7xl': { fontSize: 36, lineHeight: 44 },
  },
  weight: {
    regular:   '400' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
    black:     '900' as const,
  },
  letterSpacing: {
    tight:  -0.5,
    normal: 0,
    wide:   0.5,
    wider:  1.0,
    widest: 1.5,
  },
} as const;

// Shorthand font references (backward-compat)
export const fonts = legacyTypography.fonts;
export const fontSize = {
  xs:    11,
  sm:    12,
  base:  13,
  md:    14,
  lg:    15,
  xl:    16,
  '2xl': 18,
  '3xl': 20,
  '4xl': 24,
  '5xl': 28,
  '6xl': 32,
};

// ─── Spacing (8-pt grid) ──────────────────────────────────────────────────────

/** Legacy shopper-native spacing tokens. */
export const legacySpacing = {
  px:   1,
  0.5:  4,
  1:    8,
  1.5:  12,
  2:    16,
  2.5:  20,
  3:    24,
  3.5:  28,
  4:    32,
  5:    40,
  6:    48,
  7:    56,
  8:    64,
  9:    72,
  10:   80,
  12:   96,
  14:   112,
  16:   128,
  20:   160,
  // Named aliases
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const radius = {
  none: 0,
  xs:   4,
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  '2xl': 22,
  '3xl': 28,
  '4xl': 36,
  full: 9999,
  // Semantic alias — for buttons, badges, chips that should read as "pill"
  pill: 9999,
} as const;

export const fontWeight = {
  normal:    '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
  black:     '900' as const,
};

// ─── Shadows (elevation system) ───────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// React Native 0.76+ accepts the unified `boxShadow` CSS-like string on both
// platforms (Android/iOS via Fabric, web via react-native-web). The legacy
// shadowColor/Offset/Opacity/Radius quartet is deprecated in 0.78+; emitting
// both surfaces a console warning per shadow token on every web render.
//
// Tokens below use `boxShadow` for the visual + `elevation` for Android's
// Material elevation (separate concern — drives surface stacking, not just
// drop-shadow). This silences the deprecation across the entire app.
export const shadow = {
  none: {
    elevation: 0,
    boxShadow: `0px 0px 0px rgba(0,0,0,0)`,
  },
  // Hairline — almost invisible, just enough to read a card edge against
  // a same-color background. Use for inline cards / list rows.
  hairline: {
    elevation: 0,
    boxShadow: `0px 1px 1.5px ${hexToRgba('#0C2240', 0.03)}`,
  },
  xs: {
    elevation: 1,
    boxShadow: `0px 1px 2px ${hexToRgba('#0C2240', 0.05)}`,
  },
  sm: {
    elevation: 2,
    boxShadow: `0px 2px 6px ${hexToRgba('#0C2240', 0.07)}`,
  },
  md: {
    elevation: 4,
    boxShadow: `0px 4px 12px ${hexToRgba('#0C2240', 0.09)}`,
  },
  lg: {
    elevation: 8,
    boxShadow: `0px 8px 20px ${hexToRgba('#0C2240', 0.11)}`,
  },
  xl: {
    elevation: 12,
    boxShadow: `0px 12px 32px ${hexToRgba('#0C2240', 0.14)}`,
  },
  '2xl': {
    elevation: 20,
    boxShadow: `0px 20px 48px ${hexToRgba('#0C2240', 0.18)}`,
  },
  brand: {
    elevation: 8,
    boxShadow: `0px 6px 16px ${hexToRgba('#0E7E74', 0.30)}`,
  },
  teal: {
    elevation: 6,
    boxShadow: `0px 4px 12px ${hexToRgba('#0E7E74', 0.28)}`,
  },
  float: {
    elevation: 16,
    boxShadow: `0px 12px 32px ${hexToRgba('#021D2E', 0.20)}`,
  },
  card: {
    elevation: 3,
    boxShadow: `0px 2px 8px ${hexToRgba('#0C2240', 0.06)}`,
  },
  // Modern "lift on press" — for interactive cards (e.g. ProductCard hover).
  // Subtle, premium, doesn't dominate the layout.
  cardLifted: {
    elevation: 6,
    boxShadow: `0px 6px 18px ${hexToRgba('#0C2240', 0.10)}`,
  },
  // Brand-tinted glow used as a focus ring on Inputs / primary CTAs in
  // "trust" moments (e.g. payment confirmation, verify-phone). Clinical.
  brandGlow: {
    elevation: 6,
    boxShadow: `0px 0px 14px ${hexToRgba('#0E7E74', 0.22)}`,
  },
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────

export const animation = {
  duration: {
    instant:  80,
    fast:     150,
    normal:   250,
    slow:     380,
    verySlow: 600,
  },
  // Spring configs for Reanimated
  spring: {
    snappy:   { damping: 18, stiffness: 400, mass: 0.8 },
    default:  { damping: 16, stiffness: 280, mass: 1.0 },
    gentle:   { damping: 20, stiffness: 180, mass: 1.2 },
    bouncy:   { damping: 10, stiffness: 320, mass: 0.9 },
    stiff:    { damping: 24, stiffness: 500, mass: 0.7 },
    // Refined press-down for buttons / pressable cards. Just shy of an
    // audible click — enough to confirm the press, never bouncy.
    press:    { damping: 22, stiffness: 420, mass: 0.7 },
  },
  // Timing (easing) for Reanimated
  easing: {
    standard:    [0.2, 0.0, 0.0, 1.0]  as [number,number,number,number],
    decelerate:  [0.0, 0.0, 0.2, 1.0]  as [number,number,number,number],
    accelerate:  [0.4, 0.0, 1.0, 1.0]  as [number,number,number,number],
    sharp:       [0.4, 0.0, 0.6, 1.0]  as [number,number,number,number],
    // ── Premium curves (clinical/trust motion language) ────────────────
    // Soft, "settling" decelerate — feels expensive on sheet/modal entries.
    smoothOut:   [0.32, 0.72, 0, 1]    as [number,number,number,number],
    // Emphasized "Material 3" curve — for hero transitions and important
    // attention shifts (e.g. step pill activation, checkout step change).
    emphasize:   [0.16, 1, 0.3, 1]     as [number,number,number,number],
  },
} as const;

// ─── Gradients ────────────────────────────────────────────────────────────────

export const gradients = {
  // Hero backgrounds
  heroPrimary:   ['#021D2E', '#053348', '#0A4A65'] as string[],
  heroMid:       ['#053348', '#0A4A65'] as string[],
  heroLight:     ['#0A4A65', '#0D6080', '#0891B2'] as string[],
  // Brand — single-hue teal, aligned to the unified accent (no cyan intrusion)
  brandPrimary:  ['#0E7E74', '#0A5F58'] as string[],
  brandStrong:   ['#0A5F58', '#0E7E74'] as string[],
  brandSoft:     ['#E6FAF8', '#CFFAFE'] as string[],
  // Category palette (10 pairs)
  categories: [
    ['#0891B2', '#0E7490'],   // teal
    ['#7C3AED', '#6D28D9'],   // purple
    ['#0284C7', '#0369A1'],   // blue
    ['#DC2626', '#B91C1C'],   // red
    ['#D97706', '#B45309'],   // amber
    ['#06B6D4', '#0891B2'],   // cyan
    ['#0D9488', '#0F766E'],   // teal-green
    ['#DB2777', '#BE185D'],   // pink
    ['#2563EB', '#1D4ED8'],   // indigo
    ['#9333EA', '#7E22CE'],   // violet
  ] as [string, string][],
  // Utility
  shimmer:   ['#F1F5F9', '#E2E8F0', '#F1F5F9'] as string[],
  success:   ['#10B981', '#059669'] as string[],
  warning:   ['#F59E0B', '#D97706'] as string[],
  error:     ['#EF4444', '#DC2626'] as string[],
  loyalty:   ['#7C3AED', '#9333EA', '#DB2777'] as string[],
  premium:   ['#B45309', '#D97706', '#FBBF24'] as string[],
} as const;

// Backward-compat alias
export const catGradients = gradients.categories;

// ─── Z-index ──────────────────────────────────────────────────────────────────

export const zIndex = {
  base:       0,
  raised:     10,
  dropdown:   20,
  sticky:     30,
  overlay:    40,
  modal:      50,
  toast:      60,
  tooltip:    70,
} as const;

// ─── Layout constants ─────────────────────────────────────────────────────────

/** Legacy shopper-native layout constants. */
export const legacyLayout = {
  tabBarHeight:      96,   // floating bar: 62px height + safe-area + margin
  headerHeight:      56,
  bottomSheetRadius: 28,
  cardRadius:        16,
  inputHeight:       52,
  buttonHeight:      52,
  iconButtonSize:    44,
  // Horizontal page padding
  pagePaddingH:      20,
  // Max content width (tablet)
  maxWidth:          480,
} as const;

// ─── Theme object (canonical export) ─────────────────────────────────────────

/** Legacy shopper-native theme preserved for source compatibility. */
export const theme = {
  colors: legacyColors,
  typography: legacyTypography,
  fonts,
  fontSize,
  spacing: legacySpacing,
  radius,
  fontWeight,
  shadow,
  animation,
  gradients,
  catGradients,
  zIndex,
  layout: legacyLayout,
} as const;

/** Type of the legacy shopper-native `theme` export. */
export type Theme = typeof theme;
export default theme;
