import { useTheme } from "@pharmacy/ui-native";
/**
 * ProductGrid — 2-column product grid with platform-specific rendering.
 *
 * Native (iOS / Android):
 *   @shopify/flash-list v2. Items are measured after first render so FlashList
 *   can allocate the correct scroll height. getItemType gives the recycler a
 *   stable type hint so it never mis-recycles product cards.
 *   drawDistance pre-renders 2 screens ahead; onEndReachedThreshold fires
 *   early so infinite scroll page loads feel instantaneous.
 *
 * Web:
 *   FlatList — FlashList 2.x requires the container to have an explicit pixel
 *   height from the RN layout engine. On web the height comes from the CSS
 *   viewport, so FlashList silently renders 0 items. FlatList renders a
 *   straightforward DOM list without that constraint.
 *
 * Both branches share the same renderItem and keyExtractor — callers don't
 * need to know which list is active.
 */

import React, { useCallback, useMemo } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ProductCard } from "@/components/ProductCard";

import { flexRow, isRtl } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import type { NativeProduct } from "../types";

const ITEM_TYPE_PRODUCT = "p" as const;

export interface ProductGridProps {
  products:              NativeProduct[];
  onProductPress:        (p: NativeProduct) => void;
  onEndReached?:         () => void;
  refreshing?:           boolean;
  onRefresh?:            () => void;
  ListHeaderComponent?:  React.ComponentType | React.ReactElement | null;
  ListFooterComponent?:  React.ComponentType | React.ReactElement | null;
  ListEmptyComponent?:   React.ComponentType | React.ReactElement | null;
  contentContainerStyle?: { padding?: number; paddingBottom?: number };
  lang?:                 "ar" | "en";
}

export const ProductGrid = React.memo(function ProductGrid({
  products,
  onProductPress,
  onEndReached,
  refreshing,
  onRefresh,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  contentContainerStyle,
  lang = "ar",
}: ProductGridProps) {
  const { theme } = useTheme();
  const { numColumns, isTablet } = useScreenLayout();

  const keyExtractor = useCallback((item: NativeProduct) => item.id, []);
  const getItemType  = useCallback(() => ITEM_TYPE_PRODUCT, []);

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => {
      layout.size = 280;
      layout.span = 1;
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: NativeProduct }) => (
      <View style={[cellStyle, isTablet && cellStyleTablet]}>
        <ProductCard
          product={item}
          lang={lang}
          onPress={() => onProductPress(item)}
        />
      </View>
    ),
    [lang, onProductPress, isTablet],
  );

  const containerStyle = useMemo(
    () => ({
      padding:       contentContainerStyle?.padding ?? (isTablet ? 16 : 12),
      paddingBottom: contentContainerStyle?.paddingBottom ?? 24,
    }),
    [contentContainerStyle?.padding, contentContainerStyle?.paddingBottom, isTablet],
  );

  const columnWrapperDynamic = useMemo(
    () => ({ flexDirection: FLEX_DIR }),
    [],
  );

  const refreshControl =
    onRefresh != null ? (
      <RefreshControl
        refreshing={refreshing ?? false}
        onRefresh={onRefresh}
        tintColor={theme.colors.brand.primary}
        colors={[theme.colors.brand.primary]}
      />
    ) : undefined;

  // ── Web: FlatList ──────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    return (
      <FlatList<NativeProduct>
        data={products}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={numColumns}
        key={`grid-${numColumns}`}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={containerStyle}
        columnWrapperStyle={columnWrapperDynamic}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={refreshControl}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={80}
        windowSize={7}
        removeClippedSubviews
        style={{ flex: 1 }}
      />
    );
  }

  // ── Native: FlashList v2 (virtualized, 60 FPS) ─────────────────────────────
  return (
    <FlashList<NativeProduct>
      data={products}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      renderItem={renderItem}
      numColumns={numColumns}
      key={`grid-${numColumns}`}
      overrideItemLayout={overrideItemLayout}
      drawDistance={Platform.OS === "android" ? 300 : 250}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={containerStyle}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={refreshControl}
      style={{ flex: 1 }}
    />
  );
});

const cellStyle        = { flex: 1, padding: 5 } as const;
const cellStyleTablet  = { padding: 7 } as const;

const FLEX_DIR = flexRow(isRtl());
