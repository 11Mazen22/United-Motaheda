import { View, ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "../components/primitives";
import { useCourierTheme } from "./useCourierTheme";
import { Typography } from "./Typography";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { StyleSheet } from "react-native";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "map";
export type ButtonSize = "lg" | "md" | "sm";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconEnd?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  iconEnd,
  fullWidth,
  style,
  haptic = true,
  accessibilityLabel,
}: ButtonProps) {
  const { theme, courier: courierTokens } = useCourierTheme();

  let bg = "transparent";
  let borderColor = "transparent";
  let textColor: "primary" | "inverse" | "brand" | "danger" = "primary";

  switch (variant) {
    case "primary":
      bg = courierTokens.status.online;
      textColor = "inverse";
      break;
    case "secondary":
      bg = theme.colors.canvas.surfaceMuted;
      borderColor = theme.colors.border.default;
      textColor = "primary";
      break;
    case "outline":
      borderColor = theme.colors.brand.primary;
      textColor = "brand";
      break;
    case "ghost":
      textColor = "brand";
      break;
    case "danger":
      bg = theme.colors.status.error;
      textColor = "inverse";
      break;
    case "map":
      bg = courierTokens.map.route;
      textColor = "inverse";
      break;
  }

  const contentColor = textColor === "inverse" ? theme.colors.text.inverse : theme.colors.brand.primary;

  const handlePress = () => {
    if (loading || disabled) return;
    if (haptic && Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor,
          borderRadius: courierTokens.radius.button,
          paddingHorizontal: courierTokens.space[4],
          opacity: disabled ? 0.38 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {icon && <View style={{ marginRight: courierTokens.space[2] }}>{icon}</View>}
          <Typography scale="buttonMd" color={textColor} align="center">
            {label}
          </Typography>
          {iconEnd && <View style={{ marginLeft: courierTokens.space[2] }}>{iconEnd}</View>}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    gap: 8,
  },
});
