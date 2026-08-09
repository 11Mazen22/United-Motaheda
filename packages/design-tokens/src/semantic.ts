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

/** Semantic colors for light surfaces. */
export const lightColors = {
  brand: {
    primary: "#0E7E74",
    primaryLight: "#E6F4F2",
    primaryDark: "#0A5F58",
    accent: "#F59E0B",
    accentLight: "#FEF3C7",
  },
  canvas: {
    screen: "#F4F7FA",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    background: "#F4F7FA",
    surfaceElevated: "#FFFFFF",
    surfaceMuted: "#F1F5F9",
    overlay: "rgba(2, 29, 46, 0.55)",
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
    success: "#16A34A",
    warning: "#D97706",
    error: "#DC2626",
    info: "#2563EB",
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
    light: "#F1F5F9",
    medium: "#CBD5E1",
    subtle: "#F1F5F9",
    default: "#E2E8F0",
    strong: "#CBD5E1",
    focus: "#0E7E74",
  },
} as const satisfies SemanticColors;

/** Semantic colors for dark surfaces. */
export const darkColors = {
  brand: {
    primary: "#2CCBBD",
    primaryLight: "#123E3A",
    primaryDark: "#99F0E6",
    accent: "#FBBF24",
    accentLight: "#4A3510",
  },
  canvas: {
    screen: "#020617",
    surface: "#0F172A",
    elevated: "#1E293B",
    background: "#020617",
    surfaceElevated: "#1E293B",
    surfaceMuted: "#172033",
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
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#FB7185",
    info: "#60A5FA",
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
    light: "#1E293B",
    medium: "#475569",
    subtle: "#1E293B",
    default: "#334155",
    strong: "#475569",
    focus: "#2CCBBD",
  },
} as const satisfies SemanticColors;

/** Default semantic colors. This intentionally resolves to the light palette. */
export const colors = lightColors;

/** Platform-neutral Cairo typography tokens. */
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
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacings: {
    tight: -0.25,
    normal: 0,
    wide: 0.25,
  },
} as const;

/** A 4-point spacing scale. Keys represent scale steps, values are pixels or points. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
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
} as const;

/** Platform-neutral corner-radius tokens. */
export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999,
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

/** Five elevation levels represented without web or native style properties. */
export const shadows = {
  sm: { elevation: 1, x: 0, y: 1, blur: 2, spread: 0, color: "#0C2240", opacity: 0.05 },
  md: { elevation: 2, x: 0, y: 2, blur: 6, spread: 0, color: "#0C2240", opacity: 0.07 },
  lg: { elevation: 4, x: 0, y: 4, blur: 12, spread: 0, color: "#0C2240", opacity: 0.1 },
  xl: { elevation: 8, x: 0, y: 8, blur: 20, spread: 0, color: "#0C2240", opacity: 0.14 },
  "2xl": { elevation: 12, x: 0, y: 12, blur: 32, spread: 0, color: "#0C2240", opacity: 0.18 },
} as const satisfies Record<string, ShadowDescriptor>;

/** Platform-neutral motion durations and cubic-bezier control points. */
export const motion = {
  durations: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    decelerate: [0, 0, 0.2, 1],
    accelerate: [0.4, 0, 1, 1],
    easeInOut: [0.4, 0, 0.2, 1],
  },
} as const;

/** Responsive layout, accessibility, and icon-size tokens. */
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
