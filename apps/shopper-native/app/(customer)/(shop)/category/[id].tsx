import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Text as UIText, EmptyState, Skeleton, useTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import {
  ProductGrid,
  useInfiniteProducts,
  type NativeProduct,
  type ProductSortMode,
} from "@/features/products";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { iconForCategory } from "@/utils/categoryIcons";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const SORT_OPTIONS: {
  id: ProductSortMode;
  labelKey: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { id: "newest", labelKey: "category.sortNewest", icon: "time-outline" },
  { id: "price_asc", labelKey: "category.sortPriceAsc", icon: "arrow-up-outline" },
  { id: "price_desc", labelKey: "category.sortPriceDesc", icon: "arrow-down-outline" },
  { id: "name_asc", labelKey: "category.sortNameAsc", icon: "text-outline" },
];

function paletteFor(str: string): readonly [string, string] {
  const sum = str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return gradients.categories[sum % gradients.categories.length];
}

export default function CategoryScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[]; nameEn?: string | string[]; name?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const rawNameEn = Array.isArray(params.nameEn) ? params.nameEn[0] : params.nameEn;
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const id = typeof rawId === "string" && rawId.length > 0 ? decodeURIComponent(rawId) : undefined;
  const nameEn = typeof rawNameEn === "string" && rawNameEn.length > 0 ? decodeURIComponent(rawNameEn) : undefined;
  const catName = typeof rawName === "string" && rawName.length > 0 ? decodeURIComponent(rawName) : undefined;
  const displayTitle = i18n.language === "en" && nameEn
    ? nameEn
    : (catName ?? id ?? t("category.defaultName"));

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sortBy, setSortBy] = useState<ProductSortMode>("newest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [gradFrom, gradTo] = paletteFor(id ?? "");
  const icon = iconForCategory(catName ?? "");

  const {
    products,
    totalCount,
    isLoading,
    isError,
    isFetchingNextPage,
    isRefreshing,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteProducts({
    categoryId: id,
    sortBy,
    inStock: inStockOnly || undefined,
    enabled: Boolean(id),
  });

  const handleProductPress = useCallback(
    (p: NativeProduct) => router.push({ pathname: "/(customer)/(shop)/product/[id]", params: { id: p.id } }),
    [router],
  );

  const toggleInStock = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setInStockOnly((v) => !v);
  }, []);

  const pickSort = useCallback((next: ProductSortMode) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setSortBy(next);
  }, []);

  return (
    <View style={[s.root, { backgroundColor: theme.colors.canvas.background }]}>
      <View style={[s.header, theme.shadows[1], { paddingTop: insets.top + 6, backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
        <View style={[s.wash, { backgroundColor: `${gradFrom}18` }]} pointerEvents="none" />

        <View style={[s.navRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("common.back")} style={[s.navBtn, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
            <Ionicons name={BACK_CHEVRON} size={17} color={theme.colors.text.secondary} />
          </Pressable>

          <Pressable onPress={() => router.push("/(customer)/(tabs)/cart")} accessibilityRole="button" accessibilityLabel={t("tabs.cart")} style={[s.navBtn, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
            <Ionicons name="bag-outline" size={17} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        <View style={[s.identity, { flexDirection: flexRow(IS_RTL) }]}>
          <LinearGradient colors={[gradFrom, gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.iconWell}>
            <Ionicons name={icon} size={30} color="#FFFFFF" />
          </LinearGradient>

          <View style={s.titleBlock}>
            <UIText style={[s.eyebrow, { color: gradFrom, textAlign: TEXT_START }]}>
              {t("category.browse")}
            </UIText>
            <UIText numberOfLines={2} style={[s.title, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>
              {displayTitle}
            </UIText>
            {totalCount > 0 && (
              <View style={[s.countBadge, { backgroundColor: `${gradFrom}18`, flexDirection: flexRow(IS_RTL) }]}>
                <View style={[s.countDot, { backgroundColor: gradFrom }]} />
                <UIText style={[s.countText, { color: gradFrom }]}>
                  {t("category.productCount", { count: totalCount })}
                </UIText>
              </View>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipsRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable onPress={toggleInStock} style={[s.chip, inStockOnly ? { backgroundColor: `${gradFrom}18`, borderColor: gradFrom } : { backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default }]}>
            <Ionicons name={inStockOnly ? "checkmark-circle" : "cube-outline"} size={13} color={inStockOnly ? gradFrom : theme.colors.text.muted} />
            <UIText style={[styles.chipText, { color: inStockOnly ? gradFrom : theme.colors.text.secondary }]}>
              {t("category.inStockOnly")}
            </UIText>
          </Pressable>

          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.id;
            return (
              <Pressable key={opt.id} onPress={() => pickSort(opt.id)} style={[s.chip, active ? { backgroundColor: `${gradFrom}18`, borderColor: gradFrom } : { backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default }]}>
                <Ionicons name={opt.icon} size={13} color={active ? gradFrom : theme.colors.text.muted} />
                <UIText style={[styles.chipText, { color: active ? gradFrom : theme.colors.text.secondary }]}>
                  {t(opt.labelKey)}
                </UIText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {products.length > 0 && !isLoading && (
        <View style={[s.resultsBar, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
          <UIText style={[styles.resultsText, { color: theme.colors.text.muted }]}>
            {t("category.productCount", { count: products.length })}
          </UIText>
          {inStockOnly && (
            <View style={[s.filterTag, { backgroundColor: `${gradFrom}18`, flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="checkmark-circle" size={11} color={gradFrom} />
              <UIText style={[styles.filterTagText, { color: gradFrom }]}>
                {t("category.inStockOnly")}
              </UIText>
            </View>
          )}
        </View>
      )}

      {isLoading ? (
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          numColumns={2}
          keyExtractor={(k) => String(k)}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          columnWrapperStyle={{ gap: 10, flexDirection: flexRow(IS_RTL) }}
          showsVerticalScrollIndicator={false}
          renderItem={() => <View style={{ flex: 1 }}><Skeleton width="100%" height={190} borderRadius={16} /></View>}
        />
      ) : isError ? (
        <EmptyState
          illustrationName="empty"
          title={t("category.loadError")}
          subtitle={t("category.loadErrorDesc")}
          action={{ label: t("category.tryAgain"), onPress: refetch }}
        />
      ) : products.length === 0 ? (
        <EmptyState
          illustrationName="empty"
          title={t("category.noProducts")}
          subtitle={inStockOnly ? t("category.noInStockProducts") : t("category.noProductsInCat")}
          action={{ label: inStockOnly ? t("category.showAll") : t("common.back"), onPress: () => (inStockOnly ? setInStockOnly(false) : router.back()) }}
        />
      ) : (
        <ProductGrid
          products={products}
          onProductPress={handleProductPress}
          onEndReached={hasNextPage && !isFetchingNextPage ? fetchNextPage : undefined}
          refreshing={isRefreshing}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 90 }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color={theme.colors.brand.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingBottom: 16, paddingHorizontal: 16, gap: 12, overflow: "hidden", borderBottomWidth: StyleSheet.hairlineWidth },
  wash: { position: "absolute", top: 0, start: 0, end: 0, bottom: 0 },
  navRow: { justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  navBtn: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  identity: { alignItems: "center", gap: 16 },
  iconWell: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1, gap: 6 },
  eyebrow: { fontSize: 10, lineHeight: 14, letterSpacing: 0.7, fontWeight: "700" },
  title: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4, fontWeight: "800" },
  countBadge: { alignSelf: "flex-start", alignItems: "center", gap: 5, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  countDot: { width: 5, height: 5, borderRadius: 3 },
  countText: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  chipsRow: { gap: 8, paddingEnd: 4 },
  chip: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  resultsBar: { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  filterTag: { alignItems: "center", gap: 4, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 3 },
});

const styles = StyleSheet.create({
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  resultsText: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  filterTagText: { fontSize: 10, lineHeight: 14, fontWeight: "700" },
});
