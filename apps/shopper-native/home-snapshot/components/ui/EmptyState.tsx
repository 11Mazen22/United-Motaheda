import React from "react";
import { View } from "react-native";
import { Text as UIText } from "../../shared/ui/Text";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { theme } from "../../shared/theme";
import { Button } from "./Button";

export function EmptyState({ icon = "cube-outline", title, description, actionLabel, onAction, compact = false }: any) {
  return (
    <Animated.View style={{ flex: compact ? 0 : 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <View style={{ width: compact ? 64 : 80, height: compact ? 64 : 80, borderRadius: 24, backgroundColor: theme.colors.brand[50], alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon as any} size={34} color={theme.colors.brand[400]} />
      </View>
      <View style={{ alignItems: "center", gap: 6 }}>
        <UIText style={{ fontSize: compact ? 15 : 18, fontWeight: "700", color: theme.colors.text.primary, textAlign: "center" }}>{title}</UIText>
        {description && <UIText style={{ fontSize: 12, color: theme.colors.text.tertiary, textAlign: "center" }}>{description}</UIText>}
      </View>
      {actionLabel && onAction && <Button variant="primary" size="sm" onPress={onAction}>{actionLabel}</Button>}
    </Animated.View>
  );
}
