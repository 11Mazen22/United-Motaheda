import React, { useCallback } from "react";
import { useDarkColors } from '@/hooks/useDarkColors';
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
import { EmptyState } from "@/components/ui/EmptyState";
import { Text as UIText } from "@pharmacy/ui-native";
import { useCartStore } from "@/stores/cart";
import { useMountTiming } from "@/lib/devTiming";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { HomeSectionHeader } from "@/features/home/components/HomeSectionHeader";
import { useTranslation } from "react-i18next";
import { useScreenLayout } from "@/utils/responsive";
import { useTabSwipeGesture } from "@/shared/navigation/useTabSwipeGesture";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const GRID_GAP = 12;
// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({ catCount, loading }: { catCount: number; loading: boolean }) {
  const { c } = useDarkColors();

  const { t }       = useTranslation();
  const { pagePad } = useScreenLayout();
  const items = [
    { icon: "grid-outline"             as const, value: "",      label: t("products.statCategories"), color: c.accentDeep, tint: c.accentTint  },
    { icon: "cube-outline"             as const, value: "5000+", label: t("products.statItems"),      color: c.success,    tint: c.successTint },
    { icon: "flash-outline"            as const, value: IS_RTL ? "30د" : "30min", label: t("products.statFastLabel"), color: c.warn, tint: c.warnTint },
    { icon: "shield-checkmark-outline" as const, value: "100%",  label: t("products.statOriginalLabel"), color: "#7c3aed",         tint: "#f5f3ff"             },
  ];
  return (
    <View style={[st.row, { flexDirection: flexRow(IS_RTL), marginHorizontal: pagePad }]}>
      {items.map((item, i) => (
        <View key={i} style={[st.item, i > 0 && (IS_RTL ? st.itemBorderRight : st.itemBorderLeft)]}>
          <View style={[st.icon, { backgroundColor: item.tint }]}>
            <Ionicons name={item.icon} size={13} color={item.color} />
          </View>
          <View style={st.textCol}>
            <UIText style={[st.value, { color: item.color, textAlign: TEXT_START }]}>
              {i === 0 ? (loading ? "–" : String(catCount)) : item.value}
            </UIText>
            <UIText style={[st.label, { textAlign: TEXT_START }]}>{item.label}</UIText>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Grid skeleton ────────────────────────────────────────────────────────────

const SKELETON_CELL = { flex: 1, minWidth: "30%" as const, padding: 4 };

function GridSkeleton() {
  const { c } = useDarkColors();

  return (
    <View style={s.grid}>
      {Array(6).fill(null).map((_, i) => (
        <View key={i} style={SKELETON_CELL}>
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
  const { c } = useDarkColors();

  useMountTiming("ProductsScreen");
  const { gesture, animatedStyle } = useTabSwipeGesture("products");
  const { t, i18n } = useTranslation();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.itemCount());
  const lang      = i18n.language === "en" ? "en" as const : "ar" as const;

  // Responsive grid — category cards cap at 3 cols (wider aspect ratio than products)
  const { pagePad, numColumns, width } = useScreenLayout();
  const catCols = Math.min(numColumns, 3);
  const cellW   = Math.floor((width - pagePad * 2 - GRID_GAP * (catCols - 1)) / catCols);

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

  // Memoised navigation handlers — stable references prevent FlatList renderItem
  // from re-running on every parent render
  const goSearch   = useCallback(() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); router.push("/(tabs)/search");  }, [router]);
  const goCart     = useCallback(() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); router.push("/(tabs)/cart");     }, [router]);
  const goCategory = useCallback(
    (item: { id: string; nameEn?: string; name: string }) =>
      router.push({ pathname: "/category/[id]", params: { id: item.id, nameEn: item.nameEn ?? "", name: item.name ?? "" } }),
    [router],
  );
  return (
    <GestureDetector gesture={gesture}>
    <Animated.View style={[s.root, animatedStyle]}>
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
            <View style={[s.header, { paddingTop: insets.top + 14, paddingHorizontal: pagePad }]}>

              {/* Top row — icon block + cart */}
              <View style={[s.headerRow, { flexDirection: flexRow(IS_RTL) }]}>

                {/* Leading: icon tile + title stack */}
                <View style={[s.headerLeft, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={s.headerIconTile}>
                    <Ionicons name="grid" size={20} color={c.accentDeep} />
                  </View>
                  <View>
                    <UIText style={s.headerEyebrow}>
                      {t("products.headerEyebrow")}
                    </UIText>
                    <UIText style={s.headerTitle}>
                      {t("products.title")}
                    </UIText>
                    <UIText style={s.headerMeta}>
                      {catsLoading
                        ? t("common.loading")
                        : t("products.headerMeta", { count: categories.length })}
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
                  <Ionicons name="bag-outline" size={19} color={c.inkSoft} />
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
                  <Ionicons name="search" size={16} color={c.accentDeep} />
                </View>
                <UIText style={[s.searchHint, { textAlign: TEXT_START }]}>
                  {t("search.placeholder")}
                </UIText>
                <View style={s.searchKbd}>
                  <UIText style={s.searchKbdText}>
                    {t("tabs.search")}
                  </UIText>
                </View>
              </Pressable>
            </View>

            {/* ════════════════════════════════════════════════ */}
            {/* STATS STRIP                                     */}
            {/* ════════════════════════════════════════════════ */}
            <StatsStrip catCount={categories.length} loading={catsLoading} />

            {/* ════════════════════════════════════════════════ */}
            {/* CATEGORIES SECTION                              */}
            {/* ════════════════════════════════════════════════ */}
            <View style={[s.sectionHead, { paddingHorizontal: pagePad }]}>
              <HomeSectionHeader
                eyebrow={t("products.sectionEyebrow")}
                title={t("products.sectionTitle")}
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
                description={t("products.noCategoriesDescription")}
              />
            ) : (
              <View style={[s.grid, { paddingHorizontal: pagePad }]}>
                {categories.map((item, index) => (
                  <View key={item.id} style={{ width: cellW }}>
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

          </>
        }
      />
    </Animated.View>
    </GestureDetector>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: c.canvas,
  },

  // ── Header (paddingHorizontal applied inline via pagePad)
  header: {
    backgroundColor: c.surface,
    paddingBottom:   18,
    gap:               16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
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
    backgroundColor: c.accentTint,
    borderWidth:     1,
    borderColor:     c.accentDeep + "22",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    ...kit.shadow.raised,
  },
  headerEyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              c.accentDeep,
    letterSpacing:      0.7,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         34,
    color:              c.ink,
    letterSpacing:      -0.6,
    textAlign:          TEXT_START,
    includeFontPadding: false,
    marginTop:          1,
  },
  headerMeta: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         17,
    color:              c.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
    marginTop:          2,
  },
  cartBtn: {
    position:        "relative",
    width:           46,
    height:          46,
    borderRadius:    15,
    backgroundColor: c.well,
    borderWidth:     1,
    borderColor:     c.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  cartBadge: {
    position:          "absolute",
    top:               -4,
    ...(IS_RTL ? { start: -4 } : { end: -4 }),
    minWidth:          18,
    height:            18,
    paddingHorizontal: 4,
    borderRadius:      9,
    backgroundColor:   c.danger,
    borderWidth:       2,
    borderColor:       c.surface,
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
    backgroundColor:   c.well,
    borderRadius:      kit.radius.xl,
    paddingHorizontal: 14,
    paddingVertical:   14,
    borderWidth:       1,
    borderColor:       c.line,
  },
  searchIconWell: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: c.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  searchHint: {
    fontFamily:         theme.fonts.regular,
    flex:               1,
    fontSize:           14,
    lineHeight:         20,
    color:              c.inkFaint,
    includeFontPadding: false,
  },
  searchKbd: {
    backgroundColor:   c.surface,
    borderRadius:      kit.radius.md,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       c.line,
    ...kit.shadow.raised,
  },
  searchKbdText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           10,
    lineHeight:         14,
    color:              c.inkSoft,
    includeFontPadding: false,
  },

  // ── Section heading wrapper (paddingHorizontal applied inline via pagePad)
  sectionHead: {
    marginTop:    30,
    marginBottom: 16,
  },

  // ── Category grid (paddingHorizontal applied inline via pagePad)
  grid: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    gap:           GRID_GAP,
  },
});

// ── Stats strip styles
const st = StyleSheet.create({
  row: {
    marginTop:       20,
    backgroundColor: c.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       c.line,
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
    borderStartWidth:  StyleSheet.hairlineWidth,
    borderLeftColor:  c.line,
  },
  itemBorderRight: {
    borderEndWidth: StyleSheet.hairlineWidth,
    borderRightColor: c.line,
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
    color:              c.inkFaint,
    includeFontPadding: false,
  },
});

// ── Grid skeleton styles
const sk = StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     c.line,
    overflow:        "hidden",
  },
  stripe: {
    height:          5,
    backgroundColor: c.well,
  },
  body: {
    padding: 16,
    gap:     10,
  },
  icon: {
    width:           58,
    height:          58,
    borderRadius:    18,
    backgroundColor: c.well,
  },
  line: {
    height:          11,
    borderRadius:    6,
    backgroundColor: c.well,
  },
  lineShort: {
    width: "60%",
  },
});
