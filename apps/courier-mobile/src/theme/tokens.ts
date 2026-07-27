/**
 * Design tokens for the United Pharmacy Driver app.
 * A professional, dark-capable system inspired by Uber/Bolt driver apps.
 */

export const colors = {
  // Brand
  primary:        '#0E7E74',   // Teal — brand CTA
  primaryDark:    '#0A5E57',
  primaryLight:   '#E6F4F3',
  accent:         '#F59E0B',   // Amber — warnings, earnings

  // Status — delivery workflow
  online:         '#22C55E',   // Green
  offline:        '#6B7280',   // Gray
  assigned:       '#3B82F6',   // Blue
  enRoute:        '#8B5CF6',   // Purple
  arrived:        '#F59E0B',   // Amber
  delivered:      '#22C55E',   // Green

  // Semantic
  success:        '#22C55E',
  warning:        '#F59E0B',
  error:          '#EF4444',
  info:           '#3B82F6',

  // Neutral
  black:          '#0A0A0A',
  ink:            '#1A1A2E',
  inkSoft:        '#374151',
  inkMuted:       '#6B7280',
  inkFaint:       '#9CA3AF',
  border:         '#E5E7EB',
  borderSoft:     '#F3F4F6',
  surface:        '#FFFFFF',
  surfaceAlt:     '#F9FAFB',
  well:           '#F3F4F6',
  white:          '#FFFFFF',
  overlay:        'rgba(0,0,0,0.45)',

  // Map
  mapRoute:       '#0E7E74',
  mapPickup:      '#3B82F6',
  mapDelivery:    '#EF4444',
  mapDriver:      '#0E7E74',
} as const;

export const typography = {
  // Font families (using system fonts + Cairo via expo-font)
  fontAr:  'Cairo',
  fontEn:  'System',

  // Scale
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 34,

  // Weight names for Cairo
  regular:    '400' as const,
  medium:     '500' as const,
  semibold:   '600' as const,
  bold:       '700' as const,
  extrabold:  '800' as const,
  black:      '900' as const,

  lineHeightTight:  1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
} as const;

export const spacing = {
  px: 1,
  0.5: 2,
  1:  4,
  1.5: 6,
  2:  8,
  2.5: 10,
  3:  12,
  3.5: 14,
  4:  16,
  5:  20,
  6:  24,
  7:  28,
  8:  32,
  9:  36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radii = {
  none: 0,
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  '2xl': 20,
  full: 9999,
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

export const animation = {
  fast:   150,
  normal: 250,
  slow:   400,
} as const;

// Minimum touch target size per platform HIG
export const touchTarget = 48;
