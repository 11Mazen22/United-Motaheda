import { View, type StyleProp, type ViewStyle } from "react-native";
import { usePharmacistTheme } from "./usePharmacistTheme";
import { Typography } from "./Typography";

export interface AvatarProps {
  initials?: string;
  size?: "sm" | "md" | "lg" | number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Avatar({ initials = "", size = "md", style, accessibilityLabel }: AvatarProps) {
  const { theme, ph } = usePharmacistTheme();
  const px = typeof size === "number" ? size : { sm: ph.size.avatarSm, md: ph.size.avatarMd, lg: ph.size.avatarLg }[size];
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
