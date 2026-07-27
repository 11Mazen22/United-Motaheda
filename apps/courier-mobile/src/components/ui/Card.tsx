import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '@/theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevation?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'md',
  elevation = 'sm',
}) => {
  return (
    <View
      style={[
        s.card,
        padding !== 'none' && s[`pad_${padding}`],
        shadows[elevation],
        style,
      ]}
    >
      {children}
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  pad_sm: { padding: spacing[3] },
  pad_md: { padding: spacing[4] },
  pad_lg: { padding: spacing[6] },
});
