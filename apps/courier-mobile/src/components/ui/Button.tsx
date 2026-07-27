import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, typography, shadows, touchTarget } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  onPress,
  disabled,
  ...rest
}) => {
  const handlePress = async (e: any) => {
    if (disabled || loading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const containerStyle: ViewStyle[] = [
    s.base,
    s[variant],
    s[`size_${size}`],
    fullWidth && s.fullWidth,
    (disabled || loading) && s.disabled,
    style as ViewStyle,
  ];

  const labelStyle: TextStyle[] = [
    s.label,
    s[`label_${variant}`],
    s[`labelSize_${size}`],
    textStyle as TextStyle,
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      disabled={disabled || loading}
      style={containerStyle}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.white : colors.primary}
        />
      ) : (
        <>
          {leftIcon}
          <Text style={labelStyle}>{title}</Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radii.lg,
    minHeight: touchTarget,
    paddingHorizontal: spacing[5],
    ...shadows.sm,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },

  // Variants
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryLight },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.error },

  // Labels
  label: { fontWeight: typography.semibold, letterSpacing: 0.2 },
  label_primary: { color: colors.white },
  label_secondary: { color: colors.primary },
  label_outline: { color: colors.primary },
  label_ghost: { color: colors.primary },
  label_danger: { color: colors.white },

  // Sizes
  size_sm: { minHeight: 36, paddingHorizontal: spacing[3], borderRadius: radii.md },
  size_md: { minHeight: touchTarget, paddingHorizontal: spacing[5] },
  size_lg: { minHeight: 56, paddingHorizontal: spacing[6] },

  labelSize_sm: { fontSize: typography.sm },
  labelSize_md: { fontSize: typography.base },
  labelSize_lg: { fontSize: typography.md },
});
