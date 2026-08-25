import React from "react";
import { View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

type Variant = "brand" | "success" | "warning" | "error" | "neutral" | "purple" | "info";
type Size    = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  size?:    Size;
  dot?:     boolean;
}

const CONFIGS: Record<Variant, { bg: string; text: string; dot: string }> = {
  brand:   { bg: theme.colors.brand.primaryLight,       text: theme.colors.brand.primary,    dot: theme.colors.brand.primary   },
  success: { bg: kit.color.successTint,     text: kit.color.success,       dot: kit.color.success      },
  warning: { bg: kit.color.warnTint,        text: kit.color.warn,          dot: kit.color.warn         },
  error:   { bg: kit.color.dangerTint,      text: kit.color.danger,        dot: kit.color.danger       },
  neutral: { bg: kit.color.well,            text: kit.color.inkSoft,       dot: kit.color.inkFaint     },
  // purple/info have no home in kit.color yet — temporary standalone
  // pairs pending the token consolidation (Phase 1).
  purple:  { bg: "#F1ECFB",                 text: "#5B4291",               dot: "#8767C9"              },
  info:    { bg: "#EAF1F8",                 text: "#2E5478",               dot: "#4C7FB0"              },
};

const SIZE_MAP: Record<Size, { px: number; py: number; fontSize: number; radius: number; dotSize: number }> = {
  sm: { px: 7,  py: 3,  fontSize: 10, radius: legacyTheme.radius.xs, dotSize: 5 },
  md: { px: 10, py: 4,  fontSize: 11, radius: legacyTheme.radius.sm, dotSize: 6 },
};

export function Badge({ children, variant = "neutral", size = "sm", dot = false }: BadgeProps) {
  const cfg = CONFIGS[variant];
  const sz  = SIZE_MAP[size];

  return (
    <View
      style={{
        flexDirection:     flexRow(isRtl()) as "row" | "row-reverse",
        alignItems:        "center",
        alignSelf:         "flex-start",
        gap:               dot ? 5 : 0,
        backgroundColor:   cfg.bg,
        borderRadius:      sz.radius,
        paddingHorizontal: sz.px,
        paddingVertical:   sz.py,
      }}>
      {dot && (
        <View style={{ width: sz.dotSize, height: sz.dotSize, borderRadius: sz.dotSize / 2, backgroundColor: cfg.dot }} />
      )}
      <UIText style={{ fontSize: sz.fontSize, fontFamily: legacyTheme.fonts.bold, color: cfg.text }}>
        {children}
      </UIText>
    </View>
  );
}
