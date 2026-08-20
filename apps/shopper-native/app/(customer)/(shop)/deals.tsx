/**
 * Deals screen ?" O1OU^O  O-OOUSOc (Exclusive Offers).
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

import { CustomerUI, kit } from "@pharmacy/ui-native";
import { BACK_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
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
  const theme = CustomerUI.useLuxuryTheme();
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
    (id: string) => router.push({ pathname: "/(customer)/(shop)/product/[id]" as any, params: { id } }),
    [router],
  );

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10, backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.line }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          style={[s.backBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.line }]}
        >
          <Ionicons name={BACK_CHEVRON} size={20} color={theme.colors.ink} />
        </Pressable>
        <View style={s.headerText}>
          <CustomerUI.Typography variant="h3" weight="black" color={theme.colors.ink} style={{ textAlign: TEXT_START }}>
             {t("home.flashTitle")}
          </CustomerUI.Typography>
          {products.length > 0 && (
            <CustomerUI.Typography variant="caption" color={theme.colors.inkFaint} style={{ textAlign: TEXT_START }}>
              {products.length} {t("common.products", "products")}
            </CustomerUI.Typography>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={[s.skeletonGrid, { paddingHorizontal: pagePad }]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={s.skeletonItem}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      ) : isError ? (
        <CustomerUI.ErrorState message={t("errors.network")} retry={() => refetch()} />
      ) : (
        <FlashList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={NUM_COLS}
          estimatedItemSize={280}
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
              tintColor={theme.colors.accentDeep}
              colors={[theme.colors.accentDeep]}
            />
          }
          ListEmptyComponent={
            <CustomerUI.EmptyState 
                icon="pricetag-outline"
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
