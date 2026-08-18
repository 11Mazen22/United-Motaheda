import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme, kit } from "@pharmacy/ui-native";

export interface DividerProps {
  strength?: "subtle" | "default" | "strong";
  label?: string;
  spacing?: number;
}

export function Divider({ strength = "default", label, spacing = 0 }: DividerProps) {
  const { theme } = useTheme();

  const getOpacity = () => {
    switch (strength) {
      case "subtle": return 0.4;
      case "strong": return 1;
      case "default":
      default: return 0.7;
    }
  };

  const lineColor = kit.color.border.default;

  return (
    <View style={[s.container, { marginVertical: spacing }]}>
      <View style={[s.line, { backgroundColor: lineColor, opacity: getOpacity() }]} />
      {label && (
        <Text variant="caption" style={{ color: kit.color.text.muted, marginHorizontal: kit.sp(3) }}>
          {label}
        </Text>
      )}
      {label && (
        <View style={[s.line, { backgroundColor: lineColor, opacity: getOpacity() }]} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  line: {
    flex: 1,
    height: 1,
  },
});
