import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Text as UIText }  from "../shared/ui/Text";
import { theme }            from "../shared/theme";
import { kit }              from "../shared/kit";
import { isRtl, FORWARD_CHEVRON } from "../utils/layout";
import type { NativeCategory } from "../features/products/types";

// ─── Palette ─────────────────────────────────────────────────────────────────

const IS_RTL = isRtl();

const PALETTE: { accent: string; tint: string }[] = [
  { accent: kit.color.accentDeep, tint: kit.color.accentTint  },
  { accent: kit.color.warn,       tint: kit.color.warnTint     },
  { accent: kit.color.success,    tint: kit.color.successTint  },
  { accent: kit.color.danger,     tint: kit.color.dangerTint   },
  { accent: "#7c3aed",            tint: "#f5f3ff"              },
  { accent: "#0284c7",            tint: "#e0f2fe"              },
  { accent: "#d97706",            tint: "#fffbeb"              },
  { accent: "#16a34a",            tint: "#f0fdf4"              },
  { accent: "#db2777",            tint: "#fdf2f8"              },
  { accent: "#0ea5e9",            tint: "#f0f9ff"              },
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
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn  = useCallback(() => { scale.value = withSpring(0.95, SPRING_IN);  }, [scale]);
  const onPressOut = useCallback(() => { scale.value = withSpring(1.0,  SPRING_OUT); }, [scale]);

  const { accent, tint } = paletteFor(gradientIdx);
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
        <Animated.View
          style={[
            cs.pill,
            active && { backgroundColor: tint, borderColor: accent, borderWidth: 1.5 },
            animStyle,
          ]}
        >
          <View style={[cs.pillDot, { backgroundColor: active ? accent : tint }]}>
            <UIText style={cs.pillEmoji}>{emoji}</UIText>
          </View>

          <UIText numberOfLines={1} style={[cs.pillLabel, active && { color: accent }]}>
            {displayName}
          </UIText>

          {showCount && (
            <View style={[cs.pillCount, { backgroundColor: active ? accent : tint }]}>
              <UIText style={[cs.pillCountText, { color: active ? "#fff" : accent }]}>
                {formatCount(category.count)}
              </UIText>
            </View>
          )}
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
  // ── Pill
  pill: {
    flexDirection:     IS_RTL ? "row-reverse" : "row",
    alignItems:        "center",
    gap:               8,
    height:            44,
    paddingHorizontal: 12,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.pill,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  pillDot: {
    width:          28,
    height:         28,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
  },
  pillEmoji: {
    fontSize:   14,
    lineHeight: 18,
  },
  pillLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          IS_RTL ? "right" : "left",
    includeFontPadding: false,
    maxWidth:           120,
  },
  pillCount: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      kit.radius.pill,
  },
  pillCountText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           9,
    lineHeight:         13,
    includeFontPadding: false,
  },
  pillSkeleton: {
    width:           120,
    height:          44,
    borderRadius:    kit.radius.pill,
    backgroundColor: kit.color.well,
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
