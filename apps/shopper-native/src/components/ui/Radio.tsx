import React from 'react';
import { Pressable, View, StyleSheet, Text } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';

export interface RadioProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Radio({ checked, onChange, label, disabled }: RadioProps) {
  const c = useDarkColors();
  
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label || 'Radio'}
      style={styles.container}
    >
      <View style={[
        styles.outer,
        { 
          borderColor: checked ? c.accent : c.line,
          opacity: disabled ? kit.opacity.disabled : 1
        }
      ]}>
        {checked && <View style={[styles.inner, { backgroundColor: c.accent }]} />}
      </View>
      {label && <Text style={[styles.label, { color: c.ink, opacity: disabled ? kit.opacity.disabled : 1 }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  outer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: kit.sp(3),
  },
  inner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    ...kit.type.body,
    fontFamily: kit.font.medium,
  }
});
