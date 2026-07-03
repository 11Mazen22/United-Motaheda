/**
 * HomeScreen — 2026 V3 redesign (full reimagining).
 *
 * New IA, top to bottom:
 *   1. DeliveryHeader   — slim cinematic header (ambient orb, logo breath, search)
 *   2. HomeHero         — tier-1 personalised hero (greeting, status, 3 chips)
 *   3. TodayCare        — anticipatory care (only when active orders / Rx)
 *   4. CategoryStrip    — horizontal browse rail
 *   5. FlashSaleSection — countdown + sale rail (only when sale products exist)
 *   6. DailyEdit        — editorial 1+2 product layout (NEW)
 *   7. RecentlyViewed   — personal trail (only when content)
 *   8. SavingsStrip     — closing trust band (replaces TrustStrip + bottom CTA)
 *
 * Removed: PromoBanner, QuickActions, TrustStrip — absorbed into HomeHero
 * and SavingsStrip. Single source of identity, no duplicated trust messaging.
 *
 * Arrival overlay: relocated to (tabs)/_layout.tsx so the cinematic sequence
 * covers the bottom tab bar too, not just this screen's own content — see
 * that file's header comment for details.
 */

import React, {
  useCallback,
  useState,
} from "react";
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { GestureDetector }                from "react-native-gesture-handler";
import Animated                           from "react-native-reanimated";
import { useSafeAreaInsets }              from "react-native-safe-area-context";
import { useRouter }                      from "expo-router";
import { useTranslation }                 from "react-i18next";
import { useQuery, useQueryClient }       from "@tanstack/react-query";

// ─── Stores ──────────────────────────────────────────────────────────────────
import { useCartStore, selectItemCount }  from "../../src/stores/cart";
import { useAuth }                        from "../../src/features/auth";

// ─── API ─────────────────────────────────────────────────────────────────────
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

// ─── Theme ───────────────────────────────────────────────────────────────────
import { kit } from "../../src/shared/kit";
import { useTabSwipeGesture } from "../../src/shared/navigation/useTabSwipeGesture";

const CANVAS = kit.color.canvas;

// ─── HomeScreen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { gesture, animatedStyle } = useTabSwipeGesture("index");
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { i18n }  = useTranslation();
  const { user }  = useAuth();
  const cartCount = useCartStore(selectItemCount);
  const qc        = useQueryClient();

  const lang = (i18n.language === "en" ? "en" : "ar") as "ar" | "en";

  // ── Lazy below-fold ───────────────────────────────────────────────────────
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

  const goCart       = useCallback(() => router.push("/(tabs)/cart"    as any), [router]);
  const goSearch     = useCallback(() => router.push("/search"         as any), [router]);
  const goNotifs     = useCallback(() => router.push("/notifications"  as any), [router]);
  const goAllCats    = useCallback(() => router.push("/(tabs)/products"     ), [router]);
  const goOffers     = useCallback(() => router.push("/offers"         as any), [router]);
  const goScanRx     = useCallback(() => router.push("/prescriptions/scan" as any), [router]);

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
      <StatusBar barStyle="dark-content" backgroundColor={CANVAS} />

      <DeliveryHeader
        insets={insets}
        user={user}
        cartCount={cartCount}
        onCartPress={goCart}
        onSearchPress={goSearch}
        onNotifPress={goNotifs}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scrollEventThrottle={32}
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
        {/* 1. Tier-1 hero — personalised greeting, status, 3 primary actions */}
        <HomeHero
          onScanRx={goScanRx}
          onDeals={goSearch}
        />

        {/* 2. Anticipatory care (authed only — renders null otherwise) */}
        {Boolean(user) && <TodayCare />}

        {/* 3. Categories — horizontal browse rail */}
        <CategoryStrip
          categories={categoriesQ.data ?? []}
          isLoading={categoriesQ.isLoading}
          lang={lang}
          onCategoryPress={(id, _name, _nameEn) => goCategory(id)}
          onViewAll={goAllCats}
        />

        {/* 4. Flash sale — only when products exist */}
        {(saleProducts.length > 0 || saleLoading) && (
          <FlashSaleSection
            products={saleProducts}
            onProductPress={goProduct}
            onViewAll={goOffers}
          />
        )}

        {/* 5. Daily edit — editorial product trio */}
        <DailyEdit
          lang={lang}
          onProductPress={goProduct}
        />

        {/* Below-fold: lazy after first scroll */}
        {belowFold && (
          <>
            <RecentlyViewedCarousel lang={lang} onProductPress={goProduct} />
            <SavingsStrip />
          </>
        )}

        <View style={{ height: Math.max(insets.bottom, 16) + 72 }} />
      </ScrollView>
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
    paddingBottom: 8,
  },
});
