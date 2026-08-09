import React from "react";
import { View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
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
  brand:   { bg: kit.color.accentTint,       text: kit.color.accentDeep,    dot: kit.color.accent   },
  success: { bg: theme.colors.success.bg,      text: theme.colors.success.text,  dot: theme.colors.success.base },
  warning: { bg: theme.colors.warning.bg,      text: theme.colors.warning.text,  dot: theme.colors.warning.base },
  error:   { bg: theme.colors.error.bg,        text: theme.colors.error.text,    dot: theme.colors.error.base   },
  neutral: { bg: theme.colors.slate[100],      text: theme.colors.slate[700],    dot: theme.colors.slate[400]   },
  purple:  { bg: theme.colors.purple[100],     text: theme.colors.purple[800],   dot: theme.colors.purple[500]  },
  info:    { bg: theme.colors.info.bg,         text: theme.colors.info.text,     dot: theme.colors.info.base    },
};

const SIZE_MAP: Record<Size, { px: number; py: number; fontSize: number; radius: number; dotSize: number }> = {
  sm: { px: 7,  py: 3,  fontSize: 10, radius: theme.radius.xs, dotSize: 5 },
  md: { px: 10, py: 4,  fontSize: 11, radius: theme.radius.sm, dotSize: 6 },
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
      <UIText style={{ fontSize: sz.fontSize, fontFamily: theme.fonts.bold, color: cfg.text }}>
        {children}
      </UIText>
    </View>
  );
}
