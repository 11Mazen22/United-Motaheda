import React, { useCallback, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@pharmacy/ui-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { DeliveryHeader } from "@/features/home/components/DeliveryHeader";
import { Hero } from "@/features/home/components/Hero";
import { TodayCare } from "@/features/home/components/TodayCare";
import { CategoryStrip } from "@/features/home/components/CategoryStrip";
import { DailyEdit } from "@/features/home/components/DailyEdit";
import { FlashSaleSection } from "@/features/home/components/FlashSaleSection";
import { SavingsStrip } from "@/features/home/components/SavingsStrip";
import { RecentlyViewedCarousel } from "@/features/home/components/RecentlyViewedCarousel";
import { HomeSkeleton } from "@/features/home/components/HomeSkeleton";
import { ErrorState } from "@pharmacy/ui-native";
import { fetchCategories } from "@/services/productsApi";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const lang = i18n.language === "en" ? "en" as const : "ar" as const;
  const [refreshing, setRefreshing] = useState(false);

  const { data: categories = [], isLoading: catsLoading, isError: catsError, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 10 * 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const goSearch = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push("/(customer)/(shop)/search");
  }, [router]);

  const goScanRx = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push("/(customer)/prescriptions/scan");
  }, [router]);

  const goProducts = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push("/(customer)/(tabs)/products");
  }, [router]);

  const goCategory = useCallback((id: string, name: string, nameEn: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: "/(customer)/(shop)/category/[id]", params: { id, nameEn, name } });
  }, [router]);

  const retryCategories = useCallback(async () => { await refetch(); }, [refetch]);

  const goProduct = useCallback((id: string) => {
    router.push(`/(customer)/(shop)/product/${id}`);
  }, [router]);

  // First-load skeleton — the only genuinely blocking state; every section
  // below owns its own query and renders its own skeleton/empty guard.
  if (catsLoading && categories.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas.background }]}>
        <StatusBar style="light" />
        <View style={{ paddingTop: insets.top }} />
        <HomeSkeleton />
      </View>
    );
  }

  if (catsError && categories.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>
        <StatusBar style="auto" />
        <ErrorState message={t("errors.generic", "Something went wrong")} retry={retryCategories} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas.background }]}>
      <StatusBar style="light" />

      <View style={{ paddingTop: insets.top + 8, backgroundColor: theme.colors.canvas.surface }}>
        <DeliveryHeader />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} colors={[theme.colors.brand.primary]} />
        }
      >
        <Hero onSearch={goSearch} onScanRx={goScanRx} />

        <TodayCare />

        <CategoryStrip
          categories={categories}
          isLoading={catsLoading}
          lang={lang}
          onCategoryPress={goCategory}
          onViewAll={goProducts}
        />

        <DailyEdit lang={lang} onProductPress={goProduct} onViewAll={goProducts} />

        <FlashSaleSection products={[]} onProductPress={goProduct} onViewAll={goProducts} />

        <SavingsStrip />

        <RecentlyViewedCarousel lang={lang} onProductPress={goProduct} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
});
