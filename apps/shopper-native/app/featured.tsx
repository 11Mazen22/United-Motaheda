/**
 * FeaturedScreen — editorial picks, complete redesign 2026.
 * Data: get_featured_products RPC → is_new | is_bestseller | is_sale.
 */

import React, {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { fetchFeaturedProducts } from "@/features/products";
import { ProductGrid } from "@/features/products";
import type { NativeProduct } from "@/features/products";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL = isRtl();
const TA     = textAlignStart(IS_RTL) as "left" | "right";

type Tab = "all" | "new" | "bestseller" | "sale";

const TABS: {
  key:   Tab;
  label: string;
  icon:  React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}[] = [
  { key: "all",        label: "الكل",    icon: "apps-outline",        color: kit.color.ink        },
  { key: "new",        label: "جديد",    icon: "sparkles-outline",    color: kit.color.accentDeep },
  { key: "bestseller", label: "الأكثر",  icon: "trending-up-outline", color: "#D97706"            },
  { key: "sale",       label: "تخفيض",   icon: "pricetag-outline",    color: kit.color.danger     },
];

// ─── Tab pill ──────────────────────────────────────────────────────────────────

const TabPill = React.memo(function TabPill({
  tab, active, count, onPress,
}: {
  tab:     typeof TABS[number];
  active:  boolean;
  count:   number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.94, { damping: 12 });
    setTimeout(() => { scale.value = withSpring(1, { damping: 14 }); }, 80);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress, scale]);

  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[
          f.tab,
          { flexDirection: flexRow(IS_RTL) },
          active && { backgroundColor: kit.color.accentDeep, borderColor: kit.color.accentDeep },
        ]}>
        <Ionicons
          name={tab.icon}
          size={13}
          color={active ? kit.color.onInk : kit.color.inkSoft}
        />
        <UIText style={[f.tabText, active && f.tabTextActive]}>{tab.label}</UIText>
        {count > 0 && (
          <View style={[f.tabBadge, active && f.tabBadgeActive]}>
            <UIText style={[f.tabBadgeText, active && f.tabBadgeTextActive]}>
              {count}
            </UIText>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

// ─── Category chip ─────────────────────────────────────────────────────────────

const CatChip = React.memo(function CatChip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[f.catChip, active && f.catChipActive]}>
      <UIText style={[f.catChipText, active && f.catChipTextActive]} numberOfLines={1}>
        {label}
      </UIText>
    </Pressable>
  );
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function FeaturedScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const lang        = i18n.language === "en" ? "en" as const : "ar" as const;
  const router      = useRouter();
  const insets      = useSafeAreaInsets();

  const [query,       setQuery]       = useState("");
  const [activeTab,   setActiveTab]   = useState<Tab>("all");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const {
    data: allFeatured = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey:  ["featured-all"],
    queryFn:   () => fetchFeaturedProducts(200),
    staleTime: 5 * 60_000,
  });

  const stats = useMemo(() => ({
    newCount:        allFeatured.filter((p) => p.isNew).length,
    bestsellerCount: allFeatured.filter((p) => p.isBestseller).length,
    saleCount:       allFeatured.filter((p) => p.isSale).length,
  }), [allFeatured]);

  const tabCounts: Record<Tab, number> = useMemo(() => ({
    all:        allFeatured.length,
    new:        stats.newCount,
    bestseller: stats.bestsellerCount,
    sale:       stats.saleCount,
  }), [allFeatured.length, stats]);

  const filtered = useMemo(() => {
    let list = allFeatured;
    if (activeTab === "new")        list = list.filter((p) => p.isNew);
    if (activeTab === "bestseller") list = list.filter((p) => p.isBestseller);
    if (activeTab === "sale")       list = list.filter((p) => p.isSale);
    if (selectedCat) {
      list = list.filter(
        (p) => p.categoryName === selectedCat || p.categoryNameEn === selectedCat,
      );
    }
    if (deferredQuery.length >= 2) {
      list = list.filter(
        (p) =>
          p.nameAr?.toLowerCase().includes(deferredQuery) ||
          p.nameEn?.toLowerCase().includes(deferredQuery) ||
          p.name?.toLowerCase().includes(deferredQuery)   ||
          p.categoryName?.toLowerCase().includes(deferredQuery),
      );
    }
    return list;
  }, [allFeatured, activeTab, selectedCat, deferredQuery]);

  const categories = useMemo(() => {
    const base =
      activeTab === "new"         ? allFeatured.filter((p) => p.isNew)
      : activeTab === "bestseller"? allFeatured.filter((p) => p.isBestseller)
      : activeTab === "sale"      ? allFeatured.filter((p) => p.isSale)
      : allFeatured;

    const seen = new Set<string>();
    const cats: string[] = [];
    for (const p of base) {
      const name = lang === "en" ? (p.categoryNameEn ?? p.categoryName) : p.categoryName;
      if (name && !seen.has(p.categoryName)) {
        seen.add(p.categoryName);
        cats.push(name);
      }
    }
    return cats;
  }, [allFeatured, activeTab, lang]);

  const handleProductPress = useCallback(
    (p: NativeProduct) => {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      router.push({ pathname: "/product/[id]", params: { id: p.id } });
    },
    [router],
  );

  // ── List header ──────────────────────────────────────────────────────────────
  const ListHeader = useMemo(() => (
    <>
      {/* ── Hero ── */}
      <View style={[f.hero, { paddingTop: insets.top + 14 }]}>
        {/* Nav row */}
        <View style={[f.navRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={f.backBtn}>
            <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
          </Pressable>

          {/* Star badge */}
          <View style={f.starBadge}>
            <Ionicons name="star" size={18} color="#D97706" />
          </View>
        </View>

        {/* Title block */}
        <View style={f.titleBlock}>
          <UIText style={[f.eyebrow, { textAlign: TA }]}>
            {t("home.featuredEyebrow")}
          </UIText>
          <UIText style={[f.heroTitle, { textAlign: TA }]}>
            {t("home.featuredTitle")}
          </UIText>
        </View>

        {/* Stat pills — only when there IS data */}
        {allFeatured.length > 0 && (
          <View style={[f.statRow, { flexDirection: flexRow(IS_RTL) }]}>
            {stats.newCount > 0 && (
              <View style={[f.statPill, { backgroundColor: kit.color.accentTint }]}>
                <Ionicons name="sparkles-outline" size={11} color={kit.color.accentDeep} />
                <UIText style={[f.statText, { color: kit.color.accentDeep }]}>
                  {stats.newCount} {t("products.badgeNew")}
                </UIText>
              </View>
            )}
            {stats.bestsellerCount > 0 && (
              <View style={[f.statPill, { backgroundColor: "#FFFBEB" }]}>
                <Ionicons name="trending-up-outline" size={11} color="#D97706" />
                <UIText style={[f.statText, { color: "#B45309" }]}>
                  {stats.bestsellerCount} {t("products.badgeBestSeller")}
                </UIText>
              </View>
            )}
            {stats.saleCount > 0 && (
              <View style={[f.statPill, { backgroundColor: kit.color.dangerTint }]}>
                <Ionicons name="pricetag-outline" size={11} color={kit.color.danger} />
                <UIText style={[f.statText, { color: kit.color.danger }]}>
                  {stats.saleCount} {t("products.badgeSale", { n: "" }).replace("%", "").trim()}
                </UIText>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Search ── */}
      <View style={f.searchWrap}>
        <View style={[f.searchBar, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="search-outline" size={17} color={kit.color.inkFaint} />
          <TextInput
            style={[f.searchInput, { textAlign: TA }]}
            placeholder={t("search.placeholder")}
            placeholderTextColor={kit.color.inkFaint}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={kit.color.accentDeep}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8} style={f.searchClear}>
              <Ionicons name="close" size={13} color={kit.color.inkSoft} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[f.tabsContent, { flexDirection: flexRow(IS_RTL) }]}>
        {TABS.map((tab) => (
          <TabPill
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            count={tabCounts[tab.key]}
            onPress={() => { setActiveTab(tab.key); setSelectedCat(null); }}
          />
        ))}
      </ScrollView>

      {/* ── Category chips ── */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[f.catsContent, { flexDirection: flexRow(IS_RTL) }]}>
          <CatChip
            label={t("products.allProducts")}
            active={selectedCat === null}
            onPress={() => setSelectedCat(null)}
          />
          {categories.map((cat) => (
            <CatChip
              key={cat}
              label={cat}
              active={selectedCat === cat}
              onPress={() => setSelectedCat((p) => p === cat ? null : cat)}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Result count ── */}
      {allFeatured.length > 0 && (
        <View style={[f.countRow, { flexDirection: flexRow(IS_RTL) }]}>
          <UIText style={f.countText}>
            {filtered.length.toLocaleString()} {t("search.resultCount", { count: filtered.length }).replace(/\d+/, "").trim() || "نتيجة"}
          </UIText>
        </View>
      )}
    </>
  ), [
    insets.top, t, router, query, activeTab, selectedCat,
    stats, tabCounts, categories, filtered.length, allFeatured.length,
  ]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={f.screen}>
        <View style={[f.hero, { paddingTop: insets.top + 14 }]}>
          <View style={[f.navRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Pressable onPress={() => router.back()} style={f.backBtn}>
              <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
            </Pressable>
            <View style={f.starBadge}>
              <Ionicons name="star" size={18} color="#D97706" />
            </View>
          </View>
          <View style={f.titleBlock}>
            <UIText style={[f.eyebrow, { textAlign: TA }]}>{t("home.featuredEyebrow")}</UIText>
            <UIText style={[f.heroTitle, { textAlign: TA }]}>{t("home.featuredTitle")}</UIText>
          </View>
        </View>
        <View style={[f.skeletonGrid, { flexDirection: flexRow(IS_RTL) }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={f.skeletonCell}><ProductCardSkeleton /></View>
          ))}
        </View>
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <View style={f.screen}>
        <View style={[f.hero, { paddingTop: insets.top + 14 }]}>
          <View style={[f.navRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Pressable onPress={() => router.back()} style={f.backBtn}>
              <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
            </Pressable>
          </View>
          <UIText style={[f.heroTitle, { textAlign: TA }]}>{t("home.featuredTitle")}</UIText>
        </View>
        <View style={f.centered}>
          <View style={f.emptyIconWrap}>
            <Ionicons name="cloud-offline-outline" size={30} color={kit.color.inkFaint} />
          </View>
          <UIText style={f.emptyTitle}>{t("errors.network")}</UIText>
          <Pressable onPress={() => void refetch()} style={f.emptyBtn}>
            <Ionicons name="refresh-outline" size={15} color={kit.color.onInk} />
            <UIText style={f.emptyBtnText}>{t("common.retry")}</UIText>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────────
  return (
    <View style={f.screen}>
      <View style={f.listWrap}>
        <ProductGrid
          products={filtered}
          lang={lang}
          onProductPress={handleProductPress}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={<View style={{ height: insets.bottom + 40 }} />}
          ListEmptyComponent={
            allFeatured.length === 0 ? (
              /* ── Zero featured products in DB ── */
              <View style={f.centered}>
                <View style={f.emptyStarWrap}>
                  <Ionicons name="star" size={36} color="#D97706" />
                </View>
                <UIText style={f.emptyTitle}>{t("home.featuredEmptyTitle")}</UIText>
                <UIText style={f.emptyBody}>{t("home.featuredEmptyBody")}</UIText>
                <View style={[f.emptyActions, { flexDirection: flexRow(IS_RTL) }]}>
                  <Pressable
                    onPress={() => router.replace("/(tabs)/products")}
                    style={[f.emptyBtn, { flex: 1 }]}>
                    <Ionicons name="grid-outline" size={15} color={kit.color.onInk} />
                    <UIText style={f.emptyBtnText}>{t("home.featuredEmptyCta")}</UIText>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* ── No results for current filter/search ── */
              <View style={f.centered}>
                <View style={f.emptyIconWrap}>
                  <Ionicons name="search-outline" size={26} color={kit.color.inkFaint} />
                </View>
                <UIText style={f.emptyTitle}>{t("search.noResults")}</UIText>
                {query.length > 0 && (
                  <Pressable
                    onPress={() => setQuery("")}
                    style={[f.emptyBtn, { backgroundColor: kit.color.well }]}>
                    <UIText style={[f.emptyBtnText, { color: kit.color.inkSoft }]}>
                      {t("search.clearRecents")}
                    </UIText>
                  </Pressable>
                )}
              </View>
            )
          }
          refreshing={false}
          onRefresh={() => void refetch()}
          contentContainerStyle={{ padding: 12 }}
        />
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const f = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: kit.color.canvas },
  listWrap: { flex: 1 },

  // ── Hero ─────────────────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  navRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  starBadge: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: "#FFFBEB",
    borderWidth:     1,
    borderColor:     "rgba(217,119,6,0.22)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  titleBlock: {
    gap: 4,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      1.2,
    includeFontPadding: false,
  },
  heroTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           30,
    lineHeight:         38,
    color:              kit.color.ink,
    letterSpacing:      -0.8,
    includeFontPadding: false,
  },

  // Stat pills
  statRow: {
    flexWrap:  "wrap",
    gap:       8,
  },
  statPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      kit.radius.pill,
  },
  statText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    includeFontPadding: false,
  },

  // ── Search ───────────────────────────────────────────────────────────────────
  searchWrap: {
    paddingHorizontal: 20,
    paddingVertical:   12,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  searchBar: {
    alignItems:        "center",
    gap:               10,
    backgroundColor:   kit.color.canvas,
    borderRadius:      14,
    paddingHorizontal: 14,
    height:            46,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  searchInput: {
    flex:               1,
    fontSize:           14,
    fontFamily:         theme.fonts.semibold,
    color:              kit.color.ink,
    paddingVertical:    0,
    includeFontPadding: false,
  } as any,
  searchClear: {
    width:           26,
    height:          26,
    borderRadius:    13,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  tabsContent: {
    paddingHorizontal: 20,
    paddingVertical:   12,
    gap:               8,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  tab: {
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  tabText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  tabTextActive: {
    fontFamily: theme.fonts.black,
    color:      kit.color.onInk,
  },
  tabBadge: {
    minWidth:          18,
    height:            18,
    borderRadius:      9,
    backgroundColor:   kit.color.line,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  tabBadgeText: {
    fontFamily:         theme.fonts.black,
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  tabBadgeTextActive: {
    color: kit.color.onInk,
  },

  // ── Category chips ────────────────────────────────────────────────────────────
  catsContent: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    gap:               8,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  catChipActive:     { backgroundColor: kit.color.accentDeep, borderColor: kit.color.accentDeep },
  catChipText:       { fontFamily: theme.fonts.semibold, fontSize: 12, color: kit.color.inkSoft, includeFontPadding: false },
  catChipTextActive: { fontFamily: theme.fonts.black, fontSize: 12, color: kit.color.onInk, includeFontPadding: false },

  // ── Count row ─────────────────────────────────────────────────────────────────
  countRow: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    alignItems:        "center",
    gap:               6,
  },
  countText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Empty / error ─────────────────────────────────────────────────────────────
  centered: {
    alignItems:        "center",
    paddingHorizontal: 32,
    paddingTop:        56,
    gap:               14,
  },
  emptyIconWrap: {
    width:           72,
    height:          72,
    borderRadius:    24,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  emptyStarWrap: {
    width:           80,
    height:          80,
    borderRadius:    28,
    backgroundColor: "#FFFBEB",
    borderWidth:     1,
    borderColor:     "rgba(217,119,6,0.22)",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  emptyTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    lineHeight:         26,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  emptyBody: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    maxWidth:           260,
    includeFontPadding: false,
  },
  emptyActions: {
    gap:       10,
    marginTop: 4,
    width:     "100%",
  },
  emptyBtn: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "center",
    gap:               7,
    paddingHorizontal: 20,
    paddingVertical:   13,
    borderRadius:      14,
    backgroundColor:   kit.color.accentDeep,
  },
  emptyBtnText: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.onInk,
    includeFontPadding: false,
  },

  // ── Skeleton ──────────────────────────────────────────────────────────────────
  skeletonGrid: {
    flexWrap: "wrap",
    padding:  12,
    gap:      12,
  },
  skeletonCell: { width: "47%" as any },
});
