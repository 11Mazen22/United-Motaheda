/**
 * Search — 2026 Elite Redesign
 *
 * Search-fix invariant (DO NOT TOUCH):
 *   - resolvedDebouncedQ → useProductSearch({ query: resolvedDebouncedQ })
 *   - resolvedSubmitted  → useInfiniteProducts({ search: resolvedSubmitted })
 *   - <Hl qAlt={resolvedDebouncedQ} />
 *   - <SuggRow queryResolved={resolvedDebouncedQ} />
 *   Recents, popular-search RPC, and log_search_event analytics unchanged.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDebounce } from "@/hooks/useDebounce";
import { fetchCategories } from "@/services/productsApi";
import { ProductGrid, useInfiniteProducts, useProductSearch } from "@/features/products";
import { resolveSmartQuery, detectSearchLang } from "@/utils/searchUtils";
import { useScreenTrace } from "@/features/observability";
import { supabase } from "@/lib/supabase";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { formatPrice } from "@/utils/format";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { kit } from "@/shared/kit";
import type { NativeProduct, NativeCategory } from "@/services/productsApi";

// ─── Layout constants ────────────────────────────────────────────────────────

const IS_RTL      = isRtl();
const TEXT_START  = textAlignStart(IS_RTL);
const INPUT_ALIGN = TEXT_START as "left" | "right" | "center";
const SCREEN_W    = Dimensions.get("window").width;
const H_PAD       = 20;
// 3-column category cell: full width minus 2×padding minus 2 gaps
const CAT_W   = Math.floor((SCREEN_W - H_PAD * 2 - 10 * 2) / 3);

// Top-3 rank accent colors: gold / silver / brand teal
const RANK_COLORS: Record<number, string> = {
  0: "#D97706",
  1: "#6B7280",
  2: kit.color.accentDeep,
};
const RANK_TINTS: Record<number, string> = {
  0: kit.color.warnTint,
  1: kit.color.well,
  2: kit.color.accentTint,
};

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type SortKey = "newest" | "price_asc" | "price_desc" | "name_asc";

const SORT_KEYS: Record<SortKey, string> = {
  newest:     "search.sortNewest",
  price_asc:  "search.sortPriceAsc",
  price_desc: "search.sortPriceDesc",
  name_asc:   "search.sortNameAsc",
};

const TRENDING_META: { termKey: string; icon: IoniconsName; color: string }[] = [
  { termKey: "search.trending0", icon: "medkit",        color: kit.color.accentDeep },
  { termKey: "search.trending1", icon: "medical",       color: kit.color.accentDeep },
  { termKey: "search.trending2", icon: "sunny-outline", color: kit.color.warn       },
  { termKey: "search.trending3", icon: "fitness",       color: kit.color.danger     },
  { termKey: "search.trending4", icon: "thermometer",   color: kit.color.accentDeep },
  { termKey: "search.trending5", icon: "water-outline", color: kit.color.accentDeep },
];

// ─── Category icon resolver (unchanged) ─────────────────────────────────────

function getCategoryIcon(name: string): IoniconsName {
  const n = (name ?? "").toLowerCase();
  if (/شعر|hair/.test(n))                             return "cut-outline";
  if (/بشرة|وجه|skin|face/.test(n))                  return "hand-left-outline";
  if (/تجميل|مكياج|makeup|cosmetic/.test(n))         return "color-palette-outline";
  if (/فم|أسنان|dental|oral/.test(n))                return "happy-outline";
  if (/عطر|روائح|perfume|fragrance/.test(n))         return "flower-outline";
  if (/إسعاف|طوارئ|first.aid|مطهر/.test(n))         return "medkit-outline";
  if (/فيتامين|vitamin|مكمل|supplement/.test(n))     return "nutrition-outline";
  if (/طفل|رضيع|baby|infant/.test(n))               return "happy-outline";
  if (/أم|حمل|maternity|pregnancy/.test(n))          return "heart-outline";
  if (/جهاز|device|قياس|pressure/.test(n))           return "pulse-outline";
  if (/مضاد|antibiotic|مناعة|immune/.test(n))        return "shield-checkmark-outline";
  if (/ألم|pain|مسكن|analgesic/.test(n))             return "bandage-outline";
  if (/سكر|diabetes|ضغط|blood/.test(n))              return "water-outline";
  if (/عظ|joint|مفصل|bone/.test(n))                  return "body-outline";
  if (/عين|eye|نظر|vision/.test(n))                  return "eye-outline";
  if (/صدر|رئة|lung|chest|respiratory/.test(n))      return "cloudy-outline";
  if (/قلب|heart|cardio/.test(n))                    return "heart-circle-outline";
  if (/أدو|دواء|medicine|drug/.test(n))              return "medical-outline";
  return "grid-outline";
}

// ─── Highlight match (functional core — unchanged) ───────────────────────────

function Hl({
  text, q, qAlt, style, lines,
}: {
  text:   string;
  q:      string;
  qAlt?:  string;
  style?: StyleProp<TextStyle>;
  lines?: number;
}) {
  const render = (matchQ: string) => {
    const lower = text.toLowerCase();
    const ql    = matchQ.toLowerCase().trim();
    const idx   = lower.indexOf(ql);
    if (idx < 0) return null;
    return (
      <UIText style={style} numberOfLines={lines}>
        {text.slice(0, idx)}
        <UIText style={s.hlMatch}>{text.slice(idx, idx + ql.length)}</UIText>
        {text.slice(idx + ql.length)}
      </UIText>
    );
  };
  if (!q || q.length < 2) return <UIText style={style} numberOfLines={lines}>{text}</UIText>;
  return render(q) ?? (qAlt && qAlt.length >= 2 ? render(qAlt) : null) ?? (
    <UIText style={style} numberOfLines={lines}>{text}</UIText>
  );
}

// ─── Suggestion row (functional core — unchanged) ────────────────────────────

const SuggRow = React.memo(function SuggRow({
  product, query, queryResolved, onPress, index, selected,
}: {
  product:       NativeProduct;
  query:         string;
  queryResolved: string;
  onPress:       (p: NativeProduct) => void;
  index:         number;
  selected:      boolean;
}) {
  const { t } = useTranslation();
  const name = product.nameAr ?? product.name;
  const handlePress = useCallback(() => onPress(product), [onPress, product]);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 20).duration(180)}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          s.suggRow,
          (pressed || selected) && { backgroundColor: kit.color.well },
        ]}>
        <View style={s.suggThumb}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
              transition={80}
            />
          ) : (
            <Ionicons name="medkit-outline" size={14} color={kit.color.inkFaint} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Hl text={name} q={query} qAlt={queryResolved} style={s.suggName} lines={1} />
          <UIText style={s.suggCat} numberOfLines={1}>{product.categoryName}</UIText>
        </View>
        {!product.inStock ? (
          <View style={s.suggOos}>
            <UIText style={s.suggOosText}>{t("common.outOfStock")}</UIText>
          </View>
        ) : (
          <UIText style={s.suggPrice}>{formatPrice(product.price)}</UIText>
        )}
      </Pressable>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═══  SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function SearchScreen() {
  useScreenTrace("search");
  const { t, i18n } = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // ── State (unchanged) ──
  const [query, setQuery]             = useState("");
  const [submitted, setSubmitted]     = useState("");
  const [focused, setFocused]         = useState(false);
  const [sortBy, setSortBy]           = useState<SortKey>("newest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [catFilter, setCatFilter]     = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [recents, setRecents]         = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const debouncedQ  = useDebounce(query.trim(), 200);
  const RECENTS_KEY = "um_search_recents_v1";

  // ── Smart bilingual resolution (unchanged) ──
  const searchResolution = useMemo(
    () => (debouncedQ.length >= 2 ? resolveSmartQuery(debouncedQ) : null),
    [debouncedQ],
  );
  const translationHintText = useMemo(() => {
    const raw = searchResolution?.displayHint;
    if (!raw) return null;
    if (raw.includes(":")) return raw.split(":").slice(1).join(":").trim();
    return raw;
  }, [searchResolution]);

  const resolvedDebouncedQ = useMemo(() => {
    if (debouncedQ.length < 2) return debouncedQ;
    const term = searchResolution?.term;
    return term && term.length > 0 ? term : debouncedQ;
  }, [debouncedQ, searchResolution]);

  const resolvedSubmitted = useMemo(() => {
    if (!submitted || submitted.length < 2) return submitted;
    const { term } = resolveSmartQuery(submitted);
    return term && term.length > 0 ? term : submitted;
  }, [submitted]);

  const showSugg   = focused && debouncedQ.length >= 2 && debouncedQ !== submitted;
  const hasResults = submitted.length >= 2;

  useEffect(() => { setSelectedIdx(-1); }, [debouncedQ]);

  // ── Data (unchanged) ──
  const { data: categories } = useQuery({
    queryKey: ["searchCategories"],
    queryFn:  fetchCategories,
    staleTime: 10 * 60_000,
  });

  const { data: popularData } = useQuery({
    queryKey: ["popularSearches"],
    queryFn:  async () => {
      const { data, error } = await supabase.rpc("get_popular_searches", { p_limit: 6, p_days: 7 });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
  });
  // Quality filter: reject random/test strings — must contain Arabic chars,
  // or be a recognizable medical English term (letters only, 3+ chars, no digits).
  const isQualityQuery = (q: string) => {
    if (!q || q.length < 2) return false;
    if (/[؀-ۿ]/.test(q)) return true;           // contains Arabic
    if (/^[a-zA-Z\s\-]{3,}$/.test(q) && q.length >= 3) return true; // clean English
    return false;
  };
  const popularSearches: string[] = Array.isArray(popularData)
    ? (popularData as Array<{ query: string }>)
        .map((r) => r.query)
        .filter((q) => Boolean(q) && isQualityQuery(q))
    : [];

  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) setRecents(parsed as string[]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { products: suggestions, isLoading: suggFetching } =
    useProductSearch({ query: resolvedDebouncedQ, enabled: showSugg });

  const {
    products: results,
    totalCount,
    isLoading: resultsLoading,
    isFetching: resultsFetching,
    isFetchingNextPage,
    isRefreshing: resultsRefreshing,
    hasNextPage,
    fetchNextPage,
    refetch: refetchResults,
  } = useInfiniteProducts({
    search:     resolvedSubmitted || undefined,
    sortBy,
    inStock:    inStockOnly || undefined,
    categoryId: catFilter ?? undefined,
    pageSize:   20,
    enabled:    hasResults,
  });

  const isSearching = hasResults && (resultsLoading || (resultsFetching && !results.length));

  // ── Persist recents + analytics (unchanged) ──
  useEffect(() => {
    if (submitted.length > 1 && results.length > 0) {
      setRecents((prev) => {
        const next = [submitted, ...prev.filter((x) => x !== submitted)].slice(0, 8);
        AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      void (async () => {
        try {
          const { error } = await supabase.rpc("log_search_event", {
            p_query:        submitted,
            p_result_count: totalCount,
            p_source:       "native",
          });
          if (error && __DEV__) console.warn("[search] analytics:", error.message);
        } catch {
          // best-effort
        }
      })();
    }
  }, [submitted, results.length, totalCount]);

  // ── Handlers (unchanged) ──
  const submit = useCallback((text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setSubmitted(q);
    setQuery(q);
    setSelectedIdx(-1);
    Keyboard.dismiss();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [query]);

  const tapSugg     = useCallback((p: NativeProduct) => { submit(p.nameAr ?? p.name); }, [submit]);
  const clear       = useCallback(() => { setQuery(""); setSubmitted(""); inputRef.current?.focus(); }, []);
  const quickSearch = useCallback((term: string) => {
    setQuery(term); setSubmitted(term); Keyboard.dismiss();
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, []);
  const goProduct   = useCallback((id: string) => {
    router.push({ pathname: "/product/[id]", params: { id } });
  }, [router]);
  const resetFilters = useCallback(() => {
    setSortBy("newest"); setInStockOnly(false); setCatFilter(null);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, []);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filterCount = [inStockOnly, catFilter !== null, sortBy !== "newest"].filter(Boolean).length;

  const grouped = useMemo(() => {
    if (!results.length) return [];
    const map = new Map<string, NativeProduct[]>();
    for (const p of results) {
      const key = p.categoryName || t("common.other");
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([cat, items]) => ({ cat, items }));
  }, [results, t]);

  const trendingTerms = popularSearches.length > 0
    ? popularSearches
    : TRENDING_META.map((m) => t(m.termKey));

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <View style={s.screen}>

      {/* ╔══════════════════════════════════════════════════════════════╗
          ║  HEADER — sticky identity zone                               ║
          ╚══════════════════════════════════════════════════════════════╝ */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>

        {/* Title row: discovery title ↔ results count */}
        <View style={s.titleZone}>
          {hasResults && !isSearching && totalCount > 0 ? (
            <Animated.View entering={FadeIn.duration(220)} style={s.resultsMeta}>
              <UIText style={s.resultsCount}>{totalCount.toLocaleString()}</UIText>
              <UIText style={s.resultsDot}>{" · "}</UIText>
              <UIText style={s.resultsQuery} numberOfLines={1}>{`"${submitted}"`}</UIText>
            </Animated.View>
          ) : (
            <View>
              <UIText style={s.eyebrow}>{t("search.eyebrow")}</UIText>
              <UIText style={s.displayTitle} accessibilityRole="header">
                {t("search.title")}
              </UIText>
            </View>
          )}
        </View>

        {/* Command bar */}
        <View style={[s.bar, focused && s.barFocused]}>
          <View style={s.barIconWrap}>
            {suggFetching || isSearching ? (
              <ActivityIndicator size="small" color={kit.color.accentDeep} />
            ) : (
              <Ionicons
                name="search"
                size={18}
                color={focused ? kit.color.accentDeep : kit.color.inkFaint}
              />
            )}
          </View>

          <TextInput
            ref={inputRef}
            style={s.barInput}
            placeholder={t("search.placeholder")}
            placeholderTextColor={kit.color.inkFaint}
            value={query}
            onChangeText={(v) => { setQuery(v); setSelectedIdx(-1); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 160)}
            onSubmitEditing={() => {
              if (selectedIdx >= 0 && suggestions[selectedIdx]) tapSugg(suggestions[selectedIdx]);
              else submit();
            }}
            onKeyPress={({ nativeEvent }) => {
              if (!showSugg || suggestions.length === 0) return;
              if (nativeEvent.key === "ArrowDown")
                setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
              else if (nativeEvent.key === "ArrowUp")
                setSelectedIdx((i) => Math.max(i - 1, -1));
              else if (nativeEvent.key === "Escape") {
                setFocused(false); setSelectedIdx(-1); Keyboard.dismiss();
              }
            }}
            returnKeyType="search"
            autoCorrect={false}
            textAlign={INPUT_ALIGN}
            selectionColor={kit.color.accentDeep}
            accessibilityLabel={t("search.placeholder")}
          />

          {query.length > 0 && (
            <Pressable onPress={clear} hitSlop={10} style={s.barClear}
              accessibilityRole="button" accessibilityLabel={t("common.clear")}>
              <Ionicons name="close" size={12} color={kit.color.inkSoft} />
            </Pressable>
          )}

          <View style={s.barDivider} />

          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              setShowFilters((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("search.filterLabel")}
            style={[s.barFilterBtn, (showFilters || filterCount > 0) && s.barFilterBtnOn]}>
            <Ionicons
              name="options-outline"
              size={16}
              color={(showFilters || filterCount > 0) ? kit.color.onInk : kit.color.inkSoft}
            />
            {filterCount > 0 && !showFilters && (
              <View style={s.filterDot}>
                <UIText style={s.filterDotText}>{filterCount}</UIText>
              </View>
            )}
          </Pressable>
        </View>

        {/* Bilingual translation hint */}
        {translationHintText && debouncedQ.length >= 2 && (
          <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOut.duration(120)}
            style={s.hintPill}>
            <Ionicons name="language-outline" size={12} color={kit.color.accentDeep} />
            <UIText style={s.hintText}>{translationHintText}</UIText>
          </Animated.View>
        )}
      </View>

      {/* ╔══════════════════════════════════════════════════════════════╗
          ║  BODY                                                         ║
          ╚══════════════════════════════════════════════════════════════╝ */}
      <View style={s.body}>

        {/* ── Filter panel (collapsible) ── */}
        {showFilters && (
          <Animated.View entering={FadeInDown.duration(200)} style={s.filterPanel}>
            <View style={s.filterPanelHeader}>
              <View style={s.filterPanelTitle}>
                <Ionicons name="options-outline" size={14} color={kit.color.ink} />
                <UIText style={s.filterTitleText}>{t("search.filterTitle")}</UIText>
              </View>
              {filterCount > 0 && (
                <Pressable onPress={resetFilters} hitSlop={8} accessibilityRole="button">
                  <UIText style={s.filterResetText}>{t("search.reset")}</UIText>
                </Pressable>
              )}
            </View>

            {/* Sort */}
            <View style={s.chipsRow}>
              {(Object.keys(SORT_KEYS) as SortKey[]).map((key) => {
                const on = sortBy === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => { setSortBy(key); if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[s.chip, on && s.chipOn]}>
                    <UIText style={[s.chipText, on && s.chipTextOn]}>{t(SORT_KEYS[key])}</UIText>
                  </Pressable>
                );
              })}
            </View>

            {/* In-stock toggle */}
            <Pressable
              onPress={() => { setInStockOnly((v) => !v); if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); }}
              accessibilityRole="switch"
              accessibilityState={{ checked: inStockOnly }}
              style={s.toggleRow}>
              <View style={s.toggleLeft}>
                <Ionicons name="cube-outline" size={15} color={kit.color.inkSoft} />
                <UIText style={s.toggleLabel}>{t("search.inStockOnly")}</UIText>
              </View>
              <View style={[s.sw, inStockOnly && s.swOn]}>
                <View style={s.swThumb} />
              </View>
            </Pressable>

            {/* Category chips */}
            {categories && categories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chipsRowScroll}>
                <Pressable onPress={() => setCatFilter(null)}
                  accessibilityRole="button"
                  style={[s.chip, !catFilter && s.chipOn]}>
                  <UIText style={[s.chipText, !catFilter && s.chipTextOn]}>{t("search.all")}</UIText>
                </Pressable>
                {categories.slice(0, 12).map((cat: NativeCategory) => {
                  const on = catFilter === cat.id;
                  return (
                    <Pressable key={cat.id} onPress={() => setCatFilter(on ? null : cat.id)}
                      accessibilityRole="button"
                      style={[s.chip, on && s.chipOn]}>
                      <UIText style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>{cat.name}</UIText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Animated.View>
        )}

        {/* ╔══════════════════════════════════════════════════════════════╗
            ║  DISCOVERY — shown when no search submitted                  ║
            ╚══════════════════════════════════════════════════════════════╝ */}
        {!hasResults ? (
          <ScrollView
            contentContainerStyle={[s.discovery, { paddingBottom: theme.layout.tabBarHeight + 48 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* ── Recent searches ── */}
            {recents.length > 0 && (
              <Animated.View entering={FadeInDown.delay(20).duration(240)} style={s.section}>
                <View style={s.sectionHead}>
                  <View style={s.sectionHeadLeft}>
                    <View style={s.sectionIconDot}>
                      <Ionicons name="time-outline" size={11} color={kit.color.accentDeep} />
                    </View>
                    <UIText style={s.sectionLabel}>{t("search.recentTitle")}</UIText>
                  </View>
                  <Pressable
                    onPress={() => { setRecents([]); AsyncStorage.removeItem(RECENTS_KEY).catch(() => {}); }}
                    hitSlop={8}
                    accessibilityRole="button">
                    <UIText style={s.sectionClearBtn}>{t("search.clearRecents")}</UIText>
                  </Pressable>
                </View>
                <View style={s.chipWrap}>
                  {recents.map((term) => (
                    <Pressable
                      key={term}
                      onPress={() => quickSearch(term)}
                      accessibilityRole="button"
                      style={({ pressed }) => [s.recentChip, pressed && s.chipPressed]}>
                      <Ionicons name="search-outline" size={11} color={kit.color.inkFaint} />
                      <UIText style={s.recentChipText}>{term}</UIText>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* ── Trending — 2-column editorial pill grid ── */}
            <Animated.View entering={FadeInDown.delay(50).duration(240)} style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <View style={[s.sectionIconDot, { backgroundColor: kit.color.accentTint }]}>
                    <Ionicons name="trending-up" size={11} color={kit.color.accentDeep} />
                  </View>
                  <UIText style={s.sectionLabel}>{t("search.trendingTitle")}</UIText>
                </View>
              </View>

              <View style={s.trendGrid}>
                {trendingTerms.map((term, i) => {
                  const rankColor = RANK_COLORS[i] ?? kit.color.inkFaint;
                  const rankBg    = RANK_TINTS[i]  ?? kit.color.well;
                  return (
                    <Pressable
                      key={term}
                      onPress={() => quickSearch(term)}
                      accessibilityRole="button"
                      style={({ pressed }) => [s.trendPill, pressed && s.trendPillPressed]}>
                      <View style={[s.trendRankBadge, { backgroundColor: rankBg }]}>
                        <UIText style={[s.trendRank, { color: rankColor }]}>
                          {String(i + 1).padStart(2, "0")}
                        </UIText>
                      </View>
                      <UIText style={s.trendTerm} numberOfLines={1}>{term}</UIText>
                      <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.lineStrong} />
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* ── Categories — 4-column compact icon grid ── */}
            {categories && categories.length > 0 && (
              <Animated.View entering={FadeInDown.delay(80).duration(240)} style={s.section}>
                <View style={s.sectionHead}>
                  <View style={s.sectionHeadLeft}>
                    <View style={s.sectionIconDot}>
                      <Ionicons name="grid-outline" size={11} color={kit.color.accentDeep} />
                    </View>
                    <UIText style={s.sectionLabel}>{t("search.categoriesTitle")}</UIText>
                  </View>
                </View>

                <View style={s.catGrid}>
                  {categories.slice(0, 8).map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => router.push({ pathname: "/category/[id]", params: { id: cat.id } })}
                      accessibilityRole="button"
                      style={({ pressed }) => [s.catCell, pressed && { opacity: 0.72 }]}>
                      <View style={s.catCellIcon}>
                        <Ionicons name={getCategoryIcon(cat.name)} size={26} color={kit.color.accentDeep} />
                      </View>
                      <UIText style={s.catCellName} numberOfLines={2}>{cat.name}</UIText>
                      {cat.count > 0 && (
                        <View style={s.catCellCountBadge}>
                          <UIText style={s.catCellCount}>{cat.count}+</UIText>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}
          </ScrollView>

        ) : (

          /* ╔══════════════════════════════════════════════════════════════╗
             ║  RESULTS — infinite product grid                             ║
             ╚══════════════════════════════════════════════════════════════╝ */
          <View style={{ flex: 1 }}>
            <ProductGrid
              products={results}
              onProductPress={(p) => goProduct(p.id)}
              onEndReached={hasNextPage && !isFetchingNextPage ? loadMore : undefined}
              refreshing={resultsRefreshing}
              onRefresh={refetchResults}
              contentContainerStyle={{ paddingBottom: theme.layout.tabBarHeight + 24 }}
              lang={i18n.language === "en" ? "en" : "ar"}
              ListHeaderComponent={
                hasResults && grouped.length > 1 ? (
                  <Animated.View entering={FadeInDown.duration(200)} style={s.groupHeader}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.groupChipsScroll}>
                      {grouped.map((g) => {
                        const catObj = categories?.find((c) => c.name === g.cat);
                        const active = catObj && catFilter === catObj.id;
                        return (
                          <Pressable
                            key={g.cat}
                            onPress={() => {
                              if (catObj) setCatFilter(catFilter === catObj.id ? null : catObj.id);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: !!active }}
                            style={[s.chip, active && s.chipOn]}>
                            <UIText style={[s.chipText, active && s.chipTextOn]}>{g.cat}</UIText>
                            <View style={[s.chipCount, active && s.chipCountOn]}>
                              <UIText style={[s.chipCountText, active && s.chipTextOn]}>
                                {g.items.length}
                              </UIText>
                            </View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </Animated.View>
                ) : null
              }
              ListEmptyComponent={
                isSearching ? (
                  <View style={s.skeletonGrid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <View key={i} style={s.skeletonCell}>
                        <ProductCardSkeleton />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={s.emptyWrap}>
                    <View style={s.emptyIconRing}>
                      <Ionicons name="search-outline" size={30} color={kit.color.inkFaint} />
                    </View>
                    <UIText style={s.emptyTitle}>{t("search.noResults")}</UIText>
                    <UIText style={s.emptyBody}>
                      {detectSearchLang(submitted) === "arabic"
                        ? t("search.noResultsDescAr", { query: submitted })
                        : t("search.noResultsDescEn", { query: submitted })}
                    </UIText>
                    <UIText style={s.emptyTryLabel}>{t("search.tryPopular")}</UIText>
                    <View style={s.chipWrap}>
                      {TRENDING_META.slice(0, 4).map((m) => {
                        const term = t(m.termKey);
                        return (
                          <Pressable
                            key={m.termKey}
                            onPress={() => quickSearch(term)}
                            accessibilityRole="button"
                            style={({ pressed }) => [s.recentChip, pressed && s.chipPressed]}>
                            <Ionicons name={m.icon} size={11} color={m.color} />
                            <UIText style={s.recentChipText}>{term}</UIText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )
              }
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View style={s.footerLoader}>
                    <ActivityIndicator size="small" color={kit.color.accentDeep} />
                  </View>
                ) : null
              }
            />
          </View>
        )}

        {/* ╔══════════════════════════════════════════════════════════════╗
            ║  SUGGESTIONS OVERLAY — floats above body                     ║
            ╚══════════════════════════════════════════════════════════════╝ */}
        {showSugg && (
          <Animated.View
            entering={FadeInDown.springify().damping(22).stiffness(300)}
            exiting={FadeOut.duration(120)}
            style={s.suggOverlay}>
            <View style={s.suggCard}>
              <View style={s.suggCardHeader}>
                <View style={s.suggCardHeaderLeft}>
                  <Ionicons name="sparkles" size={11} color={kit.color.accentDeep} />
                  <UIText style={s.suggCardHeaderText}>{t("search.suggestions")}</UIText>
                </View>
                {suggFetching && <ActivityIndicator size="small" color={kit.color.accentDeep} />}
              </View>

              <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
                {!suggFetching && suggestions.length === 0 && (
                  <View style={s.suggEmpty}>
                    <Ionicons name="search-outline" size={20} color={kit.color.inkFaint} />
                    <UIText style={s.suggEmptyText}>
                      {t("search.noSuggestions", { query: debouncedQ })}
                    </UIText>
                  </View>
                )}
                {suggestions.map((p, i) => (
                  <SuggRow
                    key={p.id}
                    product={p}
                    query={debouncedQ}
                    queryResolved={resolvedDebouncedQ}
                    onPress={tapSugg}
                    index={i}
                    selected={selectedIdx === i}
                  />
                ))}
              </ScrollView>

              {suggestions.length > 0 && (
                <Pressable
                  onPress={() => submit()}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.suggShowAll, pressed && { opacity: 0.85 }]}>
                  <Ionicons name="search" size={13} color={kit.color.accentDeep} />
                  <UIText style={s.suggShowAllText}>
                    {t("search.showAll", { query: debouncedQ })}
                  </UIText>
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══  STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({

  // ── Screen shell ────────────────────────────────────────────────────────────
  screen: {
    flex: 1,
    backgroundColor: kit.color.canvas,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: H_PAD,
    paddingBottom:     14,
    gap:               12,
    backgroundColor:   kit.color.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  titleZone: {
    minHeight: 46,
    justifyContent: "flex-end",
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    letterSpacing:      1.4,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  displayTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         34,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Results meta (big teal count + query)
  resultsMeta: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "baseline",
    flexWrap:      "wrap",
  },
  resultsCount: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         34,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  resultsDot: {
    fontFamily:         theme.fonts.regular,
    fontSize:           16,
    lineHeight:         24,
    color:              kit.color.inkFaint,
    paddingHorizontal:  3,
    includeFontPadding: false,
  },
  resultsQuery: {
    flex:               1,
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    lineHeight:         24,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Command bar ─────────────────────────────────────────────────────────────
  bar: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               4,
    height:            58,
    paddingHorizontal: 8,
    backgroundColor:   kit.color.surface,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.floating,
  },
  barFocused: {
    borderColor: kit.color.accentDeep,
  },
  barIconWrap: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
  },
  barInput: {
    flex:            1,
    minWidth:        0,
    fontSize:        15,
    fontFamily:      theme.fonts.semibold,
    color:           kit.color.ink,
    textAlign:       INPUT_ALIGN,
    paddingVertical: 0,
  },
  barClear: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: kit.color.well,
    alignItems: "center", justifyContent: "center",
  },
  barDivider: {
    width:            StyleSheet.hairlineWidth,
    height:           22,
    backgroundColor:  kit.color.lineStrong,
    marginHorizontal: 4,
  },
  barFilterBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: kit.color.well,
  },
  barFilterBtnOn: {
    backgroundColor: kit.color.ink,
  },
  filterDot: {
    position: "absolute", top: -2, end: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: kit.color.accentDeep,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: kit.color.surface,
  },
  filterDotText: {
    fontFamily: theme.fonts.black,
    fontSize: 9, lineHeight: 12,
    color: kit.color.onInk,
    includeFontPadding: false,
  },

  // Translation hint pill
  hintPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    alignSelf:         "flex-start",
    gap:               6,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  hintText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  hlMatch: {
    color:           kit.color.accentDeep,
    fontFamily:      theme.fonts.black,
    backgroundColor: kit.color.accentTint,
  },

  // ── Body ────────────────────────────────────────────────────────────────────
  body: { flex: 1, position: "relative" },

  // ── Filter panel ────────────────────────────────────────────────────────────
  filterPanel: {
    backgroundColor:   kit.color.surface,
    marginHorizontal:  H_PAD,
    marginBottom:      8,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       kit.color.line,
    padding:           16,
    gap:               14,
    ...kit.shadow.raised,
  },
  filterPanelHeader: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  filterPanelTitle: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  filterTitleText: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  filterResetText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.danger,
    includeFontPadding: false,
  },
  chipsRow: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    gap:           8,
  },
  chipsRowScroll: {
    flexDirection: flexRow(IS_RTL),
    gap:           8,
    paddingBottom: 2,
  },
  toggleRow: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingVertical: 2,
  },
  toggleLeft: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  toggleLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  sw: {
    width: 42, height: 26, borderRadius: 13,
    backgroundColor: kit.color.lineStrong,
    padding: 3,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  swOn: {
    backgroundColor: kit.color.accentDeep,
    alignItems:      "flex-end",
  },
  swThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: kit.color.surface,
    ...kit.shadow.raised,
  },

  // ── Filter chips (shared) ────────────────────────────────────────────────────
  chip: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    height:            36,
    paddingHorizontal: 14,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
  },
  chipOn:      { backgroundColor: kit.color.ink },
  chipText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  chipTextOn:   { color: kit.color.onInk },
  chipCount: {
    minWidth:          20,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.surface,
    paddingHorizontal: 6,
    paddingVertical:   1,
    alignItems:        "center",
  },
  chipCountOn:  { backgroundColor: "rgba(255,255,255,0.18)" },
  chipCountText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         15,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Discovery ───────────────────────────────────────────────────────────────
  discovery: {
    paddingHorizontal: H_PAD,
    paddingTop:        20,
    gap:               28,
  },

  section: { gap: 12 },

  sectionHead: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  sectionHeadLeft: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  sectionIconDot: {
    width:           22,
    height:          22,
    borderRadius:    7,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
  },
  sectionLabel: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  sectionClearBtn: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.danger,
    includeFontPadding: false,
  },

  // Recent chips wrap
  chipWrap: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    gap:           8,
  },
  recentChip: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               7,
    paddingHorizontal: 14,
    height:            38,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.surface,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  chipPressed:     { backgroundColor: kit.color.well },
  recentChipText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },

  // Trending full-width ranked list
  trendGrid: {
    gap: 8,
  },
  trendPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 16,
    height:            60,
    backgroundColor:   kit.color.surface,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  trendPillPressed: { backgroundColor: kit.color.well },
  trendRankBadge: {
    width:          36,
    height:         36,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
  },
  trendRank: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    textAlign:          "center",
    writingDirection:   "ltr",
    includeFontPadding: false,
  },
  trendTerm: {
    flex:               1,
    fontFamily:         theme.fonts.semibold,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Category 3-col premium icon grid
  catGrid: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    gap:           10,
  },
  catCell: {
    width:             CAT_W,
    alignItems:        "center",
    gap:               8,
    paddingVertical:   18,
    paddingHorizontal: 6,
    backgroundColor:   kit.color.surface,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  catCellIcon: {
    width:            56,
    height:           56,
    borderRadius:     18,
    backgroundColor:  kit.color.accentTint,
    alignItems:       "center",
    justifyContent:   "center",
  },
  catCellName: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         15,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
  catCellCountBadge: {
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  catCellCount: {
    fontFamily:         theme.fonts.bold,
    fontSize:           9,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // ── Results ─────────────────────────────────────────────────────────────────
  groupHeader: {
    marginBottom: 12,
  },
  groupChipsScroll: {
    flexDirection: flexRow(IS_RTL),
    gap:           8,
    paddingHorizontal: 2,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems:      "center",
  },
  skeletonGrid: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    padding:       12,
    gap:           10,
  },
  skeletonCell: { width: "47%" as const },

  emptyWrap: {
    alignItems:        "center",
    paddingTop:        56,
    paddingHorizontal: 24,
    gap:               12,
  },
  emptyIconRing: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: kit.color.well,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    lineHeight:         24,
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
    maxWidth:           280,
    includeFontPadding: false,
  },
  emptyTryLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         15,
    color:              kit.color.inkFaint,
    letterSpacing:      0.8,
    marginTop:          8,
    includeFontPadding: false,
  },

  // ── Suggestions overlay ──────────────────────────────────────────────────────
  suggOverlay: {
    position: "absolute",
    top:      4,
    start:    H_PAD - 4,
    end:      H_PAD - 4,
    bottom:   theme.layout.tabBarHeight,
    zIndex:   100,
  },
  suggCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    flexShrink:      1,
    ...kit.shadow.floating,
  },
  suggCardHeader: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  suggCardHeaderLeft: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           6,
  },
  suggCardHeaderText: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         15,
    color:              kit.color.inkFaint,
    letterSpacing:      1.0,
    includeFontPadding: false,
  },
  suggRow: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  suggThumb: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: kit.color.well,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  suggName: {
    fontSize:           13,
    lineHeight:         19,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  suggCat: {
    fontFamily:         theme.fonts.regular,
    fontSize:           10,
    lineHeight:         15,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    marginTop:          2,
    includeFontPadding: false,
  },
  suggPrice: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  suggOos: {
    backgroundColor:   kit.color.dangerTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  suggOosText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           9,
    lineHeight:         14,
    color:              kit.color.danger,
    includeFontPadding: false,
  },
  suggEmpty: {
    alignItems:      "center",
    paddingVertical: 24,
    gap:             8,
  },
  suggEmptyText: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    includeFontPadding: false,
  },
  suggShowAll: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    paddingVertical: 14,
    backgroundColor: kit.color.accentTint,
  },
  suggShowAllText: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
});
