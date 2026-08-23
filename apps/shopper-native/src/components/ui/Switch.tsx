import React from 'react';
import { Pressable, StyleSheet, Animated } from 'react-native';
import { kit } from '@pharmacy/ui-native';
import { useDarkColors } from '@/hooks/useDarkColors';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

export function Switch({ checked, onChange, disabled, accessibilityLabel }: SwitchProps) {
  const c = useDarkColors();
  const [anim] = React.useState(new Animated.Value(checked ? 1 : 0));

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: checked ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [checked, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22]
  });

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [c.line, c.accent]
  });

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
    >
      <Animated.View style={[
        styles.track,
        { backgroundColor: bgColor as unknown as string, opacity: disabled ? kit.opacity.disabled : 1 }
      ]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  }
});
