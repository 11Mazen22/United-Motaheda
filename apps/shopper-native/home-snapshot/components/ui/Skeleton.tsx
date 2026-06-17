import React, { useEffect } from "react";
import { View, Dimensions, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../shared/theme";

const { width: SCREEN_W } = Dimensions.get("window");

export function Skeleton({ width = "100%", height = 16, radius = 8, style }: any) {
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false); return () => cancelAnimation(progress); }, []);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * SCREEN_W }] }));
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: theme.colors.slate[100], overflow: "hidden" }, style]}>
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: SCREEN_W }, anim as any]}>
        <LinearGradient colors={["transparent", "rgba(255,255,255,0.42)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
