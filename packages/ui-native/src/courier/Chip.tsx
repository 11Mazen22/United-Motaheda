import { type StyleProp, type ViewStyle, StyleSheet } from "react-native";
import { PressableScale } from "../components/primitives";
import { Typography } from "./Typography";
import { useCourierTheme } from "./useCourierTheme";

export interface ChipProps {
  label: string;
  selected?: boolean;
  selectable?: boolean;
  dismissible?: boolean;
  onPress?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Chip({ label, selected, selectable, dismissible, onPress, onDismiss, style, accessibilityLabel }: ChipProps) {
  const { theme } = useCourierTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress && !selectable}
      accessibilityRole={selectable ? "checkbox" : "button"}
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={accessibilityLabel || label}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.brand.primaryLight : theme.colors.canvas.surfaceMuted,
          borderColor: selected ? theme.colors.brand.primary : theme.colors.border.default,
        },
        style,
      ]}
    >
      <Typography scale="caption" color={selected ? "brand" : "secondary"}>
        {label}
      </Typography>
      {dismissible && onDismiss ? (
        <PressableScale onPress={onDismiss} accessibilityRole="button" accessibilityLabel={`Dismiss ${label}`} style={styles.closeIcon}>
          <Typography scale="caption" color="secondary">×</Typography>
        </PressableScale>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  closeIcon: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
