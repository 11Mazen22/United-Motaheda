/**
 * PressableScale — a Pressable that springs its content down on touch.
 *
 * 2026 Creative Refresh:
 *  • Integrated haptic feedback (optional, via expo‑haptics).
 *  • Default spring now has a slight bounce for a more premium feel.
 *  • Optional opacity dimming on press for an extra tactile layer.
 *  • Reduced‑motion safe; all animations degrade gracefully.
 *
 * Consolidates the press‑scale micro‑interaction used across the app.
 * The animated transform is applied to an inner Animated.View; pass the
 * visual style (background, padding, radius…) via `style`.
 */

import React, { useCallback } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

/**
 * Spring config tuned for a fast, confident press—
 * a tiny bounce communicates physicality without slowness.
 */
const DEFAULT_SPRING: WithSpringConfig = {
  damping: 14,
  stiffness: 380,
  mass: 0.6,
};

export interface PressableScaleProps extends Omit<PressableProps, "style"> {
  /** Scale applied while pressed (default 0.96). */
  scaleTo?: number;
  /** Spring config for press in/out (default: tuned snap‑bounce). */
  springConfig?: WithSpringConfig;
  /** Visual style — applied to the animated inner view. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;

  // 2026 additions — all optional, zero breaking change
  /**
   * Haptic feedback style fired on press in.
   * `"light"` for subtle taps, `"medium"` for primary actions.
   * Set to `null` to disable (default: `"light"`).
   */
  haptic?: "light" | "medium" | null;
  /**
   * When true, the content also dims to 0.85 opacity while pressed,
   * reinforcing the press state (default: false).
   */
  dimOnPress?: boolean;
}

export function PressableScale({
  scaleTo = 0.96,
  springConfig = DEFAULT_SPRING,
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  haptic = "light", // subtle haptic by default
  dimOnPress = false,
  ...rest
}: PressableScaleProps): React.ReactElement {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handleIn = useCallback<NonNullable<PressableProps["onPressIn"]>>(
    (e) => {
      if (!reduced && !disabled) {
        // Spring‑scale down
        scale.value = withSpring(scaleTo, springConfig);
        // Optional opacity dim
        if (dimOnPress) {
          opacity.value = withTiming(0.85, { duration: 120 });
        }
      }
      // Haptic feedback (light by default, overridable)
      if (haptic && !disabled) {
        Haptics.impactAsync(
          haptic === "medium"
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light
        ).catch(() => {});
      }
      onPressIn?.(e);
    },
    [
      reduced, disabled, scale, springConfig, scaleTo,
      dimOnPress, opacity, haptic, onPressIn,
    ]
  );

  const handleOut = useCallback<NonNullable<PressableProps["onPressOut"]>>(
    (e) => {
      if (!reduced && !disabled) {
        scale.value = withSpring(1, springConfig);
        if (dimOnPress) {
          opacity.value = withTiming(1, { duration: 160 });
        }
      }
      onPressOut?.(e);
    },
    [reduced, disabled, scale, springConfig, dimOnPress, opacity, onPressOut]
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPressIn={handleIn}
      onPressOut={handleOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}