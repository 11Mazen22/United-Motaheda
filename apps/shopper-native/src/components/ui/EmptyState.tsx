import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Text, Button, useTheme, kit } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { isRtl } from "@/utils/layout";

export interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon = "cube-outline", title, subtitle, description, action, style }: EmptyStateProps) {
  const { theme } = useTheme();
  
  const displaySubtitle = subtitle || description;

  return (
    <Animated.View
      entering={FadeInDown.duration(350).delay(80)}
      style={[
        s.container,
        { backgroundColor: kit.color.canvas.background },
        style
      ]}
    >
      <View
        style={[
          s.iconWrap,
          {
            backgroundColor: `${kit.color.accent}15`,
            borderColor: kit.color.line,
          }
        ]}
      >
        <Ionicons name={icon} size={36} color={kit.color.accent} />
      </View>
      <Text variant="h3" align="center" style={{ color: kit.color.text.primary, marginTop: kit.sp(4) }}>
        {title}
      </Text>
      {displaySubtitle ? (
        <Text variant="body" align="center" style={{ color: kit.color.text.secondary, marginTop: kit.sp(2) }}>
          {displaySubtitle}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: kit.sp(6) }}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: kit.sp(8),
    paddingVertical: kit.sp(12),
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
