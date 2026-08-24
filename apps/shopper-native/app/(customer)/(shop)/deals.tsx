/**
 * Deals screen — عروض حصرية (Exclusive Offers).
 * Shows all products that currently have an active promotion / sale price.
 */

import React, { useCallback } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

import { Text, EmptyState, ErrorState, Skeleton, useTheme } from "@pharmacy/ui-native";
import { BACK_CHEVRON, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useInfiniteProducts } from "@/features/products";
import { ProductCard } from "@/components/ProductCard";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const NUM_COLS = 2;
const GAP = 12;

export default function DealsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { pagePad } = useScreenLayout();
  const { theme, isDark } = useTheme();
  const lang = (i18n.language === "en" ? "en" : "ar") as "ar" | "en";

  const {
    products,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isError,
  } = useInfiniteProducts({
    isSale: true,
    pageSize: 20,
    sortBy: "price_asc",
    enabled: true,
  });

  const goProduct = useCallback(
    (id: string) => router.push({ pathname: "/(customer)/(shop)/product/[id]" as unknown as never, params: { id } }),
    [router],
  );
  const retry = useCallback(async () => { await refetch(); }, [refetch]);

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.canvas.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[s.header, { paddingTop: insets.top + 10, backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={[s.backBtn, { backgroundColor: theme.colors.canvas.background, borderColor: theme.colors.border.default }]}
        >
          <Ionicons name={BACK_CHEVRON} size={20} color={theme.colors.text.primary} />
        </Pressable>
        <View style={s.headerText}>
          <Text variant="h3" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>
             {t("home.flashTitle")}
          </Text>
          {products.length > 0 && (
            <Text variant="caption" style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>
              {products.length} {t("common.products", "products")}
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={[s.skeletonGrid, { paddingHorizontal: pagePad }]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={s.skeletonItem}>
              <Skeleton width="100%" height={220} borderRadius={16} />
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState message={t("errors.network")} retry={retry} />
      ) : (
        <FlashList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={NUM_COLS}
          contentContainerStyle={[
            s.listContent,
            { paddingHorizontal: pagePad, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={{
              flex: 1,
              paddingEnd: (index % NUM_COLS === 0) ? GAP / 2 : 0,
              paddingStart: (index % NUM_COLS !== 0) ? GAP / 2 : 0,
              paddingBottom: GAP,
            }}>
              <ProductCard
                product={item}
                lang={lang}
                badge="sale"
                onPress={() => goProduct(item.id)}
              />
            </View>
          )}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={theme.colors.brand.primary}
              colors={[theme.colors.brand.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
                illustrationName="empty"
                title={t("home.flashNoDeals", "No active deals right now")}
            />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerText: { flex: 1, gap: 2 },
  listContent: { paddingTop: 16, gap: GAP },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", paddingTop: 16, gap: GAP },
  skeletonItem: { flex: 1, minWidth: '45%' },
});
