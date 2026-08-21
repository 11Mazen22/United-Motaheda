import { View, type StyleProp, type ViewStyle } from "react-native";
import { useCourierTheme } from "./useCourierTheme";
import { Typography } from "./Typography";

export interface BadgeProps {
  label?: string;
  count?: number;
  variant?: "primary" | "success" | "warning" | "error" | "info" | "neutral";
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Badge({ label, count, variant = "primary", dot, style, accessibilityLabel }: BadgeProps) {
  const { theme, courier: courierTokens } = useCourierTheme();
  if (typeof count === "number" && count <= 0 && !dot) return null;

  const color =
    variant === "success" ? courierTokens.status.online :
    variant === "warning" ? courierTokens.status.arrived :
    variant === "error" ? courierTokens.status.cancelled :
    variant === "info" ? courierTokens.status.accepted :
    variant === "neutral" ? theme.colors.text.muted :
    theme.colors.brand.primary;

  const display = count == null ? label : count > 99 ? "99+" : String(count);

  return (
    <View
      accessibilityLabel={accessibilityLabel || display}
      style={[
        {
          minHeight: 24,
          borderRadius: 9999,
          paddingHorizontal: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${color}18`,
        },
        style,
      ]}
    >
      {dot ? <View style={styles.dot} /> : null}
      {display ? <Typography scale="badge" color="inverse">{display}</Typography> : null}
    </View>
  );
}

const styles = {
  dot: { width: 7, height: 7, borderRadius: 4 },
};
