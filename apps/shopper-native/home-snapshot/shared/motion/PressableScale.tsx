import React from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

export function PressableScale({ children, style, onPress, ...rest }: any) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable onPress={onPress} {...rest}>
      <Animated.View style={[style, anim as any]}>{children}</Animated.View>
    </Pressable>
  );
}

export default PressableScale;
