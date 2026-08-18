import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';
import { Ionicons } from '@expo/vector-icons';

export interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, disabled }: QuantityStepperProps) {
  const c = useDarkColors();
  
  const handleDec = () => { if (value > min) onChange(value - 1); };
  const handleInc = () => { if (value < max) onChange(value + 1); };

  return (
    <View style={[styles.container, { backgroundColor: c.surfaceElevated, borderColor: c.line, opacity: disabled ? kit.opacity.disabled : 1 }]}>
      <Pressable onPress={handleDec} disabled={disabled || value <= min} accessibilityRole="button" accessibilityLabel="Decrease quantity" style={styles.btn}>
        <Ionicons name="remove" size={20} color={value <= min ? c.inkFaint : c.ink} />
      </Pressable>
      <Text style={[styles.text, { color: c.ink }]}>{value}</Text>
      <Pressable onPress={handleInc} disabled={disabled || value >= max} accessibilityRole="button" accessibilityLabel="Increase quantity" style={styles.btn}>
        <Ionicons name="add" size={20} color={value >= max ? c.inkFaint : c.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: kit.radius.md,
    height: 40,
  },
  btn: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    ...kit.type.body,
    fontFamily: kit.font.semiBold,
    minWidth: 32,
    textAlign: 'center',
  }
});
