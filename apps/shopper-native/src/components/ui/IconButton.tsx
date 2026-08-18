import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';
import { Ionicons } from '@expo/vector-icons';

export interface IconButtonProps {
  onPress?: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  color?: string;
  size?: number;
  accessibilityLabel: string;
}

export function IconButton({ onPress, icon, disabled, color, size = 24, accessibilityLabel }: IconButtonProps) {
  const c = useDarkColors();
  const iconColor = disabled ? c.inkFaint : (color || c.ink);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
      style={styles.button}
    >
      <Ionicons name={icon} size={size} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: kit.radius.full,
  }
});
