import { View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import { usePharmacistTheme } from "./usePharmacistTheme";
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
  const { theme } = usePharmacistTheme();
  if (typeof count === "number" && count <= 0 && !dot) return null;

  const color =
    variant === "success" ? theme.colors.status.success :
    variant === "warning" ? theme.colors.status.warning :
    variant === "error" ? theme.colors.status.error :
    variant === "info" ? theme.colors.status.info :
    variant === "neutral" ? theme.colors.text.muted :
    theme.colors.brand.primary;

  const display = count == null ? label : count > 99 ? "99+" : String(count);

  return (
    <View
      accessibilityLabel={accessibilityLabel || display}
      style={[styles.badge, style]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {display ? <Typography scale="badge" color="inverse">{display}</Typography> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    borderRadius: 9999,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000018",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
