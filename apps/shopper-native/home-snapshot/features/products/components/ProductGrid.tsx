/**
 * ProductGrid — snapshot copy of the native product grid component.
 */

import React, { useCallback, useMemo } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ProductCard } from "../../../components/ProductCard";
import { theme } from "../../../shared/theme";
import { flexRow, isRtl } from "../../../utils/layout";
import type { NativeProduct } from "../types";

const ITEM_TYPE_PRODUCT = "p" as const;

export interface ProductGridProps {
  products: NativeProduct[];
  onProductPress: (p: NativeProduct) => void;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
  ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
  contentContainerStyle?: { padding?: number; paddingBottom?: number };
  lang?: "ar" | "en";
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
  const keyExtractor = useCallback((item: NativeProduct) => item.id, []);
  const getItemType = useCallback(() => ITEM_TYPE_PRODUCT, []);

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => {
      layout.size = 317;
      layout.span = 1;
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: NativeProduct }) => (
      <View style={cellStyle}>
        <ProductCard
          product={item}
          lang={lang}
          onPress={() => onProductPress(item)}
        />
      </View>
    ),
    [lang, onProductPress],
  );

  const containerStyle = useMemo(
    () => ({
      padding: contentContainerStyle?.padding ?? 12,
      paddingBottom: contentContainerStyle?.paddingBottom ?? 24,
    }),
    [contentContainerStyle?.padding, contentContainerStyle?.paddingBottom],
  );

  const refreshControl =
    onRefresh != null ? (
      <RefreshControl
        refreshing={refreshing ?? false}
        onRefresh={onRefresh}
        tintColor={theme.colors.brand[600]}
        colors={[theme.colors.brand[600]]}
      />
    ) : undefined;

  if (Platform.OS === "web") {
    return (
      <FlatList<NativeProduct>
        data={products}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={containerStyle}
        columnWrapperStyle={columnWrapperStyle}
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

  return (
    <FlashList<NativeProduct>
      data={products}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      renderItem={renderItem}
      numColumns={2}
      estimatedItemSize={317}
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

const cellStyle = {
  flex: 1,
  padding: 5,
} as const;

const columnWrapperStyle = {
  flexDirection: flexRow(isRtl()) as const,
};
