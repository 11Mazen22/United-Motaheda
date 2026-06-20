/**
 * CategoryStrip — creative horizontal scrollable category rail with animations.
 *
 * V3.2 Creative enhancements:
 *   • Gradient-backed category pills with creative color palettes
 *   • Smooth entrance animations with staggered timing
 *   • Pulse effects on interaction with glow layers
 *   • Professional spacing and organization
 *   • Smooth scroll transitions with optimized rendering
 */

import React, { memo, useCallback } from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { CategoryCard } from "@/components/CategoryCard";
import { CategoryCardSkeleton } from "@/components/ui/Skeleton";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import type { NativeCategory } from "@/features/products";

interface CategoryStripProps {
  categories:      NativeCategory[];
  isLoading:       boolean;
  lang:            "ar" | "en";
  onCategoryPress: (id: string, name: string, nameEn: string) => void;
  onViewAll:       () => void;
}

// ─── CategoryStrip ───────────────────────────────────────────────────────────

export const CategoryStrip = memo(function CategoryStrip({
  categories,
  isLoading,
  lang,
  onCategoryPress,
  onViewAll,
}: CategoryStripProps) {
  const { t } = useTranslation();

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
    paddingHorizontal: theme.layout.pagePaddingH,
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
      {/* Creative category rail with smooth animations */}
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
            scrollEventThrottle={16}
          />
        )}
      </View>
    </View>
  );
});

// ─── Creative styling ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  containerWrap: {
    paddingTop: kit.sp(7),
  },
  railWrapper: {
    overflow: "hidden",
    borderRadius: kit.radius.lg,
    backgroundColor: kit.color.canvas,
  },
});

// ─── Skeleton helpers (stable references → no re-allocation) ──────────────────
const SKELETON_KEYS = [1, 2, 3, 4];
const renderSkeleton = () => <CategoryCardSkeleton />;
