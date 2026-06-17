import React from "react";
import { Pressable, Text } from "react-native";

export function Button({ children, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={{ padding: 8, backgroundColor: "#0ea5b7", borderRadius: 8 }}>
      <Text style={{ color: "#fff" }}>{children}</Text>
    </Pressable>
  );
}

export default Button;
