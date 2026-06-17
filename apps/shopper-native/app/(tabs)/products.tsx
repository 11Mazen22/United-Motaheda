import React, { memo, useCallback } from "react";
import { Dimensions, FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { fetchCategories, fetchFeaturedProducts, type NativeProduct } from "@/services/productsApi";
import { CategoryCard } from "@/components/CategoryCard";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Text as UIText } from "@/shared/ui";
import { useCartStore } from "@/stores/cart";
import { useMountTiming } from "@/lib/devTiming";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { HomeSectionHeader } from "@/features/home/components/HomeSectionHeader";
import { useTranslation } from "react-i18next";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const { width: W } = Dimensions.get("window");
const GRID_PAD = 20;
const GRID_GAP = 12;
const CELL_W   = (W - GRID_PAD * 2 - GRID_GAP) / 2;
const FEAT_W   = 162;

// ─── Featured item wrapper ────────────────────────────────────────────────────

const FeaturedItem = memo(function FeaturedItem({
  item, lang, onPress,
}: {
  item:    NativeProduct;
  lang:    "ar" | "en";
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);
  return (
    <View style={{ width: FEAT_W }}>
      <ProductCard product={item} lang={lang} onPress={handlePress} />
    </View>
  );
});

const FEAT_LIST_STYLE = { paddingHorizontal: GRID_PAD, gap: 12 } as const;

// ─── Stats strip ─────────────────────────────────────────────────────────────

const STAT_ITEMS_AR = [
  { icon: "grid-outline"              as const, value: "",      label: "قسم",    color: kit.color.accentDeep, tint: kit.color.accentTint  },
  { icon: "cube-outline"              as const, value: "5000+", label: "منتج",   color: kit.color.success,    tint: kit.color.successTint },
  { icon: "flash-outline"             as const, value: "30د",   label: "توصيل",  color: kit.color.warn,       tint: kit.color.warnTint    },
  { icon: "shield-checkmark-outline"  as const, value: "100%",  label: "أصالة",  color: "#7c3aed",            tint: "#f5f3ff"             },
];
const STAT_ITEMS_EN = [
  { icon: "grid-outline"              as const, value: "",        label: "Categories", color: kit.color.accentDeep, tint: kit.color.accentTint  },
  { icon: "cube-outline"              as const, value: "5000+",   label: "Products",   color: kit.color.success,    tint: kit.color.successTint },
  { icon: "flash-outline"             as const, value: "30min",   label: "Delivery",   color: kit.color.warn,       tint: kit.color.warnTint    },
  { icon: "shield-checkmark-outline"  as const, value: "100%",    label: "Authentic",  color: "#7c3aed",            tint: "#f5f3ff"             },
];

function StatsStrip({ catCount }: { catCount: number }) {
  const items = IS_RTL ? STAT_ITEMS_AR : STAT_ITEMS_EN;
  return (
    <View style={[st.row, { flexDirection: flexRow(IS_RTL) }]}>
      {items.map((item, i) => (
        <View key={i} style={[st.item, i > 0 && (IS_RTL ? st.itemBorderRight : st.itemBorderLeft)]}>
          <View style={[st.icon, { backgroundColor: item.tint }]}>
            <Ionicons name={item.icon} size={13} color={item.color} />
          </View>
          <View style={st.textCol}>
            <UIText style={[st.value, { color: item.color, textAlign: TEXT_START }]}>
              {i === 0 ? String(catCount) : item.value}
            </UIText>
            <UIText style={[st.label, { textAlign: TEXT_START }]}>{item.label}</UIText>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Grid skeleton ────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <View style={s.grid}>
      {Array(6).fill(null).map((_, i) => (
        <View key={i} style={s.cell}>
          <View style={sk.card}>
            <View style={sk.stripe} />
            <View style={sk.body}>
              <View style={sk.icon} />
              <View style={sk.line} />
              <View style={[sk.line, sk.lineShort]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  useMountTiming("ProductsScreen");
  const { t, i18n } = useTranslation();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.itemCount());
  const lang      = i18n.language === "en" ? "en" as const : "ar" as const;

  const {
    data:      rawCategories = [],
    isLoading: catsLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey:  ["categories"],
    queryFn:   fetchCategories,
    // Categories change infrequently — 10 min stale window avoids refetches on tab switch
    staleTime: 10 * 60_000,
  });

  // Hide categories that have zero products — keeps the grid clean and avoids
  // the user tapping a category that shows an empty screen.
  // Fallback: if ALL counts are 0 (seed/dev data), show everything so the UI
  // isn't a blank page during development.
  const categories = rawCategories.some((c) => c.count > 0)
    ? rawCategories.filter((c) => c.count > 0)
    : rawCategories;

  const { data: featured = [], isLoading: featLoading } = useQuery({
    queryKey:  ["featured"],
    queryFn:   () => fetchFeaturedProducts(12),
    staleTime: 5 * 60_000,
  });

  // Memoised navigation handlers — stable references prevent FlatList renderItem
  // from re-running on every parent render
  const goSearch   = useCallback(() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); router.push("/(tabs)/search");  }, [router]);
  const goFeatured = useCallback(() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); router.push("/featured");        }, [router]);
  const goCart     = useCallback(() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); router.push("/(tabs)/cart");     }, [router]);
  const goCategory = useCallback(
    (item: { id: string; nameEn?: string; name: string }) =>
      router.push({ pathname: "/category/[id]", params: { id: item.id, nameEn: item.nameEn ?? "", name: item.name ?? "" } }),
    [router],
  );
  const goProduct = useCallback(
    (id: string) => router.push({ pathname: "/product/[id]", params: { id } }),
    [router],
  );

  // Stable renderItem — prevents FlatList from treating renderItem as changed
  // on every parent render. ProductCard's custom comparator skips onPress.
  const renderFeatured = useCallback(
    ({ item }: { item: NativeProduct }) => (
      <FeaturedItem item={item} lang={lang} onPress={goProduct} />
    ),
    [lang, goProduct],
  );

  return (
    <View style={s.root}>
      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => ""}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.layout.tabBarHeight + 24 }}
        ListHeaderComponent={
          <>
            {/* ════════════════════════════════════════════════ */}
            {/* HEADER                                          */}
            {/* ════════════════════════════════════════════════ */}
            <View style={[s.header, { paddingTop: insets.top + 14 }]}>

              {/* Top row — icon block + cart */}
              <View style={[s.headerRow, { flexDirection: flexRow(IS_RTL) }]}>

                {/* Leading: icon tile + title stack */}
                <View style={[s.headerLeft, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={s.headerIconTile}>
                    <Ionicons name="grid" size={20} color={kit.color.accentDeep} />
                  </View>
                  <View>
                    <UIText style={s.headerEyebrow}>
                      {IS_RTL ? "استكشف" : "Browse"}
                    </UIText>
                    <UIText style={s.headerTitle}>
                      {IS_RTL ? "الأقسام" : t("products.title")}
                    </UIText>
                    <UIText style={s.headerMeta}>
                      {catsLoading
                        ? (IS_RTL ? "جارٍ التحميل…" : t("common.loading"))
                        : (IS_RTL
                          ? `${categories.length} قسم · 5000+ منتج`
                          : t("products.categoriesCount", { count: categories.length }))}
                    </UIText>
                  </View>
                </View>

                {/* Trailing: cart */}
                <Pressable
                  onPress={goCart}
                  accessibilityRole="button"
                  accessibilityLabel={cartCount > 0 ? `${t("tabs.cart")}, ${cartCount}` : t("tabs.cart")}
                  style={s.cartBtn}
                >
                  <Ionicons name="bag-outline" size={19} color={kit.color.inkSoft} />
                  {cartCount > 0 && (
                    <View style={s.cartBadge}>
                      <UIText style={s.cartBadgeText}>{cartCount > 9 ? "9+" : cartCount}</UIText>
                    </View>
                  )}
                </Pressable>
              </View>

              {/* Search bar */}
              <Pressable
                onPress={goSearch}
                accessibilityRole="button"
                accessibilityLabel={t("search.placeholder")}
                style={[s.searchBar, { flexDirection: flexRow(IS_RTL) }]}
              >
                <View style={s.searchIconWell}>
                  <Ionicons name="search" size={16} color={kit.color.accentDeep} />
                </View>
                <UIText style={[s.searchHint, { textAlign: TEXT_START }]}>
                  {IS_RTL ? "ابحث عن دواء أو منتج…" : t("search.placeholder")}
                </UIText>
                <View style={s.searchKbd}>
                  <UIText style={s.searchKbdText}>
                    {IS_RTL ? "بحث" : t("tabs.search")}
                  </UIText>
                </View>
              </Pressable>
            </View>

            {/* ════════════════════════════════════════════════ */}
            {/* STATS STRIP                                     */}
            {/* ════════════════════════════════════════════════ */}
            <StatsStrip catCount={categories.length} />

            {/* ════════════════════════════════════════════════ */}
            {/* CATEGORIES SECTION                              */}
            {/* ════════════════════════════════════════════════ */}
            <View style={s.sectionHead}>
              <HomeSectionHeader
                eyebrow={IS_RTL ? "استكشف الأقسام" : "Browse categories"}
                title={IS_RTL ? "جميع الأقسام" : t("search.categoriesTitle")}
                icon="grid-outline"
              />
            </View>

            {catsLoading ? (
              <GridSkeleton />
            ) : isError ? (
              <EmptyState
                icon="wifi-outline"
                title={t("errors.network").split(".")[0]}
                description={t("errors.network")}
                actionLabel={t("common.retry")}
                onAction={() => refetch()}
              />
            ) : categories.length === 0 ? (
              <EmptyState
                icon="grid-outline"
                title={t("products.noProducts")}
                description={t("products.loading")}
              />
            ) : (
              <View style={s.grid}>
                {categories.map((item, index) => (
                  <View key={item.id} style={s.cell}>
                    <CategoryCard
                      category={item}
                      gradientIdx={index}
                      lang={lang}
                      variant="grid"
                      onPress={() => goCategory(item)}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* ════════════════════════════════════════════════ */}
            {/* FEATURED PRODUCTS                               */}
            {/* ════════════════════════════════════════════════ */}
            {!featLoading && featured.length > 0 && (
              <View style={s.featBlock}>
                <View style={s.sectionHead}>
                  <HomeSectionHeader
                    eyebrow={IS_RTL ? "مختارات المحرر" : t("home.featuredEyebrow")}
                    title={IS_RTL ? "منتجات مميزة" : t("home.featuredTitle")}
                    icon="star-outline"
                    accent={kit.color.warn}
                    onMore={goFeatured}
                  />
                </View>
                <FlatList
                  data={featured.slice(0, 8)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={FEAT_LIST_STYLE}
                  keyExtractor={(p) => p.id}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  renderItem={renderFeatured}
                />
              </View>
            )}
          </>
        }
      />
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
    paddingHorizontal: GRID_PAD,
    paddingBottom:     18,
    gap:               16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  headerRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    alignItems: "center",
    gap:        14,
    flex:       1,
  },
  headerIconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.accentDeep + "22",
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  headerEyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.7,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         34,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    textAlign:          TEXT_START,
    includeFontPadding: false,
    marginTop:          1,
  },
  headerMeta: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
    marginTop:          2,
  },
  cartBtn: {
    position:        "relative",
    width:           46,
    height:          46,
    borderRadius:    15,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  cartBadge: {
    position:          "absolute",
    top:               -4,
    ...(IS_RTL ? { left: -4 } : { right: -4 }),
    minWidth:          18,
    height:            18,
    paddingHorizontal: 4,
    borderRadius:      9,
    backgroundColor:   kit.color.danger,
    borderWidth:       2,
    borderColor:       kit.color.surface,
    alignItems:        "center",
    justifyContent:    "center",
  },
  cartBadgeText: {
    fontFamily:         theme.fonts.black,
    color:              "#fff",
    fontSize:           9,
    lineHeight:         9,
    includeFontPadding: false,
    textAlign:          "center",
  },

  // ── Search bar
  searchBar: {
    alignItems:        "center",
    gap:               10,
    backgroundColor:   kit.color.well,
    borderRadius:      kit.radius.xl,
    paddingHorizontal: 14,
    paddingVertical:   14,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  searchIconWell: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  searchHint: {
    fontFamily:         theme.fonts.regular,
    flex:               1,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  searchKbd: {
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.md,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  searchKbdText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },

  // ── Section heading wrapper
  sectionHead: {
    paddingHorizontal: GRID_PAD,
    marginTop:         30,
    marginBottom:      16,
  },

  // ── Category grid
  grid: {
    flexDirection:     flexRow(IS_RTL),
    flexWrap:          "wrap",
    gap:               GRID_GAP,
    paddingHorizontal: GRID_PAD,
  },
  cell: {
    width: CELL_W,
  },

  // ── Featured
  featBlock: {
    marginTop:    8,
    marginBottom: 8,
  },
});

// ── Stats strip styles
const st = StyleSheet.create({
  row: {
    marginTop:         20,
    marginHorizontal:  GRID_PAD,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    overflow:          "hidden",
    ...kit.shadow.raised,
  },
  item: {
    flex:           1,
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    gap:            8,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  itemBorderLeft: {
    borderLeftWidth:  StyleSheet.hairlineWidth,
    borderLeftColor:  kit.color.line,
  },
  itemBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: kit.color.line,
  },
  icon: {
    width:          28,
    height:         28,
    borderRadius:   9,
    alignItems:     "center",
    justifyContent: "center",
  },
  textCol: {
    gap: 1,
  },
  value: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    lineHeight:         18,
    includeFontPadding: false,
  },
  label: {
    fontFamily:         theme.fonts.regular,
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
});

// ── Grid skeleton styles
const sk = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
  },
  stripe: {
    height:          5,
    backgroundColor: kit.color.well,
  },
  body: {
    padding: 16,
    gap:     10,
  },
  icon: {
    width:           58,
    height:          58,
    borderRadius:    18,
    backgroundColor: kit.color.well,
  },
  line: {
    height:          11,
    borderRadius:    6,
    backgroundColor: kit.color.well,
  },
  lineShort: {
    width: "60%",
  },
});
