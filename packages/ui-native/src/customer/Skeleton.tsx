import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useLuxuryTheme } from './useLuxuryTheme';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width, height, radius, style }: SkeletonProps) {
  const { surface, lx } = useLuxuryTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 600 }),
        withTiming(0.4, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: surface.s2,
          width,
          height,
          borderRadius: radius ?? lx.radius.sm,
        },
        animatedStyle as any,
        style,
      ]}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: string | number;
  lineHeight?: number;
  gap?: number;
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
  lineHeight = 16,
  gap = 8,
}: SkeletonTextProps) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </View>
  );
}

export interface ProductCardSkeletonProps {
  style?: StyleProp<ViewStyle>;
}

export function ProductCardSkeleton({ style }: ProductCardSkeletonProps) {
  const { lx, surface } = useLuxuryTheme();

  return (
    <View
      style={[
        {
          width: lx.size.productCardWidth,
          backgroundColor: surface.s1,
          borderRadius: lx.radius.card,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Skeleton width="100%" height={lx.size.productCardImageH} radius={0} />
      <View style={{ padding: lx.space.cardV, gap: lx.space[2] }}>
        <SkeletonText lines={2} lineHeight={14} gap={4} lastLineWidth="80%" />
        <View style={{ marginTop: lx.space[2] }}>
          <Skeleton width="40%" height={20} />
        </View>
      </View>
    </View>
  );
}
