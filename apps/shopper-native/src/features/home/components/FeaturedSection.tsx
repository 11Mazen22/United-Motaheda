/**
 * FeaturedSection — Horizontal Featured Products Carousel (V3)
 *
 * Shows a horizontal FlashList of curated products (AI-recommended / hand-picked).
 * Self-contained: owns its own React Query fetch so the parent HomeScreen
 * never re-renders when featured data changes.
 *
 * Design:
 *   • Header: "Curated for You" eyebrow + "Featured Products" title + "View All"
 *   • Horizontal FlashList — 160 px wide cards with 12 px gap
 *   • Skeleton loading state: 4 placeholder cards while fetching
 *   • Empty guard: renders null when list is empty (no "no results" UI needed)
 *
 * Performance:
 *   • Isolated subscription: parent HomeScreen never re-renders for this section
 *   • FlashList handles recycling; estimatedItemSize avoids layout measurement
 *   • Images prefetched via expo-image (handled inside ProductCard)
 *   • Memoized: renderItem, keyExtractor, header are all stable references
 */

import React, {
  memo,
  useCallback,
} from "react";
import {
  StyleSheet,
  View,
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import { fetchFeaturedProducts, productKeys } from "@/features/products";
import { kit } from "@pharmacy/ui-native";
import { useScreenLayout } from "@/utils/responsive";
import type { NativeProduct } from "@/features/products";

const ITEM_W = 160;
const SEPARATOR_W = 12;
const SKELETON_COUNT = 4;
const FEATURED_LIMIT = 12;
const STALE_MS = 90_000;

export interface FeaturedSectionProps {
  lang: "ar" | "en";
  onProductPress: (id: string) => void;
  onViewAll?: () => void;
}

const SkeletonRow = memo(function SkeletonRow({ pagePad }: { pagePad: number }) {
  return (
    <View style={[cs.skeletonRow, { paddingHorizontal: pagePad }]}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <View key={i} style={cs.itemWrap}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  );
});

const Separator = memo(function Separator() {
  return <View style={cs.sep} />;
});

export const FeaturedSection = memo(function FeaturedSection({
  lang,
  onProductPress,
  onViewAll,
}: FeaturedSectionProps) {
  const { t }       = useTranslation();
  const { pagePad } = useScreenLayout();

  const { data, isLoading } = useQuery<NativeProduct[]>({
    queryKey: productKeys.featured(FEATURED_LIMIT),
    queryFn: () => fetchFeaturedProducts(FEATURED_LIMIT),
    staleTime: STALE_MS,
    gcTime: 5 * 60_000,
  });

  const products = data ?? [];

  const keyExtractor = useCallback(
    (item: NativeProduct) => item.id,
    [],
  );

  const renderItem = useCallback<ListRenderItem<NativeProduct>>(
    ({ item }) => (
      <View style={cs.itemWrap}>
        <ProductCard
          product={item}
          lang={lang}
          onPress={() => onProductPress(item.id)}
        />
      </View>
    ),
    [lang, onProductPress],
  );

  if (!isLoading && products.length === 0) return null;

  return (
    <View style={sectionStyles.wrap}>
      <HomeSectionHeader
        eyebrow={t("home.featuredEyebrow")}
        title={t("home.featuredTitle")}
        icon="star-outline"
        accent={kit.color.warn}
        onMore={onViewAll}
      />

      {isLoading && <SkeletonRow pagePad={pagePad} />}

      {!isLoading && products.length > 0 && (
        <FlashList<NativeProduct>
          data={products}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: pagePad }}
          ItemSeparatorComponent={Separator}
        />
      )}
    </View>
  );
});

const cs = StyleSheet.create({
  itemWrap: {
    width: ITEM_W,
  },
  sep: {
    width: SEPARATOR_W,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: SEPARATOR_W,
  },
});
