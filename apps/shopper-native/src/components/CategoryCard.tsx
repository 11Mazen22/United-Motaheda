/**
 * CategoryCard — pill (horizontal strip) + grid (Shop tab) variants.
 * Theme-driven (useTheme()); icon wells use the shared gradients.categories
 * palette with a real Ionicons glyph per category (see src/utils/categoryIcons),
 * not emoji.
 */

import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import {
  isRtl,
  flexRow,
  textAlignStart,
  FORWARD_CHEVRON,
} from "../utils/layout";
import { iconForCategory } from "../utils/categoryIcons";
import type { NativeCategory } from "../features/products/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

function paletteFor(idx: number): readonly [string, string] {
  return gradients.categories[Math.abs(idx) % gradients.categories.length];
}

function formatCount(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export interface CategoryCardProps {
  category: NativeCategory;
  gradientIdx: number;
  lang: "ar" | "en";
  variant?: "pill" | "grid" | "pastel";
  onPress: () => void;
  active?: boolean;
}

const SPRING_IN = { damping: 10, stiffness: 380 } as const;
const SPRING_OUT = { damping: 14, stiffness: 280 } as const;

export const CategoryCard = memo(function CategoryCard({
  category,
  gradientIdx,
  lang,
  variant = "pill",
  onPress,
  active = false,
}: CategoryCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => { scale.value = withSpring(0.95, SPRING_IN); }, [scale]);
  const onPressOut = useCallback(() => { scale.value = withSpring(1.0, SPRING_OUT); }, [scale]);

  const [gradFrom, gradTo] = paletteFor(gradientIdx);
  const displayName = lang === "en" ? (category.nameEn || category.name) : (category.name || category.nameEn);
  const icon = iconForCategory(category.name);
  const showCount = category.count > 0;

  // ── Pill variant — horizontal strip on Home ──────────────────────────────
  if (variant === "pill") {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={displayName}
        hitSlop={4}>
        <Animated.View
          style={[
            cs.pill,
            theme.shadows[1],
            { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default },
            active && [cs.pillActive, theme.shadows[2], { borderColor: gradFrom, backgroundColor: `${gradFrom}14` }],
            animStyle,
          ]}>
          <LinearGradient colors={[gradFrom, gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.pillIconDisc}>
            <Ionicons name={icon} size={18} color="#FFFFFF" />
          </LinearGradient>

          <UIText
            weight="bold"
            numberOfLines={1}
            style={[cs.pillLabel, { color: active ? gradFrom : theme.colors.text.primary, textAlign: TEXT_START }]}>
            {displayName}
          </UIText>

          {showCount && (
            <View style={[cs.pillCount, { backgroundColor: `${gradFrom}14` }]}>
              <UIText weight="black" style={[cs.pillCountText, { color: gradFrom }]}>
                {formatCount(category.count)}
              </UIText>
            </View>
          )}
        </Animated.View>
      </Pressable>
    );
  }

  // ── Grid variant — Shop tab ──────────────────────────────────────────────
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={displayName}
      style={cs.gridOuter}>
      <Animated.View style={[cs.gridCard, theme.shadows[1], { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, animStyle]}>
        <View style={[cs.stripe, { backgroundColor: gradFrom }]} />

        <View style={cs.gridBody}>
          <LinearGradient colors={[gradFrom, gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cs.iconWell}>
            <Ionicons name={icon} size={28} color="#FFFFFF" />
          </LinearGradient>

          <UIText
            weight="black"
            numberOfLines={2}
            style={[cs.gridName, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>
            {displayName}
          </UIText>

          {/*
            flexRow(IS_RTL) yields "row" in RTL (forceRTL active) so the
            chevron renders on the visual left (RTL leading) and the count
            on the visual right. FORWARD_CHEVRON already picks the correct
            glyph per direction.
          */}
          <View style={[cs.gridFoot, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={[cs.chevronWell, { backgroundColor: `${gradFrom}12` }]}>
              <Ionicons name={FORWARD_CHEVRON} size={14} color={gradFrom} />
            </View>
            {showCount && (
              <UIText weight="bold" style={[cs.gridCount, { color: theme.colors.text.muted, textAlign: TEXT_START }]}>
                {formatCount(category.count)}{lang === "ar" ? " منتج" : " items"}
              </UIText>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default CategoryCard;

// ─── Skeletons ───────────────────────────────────────────────────────────────

export const CategoryCardSkeleton = memo(function CategoryCardSkeleton() {
  const { theme } = useTheme();
  return <View style={[cs.pillSkeleton, { backgroundColor: theme.colors.canvas.surfaceMuted }]} />;
});

export const CategoryGridSkeleton = memo(function CategoryGridSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={cs.gridOuter}>
      <View style={[cs.gridCard, cs.skeletonCard, { backgroundColor: theme.colors.canvas.surface }]}>
        <View style={[cs.skeletonStripe, { backgroundColor: theme.colors.canvas.surfaceMuted }]} />
        <View style={cs.gridBody}>
          <View style={[cs.skeletonIcon, { backgroundColor: theme.colors.canvas.surfaceMuted }]} />
          <View style={[cs.skeletonLine, { backgroundColor: theme.colors.canvas.surfaceMuted }]} />
          <View style={[cs.skeletonLine, cs.skeletonShort, { backgroundColor: theme.colors.canvas.surfaceMuted }]} />
        </View>
      </View>
    </View>
  );
});

const cs = StyleSheet.create({
  pill: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 10,
    width: 172,
    height: 56,
    paddingHorizontal: 14,
    paddingEnd: 16,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillActive: { borderWidth: 1.5 },
  pillIconDisc: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  pillLabel: { flex: 1, fontSize: 13, lineHeight: 18, includeFontPadding: false, letterSpacing: -0.1 },
  pillCount: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, minWidth: 28, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  pillCountText: { fontSize: 10, lineHeight: 14, letterSpacing: 0.3, includeFontPadding: false },
  pillSkeleton: { width: 172, height: 56, borderRadius: 9999 },

  gridOuter: { width: "100%" },
  gridCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", minHeight: 170 },
  stripe: { height: 5, width: "100%" },
  gridBody: { padding: 16, gap: 12, flex: 1 },
  iconWell: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  gridName: { fontSize: 15, lineHeight: 21, letterSpacing: -0.2, includeFontPadding: false, flexGrow: 1 },
  gridFoot: { alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  chevronWell: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  gridCount: { fontSize: 11, lineHeight: 15, letterSpacing: 0.3, includeFontPadding: false, flexShrink: 1 },

  skeletonCard: { borderColor: "transparent" },
  skeletonStripe: { height: 5 },
  skeletonIcon: { width: 60, height: 60, borderRadius: 20 },
  skeletonLine: { height: 11, borderRadius: 6 },
  skeletonShort: { width: "55%" },
});
