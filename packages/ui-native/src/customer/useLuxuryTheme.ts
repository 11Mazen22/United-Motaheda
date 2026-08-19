/**
 * useLuxuryTheme — the single hook every customer primitive consumes.
 *
 * Combines the existing NativeTheme (SemanticTheme + kit + RTL) with the
 * new luxury token layer. Nothing in commerce / auth / orders changes.
 */
import { useTheme } from '../theme';
import { luxury, type LuxuryTokens } from '@pharmacy/design-tokens';

export interface LuxuryTheme {
  /** Full semantic theme (colors, shadows, spacing, RTL etc) */
  theme: ReturnType<typeof useTheme>['theme'];
  isDark: boolean;
  isRTL: boolean;
  /** Luxury token extension — surface hierarchy, motion, sizing etc */
  lx: LuxuryTokens;
  /** Current surface set for the active color mode */
  surface: LuxuryTokens['surface']['light'] | LuxuryTokens['surface']['dark'];
  /** Current interaction tints for the active color mode */
  interaction: LuxuryTokens['interaction']['light'] | LuxuryTokens['interaction']['dark'];
}

export function useLuxuryTheme(): LuxuryTheme {
  const { theme, isDark, isRTL } = useTheme();
  return {
    theme,
    isDark,
    isRTL,
    lx: luxury,
    surface: isDark ? luxury.surface.dark : luxury.surface.light,
    interaction: isDark ? luxury.interaction.dark : luxury.interaction.light,
  };
}
