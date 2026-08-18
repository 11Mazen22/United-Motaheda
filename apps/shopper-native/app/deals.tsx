/**
 * Deals screen — عروض حصرية (Exclusive Offers).
 *
 * Shows all products that currently have an active promotion / sale price.
 * Navigated to from the HomeHero "عروض حصرية" quick-action chip and
 * the FlashSaleSection "View All" button.
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
import { useRouter }         from "expo-router";
import { useTranslation }    from "react-i18next";
import { Ionicons }          from "@expo/vector-icons";
import { StatusBar }         from "expo-status-bar";

import { Text as UIText }                   from "@pharmacy/ui-native";
import { kit }                              from "@pharmacy/ui-native";
import { theme }                            from "@pharmacy/design-tokens";
import { BACK_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout }                  from "@/utils/responsive";
import { useInfiniteProducts }              from "@/features/products";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const NUM_COLS   = 2;
const GAP        = 12;

export default function DealsScreen() {
  const router          = useRouter();
  const { t, i18n }     = useTranslation();
  const insets          = useSafeAreaInsets();
  const { pagePad }     = useScreenLayout();
  const lang            = (i18n.language === "en" ? "en" : "ar") as "ar" | "en";

  const {
    products,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteProducts({
    isSale:   true,
    pageSize: 20,
    sortBy:   "price_asc",
    enabled:  true,
  });

  const goProduct = useCallback(
    (id: string) => router.push({ pathname: "/product/[id]" as any, params: { id } }),
    [router],
  );



  return (
    <View style={s.screen}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          style={s.backBtn}
        >
          <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
        </Pressable>
        <View style={s.headerText}>
          <UIText style={s.title}>{t("home.flashTitle")}</UIText>
          {products.length > 0 && (
            <UIText style={s.subtitle}>
              {products.length} {t("common.products", "منتج")}
            </UIText>
          )}
        </View>
      </View>

      {/* Grid */}
      {isLoading ? (
        <View style={[s.skeletonGrid, { paddingHorizontal: pagePad }]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={s.skeletonItem}>
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={NUM_COLS}
          overrideItemLayout={(layout: any) => {
            layout.size = 280;
            layout.span = 1;
          }}
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
              tintColor={kit.color.accentDeep}
              colors={[kit.color.accentDeep]}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="pricetag-outline" size={44} color={kit.color.inkFaint} />
              <UIText style={s.emptyText}>
                {t("home.flashNoDeals", "لا توجد عروض حالياً")}
              </UIText>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  /* ── Header ── */
  header: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 16,
    paddingBottom:     14,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  headerText: {
    flex: 1,
    gap:  2,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    lineHeight:         26,
    color:              kit.color.ink,
    letterSpacing:      -0.3,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  /* ── List ── */
  listContent: {
    paddingTop: 8,
    gap:        GAP,
  },

  /* ── Skeleton ── */
  skeletonGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    paddingTop:    8,
    gap:           GAP,
  },
  skeletonItem: {
    flex: 1,
  },

  /* ── Empty ── */
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap:        12,
  },
  emptyText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           16,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
});
