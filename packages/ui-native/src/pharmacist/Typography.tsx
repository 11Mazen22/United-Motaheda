import { Text as RNText, type TextProps as RNTextProps, type TextStyle, type StyleProp } from "react-native";
import { usePharmacistTheme } from "./usePharmacistTheme";
import { pharmacist } from "@pharmacy/design-tokens";

const fontFamilyMap = {
  regular: "Cairo_400Regular",
  medium: "Cairo_400Regular",
  semibold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extrabold: "Cairo_800ExtraBold",
  black: "Cairo_900Black",
} as const;

export interface TypographyProps extends Omit<RNTextProps, "style"> {
  scale: keyof typeof pharmacist.type;
  color?: "primary" | "secondary" | "muted" | "disabled" | "inverse" | "brand" | "danger" | "warn" | "success" | string;
  align?: "start" | "end" | "center";
  style?: StyleProp<TextStyle>;
}

export function Typography({ scale, color = "primary", align, style, ...props }: TypographyProps) {
  const { theme, isRTL, ph } = usePharmacistTheme();
  const metric = ph.type[scale];

  const resolvedColor = {
    primary: theme.colors.text.primary,
    secondary: theme.colors.text.secondary,
    muted: theme.colors.text.muted,
    disabled: theme.colors.text.disabled,
    inverse: theme.colors.text.inverse,
    brand: theme.colors.brand.primary,
    danger: theme.colors.status.error,
    warn: theme.colors.status.warning,
    success: theme.colors.status.success,
  }[color] || color;

  const textAlign = align === "center" ? "center" : (isRTL ? "right" : "left");

  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily: fontFamilyMap[metric.weight],
          fontSize: metric.fontSize,
          lineHeight: metric.lineHeight,
          letterSpacing: metric.letterSpacing,
          color: resolvedColor,
          textAlign,
          writingDirection: isRTL ? "rtl" : "ltr",
        },
        style,
      ]}
    />
  );
}
