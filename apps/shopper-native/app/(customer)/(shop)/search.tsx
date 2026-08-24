import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, TextInput, Pressable, Keyboard, ActivityIndicator, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, EmptyState, ErrorState, useTheme } from "@pharmacy/ui-native";
import { useProductSearch, useInfiniteProducts } from "@/features/products";
import { ProductGrid } from "@/features/products/components/ProductGrid";
import { isRtl, flexRow } from "@/utils/layout";
import type { NativeProduct } from "@/features/products";

const IS_RTL = isRtl();

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, isDark } = useTheme();

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

  const goProduct = useCallback((product: NativeProduct) => {
    router.push(`/(customer)/(shop)/product/${product.id}`);
  }, [router]);

  const goProductByName = useCallback((product: NativeProduct) => {
    setQuery(product.name);
    setSubmitted(product.name);
    Keyboard.dismiss();
  }, []);

  const retry = useCallback(async () => { await refetch(); }, [refetch]);

  const allProducts = useMemo(() => results || [], [results]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.header, { backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
        <View style={[styles.inputBox, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.background }]}>
          <Ionicons name="search" size={20} color={theme.colors.text.muted} />
          <TextInput
            value={query}
            onChangeText={(txt) => { setQuery(txt); if (submitted) setSubmitted(""); }}
            onSubmitEditing={handleSubmit}
            placeholder={t("search.placeholder")}
            placeholderTextColor={theme.colors.text.muted}
            style={[styles.input, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left" }]}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={handleClear} accessibilityRole="button" accessibilityLabel={t("search.clear")} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={theme.colors.text.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.content}>
        {isDiscovery && (
          <Animated.View entering={FadeIn} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={[styles.discoveryCard, theme.shadows[1], { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
                <Text variant="h5" style={{ color: theme.colors.text.primary, marginBottom: 16, textAlign: "center" }}>
                  {t("search.displayTitle", "Search anything")}
                </Text>
                <Text variant="body" style={{ color: theme.colors.text.secondary, textAlign: "center", marginBottom: 24 }}>
                  {t("search.subtitleLine", "5000+ medicines, vitamins, brands")}
                </Text>
                <View style={[styles.modeRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <Pressable onPress={() => router.push("/(customer)/prescriptions/scan")} style={[styles.modeCard, { backgroundColor: theme.colors.brand.primaryLight }]}>
                    <Ionicons name="scan-outline" size={24} color={theme.colors.brand.primary} />
                    <Text variant="bodySm" weight="bold" style={{ color: theme.colors.text.primary }}>{t("search.modeScanLabel", "Scan Rx")}</Text>
                  </Pressable>
                  <Pressable onPress={handleSubmit} style={[styles.modeCard, { backgroundColor: `${theme.colors.status.warning}1A` }]}>
                    <Ionicons name="search-outline" size={24} color={theme.colors.status.warning} />
                    <Text variant="bodySm" weight="bold" style={{ color: theme.colors.text.primary }}>{t("search.modeBrowseLabel", "Browse All")}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {isTyping && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1 }}>
            <ScrollView style={{ backgroundColor: theme.colors.canvas.surface }}>
              {suggLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.brand.primary} /></View>
              ) : suggestions?.length ? (
                suggestions.map((p) => (
                  <Pressable key={p.id} style={[styles.suggRow, { flexDirection: flexRow(IS_RTL), borderBottomColor: theme.colors.border.default }]} onPress={() => goProductByName(p)}>
                    <Ionicons name="search-outline" size={16} color={theme.colors.text.muted} />
                    <Text variant="body" style={{ color: theme.colors.text.primary }}>{p.name}</Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.center}>
                  <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("search.noSuggestions", "No suggestions found.")}</Text>
                </View>
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
              <EmptyState
                illustrationName="empty"
                title={t("search.noResults")}
                subtitle={t("search.noResultsDescEn")}
                action={{ label: t("search.clear"), onPress: handleClear }}
              />
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
  header: { padding: 16, borderBottomWidth: 1 },
  inputBox: { alignItems: "center", paddingHorizontal: 12, height: 48, borderRadius: 12, gap: 8 },
  input: { flex: 1, height: "100%", fontSize: 16, fontFamily: "Cairo_500Medium" },
  clearBtn: { padding: 4 },
  content: { flex: 1 },
  scroll: { padding: 16, gap: 24 },
  center: { padding: 40, alignItems: "center" },
  suggRow: { alignItems: "center", padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  discoveryCard: { padding: 24, borderRadius: 20, borderWidth: 1 },
  modeRow: { gap: 12 },
  modeCard: { flex: 1, padding: 20, borderRadius: 16, alignItems: "center", gap: 8 },
});
