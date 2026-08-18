import React from 'react';
import { Pressable, View, StyleSheet, Text } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';
import { Ionicons } from '@expo/vector-icons';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  const c = useDarkColors();
  
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label || 'Checkbox'}
      style={styles.container}
    >
      <View style={[
        styles.box,
        { 
          borderColor: checked ? c.accent : c.line,
          backgroundColor: checked ? c.accent : 'transparent',
          opacity: disabled ? kit.opacity.disabled : 1
        }
      ]}>
        {checked && <Ionicons name="checkmark" size={16} color={c.onAccent} />}
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
  box: {
    width: 24,
    height: 24,
    borderRadius: kit.radius.sm,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: kit.sp(3),
  },
  label: {
    ...kit.type.body,
    fontFamily: kit.font.medium,
  }
});
