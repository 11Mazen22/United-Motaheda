/**
 * Design tokens — United Pharmacy Driver App (2026 Premium Refresh).
 *
 * Aligned with the shopper-native kit design language for consistency:
 *   • Same teal brand colour (#0E7E74)
 *   • Cairo font families (loaded in app/_layout.tsx)
 *   • Semantic shadow system using boxShadow for Android (New Arch)
 *   • 4-pt spacing grid
 *   • Consistent border-radius scale
 */

import { Platform } from 'react-native';

// ─── Shadow factory (platform-aware, same approach as kit/tokens.ts) ──────────

function makeShadow(
  color: string,
  yOffset: number,
  opacity: number,
  blur: number,
  elevation: number,
): object {
  const hex = color.replace('#', '');
  const n   = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  const r   = (n >> 16) & 255;
  const g   = (n >> 8)  & 255;
  const b   =  n        & 255;
  const rgba = `rgba(${r},${g},${b},${opacity})`;

  return Platform.select({
    ios: {
      shadowColor:   color,
      shadowOffset:  { width: 0, height: yOffset },
      shadowOpacity: opacity,
      shadowRadius:  blur,
    },
    android: {
      boxShadow: `0px ${yOffset}px ${blur}px ${rgba}`,
    },
    default: {},
  }) ?? {};
}

// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  // Brand — matches kit.color exactly
  primary:      '#0E7E74',
  primaryDark:  '#0A5F58',
  primaryLight: '#E6F4F2',

  // Accent — earnings / warnings
  accent: '#F59E0B',

  // Status
  online:    '#22C55E',
  offline:   '#6B7280',
  success:   '#059669',
  warning:   '#F59E0B',
  error:     '#EF4444',
  info:      '#3B82F6',
  danger:    '#EF4444',

  // Delivery workflow
  statusAccepted:    '#3B82F6',
  statusEnRoute:     '#8B5CF6',
  statusArrived:     '#F59E0B',
  statusDelivered:   '#22C55E',
  statusCancelled:   '#EF4444',

  // Neutrals
  ink:        '#0A1220',
  inkSoft:    '#374151',
  inkMuted:   '#64748B',
  inkFaint:   '#94A3B8',
  border:     '#E2E8F0',
  borderSoft: '#F1F5F9',
  surface:    '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  well:       '#F1F5F9',
  white:      '#FFFFFF',
  black:      '#000000',
  overlay:    'rgba(0,0,0,0.45)',

  // Map markers
  mapRoute:    '#0E7E74',
  mapPickup:   '#3B82F6',
  mapDelivery: '#EF4444',
  mapDriver:   '#0E7E74',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  // Cairo font families
  black:    'Cairo_800ExtraBold',
  bold:     'Cairo_700Bold',
  semibold: 'Cairo_600SemiBold',
  medium:   'Cairo_500Medium',
  regular:  'Cairo_400Regular',

  // Scale
  xs:    11,
  sm:    13,
  base:  15,
  md:    17,
  lg:    20,
  xl:    24,
  '2xl': 28,
  '3xl': 34,

  // Weight strings (for fontWeight prop fallback)
  weightRegular:   '400' as const,
  weightMedium:    '500' as const,
  weightSemibold:  '600' as const,
  weightBold:      '700' as const,
  weightExtrabold: '800' as const,

  // Line-height multipliers
  tight:   1.2,
  normal:  1.5,
  relaxed: 1.75,
} as const;

// Re-export weights under old key names for backward compat
export const fontWeight = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
  black:     '900' as const,
};

// ─── Spacing (4-pt grid) ─────────────────────────────────────────────────────

export const spacing = {
  0.5: 2,
  1:   4,
  1.5: 6,
  2:   8,
  2.5: 10,
  3:   12,
  3.5: 14,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  9:   36,
  10:  40,
  12:  48,
  14:  56,
  16:  64,
  20:  80,
  24:  96,
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const radii = {
  none: 0,
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  none: Platform.select({ ios: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0 }, android: { boxShadow: 'none' }, default: {} }) ?? {},
  xs:   makeShadow('#0C2240', 1, 0.05, 2,  1),
  sm:   makeShadow('#0C2240', 2, 0.07, 6,  3),
  md:   makeShadow('#0C2240', 4, 0.10, 12, 6),
  lg:   makeShadow('#0C2240', 8, 0.14, 20, 10),
  xl:   makeShadow('#0C2240', 12, 0.18, 28, 14),
  brand: makeShadow('#0E7E74', 4, 0.22, 14, 8),
  card:  makeShadow('#0C2240', 2, 0.05, 6,  2),
} as const;

// ─── Animation ───────────────────────────────────────────────────────────────

export const animation = {
  fast:   150,
  normal: 250,
  slow:   400,
} as const;

// Minimum HIG touch target
export const touchTarget = 48;
