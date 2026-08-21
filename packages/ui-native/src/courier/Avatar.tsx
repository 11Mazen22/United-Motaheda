import { View, type StyleProp, type ViewStyle } from "react-native";
import { useCourierTheme } from "./useCourierTheme";
import { Typography } from "./Typography";

export interface AvatarProps {
  initials?: string;
  size?: "sm" | "md" | "lg" | number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Avatar({ initials = "", size = "md", style, accessibilityLabel }: AvatarProps) {
  const { theme } = useCourierTheme();
  const px = typeof size === "number" ? size : { sm: 32, md: 44, lg: 64 }[size];
  return (
    <View
      accessibilityLabel={accessibilityLabel || initials}
      style={[
        {
          width: px,
          height: px,
          borderRadius: px / 2,
          backgroundColor: theme.colors.brand.primaryLight,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {initials ? (
        <Typography scale="caption" color="brand" align="center">
          {initials.slice(0, 2).toUpperCase()}
        </Typography>
      ) : null}
    </View>
  );
}
