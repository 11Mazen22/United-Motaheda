/**
 * useCourierTheme — the single hook every courier primitive consumes.
 */

import { useTheme } from "../theme";
import { courier, type CourierTokens } from "@pharmacy/design-tokens";

export interface CourierTheme {
  theme: ReturnType<typeof useTheme>["theme"];
  isDark: boolean;
  isRTL: boolean;
  courier: CourierTokens;
  surface: CourierTokens["surface"]["light"] | CourierTokens["surface"]["dark"];
  interaction: CourierTokens["interaction"]["light"] | CourierTokens["interaction"]["dark"];
  colors: ReturnType<typeof useTheme>["theme"]["colors"];
}

export function useCourierTheme(): CourierTheme {
  const { theme, isDark, isRTL } = useTheme();
  return {
    theme,
    isDark,
    isRTL,
    courier,
    surface: isDark ? courier.surface.dark : courier.surface.light,
    interaction: isDark ? courier.interaction.dark : courier.interaction.light,
    colors: theme.colors,
  };
}
