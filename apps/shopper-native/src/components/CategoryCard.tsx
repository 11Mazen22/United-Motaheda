import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { Text as UIText }  from "../shared/ui/Text";
import { theme }            from "../shared/theme";
import { kit }              from "../shared/kit";
import { isRtl, FORWARD_CHEVRON } from "../utils/layout";
import type { NativeCategory } from "../features/products/types";

// ─── Palette ─────────────────────────────────────────────────────────────────

const IS_RTL = isRtl();

const PALETTE: { accent: string; tint: string; gradStart?: string; gradEnd?: string }[] = [
  { accent: kit.color.accentDeep, tint: kit.color.accentTint, gradStart: "#667eea", gradEnd: "#764ba2" },
  { accent: kit.color.warn,       tint: kit.color.warnTint, gradStart: "#f093fb", gradEnd: "#f5576c" },
  { accent: kit.color.success,    tint: kit.color.successTint, gradStart: "#4facfe", gradEnd: "#00f2fe" },
  { accent: kit.color.danger,     tint: kit.color.dangerTint, gradStart: "#fa709a", gradEnd: "#fee140" },
  { accent: "#7c3aed",            tint: "#f5f3ff", gradStart: "#9b59b6", gradEnd: "#8e44ad" },
  { accent: "#0284c7",            tint: "#e0f2fe", gradStart: "#2196F3", gradEnd: "#00BCD4" },
  { accent: "#d97706",            tint: "#fffbeb", gradStart: "#FF6B6B", gradEnd: "#FFA500" },
  { accent: "#16a34a",            tint: "#f0fdf4", gradStart: "#34A853", gradEnd: "#1abc9c" },
  { accent: "#db2777",            tint: "#fdf2f8", gradStart: "#ec4899", gradEnd: "#f97316" },
  { accent: "#0ea5e9",            tint: "#f0f9ff", gradStart: "#00d4ff", gradEnd: "#0099ff" },
];

function paletteFor(idx: number) {
  return PALETTE[Math.abs(idx) % PALETTE.length];
}

// ─── Emoji map ───────────────────────────────────────────────────────────────

const EMOJI_MAP: Record<string, string> = {
  "العناية بالشعر":                  "💆",
  "العناية بالبشرة":                 "✨",
  "مستحضرات التجميل والمكياج":       "💄",
  "العناية بالفم والأسنان":           "🦷",
  "العطور والروائح":                  "🌸",
  "الإسعافات الأولية والمطهرات":      "🩹",
  "الفيتامينات والمكملات الغذائية":   "💊",
  "المستلزمات الطبية":                "🩺",
  "الرعاية الصحية العامة":            "❤️",
  "العناية بالجسم":                   "🧴",
  "العناية بالعيون":                  "👁️",
  "صحة المرأة":                       "🌷",
  "الأطفال والرضع":                   "👶",
  "أدوية":                            "💊",
  "العناية بالرجل":                   "🪒",
  "الأم والطفل":                      "🤱",
  "التغذية الطبية":                   "🥗",
};

export function emojiFor(name: string): string {
  return EMOJI_MAP[name] ?? "🏥";
}

function formatCount(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryCardProps {
  category:    NativeCategory;
  gradientIdx: number;
  lang:        "ar" | "en";
  variant?:    "pill" | "grid" | "pastel";
  onPress:     () => void;
  active?:     boolean;
}

const SPRING_IN  = { damping: 10, stiffness: 380 } as const;
const SPRING_OUT = { damping: 14, stiffness: 280 } as const;

// ─── CategoryCard ─────────────────────────────────────────────────────────────

export const CategoryCard = memo(function CategoryCard({
  category,
  gradientIdx,
  lang,
  variant = "pill",
  onPress,
  active = false,
}: CategoryCardProps) {
  const scale     = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ 
    transform: [{ scale: scale.value }],
  }));

  const onPressIn  = useCallback(() => { 
    scale.value = withSpring(0.95, SPRING_IN);
  }, [scale]);
  
  const onPressOut = useCallback(() => { 
    scale.value = withSpring(1.0, SPRING_OUT);
  }, [scale]);

  const { accent, tint, gradStart, gradEnd } = paletteFor(gradientIdx);
  const displayName      = lang === "en" ? (category.nameEn || category.name) : category.name;
  const emoji            = emojiFor(category.name);
  const showCount        = category.count > 0;

  // ── Pill variant ────────────────────────────────────────────────────────

  if (variant === "pill") {
    return (
      <Pressable
        onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
        accessibilityRole="button" accessibilityLabel={displayName} hitSlop={4}
      >
        <Animated.View style={[animStyle]}>
          <LinearGradient
            colors={active ? [accent, tint] : [gradStart || tint, tint]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              cs.pill,
              active && { borderColor: accent, borderWidth: 1.5 },
            ]}
          >
            <View style={[cs.pillDot, { 
              backgroundColor: active ? accent : gradStart || accent,
              borderColor: active ? tint : "rgba(255,255,255,0.2)"
            }]}>
              <UIText style={cs.pillEmoji}>{emoji}</UIText>
            </View>

            <UIText numberOfLines={1} style={[cs.pillLabel, active && { color: "#fff", fontWeight: "700" }]}>
              {displayName}
            </UIText>

            {showCount && (
              <View style={[cs.pillCount, { 
                backgroundColor: active ? tint : gradEnd,
                borderColor: "rgba(255,255,255,0.3)"
              }]}>
                <UIText style={[cs.pillCountText, { 
                  color: active ? accent : "#fff",
                  fontWeight: "700"
                }]}>
                  {formatCount(category.count)}
                </UIText>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    );
  }

  // ── Grid variant (also handles "pastel") ─────────────────────────────────

  return (
    <Pressable
      onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      accessibilityRole="button" accessibilityLabel={displayName}
      style={cs.gridOuter}
    >
      <Animated.View style={[cs.gridCard, animStyle]}>

        {/* 5 px identity stripe — flat accent, per kit law */}
        <View style={[cs.stripe, { backgroundColor: accent }]} />

        <View style={cs.gridBody}>
          {/* Tinted icon well */}
          <View style={[cs.iconWell, { backgroundColor: tint }]}>
            <UIText style={cs.gridEmoji}>{emoji}</UIText>
          </View>

          {/* Name */}
          <UIText
            numberOfLines={2}
            style={[cs.gridName, { textAlign: IS_RTL ? "right" : "left" }]}
          >
            {displayName}
          </UIText>

          {/* Count + forward chevron */}
          <View style={[cs.gridFoot, { flexDirection: IS_RTL ? "row-reverse" : "row" }]}>
            {showCount && (
              <UIText style={cs.gridCount}>
                {formatCount(category.count)}{lang === "ar" ? " منتج" : " items"}
              </UIText>
            )}
            <Ionicons name={FORWARD_CHEVRON} size={13} color={accent} />
          </View>
        </View>

      </Animated.View>
    </Pressable>
  );
});

export default CategoryCard;

// ─── Skeletons ───────────────────────────────────────────────────────────────

export const CategoryCardSkeleton = memo(function CategoryCardSkeleton() {
  return <View style={cs.pillSkeleton} />;
});

export const CategoryGridSkeleton = memo(function CategoryGridSkeleton() {
  return (
    <View style={cs.gridOuter}>
      <View style={[cs.gridCard, cs.skeletonCard]}>
        <View style={cs.skeletonStripe} />
        <View style={cs.gridBody}>
          <View style={cs.skeletonIcon} />
          <View style={cs.skeletonLine} />
          <View style={[cs.skeletonLine, cs.skeletonShort]} />
        </View>
      </View>
    </View>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  // ── Pill (Creative gradient category rail)
  pill: {
    flexDirection:     IS_RTL ? "row-reverse" : "row",
    alignItems:        "center",
    gap:               10,
    height:            48,
    paddingHorizontal: 14,
    borderRadius:      kit.radius.pill,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.2)",
    ...kit.shadow.soft,
  },
  pillDot: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
  },
  pillEmoji: {
    fontSize:   16,
    lineHeight: 20,
  },
  pillLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.ink,
    textAlign:          IS_RTL ? "right" : "left",
    includeFontPadding: false,
    maxWidth:           110,
    fontWeight:         "600",
  },
  pillCount: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
    minWidth:          26,
    alignItems:        "center",
    justifyContent:    "center",
    borderWidth:       1,
  },
  pillCountText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    includeFontPadding: false,
    fontWeight:         "700",
  },
  pillSkeleton: {
    width:           140,
    height:          48,
    borderRadius:    kit.radius.pill,
    backgroundColor: kit.color.well,
    ...kit.shadow.soft,
  },

  // ── Grid card
  gridOuter: {
    width: "100%",
  },
  gridCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  stripe: {
    height: 5,
    width:  "100%",
  },
  gridBody: {
    padding: 16,
    gap:     10,
  },
  iconWell: {
    width:          58,
    height:         58,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
  },
  gridEmoji: {
    fontSize: 26,
  },
  gridName: {
    fontFamily:         theme.fonts.black,
    fontSize:           15,
    lineHeight:         21,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    includeFontPadding: false,
  },
  gridFoot: {
    alignItems:     "center",
    justifyContent: "space-between",
    marginTop:      2,
  },
  gridCount: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Grid skeleton
  skeletonCard: {
    borderColor: "transparent",
  },
  skeletonStripe: {
    height:          5,
    backgroundColor: kit.color.well,
  },
  skeletonIcon: {
    width:           58,
    height:          58,
    borderRadius:    18,
    backgroundColor: kit.color.well,
  },
  skeletonLine: {
    height:          11,
    borderRadius:    6,
    backgroundColor: kit.color.well,
  },
  skeletonShort: {
    width: "55%",
  },
});
