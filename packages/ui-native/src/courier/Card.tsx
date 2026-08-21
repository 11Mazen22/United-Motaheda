import { View, type StyleProp, type ViewStyle } from "react-native";
import { useCourierTheme } from "./useCourierTheme";

export interface CardProps {
  children: React.ReactNode;
  padding?: number | "none" | "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const cardPadding = { none: 0, sm: 12, md: 16, lg: 20 } as const;

export function Card({ children, padding = 16, style, accessibilityLabel }: CardProps) {
  const { theme, courier: courierTokens } = useCourierTheme();
  const resolvedPadding = typeof padding === "number" ? padding : cardPadding[padding];
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          borderRadius: courierTokens.radius.card,
          padding: resolvedPadding,
          backgroundColor: theme.colors.canvas.surface,
          borderWidth: 1,
          borderColor: theme.colors.border.default,
          ...courierTokens.shadow.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
