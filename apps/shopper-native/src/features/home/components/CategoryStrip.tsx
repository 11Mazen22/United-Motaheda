/**
 * CategoryStrip — 2026 Premium Redesign.
 *
 * Matches the reference image:
 *   • Section header with "التصنيفات" title + "عرض الكل" affordance
 *   • Horizontal scrollable row of square pastel-tinted category cards
 *   • Each card: emoji icon on tinted rounded square + Arabic label below
 *   • Cards are compact (80×88pt) — fits 4+ visible without scrolling
 *   • Spring press animation on each card
 *   • RTL-aware FlatList
 */

import React, { memo, useCallback } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { useScreenLayout } from "@/utils/responsive";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import type { NativeCategory } from "@/features/products";

// ─── Pastel colour palette (cycling) ─────────────────────────────────────────

const PALETTE = [
  { bg: "#FFF0F0", icon: "#E53E3E" },
  { bg: "#FFF8E1", icon: "#F59E0B" },
  { bg: "#E8F5E9", icon: "#16A34A" },
  { bg: "#E3F2FD", icon: "#2563EB" },
  { bg: "#F3E5F5", icon: "#7C3AED" },
  { bg: "#E0F2F1", icon: "#0E7E74" },
  { bg: "#FFF3E0", icon: "#EA580C" },
  { bg: "#FCE4EC", icon: "#DB2777" },
  { bg: "#E8EAF6", icon: "#4338CA" },
  { bg: "#E0F7FA", icon: "#0891B2" },
];

// ─── Emoji map (matches CategoryCard) ────────────────────────────────────────

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

function emojiFor(name: string): string {
  return EMOJI_MAP[name] ?? "🏥";
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CategoryStripProps {
  categories:      NativeCategory[];
  isLoading:       boolean;
  lang:            "ar" | "en";
  onCategoryPress: (id: string, name: string, nameEn: string) => void;
  onViewAll:       () => void;
}

// ─── CategoryStrip ────────────────────────────────────────────────────────────

export const CategoryStrip = memo(function CategoryStrip({
  categories,
  isLoading,
  lang,
  onCategoryPress,
  onViewAll,
}: CategoryStripProps) {
  const { t }       = useTranslation();
  const { pagePad } = useScreenLayout();

  const renderItem = useCallback(
    ({ item, index }: { item: NativeCategory; index: number }) => (
      <CategoryTile
        category={item}
        paletteIdx={index}
        lang={lang}
        onPress={() => onCategoryPress(item.id, item.name ?? "", item.nameEn ?? "")}
      />
    ),
    [lang, onCategoryPress],
  );

  const CONTENT_STYLE = {
    paddingHorizontal: pagePad,
    paddingVertical:   12,
    gap:               10,
  } as const;

  return (
    <View style={sectionStyles.wrap}>
      <HomeSectionHeader
        eyebrow={t("products.allProducts")}
        title={t("search.categoriesTitle")}
        icon="grid-outline"
        accent={kit.color.accentDeep}
        onMore={onViewAll}
      />

      {isLoading ? (
        <FlatList
          data={SKELETON_KEYS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={CONTENT_STYLE}
          keyExtractor={(k) => String(k)}
          renderItem={renderSkeleton}
          scrollEnabled={false}
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={CONTENT_STYLE}
          removeClippedSubviews
          initialNumToRender={7}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
        />
      )}
    </View>
  );
});

// ─── CategoryTile ─────────────────────────────────────────────────────────────

interface CategoryTileProps {
  category:   NativeCategory;
  paletteIdx: number;
  lang:       "ar" | "en";
  onPress:    () => void;
}

const SPRING_IN  = { damping: 10, stiffness: 380 } as const;
const SPRING_OUT = { damping: 14, stiffness: 280 } as const;

const CategoryTile = memo(function CategoryTile({
  category,
  paletteIdx,
  lang,
  onPress,
}: CategoryTileProps) {
  const { bg, icon: iconColor } = PALETTE[Math.abs(paletteIdx) % PALETTE.length];
  const displayName = lang === "en"
    ? (category.nameEn || category.name)
    : (category.name || category.nameEn);
  const emoji = emojiFor(category.name ?? "");

  const scale    = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn  = useCallback(() => { scale.value = withSpring(0.93, SPRING_IN);  }, [scale]);
  const onPressOut = useCallback(() => { scale.value = withSpring(1.0, SPRING_OUT); }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={displayName ?? ""}
    >
      <Animated.View style={[s.tile, animStyle]}>
        {/* Icon square */}
        <View style={[s.iconWrap, { backgroundColor: bg, borderColor: iconColor + "22" }]}>
          <UIText style={s.emoji}>{emoji}</UIText>
        </View>
        {/* Label */}
        <UIText numberOfLines={2} style={s.label}>
          {displayName}
        </UIText>
      </Animated.View>
    </Pressable>
  );
});

// ─── Separator ────────────────────────────────────────────────────────────────

const Separator = () => <View style={{ width: 10 }} />;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SKELETON_KEYS  = [1, 2, 3, 4, 5, 6];
const renderSkeleton = () => (
  <View style={s.skeleton} />
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  tile: {
    width:      80,
    alignItems: "center",
    gap:        8,
  },
  iconWrap: {
    width:          72,
    height:         72,
    borderRadius:   18,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
    // Soft shadow
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.06,
    shadowRadius:   6,
    elevation:      2,
  },
  emoji: {
    fontSize:   28,
    lineHeight: 34,
  },
  label: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         15,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
  skeleton: {
    width:           72,
    height:          72 + 8 + 30, // icon + gap + label area
    borderRadius:    18,
    backgroundColor: kit.color.well,
  },
});
