import React, { useEffect, useCallback } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  show: (message: string, type?: ToastType) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  type: 'info',
  show: (message, type = 'info') => set({ visible: true, message, type }),
  hide: () => set({ visible: false }),
}));

export const showToast = (message: string, type: ToastType = 'info') => {
  useToastStore.getState().show(message, type);
};

const typeColors: Record<ToastType, string> = {
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  info: colors.info,
};

export const Toast: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { visible, message, type, hide } = useToastStore();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const dismiss = useCallback(() => {
    hide();
  }, [hide]);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });

      const timer = setTimeout(() => {
        translateY.value = withTiming(-100, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 }, (done) => {
          if (done) runOnJS(dismiss)();
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [visible, message]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible && opacity.value === 0) return null;

  return (
    <Animated.View
      style={[
        s.container,
        { top: insets.top + spacing[2] },
        { borderLeftColor: typeColors[type] },
        animStyle,
      ]}
    >
      <Pressable onPress={dismiss} style={s.inner}>
        <Text style={s.message} numberOfLines={2}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    zIndex: 9999,
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    borderLeftWidth: 4,
    ...shadows.lg,
  },
  inner: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  message: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
});
