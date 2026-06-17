/**
 * RecentlyViewedCarousel — horizontal FlashList of recently-browsed products.
 *
 * Data source: useRecentlyViewedFeed (MMKV-backed, zero network cost).
 * Renders null when the feed is empty — no empty-state widget needed here
 * since the user hasn't browsed yet.
 *
 * Isolation: this component owns its own data subscription so the parent
 * HomeScreen never re-renders when the recently-viewed list changes.
 */

import React, { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { theme } from "../shared/theme";
import { ProductCard } from "./ProductCard";
import { useRecentlyViewedFeed } from "../features/recommendations/hooks/useRecentlyViewedFeed";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import type { NativeProduct } from "../features/products/types";

interface RecentlyViewedCarouselProps {
  lang:           "ar" | "en";
  onProductPress: (id: string) => void;
}

export const RecentlyViewedCarousel = memo(function RecentlyViewedCarousel({
  lang,
  onProductPress,
}: RecentlyViewedCarouselProps) {
  const { t }  = useTranslation();
  const recent = useRecentlyViewedFeed();

  // Nothing to show — component renders nothing
  if (recent.length === 0) return null;

  return (
    <RecentlyViewedInner
      items={recent}
      lang={lang}
      onProductPress={onProductPress}
      title={t("home.recentlyViewed")}
    />
  );
});

// ─── Inner list — memo'd separately so the outer guard component is feather-light
interface InnerProps {
  items:          NativeProduct[];
  lang:           "ar" | "en";
  onProductPress: (id: string) => void;
  title:          string;
}

const RecentlyViewedInner = memo(function RecentlyViewedInner({
  items,
  lang,
  onProductPress,
  title,
}: InnerProps) {
  const renderItem = useCallback<ListRenderItem<NativeProduct>>(
    ({ item }) => (
      <View style={s.itemWrap}>
        <ProductCard
          product={item}
          lang={lang}
          onPress={() => onProductPress(item.id)}
        />
      </View>
    ),
    [lang, onProductPress],
  );

  const keyExtractor = useCallback((item: NativeProduct) => item.id, []);

  return (
    <View style={sectionStyles.wrap}>
      <HomeSectionHeader
        title={title}
        icon="time-outline"
        accent={theme.colors.teal[600]}
      />
      <FlashList
        data={items}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: theme.layout.pagePaddingH }}
        ItemSeparatorComponent={Separator}
      />
    </View>
  );
});

const Separator = () => <View style={s.sep} />;

const s = StyleSheet.create({
  itemWrap: { width: 162 },
  sep:      { width: 10 },
});
