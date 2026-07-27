import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, radii } from '@/theme/tokens';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = radii.md,
  style,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.well, colors.borderSoft],
    ),
  }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius }, animatedStyle, style]}
    />
  );
};

interface SkeletonCardProps {
  lines?: number;
  style?: ViewStyle;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ lines = 3, style }) => (
  <View style={[s.card, style]}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        height={14}
        width={i === lines - 1 ? '60%' : '100%'}
        style={{ marginBottom: 10 }}
      />
    ))}
  </View>
);

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 16,
    gap: 8,
  },
});
