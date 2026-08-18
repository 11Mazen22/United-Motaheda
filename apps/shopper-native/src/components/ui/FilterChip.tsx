import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';
import { Ionicons } from '@expo/vector-icons';

export interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function FilterChip({ label, selected, onPress, disabled }: FilterChipProps) {
  const c = useDarkColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.accent : c.surface,
          borderColor: selected ? c.accent : c.line,
          opacity: disabled ? kit.opacity.disabled : 1,
        }
      ]}
    >
      {selected && <Ionicons name="checkmark" size={16} color={c.onAccent} style={{ marginEnd: kit.sp(1) }} />}
      <Text style={[styles.label, { color: selected ? c.onAccent : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
    borderRadius: kit.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: kit.sp(3),
    minWidth: 44,
    justifyContent: 'center',
  },
  label: {
    ...kit.type.body,
    fontFamily: kit.font.medium,
  }
});
