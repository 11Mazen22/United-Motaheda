/**
 * DealsScreen — Today's Best Prices, warrior edition.
 *
 * Data: useInfiniteProducts({ sortBy: "price_asc", inStock: true })
 *       — lowest-priced, in-stock products; server-side paginated.
 *       Search + category filter forwarded to the search_products RPC.
 *
 * Features:
 *   • Live end-of-day countdown in the header
 *   • Search bar with debounce
 *   • Category filter chips (horizontal rail)
 *   • Sort toggle: Price ↑ | Newest
 *   • Infinite scroll via ProductGrid (FlashList on native)
 *
 * VIP Phase 2: LinearGradient hero → flat kit.color.surface header in ListHeader.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
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
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { kit } from "@/shared/kit";
import { useInfiniteProducts, ProductGrid, type NativeProduct } from "@/features/products";
import { fetchCategories } from "@/services/productsApi";
import { useDebounce } from "@/hooks/useDebounce";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

// Danger red palette — no kit token for raw red hues
const DANGER = {
  base: "#EF4444",
  deep: "#DC2626",
  tint: "#FEF2F2",
  line: "rgba(239,68,68,0.20)",
  rose: "#FCA5A5",
} as const;

type SortMode = "price_asc" | "newest";

// ─── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown() {
  const getMs = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 0);
    return Math.max(0, end.getTime() - now.getTime());
  };
  const [ms, setMs]   = useState(getMs);
  const mounted       = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const id = setInterval(() => { if (mounted.current) setMs(getMs()); }, 1_000);
    return () => { mounted.current = false; clearInterval(id); };
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    h:   pad(Math.floor(ms / 3_600_000)),
    m:   pad(Math.floor((ms % 3_600_000) / 60_000)),
    s:   pad(Math.floor((ms % 60_000) / 1_000)),
  };
}

// ─── DigitBlock ────────────────────────────────────────────────────────────────

function DigitBlock({ value, label }: { value: string; label: string }) {
  return (
    <View style={d.digitUnit}>
      <View style={d.digitBox}>
        <UIText style={d.digitValue}>{value}</UIText>
      </View>
      <UIText style={d.digitLabel}>{label}</UIText>
    </View>
  );
}

// ─── CatChip ───────────────────────────────────────────────────────────────────

const CatChip = React.memo(function CatChip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[d.chip, active && d.chipActive]}>
      <UIText style={[d.chipText, active && d.chipTextActive]} numberOfLines={1}>
        {label}
      </UIText>
    </Pressable>
  );
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function DealsScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const lang        = i18n.language === "en" ? "en" as const : "ar" as const;
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { h, m, s } = useCountdown();

  const [query,       setQuery]       = useState("");
  const [sortBy,      setSortBy]      = useState<SortMode>("price_asc");
  const [selectedCat, setSelectedCat] = useState<string | undefined>(undefined);

  const debouncedQuery = useDebounce(query.trim(), 250);

  // Live-dot pulse
  const dotOp = useSharedValue(1);
  useEffect(() => {
    dotOp.value = withRepeat(
      withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1, true,
    );
  }, [dotOp]);
  const dotAnim = useAnimatedStyle(() => ({ opacity: dotOp.value }));

  // ── Categories for filter rail ───────────────────────────────────────────
  const { data: allCats = [] } = useQuery({
    queryKey:  ["categories"],
    queryFn:   fetchCategories,
    staleTime: 10 * 60_000,
  });
  const visibleCats = useMemo(
    () => allCats.filter((c) => c.count > 0).slice(0, 12),
    [allCats],
  );

  // ── Real sale / discount products (server-side infinite) ─────────────────
  // isSale=true → bypasses the search_products RPC (which has no p_is_sale
  // param) and goes directly to:
  //   SELECT ... WHERE is_sale = true OR discount_percent > 0
  // This guarantees ONLY genuinely discounted products appear — never a
  // random "cheapest products" dump.
  const {
    products,
    totalCount,
    isLoading,
    isError,
    isRefreshing,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteProducts({
    isSale:     true,
    inStock:    true,
    sortBy,
    search:     debouncedQuery || undefined,
    categoryId: selectedCat,
    pageSize:   20,
  });

  const handleProductPress = useCallback(
    (p: NativeProduct) => {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      router.push({ pathname: "/product/[id]", params: { id: p.id } });
    },
    [router],
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Header ───────────────────────────────────────────────────────────────
  const ListHeader = useMemo(() => (
    <>
      {/* ── VIP flat hero (replaces crimson LinearGradient) ── */}
      <View style={[d.hero, { paddingTop: insets.top + 14 }]}>

        {/* Top bar */}
        <View style={[d.topBar, { flexDirection: flexRow(isRtl()) }]}>
          <Pressable onPress={() => router.back()} style={d.backBtn} accessibilityRole="button">
            <Ionicons name={BACK_CHEVRON} size={17} color={kit.color.inkSoft} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={[d.eyebrowRow, { flexDirection: flexRow(isRtl()) }]}>
              <Animated.View style={[d.liveDot, dotAnim]} />
              <UIText style={d.eyebrow}>{t("home.flashEnds")}</UIText>
            </View>
            <UIText style={[d.heroTitle, { textAlign: textAlignStart(isRtl()) }]}>{t("home.flashTitle")}</UIText>
          </View>
          <View style={d.flameTile}>
            <Ionicons name="flame" size={24} color={DANGER.deep} />
          </View>
        </View>

        {/* Countdown */}
        <View style={[d.timerRow, { flexDirection: flexRow(isRtl()) }]}>
          <UIText style={d.timerLabel}>{t("home.timeLeft")}</UIText>
          <View style={[d.timerUnits, { flexDirection: flexRow(isRtl()) }]}>
            <DigitBlock value={h}  label={t("home.flashHrs")} />
            <UIText style={d.colon}>:</UIText>
            <DigitBlock value={m}  label={t("home.flashMin")} />
            <UIText style={d.colon}>:</UIText>
            <DigitBlock value={s}  label={t("home.flashSec")} />
          </View>
        </View>

        {/* Count badge */}
        {totalCount > 0 && (
          <View style={[d.countBadge, { flexDirection: flexRow(isRtl()) }]}>
            <Ionicons name="pricetag-outline" size={11} color={DANGER.deep} />
            <UIText style={d.countBadgeText}>
              {totalCount.toLocaleString()} {t("search.resultCount", { count: totalCount }).replace(/\d[\d,]*/g, "").trim()}
            </UIText>
          </View>
        )}
      </View>

      {/* ── Search bar ── */}
      <View style={[d.searchWrap, { flexDirection: flexRow(isRtl()) }]}>
        <View style={[d.searchBar, { flexDirection: flexRow(isRtl()) }]}>
          <Ionicons name="search" size={16} color={kit.color.inkFaint} />
          <TextInput
            style={[d.searchInput, { textAlign: textAlignStart(isRtl()) as "left" | "right" }]}
            placeholder={t("search.placeholder")}
            placeholderTextColor={kit.color.inkFaint}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={DANGER.base}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={kit.color.inkFaint} />
            </Pressable>
          )}
        </View>

        {/* Sort toggle */}
        <Pressable
          onPress={() => setSortBy((s) => s === "price_asc" ? "newest" : "price_asc")}
          style={d.sortBtn}
          accessibilityRole="button">
          <Ionicons
            name={sortBy === "price_asc" ? "trending-down-outline" : "time-outline"}
            size={15}
            color={DANGER.deep}
          />
        </Pressable>
      </View>

      {/* ── Category chips ── */}
      {visibleCats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[d.catsContent, { flexDirection: flexRow(isRtl()) }]}>
          <CatChip
            label={t("products.allProducts")}
            active={selectedCat === undefined}
            onPress={() => setSelectedCat(undefined)}
          />
          {visibleCats.map((cat) => {
            const label = lang === "en" ? (cat.nameEn ?? cat.name) : cat.name;
            return (
              <CatChip
                key={cat.id}
                label={label}
                active={selectedCat === cat.id}
                onPress={() => setSelectedCat((p) => p === cat.id ? undefined : cat.id)}
              />
            );
          })}
        </ScrollView>
      )}

      {/* ── Section label ── */}
      <View style={[d.sectionRow, { flexDirection: flexRow(isRtl()) }]}>
        <Ionicons name="grid-outline" size={13} color={DANGER.deep} />
        <UIText style={[d.sectionLabel, { textAlign: textAlignStart(isRtl()) }]}>{t("home.flashSale")}</UIText>
      </View>
    </>
  ), [
    insets.top, h, m, s, t, router, dotAnim, query, sortBy,
    selectedCat, visibleCats, lang, totalCount,
  ]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading && products.length === 0) {
    return (
      <View style={d.screen}>
        <View style={[d.hero, { paddingTop: insets.top + 14 }]}>
          <View style={[d.topBar, { flexDirection: flexRow(isRtl()) }]}>
            <Pressable onPress={() => router.back()} style={d.backBtn}>
              <Ionicons name={BACK_CHEVRON} size={17} color={kit.color.inkSoft} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <UIText style={d.eyebrow}>{t("home.flashEnds")}</UIText>
              <UIText style={[d.heroTitle, { textAlign: textAlignStart(isRtl()) }]}>{t("home.flashTitle")}</UIText>
            </View>
            <View style={d.flameTile}>
              <Ionicons name="flame" size={24} color={DANGER.deep} />
            </View>
          </View>
        </View>
        <View style={[d.skeletonGrid, { flexDirection: flexRow(isRtl()) }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={d.skeletonCell}><ProductCardSkeleton /></View>
          ))}
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError && products.length === 0) {
    return (
      <View style={d.screen}>
        <View style={d.center}>
          <Ionicons name="wifi-outline" size={48} color={kit.color.inkFaint} />
          <UIText style={d.emptyTitle}>{t("errors.network")}</UIText>
          <Pressable onPress={() => void refetch()} style={d.retryBtn}>
            <UIText style={d.retryText}>{t("common.retry")}</UIText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={d.screen}>
      <ProductGrid
        products={products}
        lang={lang}
        onProductPress={handleProductPress}
        onEndReached={loadMore}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={d.footerLoader}>
              <ActivityIndicator size="small" color={DANGER.base} />
            </View>
          ) : (
            <View style={{ height: insets.bottom + 40 }} />
          )
        }
        ListEmptyComponent={
          <View style={d.center}>
            <Ionicons name="pricetag-outline" size={48} color={kit.color.inkFaint} />
            <UIText style={d.emptyTitle}>{t("search.noResults")}</UIText>
            {(query.length > 0 || selectedCat) && (
              <Pressable
                onPress={() => { setQuery(""); setSelectedCat(undefined); }}
                style={d.retryBtn}>
                <UIText style={d.retryText}>{t("search.reset")}</UIText>
              </Pressable>
            )}
          </View>
        }
        refreshing={isRefreshing}
        onRefresh={() => void refetch()}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const d = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // VIP flat hero — replaces dark crimson LinearGradient
  hero: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               16,
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
  eyebrowRow: {
    alignItems:  "center",
    gap:         6,
    marginBottom: 3,
  },
  liveDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: DANGER.base,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    color:              kit.color.inkFaint,
    letterSpacing:      0.6,
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
  flameTile: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: DANGER.tint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     DANGER.line,
    flexShrink:      0,
  },

  timerRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  timerLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  timerUnits: {
    alignItems: "center",
    gap:        6,
  },
  digitUnit:  { alignItems: "center", gap: 3 },
  digitBox: {
    borderRadius:      10,
    paddingHorizontal: 10,
    paddingVertical:   6,
    minWidth:          38,
    alignItems:        "center",
    backgroundColor:   "rgba(239,68,68,0.09)",
    borderWidth:       1,
    borderColor:       "rgba(239,68,68,0.20)",
  },
  digitValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    color:              DANGER.deep,
    letterSpacing:      1,
    includeFontPadding: false,
  },
  digitLabel: {
    fontFamily:         theme.fonts.regular,
    fontSize:           9,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  colon: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    color:              kit.color.inkFaint,
    marginBottom:       12,
    includeFontPadding: false,
  },

  countBadge: {
    alignItems:        "center",
    gap:               6,
    alignSelf:         "flex-end",
    backgroundColor:   DANGER.tint,
    borderRadius:      999,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       DANGER.line,
  },
  countBadgeText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    color:              DANGER.deep,
    includeFontPadding: false,
  },

  // Search
  searchWrap: {
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 20,
    paddingVertical:   12,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  searchBar: {
    flex:              1,
    alignItems:        "center",
    gap:               10,
    backgroundColor:   kit.color.well,
    borderRadius:      14,
    paddingHorizontal: 14,
    paddingVertical:   10,
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
  sortBtn: {
    width:           42,
    height:          42,
    borderRadius:    13,
    backgroundColor: DANGER.tint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     DANGER.line,
  },

  // Categories
  catsContent: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    gap:               8,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      20,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
    overflow:          "hidden",
  },
  chipActive:     { backgroundColor: DANGER.deep, borderColor: DANGER.deep },
  chipText:       { fontFamily: theme.fonts.semibold, fontSize: 12.5, color: kit.color.inkSoft,  includeFontPadding: false },
  chipTextActive: { fontFamily: theme.fonts.black,    fontSize: 12.5, color: "#fff",             includeFontPadding: false },

  sectionRow: {
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 20,
    paddingTop:        10,
    paddingBottom:     4,
  },
  sectionLabel: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    includeFontPadding: false,
  },

  footerLoader: { paddingVertical: 20, alignItems: "center" },

  skeletonGrid: {
    flexWrap: "wrap",
    padding:  12,
    gap:      12,
  },
  skeletonCell: { width: "47%" as any },

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
    backgroundColor:   DANGER.deep,
    marginTop:         4,
  },
  retryText: { fontFamily: theme.fonts.black, fontSize: 13, color: "#fff", includeFontPadding: false },
});
