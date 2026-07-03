/**
 * CategoryStrip — clean horizontal scrollable category rail.
 *
 * V4 (2026 polish pass):
 *   • Floating scroll-nav arrow buttons removed — native swipe only, no
 *     on-screen clutter over the cards (matches the flat, premium
 *     treatment used by Browse-by-Concern on Search).
 *   • Cards are fixed-width/equal-sized (see CategoryCard `pill` style)
 *     so the rail reads as an aligned, consistent set of tiles.
 *   • RTL-aware via FlatList's native `inverted`-free RTL row flip.
 */

import React, { memo, useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { kit } from "@/shared/kit";
import { CategoryCard } from "@/components/CategoryCard";
import { CategoryCardSkeleton } from "@/components/ui/Skeleton";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import { useScreenLayout } from "@/utils/responsive";
import type { NativeCategory } from "@/features/products";

interface CategoryStripProps {
  categories:      NativeCategory[];
  isLoading:       boolean;
  lang:            "ar" | "en";
  onCategoryPress: (id: string, name: string, nameEn: string) => void;
  onViewAll:       () => void;
}

export const CategoryStrip = memo(function CategoryStrip({
  categories,
  isLoading,
  lang,
  onCategoryPress,
  onViewAll,
}: CategoryStripProps) {
  const { t }       = useTranslation();
  const { pagePad } = useScreenLayout();

  const renderCategory = useCallback(
    ({ item, index }: { item: NativeCategory; index: number }) => (
      <CategoryCard
        category={item}
        gradientIdx={index}
        lang={lang}
        variant="pill"
        onPress={() => onCategoryPress(item.id, item.name ?? "", item.nameEn ?? "")}
      />
    ),
    [lang, onCategoryPress],
  );

  const CONTENT_STYLE = {
    paddingHorizontal: pagePad,
    paddingTop:        12,
    paddingBottom:     8,
    gap:               12,
  } as const;

  return (
    <View style={[sectionStyles.wrap, s.containerWrap]}>
      <HomeSectionHeader
        eyebrow={t("products.allProducts")}
        title={t("search.categoriesTitle")}
        icon="grid-outline"
        onMore={onViewAll}
      />

      {/* Rail — overflow:hidden clips FlatList to rounded corners */}
      <View style={s.railWrapper}>
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
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            renderItem={renderCategory}
          />
        )}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  containerWrap: {
    paddingTop:    kit.sp(7),
    paddingBottom: kit.sp(6),
  },
  railWrapper: {
    overflow:        "hidden",
    borderRadius:    kit.radius.lg,
    backgroundColor: kit.color.canvas,
  },
});

const SKELETON_KEYS  = [1, 2, 3, 4];
const renderSkeleton = () => <CategoryCardSkeleton />;
