/**
 * HomeScreen — 2026 Premium Redesign.
 *
 * Architecture matches the reference image layout exactly:
 *   1. DeliveryHeader   — white top bar (logo + notification bell)
 *   2. HomeHero         — teal gradient card (greeting + search + 3 quick actions)
 *   3. TodayCare        — anticipatory care strip (authed only)
 *   4. CategoryStrip    — square pastel category tiles
 *   5. FlashSaleSection — offer banner + countdown + product rail
 *   6. DailyEdit        — editorial featured products (1+2 layout)
 *   7. RecentlyViewed   — personal trail (lazy, below fold)
 *   8. SavingsStrip     — trust band (lazy, below fold)
 *
 * Scroll behaviour:
 *   • Animated.ScrollView (Reanimated) — scroll offset drives header fade
 *   • Pull-to-refresh with teal tint
 *   • Below-fold lazy-mount after first scroll (preserves initial frame budget)
 *
 * All existing callbacks, queries, and business logic preserved.
 */

import React, {
  useCallback,
  useState,
} from "react";
import {
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ─── Stores ───────────────────────────────────────────────────────────────────
import { useAuth } from "../../src/features/auth";

// ─── API ──────────────────────────────────────────────────────────────────────
import {
  categoryKeys,
  fetchCategories,
  productKeys,
  useInfiniteProducts,
} from "../../src/features/products";

// ─── Section components ───────────────────────────────────────────────────────
import { DeliveryHeader }         from "../../src/features/home/components/DeliveryHeader";
import { HomeHero }               from "../../src/features/home/components/HomeHero";
import { CategoryStrip }          from "../../src/features/home/components/CategoryStrip";
import { TodayCare }              from "../../src/features/home/components/TodayCare";
import { FlashSaleSection }       from "../../src/features/home/components/FlashSaleSection";
import { RecentlyViewedCarousel } from "../../src/features/home/components/RecentlyViewedCarousel";
import { DailyEdit }              from "../../src/features/home/components/DailyEdit";
import { SavingsStrip }           from "../../src/features/home/components/SavingsStrip";
import { HomeSkeleton }           from "../../src/features/home/components/HomeSkeleton";

// ─── Kit ─────────────────────────────────────────────────────────────────────
import { kit } from "@pharmacy/ui-native";
import { useTabSwipeGesture } from "../../src/shared/navigation/useTabSwipeGesture";

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { gesture, animatedStyle } = useTabSwipeGesture("index");
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const { i18n }   = useTranslation();
  const { user }   = useAuth();
  const qc         = useQueryClient();

  const lang = (i18n.language === "en" ? "en" : "ar") as "ar" | "en";

  // ── Scroll-driven header opacity ────────────────────────────────────────────
  const scrollY         = useSharedValue(0);
  const scrollHandler   = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Header border becomes visible after scrolling past the hero
  const headerBorderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Lazy below-fold ──────────────────────────────────────────────────────────
  const [belowFold, setBelowFold] = useState(false);
  const onScrollBeginDrag = useCallback(() => {
    if (!belowFold) setBelowFold(true);
  }, [belowFold]);

  const [refreshing, setRefreshing] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  const categoriesQ = useQuery({
    queryKey:  categoryKeys.list(),
    queryFn:   fetchCategories,
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
  });

  const {
    products: saleProducts,
    isLoading: saleLoading,
  } = useInfiniteProducts({
    isSale:   true,
    pageSize: 8,
    sortBy:   "price_asc",
    enabled:  true,
  });

  // ── Navigation callbacks ──────────────────────────────────────────────────

  const goSearch    = useCallback(() => router.push("/search" as any), [router]);
  const goNotifs    = useCallback(() => router.push("/notifications" as any), [router]);
  const goAllCats   = useCallback(() => router.push("/(tabs)/products"), [router]);
  const goOffers    = useCallback(() => router.push("/deals" as any), [router]);
  const goScanRx    = useCallback(() => router.push("/prescriptions/scan" as any), [router]);
  // Fast delivery → browse all products (fastest way to find your medicine)
  const goFastDeliv = useCallback(() => router.push("/(tabs)/products" as any), [router]);

  const goCategory = useCallback(
    (id: string) =>
      router.push({ pathname: "/products" as any, params: { categoryId: id } }),
    [router],
  );

  const goProduct = useCallback(
    (id: string) =>
      router.push({ pathname: "/product/[id]" as any, params: { id } }),
    [router],
  );

  // ── Pull-to-refresh ───────────────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: categoryKeys.list() }),
      qc.invalidateQueries({ queryKey: productKeys.featured(12) }),
      qc.invalidateQueries({ queryKey: productKeys.featured(6) }),
      qc.invalidateQueries({ queryKey: ["products"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[s.root, animatedStyle]}>
        <StatusBar style="dark" />

        {/* ── Fixed top bar ── */}
        <DeliveryHeader
          insets={insets}
          user={user}
          onNotifPress={goNotifs}
        />

        {/* ── Scroll shadow line (appears after scroll) ── */}
        <Animated.View style={[s.scrollShadowLine, headerBorderStyle]} pointerEvents="none" />

        {/* ── Main scroll ── */}
        <Animated.ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          onScrollBeginDrag={onScrollBeginDrag}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={kit.color.accentDeep}
              colors={[kit.color.accentDeep]}
              progressBackgroundColor={kit.color.surface}
            />
          }
        >
          {categoriesQ.isLoading ? (
            <HomeSkeleton />
          ) : (
            <>
              {/* 1. Hero — greeting + search + quick actions */}
              <HomeHero
                onScanRx={goScanRx}
                onDeals={goOffers}
                onSearch={goSearch}
                onFastDeliv={goFastDeliv}
              />

              {/* 2. Anticipatory care (authed only) */}
              {Boolean(user) && <TodayCare />}

              {/* 3. Categories */}
              <CategoryStrip
                categories={categoriesQ.data ?? []}
                isLoading={categoriesQ.isLoading}
                lang={lang}
                onCategoryPress={(id, _name, _nameEn) => goCategory(id)}
                onViewAll={goAllCats}
              />

              {/* 4. Flash sale / Exclusive Offers */}
              {(saleProducts.length > 0 || saleLoading) && (
                <FlashSaleSection
                  products={saleProducts}
                  onProductPress={goProduct}
                  onViewAll={goOffers}
                />
              )}

              {/* 5. Daily edit — editorial featured products */}
              <DailyEdit
                lang={lang}
                onProductPress={goProduct}
                onViewAll={goOffers}
              />
            </>
          )}

          {/* ── Below-fold: lazy-mount after first scroll drag ── */}
          {belowFold && (
            <>
              <RecentlyViewedCarousel lang={lang} onProductPress={goProduct} />
              <SavingsStrip />
            </>
          )}

          {/* Bottom spacer — clears the tab bar */}
          <View style={{ height: Math.max(insets.bottom, 16) + 80 }} />
        </Animated.ScrollView>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    // No extra paddingTop — DeliveryHeader is position:static in the flex column
  },

  // Thin teal-tinted shadow line that appears under the header on scroll
  scrollShadowLine: {
    height:          2,
    backgroundColor: kit.color.accentTint,
    shadowColor:     kit.color.accentDeep,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.08,
    shadowRadius:    4,
    elevation:       2,
  },
});
