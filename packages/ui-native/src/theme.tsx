import React, { createContext, useContext, useMemo, useState } from "react";
import { Platform, type ViewStyle } from "react-native";
import {
  darkTheme,
  lightTheme,
  resolveTheme,
  type SemanticTheme,
  type ThemeName,
} from "@pharmacy/design-tokens";

import { kit } from "./kit";

// Keep shared theme code on the public React Native API so Expo Web can bundle it.
// RTL is supplied by the app's language layer rather than I18nManager because
// react-native-web does not expose I18nManager as a stable public web module.
export type ThemePreference = ThemeName | "system";

export type NativeTheme = Omit<SemanticTheme, "shadows" | "colors"> & {
  isRTL: boolean;
  isDark: boolean;
  direction: "rtl" | "ltr";
  shadows: ReadonlyArray<ViewStyle>;
  colors: SemanticTheme["colors"] & typeof kit.color & {
    background: string;
    surface: string;
    line: string;
    ink: string;
    inkSoft: string;
    inkFaint: string;
  };
};

export interface ThemeContextValue {
  theme: NativeTheme;
  mode: ThemeName;
  preference: ThemePreference;
  isRTL: boolean;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  initialPreference?: ThemePreference;
  systemColorScheme?: ThemeName | null;
  isRTL?: boolean;
}

function nativeShadow(elevation: number, color: string, opacity: number, radius: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: Math.max(1, elevation / 2) },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation },
    default: {},
  }) ?? {};
}

function toNativeTheme(base: SemanticTheme, isRTL: boolean, isDark: boolean): NativeTheme {
  return {
    ...base,
    isRTL,
    isDark,
    direction: isRTL ? "rtl" : "ltr",
    shadows: Object.values(base.shadows).map((value) =>
      nativeShadow(value.elevation, value.color, value.opacity, value.blur),
    ),
    colors: {
      ...base.colors,
      ...(isDark ? kit.darkColor : kit.color),
      background: (isDark ? kit.darkColor : kit.color).canvas,
      surface: (isDark ? kit.darkColor : kit.color).surface,
      line: (isDark ? kit.darkColor : kit.color).line,
      ink: (isDark ? kit.darkColor : kit.color).ink,
      inkSoft: (isDark ? kit.darkColor : kit.color).inkSoft,
      inkFaint: (isDark ? kit.darkColor : kit.color).inkFaint,
    } as any,
  };
}

const defaultTheme = toNativeTheme(lightTheme, false, false);
const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  mode: "light",
  preference: "light",
    isRTL: false,
  isDark: false,
  setPreference: () => undefined,
  toggleTheme: () => undefined,
});

/** Provides light/dark semantic tokens and one authoritative RTL direction. */
export function ThemeProvider({
  children,
  initialPreference = "system",
  systemColorScheme = "light",
  isRTL = false,
}: ThemeProviderProps): React.ReactElement {
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);
  const mode: ThemeName = preference === "system" ? systemColorScheme ?? "light" : preference;
  const isDark = mode === "dark";
  const value = useMemo<ThemeContextValue>(() => ({
    theme: toNativeTheme(resolveTheme(mode), isRTL, isDark),
    mode,
    preference,
    isRTL,
    isDark,
    setPreference,
    toggleTheme: () => setPreference((current) => {
      const resolved = current === "system" ? mode : current;
      return resolved === "light" ? "dark" : "light";
    }),
  }), [isRTL, mode, preference, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Returns the active native theme, theme controls, and RTL state. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export { darkTheme, lightTheme };
