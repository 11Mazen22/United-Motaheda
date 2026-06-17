/**
 * Search — 2026 rebuild on the @/shared/kit design language.
 *
 * Architecture (completely new — replaces the dark-gradient header layout):
 *   • Light canvas end to end. Editorial header: eyebrow + display title,
 *     result-count ink pill when searching.
 *   • Floating COMMAND BAR: white pill, layered shadow, inline filter toggle.
 *     Submit via the keyboard search key / suggestion footer — no gradient
 *     submit square.
 *   • Discovery: recent chips → TRENDING as an editorial numbered list
 *     (display numerals, hairline separators — no icon cards) → CATEGORIES
 *     as a horizontal snap rail of compact tiles.
 *   • Suggestions: floating white sheet; filter panel: white card with pill
 *     segments and a kit switch.
 *
 * Search-fix invariant (functional core — DO NOT TOUCH):
 *   - resolvedDebouncedQ → useProductSearch({ query: resolvedDebouncedQ })
 *   - resolvedSubmitted  → useInfiniteProducts({ search: resolvedSubmitted })
 *   - <Hl qAlt={resolvedDebouncedQ} />
 *   - <SuggRow queryResolved={resolvedDebouncedQ} />
 *   Recents persistence, popular-search RPC, and log_search_event analytics
 *   are also unchanged.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

const IS_RTL      = isRtl();
const TEXT_START  = textAlignStart(IS_RTL);
const INPUT_ALIGN = TEXT_START as "left" | "right" | "center";

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

// ─── Category icon mapping — Arabic/English keyword → Ionicons name ─────────

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

// ─── Highlight match ─────────────────────────────────────────────────────────

function Hl({
  text, q, qAlt, style, lines,
}: {
  text:   string;
  q:      string;
  /** Alternate (translated/resolved) query — tried when the primary q has no match. */
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

// ─── Suggestion row ──────────────────────────────────────────────────────────

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
            <Image source={{ uri: product.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" transition={80} />
          ) : (
            <Ionicons name="medkit-outline" size={14} color={kit.color.inkFaint} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          {/* Highlight with the raw (possibly Arabic) input first; fall back to
              the resolved (translated) query for English-only product names. */}
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

// ═══════════════════════════════════════════════════════════════════════════
// ═══  SCREEN  ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════

export default function SearchScreen() {
  useScreenTrace("search");
  const { t, i18n } = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // ── State ──
  const [query, setQuery]             = useState("");
  const [submitted, setSubmitted]     = useState("");
  const [focused, setFocused]         = useState(false);
  const [sortBy, setSortBy]           = useState<SortKey>("newest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [catFilter, setCatFilter]     = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [recents, setRecents]         = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const debouncedQ = useDebounce(query.trim(), 200);

  const RECENTS_KEY = "um_search_recents_v1";

  // Smart bilingual resolution — drives the translation hint + DB queries.
  const searchResolution = useMemo(
    () => (debouncedQ.length >= 2 ? resolveSmartQuery(debouncedQ) : null),
    [debouncedQ],
  );
  const translationHintText = useMemo(() => {
    const raw = searchResolution?.displayHint;
    if (!raw) return null;
    if (raw.includes(':')) return raw.split(':').slice(1).join(':').trim();
    return raw;
  }, [searchResolution]);

  /** Resolved debounced query — the term actually sent to Supabase. */
  const resolvedDebouncedQ = useMemo(() => {
    if (debouncedQ.length < 2) return debouncedQ;
    const term = searchResolution?.term;
    return term && term.length > 0 ? term : debouncedQ;
  }, [debouncedQ, searchResolution]);

  /** Resolved submitted query — same translation for the results grid. */
  const resolvedSubmitted = useMemo(() => {
    if (!submitted || submitted.length < 2) return submitted;
    const { term } = resolveSmartQuery(submitted);
    return term && term.length > 0 ? term : submitted;
  }, [submitted]);

  const showSugg   = focused && debouncedQ.length >= 2 && debouncedQ !== submitted;
  const hasResults = submitted.length >= 2;

  useEffect(() => { setSelectedIdx(-1); }, [debouncedQ]);

  // ── Data ──
  const { data: categories } = useQuery({
    queryKey: ["searchCategories"],
    queryFn:  fetchCategories,
    staleTime: 10 * 60_000,
  });

  // Popular searches from analytics — falls back to TRENDING_META terms.
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
  const popularSearches: string[] = Array.isArray(popularData)
    ? (popularData as Array<{ query: string }>).map((r) => r.query).filter(Boolean)
    : [];

  // Load persisted recents on mount.
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

  // Suggestions — resolved (translated) query so Arabic input finds English names.
  const {
    products:  suggestions,
    isLoading: suggFetching,
  } = useProductSearch({ query: resolvedDebouncedQ, enabled: showSugg });

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

  // Persist recents + log analytics whenever a search yields results.
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
          // Best-effort analytics only.
        }
      })();
    }
  }, [submitted, results.length, totalCount]);

  // ── Handlers ──
  const submit = useCallback((text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setSubmitted(q);
    setQuery(q);
    setSelectedIdx(-1);
    Keyboard.dismiss();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [query]);

  const tapSugg = useCallback((p: NativeProduct) => {
    submit(p.nameAr ?? p.name);
  }, [submit]);

  const clear = useCallback(() => {
    setQuery("");
    setSubmitted("");
    inputRef.current?.focus();
  }, []);

  const quickSearch = useCallback((term: string) => {
    setQuery(term);
    setSubmitted(term);
    Keyboard.dismiss();
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, []);

  const goProduct = useCallback((id: string) => {
    router.push({ pathname: "/product/[id]", params: { id } });
  }, [router]);

  const resetFilters = useCallback(() => {
    setSortBy("newest");
    setInStockOnly(false);
    setCatFilter(null);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, []);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filterCount = [inStockOnly, catFilter !== null, sortBy !== "newest"].filter(Boolean).length;

  // ── Grouped results by category — for the in-results filter chips ──
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

  return (
    <View style={s.screen}>

      {/* ─── Editorial header ── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <UIText style={s.eyebrow}>{t("search.eyebrow")}</UIText>
            <UIText style={s.title} accessibilityRole="header">{t("search.title")}</UIText>
          </View>
          {hasResults && totalCount > 0 && !isSearching && (
            <Animated.View entering={FadeIn.duration(200)} style={s.countPill}>
              <UIText style={s.countPillText}>
                {t("search.resultCount", { count: totalCount.toLocaleString() })}
              </UIText>
            </Animated.View>
          )}
        </View>

        {/* ─── Command bar ── */}
        <View style={[s.bar, focused && s.barFocused]}>
          <View style={s.barIcon}>
            {suggFetching || isSearching ? (
              <ActivityIndicator size="small" color={kit.color.accent} />
            ) : (
              <Ionicons name="search" size={18} color={focused ? kit.color.ink : kit.color.inkFaint} />
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
              if (selectedIdx >= 0 && suggestions[selectedIdx]) {
                tapSugg(suggestions[selectedIdx]);
              } else {
                submit();
              }
            }}
            onKeyPress={({ nativeEvent }) => {
              if (!showSugg || suggestions.length === 0) return;
              if (nativeEvent.key === "ArrowDown") {
                setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (nativeEvent.key === "ArrowUp") {
                setSelectedIdx((i) => Math.max(i - 1, -1));
              } else if (nativeEvent.key === "Escape") {
                setFocused(false);
                setSelectedIdx(-1);
                Keyboard.dismiss();
              }
            }}
            returnKeyType="search"
            autoCorrect={false}
            textAlign={INPUT_ALIGN}
            selectionColor={kit.color.accent}
            accessibilityLabel={t("search.placeholder")}
          />

          {query.length > 0 && (
            <Pressable onPress={clear} hitSlop={10} style={s.barClear}
              accessibilityRole="button" accessibilityLabel={t("common.clear")}>
              <Ionicons name="close" size={13} color={kit.color.inkSoft} />
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
            style={[s.barFilter, (showFilters || filterCount > 0) && s.barFilterActive]}>
            <Ionicons
              name="options-outline"
              size={16}
              color={(showFilters || filterCount > 0) ? kit.color.onInk : kit.color.inkSoft}
            />
            {filterCount > 0 && !showFilters && (
              <View style={s.filterBadge}>
                <UIText style={s.filterBadgeText}>{filterCount}</UIText>
              </View>
            )}
          </Pressable>
        </View>

        {/* Translation / typo-fix hint */}
        {translationHintText && debouncedQ.length >= 2 && (
          <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOut.duration(120)}
            style={s.hint}>
            <Ionicons name="language-outline" size={13} color={kit.color.accentDeep} />
            <UIText style={s.hintText}>{translationHintText}</UIText>
          </Animated.View>
        )}
      </View>

      {/* ─── Body ── */}
      <View style={s.body}>

        {/* Filter panel */}
        {showFilters && (
          <Animated.View entering={FadeInDown.duration(200)} style={s.filterPanel}>
            <View style={s.filterHeader}>
              <UIText style={s.filterTitle}>{t("search.filterTitle")}</UIText>
              {filterCount > 0 && (
                <Pressable onPress={resetFilters} hitSlop={6}
                  accessibilityRole="button" accessibilityLabel={t("search.reset")}>
                  <UIText style={s.filterReset}>{t("search.reset")}</UIText>
                </Pressable>
              )}
            </View>

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

        {!hasResults ? (
          /* ── Discovery ── */
          <ScrollView
            contentContainerStyle={[s.discovery, { paddingBottom: theme.layout.tabBarHeight + 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* Recent searches */}
            {recents.length > 0 && (
              <Animated.View entering={FadeInDown.delay(30).duration(240)} style={s.section}>
                <View style={s.sectionHeader}>
                  <UIText style={s.sectionTitle}>{t("search.recentTitle")}</UIText>
                  <Pressable onPress={() => {
                    setRecents([]);
                    AsyncStorage.removeItem(RECENTS_KEY).catch(() => {});
                  }} hitSlop={6}
                    accessibilityRole="button" accessibilityLabel={t("search.clearRecents")}>
                    <UIText style={s.sectionAction}>{t("search.clearRecents")}</UIText>
                  </Pressable>
                </View>
                <View style={s.recentWrap}>
                  {recents.map((term) => (
                    <Pressable
                      key={term}
                      onPress={() => quickSearch(term)}
                      accessibilityRole="button"
                      style={({ pressed }) => [s.recentChip, pressed && { backgroundColor: kit.color.well }]}>
                      <Ionicons name="time-outline" size={12} color={kit.color.inkFaint} />
                      <UIText style={s.recentChipText}>{term}</UIText>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Trending — editorial numbered list */}
            <Animated.View entering={FadeInDown.delay(60).duration(240)} style={s.section}>
              <UIText style={s.sectionTitle}>{t("search.trendingTitle")}</UIText>
              <View style={s.trendCard}>
                {trendingTerms.map((term, i, arr) => (
                  <Pressable
                    key={term}
                    onPress={() => quickSearch(term)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      s.trendRow,
                      i < arr.length - 1 && s.trendRowDivider,
                      pressed && { backgroundColor: kit.color.well },
                    ]}>
                    <UIText style={[
                      s.trendNum,
                      i === 0 && s.trendNum1,
                      i === 1 && s.trendNum2,
                      i === 2 && s.trendNum3,
                    ]}>
                      {`0${i + 1}`}
                    </UIText>
                    <UIText style={s.trendTerm} numberOfLines={1}>{term}</UIText>
                    <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.inkFaint} />
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* Categories — horizontal rail */}
            {categories && categories.length > 0 && (
              <Animated.View entering={FadeInDown.delay(90).duration(240)} style={s.section}>
                <UIText style={s.sectionTitle}>{t("search.categoriesTitle")}</UIText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.catRail}>
                  {categories.slice(0, 8).map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => router.push({ pathname: "/category/[id]", params: { id: cat.id } })}
                      accessibilityRole="button"
                      style={({ pressed }) => [s.catTile, pressed && { backgroundColor: kit.color.well }]}>
                      <View style={s.catTileIcon}>
                        <Ionicons name={getCategoryIcon(cat.name)} size={22} color={kit.color.accentDeep} />
                      </View>
                      <UIText style={s.catTileName} numberOfLines={2}>{cat.name}</UIText>
                      {cat.count > 0 && (
                        <UIText style={s.catTileCount}>
                          {t("category.productCount", { count: `${cat.count}+` })}
                        </UIText>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </ScrollView>
        ) : (
          /* ── Results grid ── */
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
                    <UIText style={s.sectionTitleSm}>{t("search.groupFilter")}</UIText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groupChipsRow}>
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
                    <View style={s.emptyIcon}>
                      <Ionicons name="search-outline" size={32} color={kit.color.inkFaint} />
                    </View>
                    <UIText style={s.emptyTitle}>{t("search.noResults")}</UIText>
                    <UIText style={s.emptyBody}>
                      {detectSearchLang(submitted) === "arabic"
                        ? t("search.noResultsDescAr", { query: submitted })
                        : t("search.noResultsDescEn", { query: submitted })}
                    </UIText>
                    <UIText style={s.emptyTryLabel}>{t("search.tryPopular")}</UIText>
                    <View style={s.emptyChips}>
                      {TRENDING_META.slice(0, 4).map((m) => {
                        const term = t(m.termKey);
                        return (
                          <Pressable
                            key={m.termKey}
                            onPress={() => quickSearch(term)}
                            accessibilityRole="button"
                            style={({ pressed }) => [s.recentChip, pressed && { backgroundColor: kit.color.well }]}>
                            <Ionicons name={m.icon} size={12} color={m.color} />
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
                    <ActivityIndicator size="small" color={kit.color.accent} />
                  </View>
                ) : null
              }
            />
          </View>
        )}

        {/* ─── Suggestions overlay ── */}
        {showSugg && (
          <Animated.View
            entering={FadeInDown.springify().damping(22).stiffness(300)}
            exiting={FadeOut.duration(120)}
            style={s.suggOverlay}>
            <View style={s.suggCard}>
              <View style={s.suggHeader}>
                <UIText style={s.suggHeaderText}>{t("search.suggestions")}</UIText>
                {suggFetching && <ActivityIndicator size="small" color={kit.color.accent} />}
              </View>

              <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
                {!suggFetching && suggestions.length === 0 && (
                  <View style={s.suggEmpty}>
                    <Ionicons name="search-outline" size={22} color={kit.color.inkFaint} />
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
                  <Ionicons name="search" size={14} color={kit.color.accentDeep} />
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

// ═══════════════════════════════════════════════════════════════════════════
// ═══  STYLES — kit light language  ═════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // ── Header
  header: {
    paddingHorizontal: kit.sp(5),
    paddingBottom:     kit.sp(3),
    gap:               kit.sp(3),
  },
  headerRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "flex-end",
    gap:           kit.sp(3),
  },
  eyebrow: {
    fontFamily: theme.fonts.bold,
    fontSize: 11, lineHeight: 16,
    color: kit.color.inkFaint,
    textAlign: TEXT_START,
    includeFontPadding: false,
  },
  title: {
    fontFamily: theme.fonts.black,
    fontSize: kit.type.display.fontSize - 4,
    lineHeight: kit.type.display.lineHeight - 6,
    color: kit.color.ink,
    textAlign: TEXT_START,
    includeFontPadding: false,
  },
  countPill: {
    backgroundColor:   kit.color.ink,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 12,
    paddingVertical:   6,
    marginBottom:      4,
  },
  countPillText: {
    fontFamily: theme.fonts.black,
    fontSize: 11, lineHeight: 16,
    color: kit.color.onInk,
    includeFontPadding: false,
  },

  // ── Command bar
  bar: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               4,
    height:            56,
    paddingHorizontal: 8,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.pill,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.floating,
  },
  barFocused: {
    borderColor: kit.color.ink,
  },
  barIcon: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
  },
  barInput: {
    flex:       1,
    minWidth:   0,
    fontSize:   14,
    fontFamily: theme.fonts.semibold,
    color:      kit.color.ink,
    textAlign:  INPUT_ALIGN,
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
  barFilter: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: kit.color.well,
  },
  barFilterActive: {
    backgroundColor: kit.color.ink,
  },
  filterBadge: {
    position: "absolute",
    top: -2, end: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: kit.color.accent,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: kit.color.surface,
  },
  filterBadgeText: {
    fontFamily: theme.fonts.black,
    fontSize: 9, lineHeight: 12,
    color: kit.color.onInk,
    includeFontPadding: false,
  },

  hint: {
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
    fontFamily: theme.fonts.bold,
    fontSize: 11, lineHeight: 16,
    color: kit.color.accentDeep,
    includeFontPadding: false,
  },

  hlMatch: {
    color:           kit.color.accentDeep,
    fontFamily:      theme.fonts.black,
    backgroundColor: kit.color.accentTint,
  },

  // ── Body
  body: { flex: 1, position: "relative" },

  // ── Filter panel
  filterPanel: {
    backgroundColor:   kit.color.surface,
    marginHorizontal:  kit.sp(5),
    marginBottom:      kit.sp(2),
    borderRadius:      kit.radius.card,
    borderWidth:       1,
    borderColor:       kit.color.line,
    padding:           kit.sp(4),
    gap:               kit.sp(3),
    ...kit.shadow.raised,
  },
  filterHeader: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  filterTitle: {
    fontFamily: theme.fonts.black,
    fontSize: 13, lineHeight: 19,
    color: kit.color.ink,
    includeFontPadding: false,
  },
  filterReset: {
    fontFamily: theme.fonts.bold,
    fontSize: 12, lineHeight: 18,
    color: kit.color.danger,
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
  chip: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    height:            36,
    paddingHorizontal: 14,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
  },
  chipOn: { backgroundColor: kit.color.ink },
  chipText: {
    fontFamily: theme.fonts.bold,
    fontSize: 12, lineHeight: 18,
    color: kit.color.inkSoft,
    includeFontPadding: false,
  },
  chipTextOn: { color: kit.color.onInk },
  chipCount: {
    minWidth: 20,
    borderRadius: kit.radius.pill,
    backgroundColor: kit.color.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: "center",
  },
  chipCountOn: { backgroundColor: "rgba(255,255,255,0.18)" },
  chipCountText: {
    fontFamily: theme.fonts.bold,
    fontSize: 10, lineHeight: 15,
    color: kit.color.inkFaint,
    includeFontPadding: false,
  },

  toggleRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  toggleLeft: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  toggleLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 13, lineHeight: 19,
    color: kit.color.inkSoft,
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
    backgroundColor: kit.color.accent,
    alignItems: "flex-end",
  },
  swThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: kit.color.surface,
    ...kit.shadow.raised,
  },

  // ── Discovery
  discovery: {
    paddingHorizontal: kit.sp(5),
    paddingTop:        kit.sp(2),
    gap:               kit.sp(6),
  },
  section: { gap: kit.sp(3) },
  sectionHeader: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: theme.fonts.black,
    fontSize: kit.type.heading.fontSize,
    lineHeight: kit.type.heading.lineHeight,
    color: kit.color.ink,
    textAlign: TEXT_START,
    includeFontPadding: false,
  },
  sectionTitleSm: {
    fontFamily: theme.fonts.black,
    fontSize: 13, lineHeight: 19,
    color: kit.color.ink,
    textAlign: TEXT_START,
    includeFontPadding: false,
  },
  sectionAction: {
    fontFamily: theme.fonts.bold,
    fontSize: 12, lineHeight: 18,
    color: kit.color.danger,
    includeFontPadding: false,
  },

  recentWrap: {
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
  recentChipText: {
    fontFamily: theme.fonts.bold,
    fontSize: 12, lineHeight: 18,
    color: kit.color.inkSoft,
    includeFontPadding: false,
  },

  // Trending — editorial numbered list
  trendCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.card,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  trendRow: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               kit.sp(4),
    paddingHorizontal: kit.sp(4),
    minHeight:         56,
  },
  trendRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  trendNum: {
    fontFamily: theme.fonts.black,
    fontSize: 17, lineHeight: 24,
    color: kit.color.inkFaint,
    width: 30,
    includeFontPadding: false,
    writingDirection: "ltr",
    textAlign: "center",
  },
  trendNumTop: { color: kit.color.accentDeep },
  trendNum1:   { color: "#D97706" },
  trendNum2:   { color: "#64748B" },
  trendNum3:   { color: kit.color.accentDeep },
  trendTerm: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: 14, lineHeight: 21,
    color: kit.color.ink,
    textAlign: TEXT_START,
    includeFontPadding: false,
  },

  // Categories rail
  catRail: {
    flexDirection: flexRow(IS_RTL),
    gap:           10,
  },
  catTile: {
    width:             116,
    alignItems:        "center",
    gap:               10,
    paddingVertical:   kit.sp(4),
    paddingHorizontal: 8,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.card,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  catTileIcon: {
    width: 56, height: 56, borderRadius: 20,
    backgroundColor: kit.color.accentTint,
    alignItems: "center", justifyContent: "center",
  },
  catTileName: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  catTileCount: {
    fontFamily:         theme.fonts.bold,
    fontSize:           9,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Results
  groupHeader: {
    marginBottom: kit.sp(3),
    gap:          kit.sp(2),
  },
  groupChipsRow: {
    flexDirection: flexRow(IS_RTL),
    gap:           8,
    paddingHorizontal: 2,
  },
  footerLoader: {
    paddingVertical: kit.sp(4),
    alignItems:      "center",
  },
  skeletonGrid: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    padding:       kit.sp(3),
    gap:           10,
  },
  skeletonCell: { width: "47%" as const },

  emptyWrap: {
    alignItems:        "center",
    paddingTop:        kit.sp(14),
    paddingHorizontal: kit.sp(6),
    gap:               kit.sp(3),
  },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 26,
    backgroundColor: kit.color.well,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: theme.fonts.black,
    fontSize: 16, lineHeight: 24,
    color: kit.color.ink,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: theme.fonts.regular,
    fontSize: 13, lineHeight: 20,
    color: kit.color.inkSoft,
    textAlign: "center",
    maxWidth: 300,
  },
  emptyTryLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 11, lineHeight: 16,
    color: kit.color.inkFaint,
    marginTop: kit.sp(2),
  },
  emptyChips: {
    flexDirection:  flexRow(IS_RTL),
    flexWrap:       "wrap",
    justifyContent: "center",
    gap:            8,
  },

  // ── Suggestions overlay
  suggOverlay: {
    position: "absolute",
    top:      kit.sp(1),
    start:    kit.sp(4),
    end:      kit.sp(4),
    bottom:   theme.layout.tabBarHeight,
    zIndex:   100,
  },
  suggCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.sheet - 4,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    flexShrink:      1,
    ...kit.shadow.floating,
  },
  suggHeader: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: kit.sp(4),
    paddingVertical:   kit.sp(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  suggHeaderText: {
    fontFamily: theme.fonts.black,
    fontSize: 11, lineHeight: 16,
    color: kit.color.inkFaint,
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  suggRow: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               kit.sp(3),
    paddingHorizontal: kit.sp(4),
    paddingVertical:   kit.sp(2.5),
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
    fontSize: 13, lineHeight: 19,
    fontFamily: theme.fonts.bold,
    color: kit.color.ink,
    textAlign: TEXT_START,
    includeFontPadding: false,
  },
  suggCat: {
    fontFamily: theme.fonts.regular,
    fontSize: 10, lineHeight: 15,
    color: kit.color.inkFaint,
    textAlign: TEXT_START,
    marginTop: 2,
    includeFontPadding: false,
  },
  suggPrice: {
    fontFamily: theme.fonts.black,
    fontSize: 12, lineHeight: 18,
    color: kit.color.ink,
    includeFontPadding: false,
  },
  suggOos: {
    backgroundColor:   kit.color.dangerTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  suggOosText: {
    fontFamily: theme.fonts.bold,
    fontSize: 9, lineHeight: 14,
    color: kit.color.danger,
    includeFontPadding: false,
  },
  suggEmpty: {
    alignItems:      "center",
    paddingVertical: kit.sp(6),
    gap:             kit.sp(2),
  },
  suggEmptyText: {
    fontFamily: theme.fonts.regular,
    fontSize: 12, lineHeight: 18,
    color: kit.color.inkFaint,
    textAlign: "center",
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
    fontFamily: theme.fonts.black,
    fontSize: 12, lineHeight: 18,
    color: kit.color.accentDeep,
    includeFontPadding: false,
  },
});
