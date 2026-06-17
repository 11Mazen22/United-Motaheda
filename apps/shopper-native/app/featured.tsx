/**
 * FeaturedScreen — Editor's Picks, real data only.
 *
 * Data source: `get_featured_products` RPC → products flagged
 * `is_new=true OR is_bestseller=true OR is_sale=true` in the database.
 * NEVER dumps all products — if nothing is marked featured the page
 * shows a proper empty state.
 *
 * Search: client-side (200-product cap) — fast, no extra round-trips.
 * Tabs:   All · New · Bestseller · Sale
 * Filter: category rail derived from the actual featured set.
 *
 * VIP Phase 2: LinearGradient hero → flat kit.color.surface header in ListHeader.
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

// Amber brand palette — no kit token for raw amber hues
const AMBER = {
  base: "#D97706",
  deep: "#B45309",
  soft: "#FBBF24",
  tint: "#FFFBEB",
  line: "rgba(217,119,6,0.22)",
} as const;

type Tab = "all" | "new" | "bestseller" | "sale";

const TABS: { key: Tab; labelKey: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "all",        labelKey: "products.allProducts",    icon: "apps-outline"          },
  { key: "new",        labelKey: "products.badgeNew",       icon: "sparkles-outline"      },
  { key: "bestseller", labelKey: "products.badgeBestSeller",icon: "trending-up-outline"   },
  { key: "sale",       labelKey: "products.badgeSale",      icon: "pricetag-outline"      },
];

// ─── TabPill ───────────────────────────────────────────────────────────────────

const TabPill = React.memo(function TabPill({
  label, icon, active, onPress,
}: { label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; active: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = useCallback(() => {
    scale.value = withSpring(0.93, theme.animation.spring.press);
    setTimeout(() => { scale.value = withSpring(1, theme.animation.spring.press); }, 80);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress, scale]);

  return (
    <Animated.View style={anim}>
      <Pressable onPress={handlePress} style={[f.tab, active && f.tabActive]}>
        <Ionicons
          name={icon}
          size={13}
          color={active ? "#fff" : kit.color.inkSoft}
        />
        <UIText style={[f.tabText, active && f.tabTextActive]} numberOfLines={1}>
          {label}
        </UIText>
      </Pressable>
    </Animated.View>
  );
});

// ─── CatChip ───────────────────────────────────────────────────────────────────

const CatChip = React.memo(function CatChip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[f.catChip, active && f.catChipActive]}>
      <UIText style={[f.catChipText, active && f.catChipTextActive]} numberOfLines={1}>
        {label}
      </UIText>
    </Pressable>
  );
});

// ─── StatBadge ─────────────────────────────────────────────────────────────────

function StatBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[f.stat, { borderColor: color + "30", backgroundColor: color + "15" }]}>
      <UIText style={[f.statNum, { color }]}>{count}</UIText>
      <UIText style={[f.statLbl, { color: color + "CC" }]}>{label}</UIText>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function FeaturedScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const lang        = i18n.language === "en" ? "en" as const : "ar" as const;
  const router      = useRouter();
  const insets      = useSafeAreaInsets();

  const [query,       setQuery]       = useState("");
  const [activeTab,   setActiveTab]   = useState<Tab>("all");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Defer the query for smoother typing — expensive filter runs off the render path
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  // ── Real featured products from the DB ────────────────────────────────────
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

  // ── Stats from the full set ───────────────────────────────────────────────
  const stats = useMemo(() => ({
    newCount:        allFeatured.filter((p) => p.isNew).length,
    bestsellerCount: allFeatured.filter((p) => p.isBestseller).length,
    saleCount:       allFeatured.filter((p) => p.isSale).length,
  }), [allFeatured]);

  // ── Filtered product list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allFeatured;

    // Tab filter
    if (activeTab === "new")        list = list.filter((p) => p.isNew);
    if (activeTab === "bestseller") list = list.filter((p) => p.isBestseller);
    if (activeTab === "sale")       list = list.filter((p) => p.isSale);

    // Category filter
    if (selectedCat) {
      list = list.filter(
        (p) => p.categoryName === selectedCat || p.categoryNameEn === selectedCat,
      );
    }

    // Text search — Arabic + English name
    if (deferredQuery.length >= 2) {
      list = list.filter(
        (p) =>
          p.nameAr?.toLowerCase().includes(deferredQuery) ||
          p.nameEn?.toLowerCase().includes(deferredQuery) ||
          p.name?.toLowerCase().includes(deferredQuery)  ||
          p.categoryName?.toLowerCase().includes(deferredQuery),
      );
    }

    return list;
  }, [allFeatured, activeTab, selectedCat, deferredQuery]);

  // ── Category chips derived from the current filtered base ────────────────
  const categories = useMemo(() => {
    const base = activeTab === "all" ? allFeatured
      : activeTab === "new"         ? allFeatured.filter((p) => p.isNew)
      : activeTab === "bestseller"  ? allFeatured.filter((p) => p.isBestseller)
      :                               allFeatured.filter((p) => p.isSale);

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

  // ── Header + search + tabs (memoised — heavy subview) ────────────────────
  const ListHeader = useMemo(() => (
    <>
      {/* ── VIP flat hero (replaces dark amber LinearGradient) ── */}
      <View style={[f.hero, { paddingTop: insets.top + 14 }]}>

        {/* Top bar */}
        <View style={[f.topBar, { flexDirection: flexRow(isRtl()) }]}>
          <Pressable onPress={() => router.back()} style={f.backBtn} accessibilityRole="button">
            <Ionicons name={BACK_CHEVRON} size={17} color={kit.color.inkSoft} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <UIText style={[f.eyebrow, { textAlign: textAlignStart(isRtl()) }]}>{t("home.featuredEyebrow")}</UIText>
            <UIText style={[f.heroTitle, { textAlign: textAlignStart(isRtl()) }]}>{t("home.featuredTitle")}</UIText>
          </View>
          <View style={f.starTile}>
            <Ionicons name="star" size={22} color={AMBER.base} />
          </View>
        </View>

        {/* Stats row */}
        <View style={[f.statsRow, { flexDirection: flexRow(isRtl()) }]}>
          <StatBadge count={stats.newCount}        label={t("products.badgeNew")}        color={kit.color.accent}  />
          <StatBadge count={stats.bestsellerCount} label={t("products.badgeBestSeller")} color={AMBER.base}        />
          <StatBadge count={stats.saleCount}       label={t("products.badgeSale", { n: "" }).replace("%", "").trim()} color={kit.color.danger} />
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={f.searchWrap}>
        <View style={[f.searchBar, { flexDirection: flexRow(isRtl()) }]}>
          <Ionicons name="search" size={16} color={kit.color.inkFaint} />
          <TextInput
            style={[f.searchInput, { textAlign: textAlignStart(isRtl()) as "left" | "right" }]}
            placeholder={t("search.placeholder")}
            placeholderTextColor={kit.color.inkFaint}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={AMBER.base}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8} style={f.searchClear}>
              <Ionicons name="close-circle" size={16} color={kit.color.inkFaint} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[f.tabsContent, { flexDirection: flexRow(isRtl()) }]}>
        {TABS.map((tab) => (
          <TabPill
            key={tab.key}
            label={tab.key === "sale"
              ? t("products.badgeSale", { n: "" }).replace("%", "").trim()
              : t(tab.labelKey)}
            icon={tab.icon}
            active={activeTab === tab.key}
            onPress={() => { setActiveTab(tab.key); setSelectedCat(null); }}
          />
        ))}
      </ScrollView>

      {/* ── Category chips ── */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[f.catsContent, { flexDirection: flexRow(isRtl()) }]}>
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
      <View style={f.countRow}>
        <UIText variant="eyebrow" color="tertiary" align={textAlignStart(isRtl()) as "left" | "right"}>
          {t("search.resultCount", { count: filtered.length })}
        </UIText>
      </View>
    </>
  ), [
    insets.top, t, router, query, activeTab, selectedCat,
    stats, categories, filtered.length,
  ]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={f.screen}>
        <View style={[f.hero, { paddingTop: insets.top + 14 }]}>
          <View style={[f.topBar, { flexDirection: flexRow(isRtl()) }]}>
            <Pressable onPress={() => router.back()} style={f.backBtn}>
              <Ionicons name={BACK_CHEVRON} size={17} color={kit.color.inkSoft} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <UIText style={[f.eyebrow, { textAlign: textAlignStart(isRtl()) }]}>{t("home.featuredEyebrow")}</UIText>
              <UIText style={[f.heroTitle, { textAlign: textAlignStart(isRtl()) }]}>{t("home.featuredTitle")}</UIText>
            </View>
            <View style={f.starTile}>
              <Ionicons name="star" size={22} color={AMBER.base} />
            </View>
          </View>
        </View>
        <View style={[f.skeletonGrid, { flexDirection: flexRow(isRtl()) }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={f.skeletonCell}><ProductCardSkeleton /></View>
          ))}
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <View style={f.screen}>
        <View style={f.center}>
          <Ionicons name="wifi-outline" size={48} color={kit.color.inkFaint} />
          <UIText style={f.emptyTitle}>{t("errors.network")}</UIText>
          <Pressable onPress={() => void refetch()} style={f.retryBtn}>
            <UIText style={f.retryText}>{t("common.retry")}</UIText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={f.screen}>
      {/* Explicit flex:1 bridge — ensures FlashList receives a measured height
          from its containing View and never collapses to zero on Android.      */}
      <View style={f.listWrap}>
        <ProductGrid
          products={filtered}
          lang={lang}
          onProductPress={handleProductPress}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={<View style={{ height: insets.bottom + 40 }} />}
          ListEmptyComponent={
            <View style={f.center}>
              <Ionicons
                name={allFeatured.length === 0 ? "star-outline" : "search-outline"}
                size={48}
                color={kit.color.inkFaint}
              />
              <UIText style={f.emptyTitle}>
                {allFeatured.length === 0
                  ? t("home.featuredTitle")
                  : t("search.noResults")}
              </UIText>
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} style={f.retryBtn}>
                  <UIText style={f.retryText}>{t("search.clearRecents")}</UIText>
                </Pressable>
              )}
            </View>
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
  listWrap: { flex: 1 },  // explicit bridge so FlashList gets a measured height

  // VIP flat hero — replaces dark amber LinearGradient
  hero: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               14,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  topBar: {
    alignItems: "center",
    gap:        12,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
    flexShrink:      0,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    color:              kit.color.inkFaint,
    letterSpacing:      0.6,
    marginBottom:       2,
    includeFontPadding: false,
  },
  heroTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           24,
    color:              kit.color.ink,
    letterSpacing:      -0.5,
    lineHeight:         30,
    includeFontPadding: false,
  },
  starTile: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: AMBER.tint,
    borderWidth:     1,
    borderColor:     AMBER.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },

  statsRow: {
    gap:            10,
    justifyContent: isRtl() ? "flex-start" : "flex-end",
  },
  stat: {
    flexDirection:     isRtl() ? "row-reverse" : "row",
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
    borderWidth:       1,
  },
  statNum: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  statLbl: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           10,
    includeFontPadding: false,
  },

  // Search
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
    backgroundColor:   kit.color.well,
    borderRadius:      14,
    paddingHorizontal: 14,
    paddingVertical:   11,
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
  searchClear: { padding: 2 },

  // Tabs
  tabsContent: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    gap:               8,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  tab: {
    flexDirection:     isRtl() ? "row-reverse" : "row",
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      20,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  tabActive:     { backgroundColor: AMBER.base, borderColor: AMBER.deep },
  tabText:       { fontFamily: theme.fonts.semibold, fontSize: 12.5, color: kit.color.inkSoft,  includeFontPadding: false },
  tabTextActive: { fontFamily: theme.fonts.black,    fontSize: 12.5, color: "#fff",             includeFontPadding: false },

  // Categories
  catsContent: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    gap:               8,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  catChip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: kit.color.well,  borderWidth: 1, borderColor: kit.color.line   },
  catChipActive:    { backgroundColor: AMBER.base, borderColor: AMBER.deep },
  catChipText:      { fontFamily: theme.fonts.semibold, fontSize: 12, color: kit.color.inkSoft, includeFontPadding: false },
  catChipTextActive:{ fontFamily: theme.fonts.black,    fontSize: 12, color: "#fff",            includeFontPadding: false },

  // Count
  countRow: {
    paddingHorizontal: 20,
    paddingVertical:   8,
  },

  // Skeleton
  skeletonGrid: {
    flexWrap: "wrap",
    padding:  12,
    gap:      12,
  },
  skeletonCell: { width: "47%" as any },

  // Empty / error
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            14,
    padding:        16,
    paddingTop:     60,
  },
  emptyTitle: {
    fontFamily:         theme.fonts.bold,
    fontSize:           15,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical:   11,
    borderRadius:      14,
    backgroundColor:   AMBER.base,
    marginTop:         4,
  },
  retryText: { fontFamily: theme.fonts.black, fontSize: 13, color: "#fff", includeFontPadding: false },
});
