import React from 'react';
import { View, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '../components/primitives';
import { useLuxuryTheme } from './useLuxuryTheme';
import { T } from './Typography';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface CButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconEnd?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityLabel?: string;
}

export function CButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  iconEnd,
  fullWidth,
  style,
  haptic = true,
  accessibilityLabel,
}: CButtonProps) {
  const { theme, surface, lx, interaction } = useLuxuryTheme();

  const handlePress = () => {
    if (loading || disabled) return;
    if (haptic && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  const height = size === 'lg' ? lx.size.buttonHeightLg : size === 'sm' ? lx.size.buttonHeightSm : lx.size.buttonHeightMd;
  const textScale = size === 'lg' ? 'buttonLg' : size === 'sm' ? 'buttonSm' : 'buttonMd';

  let bg = 'transparent';
  let borderColor = 'transparent';
  let textColor = 'primary';

  switch (variant) {
    case 'primary':
      bg = theme.colors.brand.primary;
      textColor = 'inverse';
      break;
    case 'secondary':
      bg = surface.s2;
      borderColor = theme.colors.brand.primary;
      textColor = 'brand';
      break;
    case 'outline':
      borderColor = theme.colors.brand.primary;
      textColor = 'brand';
      break;
    case 'ghost':
      textColor = 'brand';
      break;
    case 'danger':
      bg = theme.colors.status.error;
      textColor = 'inverse';
      break;
  }

  const contentColor = textColor === 'inverse' ? theme.colors.text.inverse : theme.colors.brand.primary;

  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      style={[
        {
          height,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'secondary' || variant === 'outline' ? 1 : 0,
          borderRadius: lx.radius.button,
          paddingHorizontal: lx.space[4],
          opacity: disabled ? interaction.disabledOpacity : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {icon && <View style={{ marginRight: lx.space[2] }}>{icon}</View>}
          <T scale={textScale} color={textColor} align="center">
            {label}
          </T>
          {iconEnd && <View style={{ marginLeft: lx.space[2] }}>{iconEnd}</View>}
        </>
      )}
    </PressableScale>
  );
}
