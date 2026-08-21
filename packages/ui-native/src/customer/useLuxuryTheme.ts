/**
 * useCustomerTheme — the single hook every customer primitive consumes.
 *
 * Combines the existing NativeTheme (SemanticTheme + kit + RTL) with the
 * customer commerce token layer. Nothing in commerce / auth / orders changes.
 *
 * Backward-compat: `useLuxuryTheme` is re-exported for existing screens
 * during the transition.
 */
import { useTheme } from '../theme';
import { customer, type CustomerTokens } from '@pharmacy/design-tokens';

export interface CustomerTheme {
  /** Full semantic theme (colors, shadows, spacing, RTL etc) */
  theme: ReturnType<typeof useTheme>['theme'];
  isDark: boolean;
  isRTL: boolean;
  /** Customer token extension — surface hierarchy, motion, sizing etc */
  cx: CustomerTokens;
  /** Current surface set for the active color mode */
  surface: CustomerTokens['surface']['light'] | CustomerTokens['surface']['dark'];
  /** Current interaction tints for the active color mode */
  interaction: CustomerTokens['interaction']['light'] | CustomerTokens['interaction']['dark'];
  /** Luxury token shorthand for spacing, radius, type, size */
  lx: Pick<CustomerTokens, 'space' | 'radius' | 'type' | 'size'>;
  /** Compatibility aliases for screens that consume the hook as a theme object. */
  colors: ReturnType<typeof useTheme>['theme']['colors'];
  fonts: ReturnType<typeof useTheme>['theme']['typography'];
  layout: ReturnType<typeof useTheme>['theme']['layout'];
}

export function useCustomerTheme(): CustomerTheme {
  const { theme, isDark, isRTL } = useTheme();
  return {
    theme,
    isDark,
    isRTL,
    cx: customer,
    surface: isDark ? customer.surface.dark : customer.surface.light,
    interaction: isDark ? customer.interaction.dark : customer.interaction.light,
    lx: {
      space: customer.space,
      radius: customer.radius,
      type: customer.type,
      size: customer.size,
    },
    colors: theme.colors,
    fonts: theme.typography,
    layout: theme.layout,
  };
}

/** Backward-compatible alias for screens still using the old hook name. */
export const useLuxuryTheme = useCustomerTheme;
