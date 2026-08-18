import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';

export interface ButtonProps {
  onPress?: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ onPress, title, variant = 'primary', disabled, loading }: ButtonProps) {
  const c = useDarkColors();
  
  const getBgColor = () => {
    if (disabled) return c.line;
    switch (variant) {
      case 'primary': return c.accent;
      case 'secondary': return c.surfaceElevated;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return c.accent;
    }
  };

  const getTextColor = () => {
    if (disabled) return c.inkFaint;
    switch (variant) {
      case 'primary': return c.onAccent;
      case 'secondary': return c.ink;
      case 'outline': return c.accent;
      case 'ghost': return c.ink;
      default: return c.onAccent;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityLabel={title}
      style={[
        styles.button,
        { backgroundColor: getBgColor() },
        variant === 'outline' && { borderWidth: 1, borderColor: c.accent }
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: kit.radius.control,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: kit.sp(4),
    minWidth: 44,
  },
  text: {
    ...kit.type.btnLabel,
    fontFamily: kit.font.semiBold,
  }
});
