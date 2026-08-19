/**
 * Search — Phase 3 Redesign.
 * Core Experience for Discovery & Search.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, TextInput, Pressable, Keyboard, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomerUI } from "@pharmacy/ui-native";
import { useProductSearch, useInfiniteProducts } from "@/features/products";
import { ProductGrid } from "@/features/products/components/ProductGrid";
import { isRtl, flexRow } from "@/utils/layout";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const theme = CustomerUI.useLuxuryTheme();
  
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [submitted, setSubmitted] = useState("");

  // Typing -> Debounced
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: suggestions, isLoading: suggLoading } = useProductSearch({ query: debounced });
  const { data: results, isLoading: resLoading, fetchNextPage, hasNextPage, isError, refetch } = useInfiniteProducts({ search: submitted, enabled: submitted.trim().length > 0 });

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

  const allProducts = useMemo(() => results?.pages.flatMap(p => p.items) || [], [results]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.line }]}>
        <View style={[styles.inputBox, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="search" size={20} color={theme.colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={(txt) => { setQuery(txt); if(submitted) setSubmitted(""); }}
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
          <Animated.ScrollView entering={FadeIn} exiting={FadeOut} contentContainerStyle={styles.scroll}>
            <CustomerUI.Section title={t("search.recent")}>
              {/* Recent searches will map here */}
              <CustomerUI.Typography variant="body" color={theme.colors.inkSoft}>No recent searches.</CustomerUI.Typography>
            </CustomerUI.Section>
            
            <CustomerUI.Section title={t("search.trending")}>
              <CustomerUI.Typography variant="body" color={theme.colors.inkSoft}>No trending items.</CustomerUI.Typography>
            </CustomerUI.Section>
          </Animated.ScrollView>
        )}

        {isTyping && (
          <Animated.ScrollView entering={FadeIn} exiting={FadeOut} style={{ backgroundColor: theme.colors.surface }}>
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
                <CustomerUI.Typography variant="body" color={theme.colors.inkSoft}>No suggestions found.</CustomerUI.Typography>
              </View>
            )}
          </Animated.ScrollView>
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
                description={t("search.noResultsDesc")} 
                actionLabel={t("search.clear")} 
                onAction={handleClear} 
              />
            ) : (
              <ProductGrid
                products={allProducts}
                onProductPress={() => {}} // Context router handled internally by ProductCard in reality
                onEndReached={() => { if(hasNextPage) fetchNextPage(); }}
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
});
