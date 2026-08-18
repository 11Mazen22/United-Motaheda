import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
}

export function Toast({ message, type = 'info' }: ToastProps) {
  const c = useDarkColors();
  
  const getBgColor = () => {
    switch(type) {
      case 'success': return c.success;
      case 'error': return c.danger;
      default: return c.ink;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getBgColor() }]} accessibilityRole="alert">
      <Text style={[styles.text, { color: c.onInk }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: kit.sp(4),
    paddingVertical: kit.sp(3),
    borderRadius: kit.radius.md,
    margin: kit.sp(4),
    ...kit.shadow.floating,
  },
  text: {
    ...kit.type.body,
    fontFamily: kit.font.medium,
  }
});
