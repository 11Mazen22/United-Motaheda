/**
 * usePharmacistTheme — the single hook every pharmacist primitive consumes.
 *
 * Combines the existing NativeTheme (SemanticTheme + kit + RTL) with the
 * pharmacist token layer.
 */

import { useTheme } from "../theme";
import { pharmacist, type PharmacistTokens } from "@pharmacy/design-tokens";

export interface PharmacistTheme {
  theme: ReturnType<typeof useTheme>["theme"];
  isDark: boolean;
  isRTL: boolean;
  ph: PharmacistTokens;
  surface: PharmacistTokens["surface"]["light"] | PharmacistTokens["surface"]["dark"];
  interaction: PharmacistTokens["interaction"]["light"] | PharmacistTokens["interaction"]["dark"];
  colors: ReturnType<typeof useTheme>["theme"]["colors"];
}

export function usePharmacistTheme(): PharmacistTheme {
  const { theme, isDark, isRTL } = useTheme();
  return {
    theme,
    isDark,
    isRTL,
    ph: pharmacist,
    surface: isDark ? pharmacist.surface.dark : pharmacist.surface.light,
    interaction: isDark ? pharmacist.interaction.dark : pharmacist.interaction.light,
    colors: theme.colors,
  };
}
