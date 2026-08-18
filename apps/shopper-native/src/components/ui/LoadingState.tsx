import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { Text, useTheme, kit } from "@pharmacy/ui-native";

export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  const { theme } = useTheme();
  
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 800 }),
        withTiming(0.8, { duration: 800 })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.5, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <View style={[s.container, { backgroundColor: theme.colors.canvas.background }]}>
      <Animated.View
        style={[
          s.circle,
          { backgroundColor: kit.color.accent },
          animatedStyle,
        ]}
      />
      {message && (
        <Text variant="body" align="center" style={{ color: theme.colors.text.secondary, marginTop: kit.sp(6) }}>
          {message}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: kit.sp(6),
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
});
