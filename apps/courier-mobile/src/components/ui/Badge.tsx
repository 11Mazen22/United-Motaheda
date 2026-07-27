import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  dot?: boolean;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: colors.primaryLight, text: colors.primary },
  success: { bg: '#DCFCE7', text: '#15803D' },
  warning: { bg: '#FEF9C3', text: '#854D0E' },
  error: { bg: '#FEE2E2', text: '#B91C1C' },
  info: { bg: '#DBEAFE', text: '#1D4ED8' },
  neutral: { bg: colors.well, text: colors.inkMuted },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  style,
  dot = false,
}) => {
  const { bg, text } = variantColors[variant];

  return (
    <View style={[s.badge, { backgroundColor: bg }, style]}>
      {dot && <View style={[s.dot, { backgroundColor: text }]} />}
      <Text style={[s.label, { color: text }]}>{label}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
});
