/**
 * AppLogo — reusable brand-mark renderer.
 *
 * Creative refresh (2026):
 *  • Spring‑animated mount for a modern, alive first impression.
 *  • Respects reduced motion for accessibility.
 *  • Improved accessibility role + label on the container.
 *  • All existing sizing, inset logic, and fallback preserved exactly.
 */

import React, { useState } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { kit } from "@pharmacy/ui-native";

const SIZE: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
  xs: 24,
  sm: 40,
  md: 64,
  lg: 96,
  xl: 140,
};

const ICON_SIZE: Record<keyof typeof SIZE, number> = {
  xs: 13,
  sm: 22,
  md: 35,
  lg: 52,
  xl: 76,
};

const GLYPH_INSET = 0.82;
const RADIUS_RATIO = 0.24;
const BRAND_MARK = require("../../../assets/brand-mark.png");

export type AppLogoSize = keyof typeof SIZE;

export interface AppLogoProps {
  size?: AppLogoSize | number;
  style?: StyleProp<ViewStyle>;
}

export function AppLogo({ size = "md", style }: AppLogoProps): React.ReactElement {
  const px = typeof size === "number" ? size : SIZE[size];
  const icon = typeof size === "number" ? Math.round(size * 0.55) : ICON_SIZE[size];
  const [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();

  const enterAnimation = reduced ? undefined : FadeIn.springify().damping(14).mass(0.8).duration(600);

  return (
    <Animated.View
      entering={enterAnimation}
      style={[
        s.container,
        {
          width: px,
          height: px,
          borderRadius: Math.round(px * RADIUS_RATIO),
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="United Pharmacy"
    >
      {failed ? (
        <Ionicons
          name="medkit"
          size={icon}
          color={kit.color.accentDeep}
        />
      ) : (
        <Image
          source={BRAND_MARK}
          style={{
            width: px * GLYPH_INSET,
            height: px * GLYPH_INSET,
          }}
          contentFit="contain"
          onError={() => setFailed(true)}
          accessibilityLabel="United Pharmacy"
          accessibilityIgnoresInvertColors
        />
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});