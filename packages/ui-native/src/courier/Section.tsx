import { View, type StyleProp, type ViewStyle } from "react-native";
import { useCourierTheme } from "./useCourierTheme";
import { Typography } from "./Typography";

export interface SectionProps {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Section({ title, subtitle, actionLabel, onAction, children, style }: SectionProps) {
  const { courier: courierTokens, isRTL } = useCourierTheme();
  return (
    <View style={[{ gap: courierTokens.space[3] }, style]}>
      {(title || actionLabel) && (
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            {title ? <Typography scale="sectionHead">{title}</Typography> : null}
            {subtitle ? <Typography scale="caption" color="secondary">{subtitle}</Typography> : null}
          </View>
          {actionLabel ? (
            <Typography scale="caption" color="brand" onPress={onAction}>{actionLabel}</Typography>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}
