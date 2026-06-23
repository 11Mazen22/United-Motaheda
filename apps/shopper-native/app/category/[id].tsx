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
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import {
  ProductGrid,
  useInfiniteProducts,
  type NativeProduct,
  type ProductSortMode,
} from "@/features/products";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { emojiFor } from "@/components/CategoryCard";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: {
  id:       ProductSortMode;
  labelKey: string;
  icon:     React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { id: "newest",     labelKey: "category.sortNewest",   icon: "time-outline"       },
  { id: "price_asc",  labelKey: "category.sortPriceAsc", icon: "arrow-up-outline"   },
  { id: "price_desc", labelKey: "category.sortPriceDesc", icon: "arrow-down-outline" },
  { id: "name_asc",   labelKey: "category.sortNameAsc",  icon: "text-outline"       },
];

// ─── Per-category accent palette ─────────────────────────────────────────────

const PALETTE = [
  { accent: kit.color.accentDeep, tint: kit.color.accentTint },
  { accent: kit.color.warn,       tint: kit.color.warnTint    },
  { accent: kit.color.success,    tint: kit.color.successTint },
  { accent: "#7c3aed",            tint: "#f5f3ff"             },
  { accent: "#0284c7",            tint: "#e0f2fe"             },
];

function idToPalette(str: string) {
  const sum = str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length];
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CategoryScreen() {
  const { t, i18n } = useTranslation();

  const params    = useLocalSearchParams<{ id?: string | string[]; nameEn?: string | string[]; name?: string | string[] }>();
  const rawId     = Array.isArray(params.id)     ? params.id[0]     : params.id;
  const rawNameEn = Array.isArray(params.nameEn) ? params.nameEn[0] : params.nameEn;
  const rawName   = Array.isArray(params.name)   ? params.name[0]   : params.name;

  const id       = typeof rawId     === "string" && rawId.length     > 0 ? decodeURIComponent(rawId)     : undefined;
  const nameEn   = typeof rawNameEn === "string" && rawNameEn.length > 0 ? decodeURIComponent(rawNameEn) : undefined;
  const catName  = typeof rawName   === "string" && rawName.length   > 0 ? decodeURIComponent(rawName)   : undefined;

  const displayTitle = i18n.language === "en" && nameEn
    ? nameEn
    : (catName ?? id ?? t("category.defaultName"));

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sortBy, setSortBy]           = useState<ProductSortMode>("newest");
  const [inStockOnly, setInStockOnly] = useState(false);

  const { accent, tint } = idToPalette(id ?? "");
  const emoji             = emojiFor(catName ?? "");

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
    inStock:    inStockOnly || undefined,
    enabled:    Boolean(id),
  });

  const handleProductPress = useCallback(
    (p: NativeProduct) => router.push({ pathname: "/product/[id]", params: { id: p.id } }),
    [router],
  );

  const toggleInStock = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setInStockOnly((v) => !v);
  }, []);

  const pickSort = useCallback((id: ProductSortMode) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setSortBy(id);
  }, []);

  return (
    <View style={s.root}>

      {/* ══════════════════════════════════════════════════ */}
      {/* HEADER                                           */}
      {/* ══════════════════════════════════════════════════ */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>

        {/* Tinted identity wash — fills top portion of header */}
        <View style={[s.wash, { backgroundColor: tint }]} pointerEvents="none" />

        {/* Nav row — back + cart */}
        <View style={[s.navRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.navBtn}>
            <Ionicons name={BACK_CHEVRON} size={17} color={kit.color.inkSoft} />
          </Pressable>

          <Pressable onPress={() => router.push("/(tabs)/cart")} style={s.navBtn}>
            <Ionicons name="bag-outline" size={17} color={kit.color.inkSoft} />
          </Pressable>
        </View>

        {/* Identity block — emoji + title */}
        <View style={s.identity}>
          {/* Emoji well */}
          <View style={[s.emojiWell, { backgroundColor: tint, borderColor: accent + "30" }]}>
            <UIText style={s.emojiText}>{emoji}</UIText>
          </View>

          {/* Text */}
          <View style={s.titleBlock}>
            <UIText style={[s.eyebrow, { textAlign: TEXT_START }]}>
              {t("category.browse")}
            </UIText>
            <UIText numberOfLines={2} style={[s.title, { textAlign: TEXT_START }]}>
              {displayTitle}
            </UIText>
            {totalCount > 0 && (
              <View style={[s.countBadge, { backgroundColor: tint, flexDirection: flexRow(IS_RTL) }]}>
                <View style={[s.countDot, { backgroundColor: accent }]} />
                <UIText style={[s.countText, { color: accent }]}>
                  {t("category.productCount", { count: totalCount })}
                </UIText>
              </View>
            )}
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.chipsRow, { flexDirection: flexRow(IS_RTL) }]}
        >
          {/* In-stock toggle */}
          <Pressable
            onPress={toggleInStock}
            style={[s.chip, inStockOnly
              ? { backgroundColor: tint, borderColor: accent }
              : s.chipOff]}
          >
            <Ionicons
              name={inStockOnly ? "checkmark-circle" : "cube-outline"}
              size={13}
              color={inStockOnly ? accent : kit.color.inkFaint}
            />
            <UIText style={[s.chipText, { color: inStockOnly ? accent : kit.color.inkSoft }]}>
              {t("category.inStockOnly")}
            </UIText>
          </Pressable>

          {/* Sort chips */}
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => pickSort(opt.id)}
                style={[s.chip, active
                  ? { backgroundColor: tint, borderColor: accent }
                  : s.chipOff]}
              >
                <Ionicons name={opt.icon} size={13} color={active ? accent : kit.color.inkFaint} />
                <UIText style={[s.chipText, { color: active ? accent : kit.color.inkSoft }]}>
                  {t(opt.labelKey)}
                </UIText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════════ */}
      {/* RESULTS BAR                                      */}
      {/* ══════════════════════════════════════════════════ */}
      {products.length > 0 && !isLoading && (
        <View style={[s.resultsBar, { flexDirection: flexRow(IS_RTL) }]}>
          <UIText style={s.resultsText}>
            {t("category.productCount", { count: products.length })}
          </UIText>
          {inStockOnly && (
            <View style={[s.filterTag, { backgroundColor: tint, flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="checkmark-circle" size={11} color={accent} />
              <UIText style={[s.filterTagText, { color: accent }]}>
                {t("category.inStockOnly")}
              </UIText>
            </View>
          )}
        </View>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* CONTENT                                          */}
      {/* ══════════════════════════════════════════════════ */}
      {isLoading ? (
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          numColumns={2}
          keyExtractor={(k) => String(k)}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          columnWrapperStyle={{ gap: 10, flexDirection: flexRow(isRtl()) }}
          showsVerticalScrollIndicator={false}
          renderItem={() => <View style={{ flex: 1 }}><ProductCardSkeleton /></View>}
        />
      ) : isError ? (
        <EmptyState
          icon="wifi-outline"
          title={t("category.loadError")}
          description={t("category.loadErrorDesc")}
          actionLabel={t("category.tryAgain")}
          onAction={refetch}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title={t("category.noProducts")}
          description={inStockOnly ? t("category.noInStockProducts") : t("category.noProductsInCat")}
          actionLabel={inStockOnly ? t("category.showAll") : t("common.back")}
          onAction={() => (inStockOnly ? setInStockOnly(false) : router.back())}
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
                <ActivityIndicator color={kit.color.accentDeep} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  // ── Header
  header: {
    backgroundColor:   kit.color.surface,
    paddingBottom:     16,
    paddingHorizontal: 16,
    gap:               16,
    overflow:          "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  wash: {
    position: "absolute",
    top:      0,
    left:     0,
    right:    0,
    bottom:   0,
    opacity:  0.45,
  },

  // ── Nav row
  navRow: {
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      4,
  },
  navBtn: {
    width:           40,
    height:          40,
    borderRadius:    13,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },

  // ── Identity block
  identity: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    gap:            16,
  },
  emojiWell: {
    width:          72,
    height:         72,
    borderRadius:   22,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
    ...kit.shadow.raised,
  },
  emojiText: {
    fontSize: 34,
  },
  titleBlock: {
    flex: 1,
    gap:  6,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.7,
    includeFontPadding: false,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    lineHeight:         28,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  countBadge: {
    alignSelf:         "flex-start",
    alignItems:        "center",
    gap:               5,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  countDot: {
    width:        5,
    height:       5,
    borderRadius: 3,
  },
  countText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         15,
    includeFontPadding: false,
  },

  // ── Filter chips
  chipsRow: {
    gap:          8,
    paddingRight: 4,
  },
  chip: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 13,
    paddingVertical:   9,
    borderRadius:      kit.radius.control,
    borderWidth:       1,
  },
  chipOff: {
    backgroundColor: kit.color.well,
    borderColor:     kit.color.line,
  },
  chipText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           12,
    lineHeight:         16,
    includeFontPadding: false,
  },

  // ── Results bar
  resultsBar: {
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   10,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  resultsText: {
    fontFamily: theme.fonts.semibold,
    fontSize:   12,
    lineHeight: 16,
    color:      kit.color.inkFaint,
  },
  filterTag: {
    alignItems:        "center",
    gap:               4,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  filterTagText: {
    fontFamily: theme.fonts.bold,
    fontSize:   10,
    lineHeight: 14,
  },
});
