import React, { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, View, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { CustomerUI, kit } from "@pharmacy/ui-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenLayout } from "@/utils/responsive";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useTranslation } from "react-i18next";
import { DeliveryHeader } from "@/features/home/components/DeliveryHeader";
import { CategoryStrip } from "@/features/home/components/CategoryStrip";
import { FlashSaleSection } from "@/features/home/components/FlashSaleSection";
import { FeaturedSection } from "@/features/home/components/FeaturedSection";
import { SavingsStrip } from "@/features/home/components/SavingsStrip";
import { RecentlyViewedCarousel } from "@/features/home/components/RecentlyViewedCarousel";
import { fetchCategories } from "@/services/productsApi";

const IS_RTL = isRtl();

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pagePad } = useScreenLayout();
  const { t, i18n } = useTranslation();
  const theme = CustomerUI.useCustomerTheme();
  const lang = i18n.language === "en" ? "en" as const : "ar" as const;

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 10 * 60_000,
  });

  const goSearch = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push("/(customer)/(shop)/search");
  }, [router]);

  const goProducts = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push("/(customer)/(tabs)/products");
  }, [router]);

  const goCategory = useCallback((id: string, name: string, nameEn: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: "/(customer)/(shop)/category/[id]", params: { id, nameEn, name } });
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar style="auto" />

      {/* Delivery / Location Header */}
      <View style={{ paddingTop: insets.top + 8 }}>
        <DeliveryHeader />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        {/* Compact Search Bar */}
        <View style={[styles.searchSection, { paddingHorizontal: pagePad, paddingTop: 12, paddingBottom: 8 }]}>
          <Pressable onPress={goSearch} accessibilityRole="button" style={styles.searchBar}>
            <View style={[styles.searchInner, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={[styles.searchIconWell, { backgroundColor: theme.colors.accentTint }]}>
                <Ionicons name="search" size={18} color={theme.colors.accentDeep} />
              </View>
              <CustomerUI.Typography variant="body" color={theme.colors.inkFaint} style={[styles.searchHint, { textAlign: textAlignStart(IS_RTL) }]}>
                {t("search.placeholder")}
              </CustomerUI.Typography>
              <View style={[styles.scanBtn, { backgroundColor: theme.colors.accent }]}>
                <Ionicons name="scan-outline" size={18} color="#fff" />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={[styles.quickActions, { paddingHorizontal: pagePad }]}>
          <QuickAction
            icon="document-text-outline"
            label={t("home.qaScanLabel", "Scan Rx")}
            sub={t("home.qaScanSub", "Upload prescription")}
            accent={theme.colors.accent}
            tint={theme.colors.accentTint}
            onPress={() => router.push("/(customer)/prescriptions/scan")}
          />
          <QuickAction
            icon="repeat-outline"
            label={t("home.qaRefillLabel", "Refill")}
            sub={t("home.qaRefillSub", "Recurring orders")}
            accent={kit.color.warn}
            tint={kit.color.warnTint}
            onPress={() => router.push("/(customer)/(tabs)/meds")}
          />
          <QuickAction
            icon="bag-handle-outline"
            label={t("home.qaReorderLabel", "Reorder")}
            sub={t("home.qaReorderSub", "Order again")}
            accent={kit.color.success}
            tint={kit.color.successTint}
            onPress={() => router.push("/(customer)/(tabs)/orders")}
          />
          <QuickAction
            icon="grid-outline"
            label={t("home.qaExploreLabel", "Browse")}
            sub={t("home.qaExploreSub", "All products")}
            accent={kit.color.danger}
            tint={kit.color.dangerTint}
            onPress={goProducts}
          />
        </View>

        {/* Categories */}
        <CategoryStrip
          categories={categories}
          isLoading={catsLoading}
          lang={lang}
          onCategoryPress={goCategory}
          onViewAll={goProducts}
        />

        {/* Featured Products */}
        <FeaturedSection lang={lang} onProductPress={(id) => router.push(`/(customer)/(shop)/product/${id}`)} onViewAll={goProducts} />

        {/* Flash Deals */}
        <FlashSaleSection
          products={[]}
          onProductPress={(id) => router.push(`/(customer)/(shop)/product/${id}`)}
          onViewAll={goProducts}
        />

        {/* Trust / Savings Strip */}
        <SavingsStrip />

        {/* Recently Viewed */}
        <RecentlyViewedCarousel
          lang={lang}
          onProductPress={(id) => router.push(`/(customer)/(shop)/product/${id}`)}
        />
      </ScrollView>
    </View>
  );
}

const QuickAction = memo(function QuickAction({ icon, label, sub, accent, tint, onPress }: {
  icon: string;
  label: string;
  sub: string;
  accent: string;
  tint: string;
  onPress: () => void;
}) {
  const IS_RTL = isRtl();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.qaCard, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.qaIconWell, { backgroundColor: tint }]}>
        <Ionicons name={icon as unknown as never} size={22} color={accent} />
      </View>
      <CustomerUI.Typography variant="bodySm" weight="bold" color={kit.color.ink} style={[styles.qaLabel, { textAlign: textAlignStart(IS_RTL) }]}>
        {label}
      </CustomerUI.Typography>
      <CustomerUI.Typography variant="caption" color={kit.color.inkFaint} style={[styles.qaSub, { textAlign: textAlignStart(IS_RTL) }]}>
        {sub}
      </CustomerUI.Typography>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchSection: { zIndex: 10 },
  searchBar: { height: 48 },
  searchInner: {
    alignItems: "center",
    backgroundColor: kit.color.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: kit.color.line,
    paddingHorizontal: 8,
    height: 48,
    gap: 8,
    ...kit.shadow.raised,
  },
  searchIconWell: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  searchHint: { flex: 1 },
  scanBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  quickActions: { flexDirection: flexRow(isRtl()), flexWrap: "wrap", gap: 12, paddingBottom: 8 },
  qaCard: {
    width: "47%",
    backgroundColor: kit.color.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: kit.color.line,
    padding: 14,
    gap: 6,
    ...kit.shadow.card,
  },
  qaIconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  qaLabel: { fontSize: 13, lineHeight: 18 },
  qaSub: { fontSize: 11, lineHeight: 15 },
});

