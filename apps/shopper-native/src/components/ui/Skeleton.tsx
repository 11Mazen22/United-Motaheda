/**
 * Skeleton — premium loading placeholder system.
 *
 * Design principles:
 *   - The base block sits on a soft `surfaceSunken` tint, not aggressive
 *     slate[200] — it should read as "shape waiting to be filled", not
 *     "missing content".
 *   - Shimmer overlay is a calm 40%-white sweep on a 1600ms cycle. Premium
 *     loading feels measured, not anxious; slower-than-default shimmer
 *     signals system confidence.
 *   - Preset card skeletons mirror the EXACT geometry of their real
 *     counterparts (radius 18, padding 14, gap 5) so the transition into
 *     real content causes zero layout reflow.
 *   - All presets layer on `shadow.card` so the loading state already
 *     feels elevated — no popping the moment data arrives.
 */

import React, { useEffect } from "react";
import { Dimensions, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const _isRtl = isRtl();

const { width: SCREEN_W } = Dimensions.get("window");

interface SkeletonProps {
  width?:   number | `${number}%`;
  height?:  number;
  radius?:  number;
  style?:   StyleProp<ViewStyle>;
}

export function Skeleton({ width = "100%", height = 16, radius = theme.radius.md, style }: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      // 1600ms with the new `smoothOut` ease — calmer, premium loading
      withTiming(1, { duration: 1600, easing: Easing.bezier(0.32, 0.72, 0, 1) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-SCREEN_W, SCREEN_W],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius:    radius,
          backgroundColor: kit.color.slate[100],
          overflow:        "hidden",
        },
        style,
      ]}>
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: SCREEN_W }, animStyle]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.42)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

// ─── Preset skeletons ─────────────────────────────────────────────────────────
// Geometry matches the real components 1:1 — when data arrives, the
// transition is invisible (no width/height/radius shift).

export function ProductCardSkeleton() {
  return (
    <View style={{
      backgroundColor: kit.color.surface,
      borderRadius:    18,                // matches ProductCard.gridCard
      overflow:        "hidden",
      ...theme.shadow.card,
    }}>
      {/* Image area — matches ProductCard.imgBox (170h, surfaceSunken bg) */}
      <View style={{ height: 170, backgroundColor: kit.color.surfaceSunken, padding: 14, gap: 8, justifyContent: "flex-end" }}>
        {/* Wishlist heart tile placeholder (top-right) */}
        <View style={{ position: "absolute", top: 10, end: 10 }}>
          <Skeleton width={32} height={32} radius={11} />
        </View>
      </View>
      {/* Info area — matches ProductCard.gridInfo (padding 14, gap 5) */}
      <View style={{ padding: 14, gap: 8 }}>
        <Skeleton width="40%" height={10} radius={6} />
        <Skeleton width="85%" height={13} radius={6} />
        <Skeleton width="60%" height={13} radius={6} />
        <View style={{ flexDirection: flexRow(_isRtl), justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
          <View style={{ gap: 4, alignItems: "flex-end" }}>
            <Skeleton width={64} height={18} radius={6} />
          </View>
          <Skeleton width={38} height={38} radius={12} />
        </View>
      </View>
    </View>
  );
}

export function CategoryCardSkeleton() {
  // matches CategoryCard.pill — 104w × 168h × radius["2xl"] (22)
  return <Skeleton width={104} height={168} radius={theme.radius['2xl']} />;
}

export function OrderCardSkeleton() {
  return (
    <View style={{
      backgroundColor: kit.color.surface,
      borderRadius:    18,
      padding:         18,
      gap:             14,
      ...theme.shadow.card,
    }}>
      {/* Header row — icon tile + identity stack + status badge */}
      <View style={{ flexDirection: flexRow(_isRtl), justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexDirection: flexRow(_isRtl), gap: 10, alignItems: "center" }}>
          <Skeleton width={34} height={34} radius={11} />
          <View style={{ gap: 4 }}>
            <Skeleton width={64} height={9}  radius={4} />
            <Skeleton width={92} height={14} radius={6} />
            <Skeleton width={80} height={10} radius={4} />
          </View>
        </View>
        <Skeleton width={72} height={22} radius={999} />
      </View>
      {/* Items preview row */}
      <View style={{
        backgroundColor: kit.color.surfaceSunken,
        borderRadius: theme.radius.lg,
        padding: 12,
        flexDirection: flexRow(_isRtl),
        alignItems: "center",
        gap: 12,
      }}>
        <Skeleton width={54} height={54} radius={theme.radius.md} />
        <View style={{ flex: 1, gap: 5 }}>
          <Skeleton width="70%" height={11} radius={5} />
          <Skeleton width="40%" height={9}  radius={4} />
        </View>
      </View>
      {/* Footer — total */}
      <View style={{
        flexDirection: flexRow(_isRtl),
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: kit.color.border.hairline,
      }}>
        <Skeleton width={56} height={11} radius={5} />
        <Skeleton width={88} height={17} radius={6} />
      </View>
    </View>
  );
}
