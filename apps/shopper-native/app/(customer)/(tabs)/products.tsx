import React, { useCallback, useMemo } from "react";
import { FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { fetchCategories } from "@/services/productsApi";
import { CategoryCard } from "@/components/CategoryCard";
import { CustomerUI, kit } from "@pharmacy/ui-native";
import { useCartStore } from "@/stores/cart";
import { useMountTiming } from "@/lib/devTiming";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { HomeSectionHeader } from "@/features/home/components/HomeSectionHeader";
import { useTranslation } from "react-i18next";
import { useScreenLayout } from "@/utils/responsive";
import { useTabSwipeGesture } from "@/shared/navigation/useTabSwipeGesture";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const GRID_GAP = 12;

function StatsStrip({ catCount, loading }: { catCount: number; loading: boolean }) {
  const { t } = useTranslation();
  const theme = CustomerUI.useLuxuryTheme();
  const { pagePad } = useScreenLayout();

  const items = [
    { icon: "grid-outline" as const, value: "", label: t("products.statCategories"), color: theme.colors.accentDeep, tint: theme.colors.accentTint },
    { icon: "cube-outline" as const, value: "5000+", label: t("products.statItems"), color: kit.color.success, tint: kit.color.successTint },
    { icon: "flash-outline" as const, value: IS_RTL ? "30د" : "30min", label: t("products.statFastLabel"), color: kit.color.warn, tint: kit.color.warnTint },
    { icon: "shield-checkmark-outline" as const, value: "100%", label: t("products.statOriginalLabel"), color: "#7c3aed", tint: "#f5f3ff" },
  ];

  return (
    <View style={[st.row, { flexDirection: flexRow(IS_RTL), marginHorizontal: pagePad }]}>
      {items.map((item, i) => (
        <View key={i} style={[st.item, i > 0 && (IS_RTL ? st.itemBorderRight : st.itemBorderLeft)]}>
          <View style={[st.icon, { backgroundColor: item.tint }]}>
            <Ionicons name={item.icon} size={13} color={item.color} />
          </View>
          <View style={st.textCol}>
            <CustomerUI.Typography variant="caption" weight="bold" color={item.color} style={{ textAlign: TEXT_START }}>
              {i === 0 ? (loading ? "..." : String(catCount)) : item.value}
            </CustomerUI.Typography>
            <CustomerUI.Typography variant="caption" color={theme.colors.inkSoft} style={{ textAlign: TEXT_START, fontSize: 9 }}>
              {item.label}
            </CustomerUI.Typography>
          </View>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(15,23,42,0.08)', marginBottom: 24, marginTop: 12 },
  item: { flex: 1, paddingVertical: 8, alignItems: "center", justifyContent: "center", gap: 8 },
  itemBorderLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(15,23,42,0.08)' },
  itemBorderRight: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(15,23,42,0.08)' },
  icon: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  textCol: { alignItems: "center", justifyContent: "center", gap: 2 },
});

export default function ProductsScreen() {
  useMountTiming("ProductsScreen");
  const { gesture, animatedStyle } = useTabSwipeGesture("products");
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.itemCount());
  const theme = CustomerUI.useLuxuryTheme();
  const lang = i18n.language === "en" ? "en" as const : "ar" as const;

  const { pagePad, numColumns, width } = useScreenLayout();
  const catCols = Math.min(numColumns, 3);
  const cellW = Math.floor((width - pagePad * 2 - GRID_GAP * (catCols - 1)) / catCols);

  const { data: rawCategories = [], isLoading: catsLoading, isError, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 10 * 60_000,
  });

  const categories = useMemo(() => {
    return rawCategories.some((c) => c.count > 0) ? rawCategories.filter((c) => c.count > 0) : rawCategories;
  }, [rawCategories]);

  const goSearch = useCallback(() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); router.push("/(customer)/(shop)/search"); }, [router]);
  const goCart = useCallback(() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); router.push("/(customer)/(tabs)/cart"); }, [router]);
  const goCategory = useCallback(
    (item: { id: string; nameEn?: string; name: string }) => router.push({ pathname: "/(customer)/(shop)/category/[id]", params: { id: item.id, nameEn: item.nameEn ?? "", name: item.name ?? "" } }),
    [router]
  );

  const ListHeaderComponent = useCallback(() => (
    <>
      <View style={[s.header, { paddingTop: insets.top + 14, paddingHorizontal: pagePad }]}>
        <View style={[s.headerRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.headerLeft, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={[s.headerIconTile, { backgroundColor: theme.colors.accentTint }]}>
              <Ionicons name="grid" size={20} color={theme.colors.accentDeep} />
            </View>
            <View>
              <CustomerUI.Typography variant="caption" weight="bold" color={theme.colors.accentDeep} style={{ textTransform: "uppercase" }}>
                {t("products.headerEyebrow")}
              </CustomerUI.Typography>
              <CustomerUI.Typography variant="h3" weight="black" color={theme.colors.ink}>
                {t("products.title")}
              </CustomerUI.Typography>
            </View>
          </View>

          <Pressable onPress={goCart} accessibilityRole="button" style={[s.cartBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}>
            <Ionicons name="bag-outline" size={19} color={theme.colors.inkSoft} />
            {cartCount > 0 && (
              <View style={s.cartBadge}>
                <CustomerUI.Typography variant="caption" weight="black" color="#FFF" style={{ fontSize: 9 }}>{cartCount > 9 ? "9+" : cartCount}</CustomerUI.Typography>
              </View>
            )}
          </Pressable>
        </View>

        <Pressable onPress={goSearch} accessibilityRole="button" style={[s.searchBar, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.background }]}>
          <View style={s.searchIconWell}><Ionicons name="search" size={16} color={theme.colors.accentDeep} /></View>
          <CustomerUI.Typography variant="body" color={theme.colors.inkFaint} style={[s.searchHint, { textAlign: TEXT_START }]}>
            {t("search.placeholder")}
          </CustomerUI.Typography>
        </Pressable>
      </View>
      <StatsStrip catCount={categories.length} loading={catsLoading} />
      <View style={[s.sectionHead, { paddingHorizontal: pagePad }]}>
        <HomeSectionHeader eyebrow={t("products.sectionEyebrow")} title={t("products.sectionTitle")} icon="grid-outline" />
      </View>
    </>
  ), [catsLoading, categories.length, insets.top, pagePad, theme, t, goCart, cartCount, goSearch]);

  const renderItem = useCallback(({ item, index }: any) => (
    <View style={{ width: cellW, marginBottom: GRID_GAP }}>
      <CategoryCard category={item} gradientIdx={index} lang={lang} variant="grid" onPress={() => goCategory(item)} />
    </View>
  ), [cellW, lang, goCategory]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[s.root, { backgroundColor: theme.colors.canvas }, animatedStyle]}>
        {catsLoading ? (
           <View style={{ flex: 1, padding: pagePad, paddingTop: insets.top + 80 }}><CustomerUI.ActivityIndicator size="large" /></View>
        ) : isError ? (
           <CustomerUI.ErrorState message={t("errors.network")} retry={() => refetch()} />
        ) : categories.length === 0 ? (
           <CustomerUI.EmptyState title={t("products.noProducts")} />
        ) : (
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            numColumns={catCols}
            key={catCols}
            renderItem={renderItem}
            ListHeaderComponent={ListHeaderComponent}
            contentContainerStyle={{ paddingBottom: theme.layout.tabBarHeight + 24 }}
            columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: pagePad }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 16, marginBottom: 12 },
  headerRow: { alignItems: "center", justifyContent: "space-between" },
  headerLeft: { alignItems: "center", gap: 12 },
  headerIconTile: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cartBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cartBadge: { position: "absolute", top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: kit.color.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#FFFFFF" },
  searchBar: { height: 48, borderRadius: 16, alignItems: "center", paddingHorizontal: 6, gap: 10 },
  searchIconWell: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  searchHint: { flex: 1 },
  sectionHead: { marginBottom: 16 },
});
