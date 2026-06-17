/**
 * CategoryStrip — horizontal scrollable category pill rail.
 */

import React, { memo, useCallback } from "react";
import { FlatList, View } from "react-native";
import { useTranslation } from "react-i18next";
import { theme } from "../shared/theme";
import { CategoryCard } from "./CategoryCard";
import { CategoryCardSkeleton } from "./ui/Skeleton";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import type { NativeCategory } from "../features/products/types";

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
    paddingTop:        4,
    gap:               10,
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
          renderItem={renderSkeleton}
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
          renderItem={renderCategory}
        />
      )}
    </View>
  );
});

const SKELETON_KEYS = [1, 2, 3, 4];
const renderSkeleton = () => <CategoryCardSkeleton />;
