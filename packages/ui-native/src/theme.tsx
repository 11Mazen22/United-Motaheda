import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, type ViewStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  darkTheme,
  darkShadowOpacity,
  lightTheme,
  resolveTheme,
  type SemanticTheme,
  type ThemeName,
} from "@pharmacy/design-tokens";

const THEME_PREFERENCE_STORAGE_KEY = "@pharmacy/theme-preference";
function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

// Keep shared theme code on the public React Native API so Expo Web can bundle it.
// RTL is supplied by the app's language layer rather than I18nManager because
// react-native-web does not expose I18nManager as a stable public web module.
export type ThemePreference = ThemeName | "system";

export type NativeTheme = Omit<SemanticTheme, "shadows" | "colors"> & {
  isRTL: boolean;
  isDark: boolean;
  direction: "rtl" | "ltr";
  shadows: ReadonlyArray<ViewStyle>;
  /** A dedicated brand-tinted glow shadow — distinct from the neutral
   *  elevation ladder above, for the rare moment that wants a colored glow
   *  rather than a neutral drop shadow (e.g. a primary CTA's resting state). */
  brandGlow: ViewStyle;
  colors: SemanticTheme["colors"] & {
    /** Convenience aliases kept for the handful of call sites that already
     *  used them (previously sourced from the static, non-reactive kit.color
     *  — now properly reactive, derived from the canonical semantic colors). */
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
  const c = base.colors;
  return {
    ...base,
    isRTL,
    isDark,
    direction: isRTL ? "rtl" : "ltr",
    // Dark mode leans on pure-black opacity (per darkShadowOpacity) rather
    // than a colored shadow — colored shadows are nearly invisible on
    // near-black surfaces, so elevation there is carried by the
    // surface-lightness ramp plus this opacity boost instead.
    shadows: Object.entries(base.shadows).map(([key, value]) =>
      nativeShadow(
        value.elevation,
        isDark ? "#000000" : value.color,
        isDark ? darkShadowOpacity[key as keyof typeof darkShadowOpacity] : value.opacity,
        value.blur,
      ),
    ),
    brandGlow: nativeShadow(2, c.brand.primary, isDark ? 0.24 : 0.12, 12),
    colors: {
      ...c,
      background: c.canvas.background,
      surface: c.canvas.surface,
      line: c.border.default,
      ink: c.text.primary,
      inkSoft: c.text.secondary,
      inkFaint: c.text.muted,
    },
  };
}

/**
 * Fallback NativeTheme for the context's default value, used only when a
 * component reads useTheme() outside a <ThemeProvider>. Not exported — every
 * screen/component in the app must go through useTheme() to stay reactive to
 * theme changes. It used to be an exported "static theme" escape hatch that
 * ~103 files imported instead of calling the hook, which was the root cause
 * of dark mode rendering as a broken half-light/half-dark UI (frozen to
 * light mode at module-import time). See the no-restricted-imports ESLint
 * rule, which prevents that import path from being reintroduced.
 */
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
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  // Single source of truth for the theme preference, persisted here so it survives
  // an app restart. Previously this state existed only in memory (no persistence),
  // and two other places independently tracked "is dark mode on" — this is now the
  // only one; consumers should stop reading device color scheme directly.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
      .then((stored) => { if (!cancelled && isThemePreference(stored)) setPreferenceState(stored); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const mode: ThemeName = preference === "system" ? systemColorScheme ?? "light" : preference;
  const isDark = mode === "dark";
  const value = useMemo<ThemeContextValue>(() => ({
    theme: toNativeTheme(resolveTheme(mode), isRTL, isDark),
    mode,
    preference,
    isRTL,
    isDark,
    setPreference,
    toggleTheme: () => {
      const resolved = preference === "system" ? mode : preference;
      setPreference(resolved === "light" ? "dark" : "light");
    },
  }), [isRTL, mode, preference, isDark, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Returns the active native theme, theme controls, and RTL state. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export { darkTheme, lightTheme };
