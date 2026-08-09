import React from "react";
import { View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "@pharmacy/design-tokens";
import { Button, kit } from "@pharmacy/ui-native";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface EmptyStateProps {
  icon?:          IoniconsName;
  title:          string;
  description?:   string;
  actionLabel?:   string;
  onAction?:      () => void;
  compact?:       boolean;
}

export function EmptyState({
  icon        = "cube-outline",
  title,
  description,
  actionLabel,
  onAction,
  compact     = false,
}: EmptyStateProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(350).delay(80)}
      style={{
        flex:           compact ? 0 : 1,
        alignItems:     "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical:   compact ? 32 : 64,
        gap:            16,
      }}>
      {/* Icon circle */}
      <View
        style={{
          width:           compact ? 64 : 80,
          height:          compact ? 64 : 80,
          borderRadius:    compact ? 20 : 24,
          backgroundColor: kit.color.accentTint,
          alignItems:      "center",
          justifyContent:  "center",
          borderWidth:     1,
          borderColor:     kit.color.line,
        }}>
        <Ionicons
          name={icon}
          size={compact ? 28 : 34}
          color={kit.color.accent}
        />
      </View>

      {/* Text */}
      <View style={{ alignItems: "center", gap: 6 }}>
        <UIText style={{
          fontSize:   compact ? theme.fontSize.lg : theme.fontSize['2xl'],
          fontFamily: theme.fonts.bold,
          color:      theme.colors.text.primary,
          textAlign:  "center",
        }}>
          {title}
        </UIText>
        {description && (
          <UIText style={{
            fontSize:   theme.fontSize.sm,
            fontFamily: theme.fonts.regular,
            color:      theme.colors.text.tertiary,
            textAlign:  "center",
            lineHeight: 20,
          }}>
            {description}
          </UIText>
        )}
      </View>

      {/* Action */}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onPress={onAction} label={actionLabel} />
      )}
    </Animated.View>
  );
}
