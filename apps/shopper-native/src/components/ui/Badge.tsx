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
  success: { bg: kit.color.success.bg,      text: kit.color.success.text,  dot: kit.color.success.base },
  warning: { bg: kit.color.warning.bg,      text: kit.color.warning.text,  dot: kit.color.warning.base },
  error:   { bg: kit.color.error.bg,        text: kit.color.error.text,    dot: kit.color.error.base   },
  neutral: { bg: kit.color.slate[100],      text: kit.color.slate[700],    dot: kit.color.slate[400]   },
  purple:  { bg: kit.color.purple[100],     text: kit.color.purple[800],   dot: kit.color.purple[500]  },
  info:    { bg: kit.color.info.bg,         text: kit.color.info.text,     dot: kit.color.info.base    },
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
