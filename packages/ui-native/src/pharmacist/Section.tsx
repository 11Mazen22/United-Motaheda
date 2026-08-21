import { View, type StyleProp, type ViewStyle } from "react-native";
import { usePharmacistTheme } from "./usePharmacistTheme";
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
  const { ph, isRTL } = usePharmacistTheme();
  return (
    <View style={[{ gap: ph.space[3] }, style]}>
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
