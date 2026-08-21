import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, TextInput, Pressable, Keyboard, ActivityIndicator, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomerUI, kit } from "@pharmacy/ui-native";
import { useProductSearch, useInfiniteProducts } from "@/features/products";
import { ProductGrid } from "@/features/products/components/ProductGrid";
import { isRtl, flexRow } from "@/utils/layout";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const theme = CustomerUI.useCustomerTheme();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [submitted, setSubmitted] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { products: suggestions, isLoading: suggLoading } = useProductSearch({ query: debounced });
  const { products: results, isLoading: resLoading, fetchNextPage, hasNextPage, isError, refetch } = useInfiniteProducts({ search: submitted, enabled: submitted.trim().length > 0 });

  const isDiscovery = query === "" && submitted === "";
  const isTyping = query !== "" && submitted === "";
  const isResults = submitted !== "";

  const handleSubmit = () => {
    Keyboard.dismiss();
    setSubmitted(query);
  };

  const handleClear = () => {
    setQuery("");
    setDebounced("");
    setSubmitted("");
    Keyboard.dismiss();
  };

  const allProducts = useMemo(() => results || [], [results]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />

      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.line }]}>
        <View style={[styles.inputBox, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="search" size={20} color={theme.colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={(txt) => { setQuery(txt); if (submitted) setSubmitted(""); }}
            onSubmitEditing={handleSubmit}
            placeholder={t("search.placeholder")}
            placeholderTextColor={theme.colors.inkFaint}
            style={[styles.input, { color: theme.colors.ink }]}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={handleClear} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={theme.colors.inkFaint} />
            </Pressable>
          )}
        </View>
      </View>

      {/* States */}
      <View style={styles.content}>
        {isDiscovery && (
          <Animated.View entering={FadeIn}>
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={styles.discoveryCard}>
                <CustomerUI.Typography variant="h5" weight="black" color={theme.colors.ink} style={{ marginBottom: 16, textAlign: "center" }}>
                  {t("search.displayTitle", "Search anything")}
                </CustomerUI.Typography>
                <CustomerUI.Typography variant="body" color={theme.colors.inkSoft} style={{ textAlign: "center", marginBottom: 24 }}>
                  {t("search.subtitleLine", "5000+ medicines, vitamins, brands")}
                </CustomerUI.Typography>
                <View style={[styles.modeRow, { flexDirection: flexRow(isRtl()) }]}>
                  <Pressable onPress={() => {}} style={[styles.modeCard, { backgroundColor: theme.colors.accentTint }]}>
                    <Ionicons name="scan-outline" size={24} color={theme.colors.accentDeep} />
                    <CustomerUI.Typography variant="bodySm" weight="bold" color={theme.colors.ink}>{t("search.modeScanLabel", "Scan Rx")}</CustomerUI.Typography>
                  </Pressable>
                  <Pressable onPress={handleSubmit} style={[styles.modeCard, { backgroundColor: kit.color.warnTint }]}>
                    <Ionicons name="search-outline" size={24} color={kit.color.warn} />
                    <CustomerUI.Typography variant="bodySm" weight="bold" color={theme.colors.ink}>{t("search.modeBrowseLabel", "Browse All")}</CustomerUI.Typography>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {isTyping && (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <ScrollView style={{ backgroundColor: theme.colors.surface }}>
              {suggLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.accent} /></View>
              ) : suggestions?.length ? (
                suggestions.map((p) => (
                  <Pressable key={p.id} style={[styles.suggRow, { borderBottomColor: theme.colors.line }]} onPress={() => { setQuery(p.name); setSubmitted(p.name); Keyboard.dismiss(); }}>
                    <Ionicons name="search-outline" size={16} color={theme.colors.inkFaint} />
                    <CustomerUI.Typography variant="body" color={theme.colors.ink}>{p.name}</CustomerUI.Typography>
                  </Pressable>
                ))
              ) : (
                <View style={styles.center}>
                  <CustomerUI.Typography variant="body" color={theme.colors.inkSoft}>{t("search.noSuggestions", "No suggestions found.")}</CustomerUI.Typography>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        )}

        {isResults && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1 }}>
            {resLoading ? (
              <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.accent} /></View>
            ) : isError ? (
              <CustomerUI.ErrorState onRetry={() => refetch()} />
            ) : allProducts.length === 0 ? (
              <CustomerUI.EmptyState
                icon="search"
                title={t("search.noResults")}
                description={t("search.noResultsDescEn")}
                actionLabel={t("search.clear")}
                onAction={handleClear}
              />
            ) : (
              <ProductGrid
                products={allProducts}
                onProductPress={() => {}}
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
  header: { padding: 16, borderBottomWidth: 1 },
  inputBox: { flexDirection: flexRow(isRtl()), alignItems: "center", paddingHorizontal: 12, height: 48, borderRadius: 12, gap: 8 },
  input: { flex: 1, height: "100%", fontSize: 16, fontFamily: "Cairo-Medium", textAlign: isRtl() ? "right" : "left" },
  clearBtn: { padding: 4 },
  content: { flex: 1 },
  scroll: { padding: 16, gap: 24 },
  center: { padding: 40, alignItems: "center" },
  suggRow: { flexDirection: flexRow(isRtl()), alignItems: "center", padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  discoveryCard: { padding: 24, backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.card },
  modeRow: { gap: 12 },
  modeCard: { flex: 1, padding: 20, borderRadius: 16, alignItems: "center", gap: 8 },
});
