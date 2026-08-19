import React from 'react';
import { View, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Typography';
import { useLuxuryTheme } from './useLuxuryTheme';
import { Ionicons } from '@expo/vector-icons';

export interface NoticeProps {
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`
    : hex;
}

export function Notice({
  message,
  variant = 'info',
  title,
  icon,
  onDismiss,
  style,
}: NoticeProps) {
  const { theme, lx, isRTL } = useLuxuryTheme();

  let accentColor: string = theme.colors.status.info;
  let defaultIconName: keyof typeof Ionicons.glyphMap = 'information-circle';

  switch (variant) {
    case 'success':
      accentColor = theme.colors.status.success;
      defaultIconName = 'checkmark-circle';
      break;
    case 'warning':
      accentColor = theme.colors.status.warning;
      defaultIconName = 'warning';
      break;
    case 'danger':
      accentColor = theme.colors.status.error;
      defaultIconName = 'alert-circle';
      break;
  }

  const bgColor = hexToRgba(accentColor, 0.08);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: bgColor,
          borderRadius: lx.radius.sm,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: 4,
          backgroundColor: accentColor,
        }}
      />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          padding: lx.space[3],
          alignItems: 'flex-start',
        }}
      >
        <View style={{ marginRight: isRTL ? 0 : lx.space[3], marginLeft: isRTL ? lx.space[3] : 0 }}>
          {icon || <Ionicons name={defaultIconName} size={20} color={accentColor} />}
        </View>
        <View style={{ flex: 1 }}>
          {title && (
            <T scale="label" style={{ marginBottom: lx.space[0.5] }}>
              {title}
            </T>
          )}
          <T scale="bodySm">{message}</T>
        </View>
        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            style={{ padding: lx.space[1], marginLeft: isRTL ? 0 : lx.space[2], marginRight: isRTL ? lx.space[2] : 0 }}
            hitSlop={12}
          >
            <Ionicons name="close" size={20} color={theme.colors.text.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
