import { View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { useCourierTheme } from "./useCourierTheme";
import { Typography } from "./Typography";
import { Button } from "./Button";

export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ title, subtitle, actionLabel, onAction, icon = "cube-outline", style }: EmptyStateProps) {
  const { theme } = useCourierTheme();
  return (
    <Animated.View entering={FadeIn} style={[styles.state, style]}>
      <View style={styles.iconWrap}>
        <View style={[styles.iconCircle, { borderColor: theme.colors.border.default }]}>
          <Ionicons name={icon} size={32} color={theme.colors.text.muted} />
        </View>
      </View>
      <Typography scale="sectionHead" align="center">{title}</Typography>
      {subtitle ? <Typography scale="body" color="secondary" align="center">{subtitle}</Typography> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  iconWrap: {
    marginBottom: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
  },
});
