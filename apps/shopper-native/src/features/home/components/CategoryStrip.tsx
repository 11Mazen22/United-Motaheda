/**
 * CategoryStrip — horizontal row of category tiles.
 *
 * Icon wells use the shared `gradients.categories` token set (cycling) —
 * one of the design language's explicitly sanctioned gradient uses — with a
 * single Ionicons glyph per category instead of emoji, so the icon language
 * stays consistent with the rest of the app.
 */

import React, { memo, useCallback } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import { useScreenLayout } from "@/utils/responsive";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import { iconForCategory } from "@/utils/categoryIcons";
import type { NativeCategory } from "@/features/products";

interface CategoryStripProps {
  categories: NativeCategory[];
  isLoading: boolean;
  lang: "ar" | "en";
  onCategoryPress: (id: string, name: string, nameEn: string) => void;
  onViewAll: () => void;
}

export const CategoryStrip = memo(function CategoryStrip({
  categories,
  isLoading,
  lang,
  onCategoryPress,
  onViewAll,
}: CategoryStripProps) {
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  const { theme } = useTheme();

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
    paddingVertical: 12,
    gap: 10,
  } as const;

  return (
    <View style={sectionStyles.wrap}>
      <HomeSectionHeader
        eyebrow={t("products.allProducts")}
        title={t("search.categoriesTitle")}
        icon="grid-outline"
        onMore={onViewAll}
      />

      {isLoading ? (
        <FlatList
          data={SKELETON_KEYS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={CONTENT_STYLE}
          keyExtractor={(k) => String(k)}
          renderItem={() => <View style={[s.skeleton, { backgroundColor: theme.colors.canvas.surfaceMuted }]} />}
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

interface CategoryTileProps {
  category: NativeCategory;
  paletteIdx: number;
  lang: "ar" | "en";
  onPress: () => void;
}

const SPRING_IN = { damping: 10, stiffness: 380 } as const;
const SPRING_OUT = { damping: 14, stiffness: 280 } as const;

const CategoryTile = memo(function CategoryTile({
  category,
  paletteIdx,
  lang,
  onPress,
}: CategoryTileProps) {
  const { theme } = useTheme();
  const [from, to] = gradients.categories[Math.abs(paletteIdx) % gradients.categories.length];
  const displayName = lang === "en"
    ? (category.nameEn || category.name)
    : (category.name || category.nameEn);
  const icon = iconForCategory(category.name ?? "");

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => { scale.value = withSpring(0.93, SPRING_IN); }, [scale]);
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
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconWrap}>
          <Ionicons name={icon} size={26} color="#FFFFFF" />
        </LinearGradient>
        <UIText variant="caption" numberOfLines={2} style={{ color: theme.colors.text.secondary, textAlign: "center" }}>
          {displayName}
        </UIText>
      </Animated.View>
    </Pressable>
  );
});

const Separator = () => <View style={{ width: 10 }} />;

const SKELETON_KEYS = [1, 2, 3, 4, 5, 6];

const s = StyleSheet.create({
  tile: { width: 80, alignItems: "center", gap: 8 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  skeleton: { width: 72, height: 72 + 8 + 30, borderRadius: 20 },
});
