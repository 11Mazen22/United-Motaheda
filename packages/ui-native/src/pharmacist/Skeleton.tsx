import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import { usePharmacistTheme } from "./usePharmacistTheme";

export interface SkeletonProps {
  variant?: "rectangle" | "circle" | "text";
  width?: number | `${number}%`;
  height?: number;
  style?: any;
}

export function Skeleton({ variant = "rectangle", width = "100%", height = variant === "text" ? 14 : 16, style }: SkeletonProps) {
  const { theme, ph } = usePharmacistTheme();
  const opacity = useSharedValue(0.35);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        {
          width,
          height,
          borderRadius: variant === "circle" ? Number(height) / 2 : variant === "text" ? 4 : ph.radius.sm,
          backgroundColor: theme.colors.canvas.surfaceMuted,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
