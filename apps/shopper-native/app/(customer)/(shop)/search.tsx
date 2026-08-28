/**
 * Search — a real product-discovery surface, not a bare input on an empty
 * page. Every section here (recent searches, browse-by-concern, trending)
 * uses copy that already existed, fully translated, in the locale files —
 * it just had no screen wired up to render it until now.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, TextInput, Pressable, Keyboard, ActivityIndicator, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Text, EmptyState, ErrorState, useTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import { useQuery } from "@tanstack/react-query";
import { useProductSearch, useInfiniteProducts } from "@/features/products";
import { ProductGrid } from "@/features/products/components/ProductGrid";
import { useRecentSearchesStore } from "@/features/products/stores/recentSearchesStore";
import { resolveSmartQuery } from "@/utils/searchUtils";
import { logSearchEvent, fetchPopularSearches } from "@/features/products/api/searchAnalytics";
import { useSearchIntelligence } from "@/features/products/hooks/useSearchIntelligence";
import { useAuth } from "@/features/auth";
import { isRtl, flexRow, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import type { NativeProduct } from "@/features/products";

// Cheap edit-distance check against a small, known set of terms (trending +
// recent searches — tens of items, not the ~35k product catalog) so a typo
// like "بنادول" can suggest "بانادول" without needing full server-side
// fuzzy search. Deliberately NOT run against the catalog itself: that would
// mean fetching/scanning thousands of names client-side for every empty
// search, which is what the (still-pending) DB trigram migration is for.
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function findDidYouMean(query: string, candidates: string[]): string | null {
  const q = query.trim();
  if (q.length < 3) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const term of candidates) {
    if (term.trim().toLowerCase() === q.toLowerCase()) continue; // exact match isn't a correction
    const dist = levenshtein(q, term);
    // Scale the tolerance with length — "بنادول"→"بانادول" is 1 edit on 6
    // chars; a flat threshold would be too strict for longer product names
    // and too loose for short ones.
    if (dist <= Math.max(1, Math.floor(term.length * 0.3)) && dist < bestDist) {
      best = term;
      bestDist = dist;
    }
  }
  return best;
}

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const TRENDING_COUNT = 6;

const CONCERNS = [
  { key: "Pain", icon: "thermometer-outline" as const, colors: ["#F43F5E", "#E11D48"] as const },
  { key: "Cold", icon: "snow-outline" as const, colors: ["#0EA5E9", "#0284C7"] as const },
  { key: "Allergy", icon: "flower-outline" as const, colors: ["#EC4899", "#DB2777"] as const },
  { key: "Skin", icon: "sparkles-outline" as const, colors: ["#A855F7", "#9333EA"] as const },
  { key: "Vitamin", icon: "nutrition-outline" as const, colors: ["#F59E0B", "#D97706"] as const },
  { key: "Baby", icon: "happy-outline" as const, colors: ["#10B981", "#059669"] as const },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const lang = i18n.language === "en" ? "en" as const : "ar" as const;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [submitted, setSubmitted] = useState("");

  // Client-side smart resolution — instant (no network), so it belongs at
  // the "keystroke stage": Arabic brand/generic/category names resolve to
  // the English form product names are actually stored under, and common
  // English misspellings get fixed, before either debounced suggestion
  // fetch or a submitted search ever reaches the network. The database RPC
  // also does fuzzy/synonym matching now (search_effective_products), so
  // this is a fast first pass, not the only safety net.
  const resolvedDebounced = useMemo(() => resolveSmartQuery(debounced), [debounced]);
  const resolvedSubmitted = useMemo(() => resolveSmartQuery(submitted), [submitted]);

  // Soft focus glow on the search bar — a small, physical-feeling detail
  // (spring scale + border/shadow fade) rather than a hard on/off state.
  const reducedMotion = useReducedMotion();
  const focusAnim = useSharedValue(0);
  const handleFocus = useCallback(() => {
    focusAnim.value = reducedMotion ? 1 : withSpring(1, { damping: 16, stiffness: 220 });
  }, [focusAnim, reducedMotion]);
  const handleBlur = useCallback(() => {
    focusAnim.value = reducedMotion ? 0 : withSpring(0, { damping: 18, stiffness: 220 });
  }, [focusAnim, reducedMotion]);
  const searchBarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focusAnim.value * 0.012 }],
    shadowOpacity: focusAnim.value * 0.18,
  }));
  const glowAnimStyle = useAnimatedStyle(() => ({ opacity: focusAnim.value }));

  const recentTerms = useRecentSearchesStore((s) => s.terms);
  const pushRecent = useRecentSearchesStore((s) => s.push);
  const removeRecent = useRecentSearchesStore((s) => s.remove);
  const clearRecent = useRecentSearchesStore((s) => s.clear);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { products: suggestions, isLoading: suggLoading } = useProductSearch({ query: resolvedDebounced.term });
  const { products: results, isLoading: resLoading, fetchNextPage, hasNextPage, isError, refetch } = useInfiniteProducts({ search: resolvedSubmitted.term, enabled: submitted.trim().length > 0 });

  const isDiscovery = query === "" && submitted === "";
  const isTyping = query !== "" && submitted === "";
  const isResults = submitted !== "";

  const runSearch = useCallback((term: string) => {
    Keyboard.dismiss();
    const trimmed = term.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmitted(trimmed);
    pushRecent(trimmed);
  }, [pushRecent]);

  const handleSubmit = () => runSearch(query);

  const handleClear = () => {
    setQuery("");
    setDebounced("");
    setSubmitted("");
    Keyboard.dismiss();
  };

  const goProduct = useCallback((product: NativeProduct) => {
    router.push(`/(customer)/(shop)/product/${product.id}`);
  }, [router]);

  const goProductByName = useCallback((product: NativeProduct) => {
    runSearch(product.name);
  }, [runSearch]);

  const retry = useCallback(async () => { await refetch(); }, [refetch]);

  const allProducts = useMemo(() => results || [], [results]);
  const firstName = useMemo(() => (user?.name ?? "").split(" ")[0].trim() || null, [user?.name]);

  // Real search analytics (search_events / log_search_event / get_popular_
  // searches — already deployed, previously never called by any client).
  // Logged once per submitted query, after results settle so the actual hit
  // count is known — not on every keystroke.
  useEffect(() => {
    if (!submitted || resLoading) return;
    logSearchEvent(submitted, allProducts.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, resLoading]);

  // Product Intelligence Stage 3 — natural-language interpretation, additive
  // only: the results grid below always comes from useInfiniteProducts
  // (search_effective_products), so this never blocks or replaces search
  // when the Edge Function isn't deployed / has no AI provider configured /
  // times out. Only fired for longer, descriptive queries (3+ words) — a
  // short brand/product lookup like "بنادول" is already answered perfectly
  // by the plain RPC and doesn't need intent classification.
  const searchIntelligence = useSearchIntelligence();
  useEffect(() => {
    if (!submitted || submitted.trim().split(/\s+/).length < 3) {
      searchIntelligence.reset();
      return;
    }
    void searchIntelligence.run({ query: submitted, limit: 20 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const { data: popularSearches } = useQuery({
    queryKey: ["search", "popular"],
    queryFn: () => fetchPopularSearches(TRENDING_COUNT),
    staleTime: 10 * 60_000,
  });
  // Static translated fallback for a cold project with no search history yet
  // — once search_events accumulates real rows, popularSearches wins.
  const staticTrendingTerms = useMemo(
    () => Array.from({ length: TRENDING_COUNT }, (_, i) => t(`search.trending${i}`)),
    [t],
  );
  const trendingTerms = useMemo(
    () => (popularSearches?.length ? popularSearches.map((p) => p.query) : staticTrendingTerms),
    [popularSearches, staticTrendingTerms],
  );
  const knownTermsPool = useMemo(
    () => Array.from(new Set([...trendingTerms, ...recentTerms])),
    [trendingTerms, recentTerms],
  );
  const didYouMeanSuggestion = useMemo(
    () => (suggestions?.length ? null : findDidYouMean(debounced, knownTermsPool)),
    [debounced, knownTermsPool, suggestions],
  );
  const didYouMeanResults = useMemo(
    () => (allProducts.length ? null : findDidYouMean(submitted, knownTermsPool)),
    [submitted, knownTermsPool, allProducts.length],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas.background }]}>
      <StatusBar style="light" />

      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={[styles.headerRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")} style={styles.backBtn}>
            <Ionicons name={BACK_CHEVRON} size={22} color="#fff" />
          </Pressable>
          <View style={styles.inputBoxOuter}>
            {/* Soft white glow that fades in on focus, sitting just outside
                the bar rather than a hard focus-ring border. */}
            <Animated.View pointerEvents="none" style={[styles.inputGlow, { backgroundColor: "#fff" }, glowAnimStyle]} />
            <Animated.View
              style={[
                styles.inputBox,
                theme.shadows[2],
                { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surface },
                searchBarAnimStyle,
              ]}
            >
              <Ionicons name="search" size={20} color={theme.colors.brand.primary} />
              <TextInput
                value={query}
                onChangeText={(txt) => { setQuery(txt); if (submitted) setSubmitted(""); }}
                onSubmitEditing={handleSubmit}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={t("search.placeholder")}
                placeholderTextColor={theme.colors.text.muted}
                style={[styles.input, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left" }]}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)}>
                  <Pressable onPress={handleClear} accessibilityRole="button" accessibilityLabel={t("search.clear")} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.text.muted} />
                  </Pressable>
                </Animated.View>
              )}
            </Animated.View>
          </View>
        </View>
      </LinearGradient>

      {/* Smart-resolution cue — shown only when the query was actually
          translated/corrected, so it reads as useful feedback ("we understood
          you") rather than a permanent chrome element. Grounded in the real
          resolved term, never a generic "AI thinking" indicator. */}
      {isResults && resolvedSubmitted.displayHint && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.hintBar, { backgroundColor: theme.colors.brand.primaryLight }]}>
          <Ionicons name="sparkles" size={13} color={theme.colors.brand.primary} />
          <Text variant="caption" weight="bold" style={{ color: theme.colors.brand.primary }}>{resolvedSubmitted.displayHint}</Text>
        </Animated.View>
      )}

      {/* Natural-language interpretation cue — only rendered when the Edge
          Function actually returned a grounded explanation for a real,
          already-fetched result set. Never shown while the AI call is
          in flight (no "thinking" chrome) and silently absent whenever the
          Edge Function is unavailable, unconfigured, or the query didn't
          qualify — search itself is completely unaffected either way. */}
      {isResults && !searchIntelligence.isLoading && searchIntelligence.aiExplanation && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.hintBar, { backgroundColor: theme.colors.brand.primaryLight }]}>
          <Ionicons name="sparkles" size={13} color={theme.colors.brand.primary} />
          <Text variant="caption" style={{ color: theme.colors.text.primary, flex: 1 }}>{searchIntelligence.aiExplanation}</Text>
        </Animated.View>
      )}

      {isResults && !searchIntelligence.isLoading && searchIntelligence.clarificationQuestion && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.hintBar, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
          <Ionicons name="help-circle-outline" size={14} color={theme.colors.text.secondary} />
          <Text variant="caption" style={{ color: theme.colors.text.secondary, flex: 1 }}>{searchIntelligence.clarificationQuestion}</Text>
        </Animated.View>
      )}

      <View style={styles.content}>
        {isDiscovery && (
          <Animated.View entering={FadeIn} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text variant="h5" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>
                {firstName ? t("search.greetUser", { name: firstName }) : t("search.greetGuest")}
              </Text>
              <Text variant="body" style={{ color: theme.colors.text.secondary, textAlign: TEXT_START, marginTop: 4 }}>
                {t("search.subtitleLine", "5,000+ medicines, vitamins & brands")}
              </Text>

              <View style={[styles.modeRow, { flexDirection: flexRow(IS_RTL) }]}>
                <Pressable onPress={() => router.push("/(customer)/prescriptions/scan")} style={({ pressed }) => [styles.modeCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[1], pressed && { transform: [{ scale: 0.98 }] }]}>
                  <LinearGradient colors={["#0DA99C", "#086F63"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeIconWell}>
                    <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
                  </LinearGradient>
                  <Text variant="bodySm" weight="bold" style={{ color: theme.colors.text.primary }}>{t("search.modeScanLabel")}</Text>
                </Pressable>
                <Pressable onPress={() => router.push("/(customer)/(tabs)/products")} style={({ pressed }) => [styles.modeCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[1], pressed && { transform: [{ scale: 0.98 }] }]}>
                  <LinearGradient colors={["#F59E0B", "#D97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeIconWell}>
                    <Ionicons name="grid-outline" size={22} color="#FFFFFF" />
                  </LinearGradient>
                  <Text variant="bodySm" weight="bold" style={{ color: theme.colors.text.primary }}>{t("search.modeBrowseLabel")}</Text>
                </Pressable>
              </View>

              {recentTerms.length > 0 && (
                <View style={styles.section}>
                  <View style={[styles.sectionHead, { flexDirection: flexRow(IS_RTL) }]}>
                    <Text variant="label" style={{ color: theme.colors.text.primary }}>{t("search.recentTitle")}</Text>
                    <Pressable onPress={clearRecent} hitSlop={8}>
                      <Text variant="caption" weight="bold" style={{ color: theme.colors.brand.primary }}>{t("search.clearRecents")}</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.chipWrap, { flexDirection: flexRow(IS_RTL) }]}>
                    {recentTerms.map((term) => (
                      <View key={term} style={[styles.recentChip, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                        <Pressable onPress={() => runSearch(term)} style={[styles.recentChipTap, { flexDirection: flexRow(IS_RTL) }]}>
                          <Ionicons name="time-outline" size={13} color={theme.colors.text.muted} />
                          <Text variant="caption" style={{ color: theme.colors.text.primary }}>{term}</Text>
                        </Pressable>
                        <Pressable onPress={() => removeRecent(term)} hitSlop={8} style={styles.recentChipRemove}>
                          <Ionicons name="close" size={12} color={theme.colors.text.muted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text variant="label" style={{ color: theme.colors.text.primary, textAlign: TEXT_START, marginBottom: 12 }}>
                  {t("search.concernsTitle")}
                </Text>
                <View style={[styles.concernGrid, { flexDirection: flexRow(IS_RTL) }]}>
                  {CONCERNS.map((c) => (
                    <Pressable
                      key={c.key}
                      onPress={() => runSearch(t(`search.concernTerm${c.key}`))}
                      style={({ pressed }) => [
                        styles.concernCard,
                        { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default },
                        theme.shadows[1],
                        pressed && { transform: [{ scale: 0.97 }] },
                      ]}
                    >
                      <LinearGradient colors={c.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.concernIconWell}>
                        <Ionicons name={c.icon} size={20} color="#FFFFFF" />
                      </LinearGradient>
                      <Text variant="caption" weight="bold" numberOfLines={1} style={{ color: theme.colors.text.primary }}>
                        {t(`search.concern${c.key}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text variant="label" style={{ color: theme.colors.text.primary, textAlign: TEXT_START, marginBottom: 12 }}>
                  {t("search.trendingTitle")}
                </Text>
                <View style={[styles.chipWrap, { flexDirection: flexRow(IS_RTL) }]}>
                  {trendingTerms.map((term) => (
                    <Pressable key={term} onPress={() => runSearch(term)} style={[styles.trendingChip, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default }]}>
                      <Ionicons name="flame-outline" size={12} color={theme.colors.status.warning} />
                      <Text variant="caption" style={{ color: theme.colors.text.primary }}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

            </ScrollView>
          </Animated.View>
        )}

        {isTyping && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1 }}>
            <ScrollView style={{ backgroundColor: theme.colors.canvas.surface }} keyboardShouldPersistTaps="handled">
              {suggLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.brand.primary} /></View>
              ) : suggestions?.length ? (
                suggestions.map((p) => (
                  <Pressable key={p.id} style={[styles.suggRow, { flexDirection: flexRow(IS_RTL), borderBottomColor: theme.colors.border.default }]} onPress={() => goProductByName(p)}>
                    {p.imageUrl ? (
                      <Image source={{ uri: p.imageUrl }} style={styles.suggThumb} contentFit="contain" />
                    ) : (
                      <View style={[styles.suggThumb, styles.suggThumbPlaceholder, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                        <Ionicons name="medkit-outline" size={16} color={theme.colors.text.muted} />
                      </View>
                    )}
                    <Text variant="body" numberOfLines={1} style={{ flex: 1, color: theme.colors.text.primary, textAlign: TEXT_START }}>{p.name}</Text>
                    <Text variant="caption" weight="bold" style={{ color: theme.colors.text.secondary }}>{formatPrice(p.price, lang)}</Text>
                  </Pressable>
                ))
              ) : (
                <Animated.View entering={FadeIn.duration(220)} style={styles.center}>
                  <View style={[styles.emptyIconWell, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                    <Ionicons name="search-outline" size={28} color={theme.colors.text.muted} />
                  </View>
                  <Text variant="body" style={{ color: theme.colors.text.secondary, textAlign: "center", marginTop: 14 }}>{t("search.noSuggestions", { query: debounced })}</Text>

                  {didYouMeanSuggestion && (
                    <Pressable onPress={() => runSearch(didYouMeanSuggestion)} style={[styles.didYouMeanChip, { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary }]}>
                      <Ionicons name="sparkles" size={14} color={theme.colors.brand.primary} />
                      <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("search.didYouMean", "هل تقصد")}</Text>
                      <Text variant="body" weight="black" style={{ color: theme.colors.brand.primary }}>{didYouMeanSuggestion}</Text>
                    </Pressable>
                  )}

                  <Pressable onPress={handleSubmit} style={{ marginTop: 14 }}>
                    <Text variant="body" weight="bold" style={{ color: theme.colors.brand.primary }}>{t("search.showAll", { query: debounced })}</Text>
                  </Pressable>
                </Animated.View>
              )}
            </ScrollView>
          </Animated.View>
        )}

        {isResults && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1 }}>
            {resLoading ? (
              <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.brand.primary} /></View>
            ) : isError ? (
              <ErrorState message={t("errors.generic", "Something went wrong")} retry={retry} />
            ) : allProducts.length === 0 ? (
              <View style={{ flex: 1 }}>
                <EmptyState
                  illustrationName="empty"
                  title={t("search.noResults")}
                  subtitle={t("search.noResultsDescEn", { query: submitted })}
                  action={{ label: t("search.clear"), onPress: handleClear }}
                />
                {didYouMeanResults && (
                  <Animated.View entering={FadeIn.delay(150)} style={{ alignItems: "center", marginTop: -24 }}>
                    <Pressable onPress={() => runSearch(didYouMeanResults)} style={[styles.didYouMeanChip, { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary }]}>
                      <Ionicons name="sparkles" size={14} color={theme.colors.brand.primary} />
                      <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("search.didYouMean", "هل تقصد")}</Text>
                      <Text variant="body" weight="black" style={{ color: theme.colors.brand.primary }}>{didYouMeanResults}</Text>
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            ) : (
              <ProductGrid
                products={allProducts}
                onProductPress={goProduct}
                onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
                contentContainerStyle={{ padding: 16 }}
              />
            )}
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { alignItems: "center", gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  inputBoxOuter: { flex: 1 },
  inputGlow: { position: "absolute", top: -3, start: -3, end: -3, bottom: -3, borderRadius: 15, opacity: 0.16 },
  inputBox: {
    alignItems: "center",
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  input: { flex: 1, height: "100%", fontSize: 16, fontFamily: "Cairo_500Medium" },
  clearBtn: { padding: 4 },
  content: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40, gap: 4 },
  center: { padding: 40, alignItems: "center" },
  emptyIconWell: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  hintBar: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  didYouMeanChip: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 6, marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999, borderWidth: 1 },
  suggRow: { alignItems: "center", padding: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  suggThumb: { width: 36, height: 36, borderRadius: 8 },
  suggThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  modeRow: { gap: 12, marginTop: 24 },
  modeCard: { flex: 1, padding: 18, borderRadius: 16, alignItems: "center", gap: 10, borderWidth: 1 },
  modeIconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  section: { marginTop: 28 },
  sectionHead: { alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  chipWrap: { flexWrap: "wrap", gap: 8 },
  recentChip: { alignItems: "center", borderRadius: 9999, paddingStart: 12, paddingEnd: 4, height: 34, gap: 4 },
  recentChipTap: { alignItems: "center", gap: 6, paddingEnd: 4 },
  recentChipRemove: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  trendingChip: { alignItems: "center", gap: 6, borderRadius: 9999, paddingHorizontal: 12, height: 34, borderWidth: 1 },
  concernGrid: { flexWrap: "wrap", gap: 10 },
  concernCard: { width: "31%", alignItems: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  concernIconWell: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
