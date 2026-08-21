import { Text as RNText, type TextProps as RNTextProps, type TextStyle, type StyleProp } from 'react-native';
import { useCustomerTheme } from './useCustomerTheme';
import type { customerType } from '@pharmacy/design-tokens';

const fontFamilyMap = {
  regular: 'Cairo_400Regular',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extrabold: 'Cairo_800ExtraBold',
  black: 'Cairo_900Black',
} as const;

export interface TProps extends Omit<RNTextProps, 'style'> {
  scale: keyof typeof customerType;
  color?: 'primary' | 'secondary' | 'muted' | 'disabled' | 'inverse' | 'brand' | 'danger' | 'warn' | 'success' | string;
  align?: 'start' | 'end' | 'center';
  style?: StyleProp<TextStyle>;
}

export function T({ scale, color = 'primary', align, style, ...props }: TProps) {
  const { theme, isRTL, cx } = useCustomerTheme();
  const metric = cx.type[scale];
  
  const resolvedColor = {
    primary: theme.colors.text.primary,
    secondary: theme.colors.text.secondary,
    muted: theme.colors.text.muted,
    disabled: theme.colors.text.disabled,
    inverse: theme.colors.text.inverse,
    brand: theme.colors.brand.primary,
    danger: theme.colors.status.error,
    warn: theme.colors.status.warning,
    success: theme.colors.status.success,
  }[color] || color;

  let textAlign: TextStyle['textAlign'] = align === 'center' ? 'center' : (isRTL ? 'right' : 'left');
  if (align === 'start') textAlign = isRTL ? 'right' : 'left';
  if (align === 'end') textAlign = isRTL ? 'left' : 'right';

  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily: fontFamilyMap[metric.weight],
          fontSize: metric.fontSize,
          lineHeight: metric.lineHeight,
          letterSpacing: metric.letterSpacing,
          color: resolvedColor,
          textAlign,
          writingDirection: isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]}
    />
  );
}





export interface EyebrowProps {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Eyebrow({ children, color = 'brand', style }: EyebrowProps) {
  return (
    <T scale="eyebrow" color={color} style={[{ textTransform: 'uppercase' }, style]}>
      {children}
    </T>
  );
}
