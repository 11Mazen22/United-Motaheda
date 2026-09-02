/**
 * InventoryIntelligenceScreen — pharmacist inventory intelligence dashboard.
 *
 * Tabs:
 *   • Low Stock    — products with available <= 5, sorted by most critical
 *   • Out of Stock — available = 0
 *   • Search       — full-text + barcode search
 *
 * Each product card shows:
 *   - Name (Arabic + English)
 *   - Code / Barcode
 *   - On-hand / Reserved / Available
 *   - Category
 *   - Price
 *   - Urgency colour band (red = out of stock, amber = 1-5 on hand, green = 6+)
 *
 * Gradient hero header matches the rest of the pharmacist product (Workbench,
 * Orders) instead of the plain title bar it had before, and states the
 * live low-stock/out-of-stock counts up front — a pharmacist opening this
 * screen wants to know "how bad is it" before they even pick a tab.
 */
import React, { useState, useCallback, useDeferredValue, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { gradients } from "@pharmacy/design-tokens";

import { Screen, Text as UIText, EmptyState, useTheme, PressableScale, type NativeTheme } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice, fmtN } from "@/utils/format";

import {
  useLowStockProducts,
  useOutOfStockProducts,
  useProductSearch,
} from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import type { PharmacistProduct } from "../api/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type InventoryTab = "lowstock" | "search" | "outofstock";

// ─── Urgency band ────────────────────────────────────────────────────────────

function urgencyColor(available: number, colors: NativeTheme["colors"]): string {
  if (available === 0) return colors.status.error;
  if (available <= 5) return colors.status.warning;
  return colors.status.success;
}

// ─── Product card ────────────────────────────────────────────────────────────

function ProductCard({
  product,
  index,
  onScan,
  colors,
  styles,
}: {
  product: PharmacistProduct;
  index: number;
  onScan: (barcode: string) => void;
  colors: NativeTheme["colors"];
  styles: ReturnType<typeof createStyles>;
}) {
  const { t } = useTranslation();
  const urg = urgencyColor(product.available, colors);
  const isOut = product.available === 0;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 30).duration(240)}>
      <View style={[styles.card, { borderStartColor: urg, borderStartWidth: 4, backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Header row */}
        <View style={[styles.cardHeader, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>
              {product.nameAr ?? product.nameEn ?? product.name}
            </UIText>
            {product.nameEn && product.nameAr && (
              <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }} numberOfLines={1}>
                {product.nameEn}
              </UIText>
            )}
          </View>
          <UIText style={[styles.price, { color: colors.brand.primaryDark }]}>{formatPrice(product.effectivePrice)}</UIText>
        </View>

        {/* Code + category */}
        <View style={[styles.metaRow, { flexDirection: flexRow(IS_RTL) }]}>
          {product.code && (
            <View style={[styles.chip, { flexDirection: flexRow(IS_RTL), backgroundColor: colors.canvas.surfaceMuted, borderColor: colors.line }]}>
              <Ionicons name="barcode-outline" size={10} color={colors.inkSoft} />
              <UIText style={[styles.chipText, { color: colors.inkSoft }]}>{product.code}</UIText>
            </View>
          )}
          {product.categoryName && (
            <View style={[styles.chip, { flexDirection: flexRow(IS_RTL), backgroundColor: colors.canvas.surfaceMuted, borderColor: colors.line }]}>
              <Ionicons name="folder-outline" size={10} color={colors.inkSoft} />
              <UIText style={[styles.chipText, { color: colors.inkSoft }]} numberOfLines={1}>{product.categoryName}</UIText>
            </View>
          )}
          {isOut && (
            <View style={[styles.chip, { flexDirection: flexRow(IS_RTL), backgroundColor: colors.statusSoft.error.bg, borderColor: colors.status.error }]}>
              <Ionicons name="close-circle" size={10} color={colors.status.error} />
              <UIText style={[styles.chipText, { color: colors.status.error }]}>
                {t("pharmacist.stockExhausted", "نفد المخزون")}
              </UIText>
            </View>
          )}
        </View>

        {/* Stock grid */}
        <View style={[styles.stockRow, { flexDirection: flexRow(IS_RTL) }]}>
          {[
            { label: t("pharmacist.onHand", "في المخزن"), value: product.onHand },
            { label: t("pharmacist.reserved", "محجوز"), value: product.reserved },
            { label: t("pharmacist.available", "متاح"), value: product.available, warn: true },
          ].map(({ label, value, warn }) => (
            <View key={label} style={[styles.stockCell, { backgroundColor: colors.canvas.surfaceMuted }]}>
              <UIText style={[styles.stockValue, warn ? { color: urgencyColor(product.available, colors) } : null]}>
                {value}
              </UIText>
              <UIText style={[styles.stockLabel, { color: colors.inkSoft }]} numberOfLines={1}>{label}</UIText>
            </View>
          ))}

          {/* Scan button */}
          {product.barcode && (
            <PressableScale
              onPress={() => onScan(product.barcode!)}
              style={[styles.scanBtn, { backgroundColor: colors.brand.primaryLight, borderColor: colors.line }]}
              accessibilityRole="button"
              accessibilityLabel={t("pharmacist.scannerTitle")}
            >
              <Ionicons name="barcode-outline" size={14} color={colors.brand.primaryDark} />
            </PressableScale>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function InventoryIntelligenceScreen(): React.ReactElement {
  const { theme } = useTheme();
  const { pagePad, isTablet } = useScreenLayout();
  const styles = useMemo(() => createStyles(theme, pagePad), [theme, pagePad]);
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string }>();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<InventoryTab>("lowstock");
  const [rawQuery, setRawQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const query = useDeferredValue(rawQuery.trim());

  React.useEffect(() => {
    if (typeof params.query !== "string") return;
    const nextQuery = params.query.trim();
    if (!nextQuery || nextQuery === rawQuery) return;
    setRawQuery(nextQuery);
    setTab("search");
  }, [params.query, rawQuery]);

  const lowStockQuery = useLowStockProducts();
  const outOfStockQuery = useOutOfStockProducts();
  const searchQuery = useProductSearch(query);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.lowStock() }),
        queryClient.invalidateQueries({ queryKey: [...pharmacistQueryKeys.lowStock(), "out-of-stock"] }),
        queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.products(query) }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, query]);

  const handleScan = useCallback((barcode: string) => {
    router.push({
      pathname: "/(pharmacist)/scanner",
      params: { mode: "inventory", barcode },
    });
  }, [router]);

  // Derive current list
  const items: PharmacistProduct[] =
    tab === "lowstock" ? (lowStockQuery.data ?? []) :
    tab === "outofstock" ? (outOfStockQuery.data ?? []) :
    (searchQuery.data ?? []);

  const isLoading =
    tab === "lowstock" ? lowStockQuery.isLoading :
    tab === "outofstock" ? outOfStockQuery.isLoading :
    (query.length > 0 && searchQuery.isLoading);

  const isError =
    tab === "lowstock" ? lowStockQuery.isError :
    tab === "outofstock" ? outOfStockQuery.isError :
    (query.length > 0 && searchQuery.isError);

  const lowStockCount = lowStockQuery.data?.length ?? 0;
  const outOfStockCount = outOfStockQuery.data?.length ?? 0;

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingHorizontal: pagePad }]}
      >
        <View style={[styles.heroRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UIText variant="eyebrow" style={styles.heroEyebrow}>
              {t("pharmacist.inventoryEyebrow", "Stock Intelligence")}
            </UIText>
            <UIText variant="screen-title" style={{ color: "#fff" }}>
              {t("pharmacist.inventoryTitle")}
            </UIText>
          </View>
          <Pressable
            onPress={() => router.push("/(pharmacist)/scanner")}
            style={styles.scannerBtn}
            accessibilityRole="button"
            accessibilityLabel={t("pharmacist.scannerTitle")}
          >
            <Ionicons name="barcode-outline" size={20} color="#fff" />
          </Pressable>
        </View>
        <View style={[styles.heroStatRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={styles.heroStat}>
            <UIText style={styles.heroStatValue}>{fmtN(lowStockCount)}</UIText>
            <UIText style={styles.heroStatLabel} numberOfLines={1}>{t("pharmacist.modeLowStock")}</UIText>
          </View>
          <View style={styles.heroStat}>
            <UIText style={styles.heroStatValue}>{fmtN(outOfStockCount)}</UIText>
            <UIText style={styles.heroStatLabel} numberOfLines={1}>{t("pharmacist.modeOutOfStock", "Out of Stock")}</UIText>
          </View>
        </View>
      </LinearGradient>

      {/* Search bar — always visible */}
      <View style={[styles.searchBar, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default }]}>
        <Ionicons name="search-outline" size={16} color={theme.colors.text.muted} />
        <TextInput
          value={rawQuery}
          onChangeText={(v) => { setRawQuery(v); if (v.trim()) setTab("search"); }}
          placeholder={t("pharmacist.inventorySearch")}
          placeholderTextColor={theme.colors.text.muted}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.searchInput, { color: theme.colors.text.primary }]}
          returnKeyType="search"
        />
        {rawQuery.length > 0 && (
          <Pressable
            onPress={() => { setRawQuery(""); setTab("lowstock"); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("common.clear", "Clear")}
          >
            <Ionicons name="close-circle" size={16} color={theme.colors.text.muted} />
          </Pressable>
        )}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabs, { flexDirection: flexRow(IS_RTL) }]}>
        {(["lowstock", "outofstock", "search"] as InventoryTab[]).map((tabKey) => {
          const labels: Record<InventoryTab, string> = {
            lowstock: t("pharmacist.modeLowStock"),
            outofstock: t("pharmacist.modeOutOfStock", "نفد"),
            search: t("pharmacist.modeSearch"),
          };
          const active = tab === tabKey;
          return (
            <Pressable
              key={tabKey}
              onPress={() => {
                setTab(tabKey);
                if (tabKey !== "search") setRawQuery("");
              }}
              style={[styles.tab, { backgroundColor: active ? theme.colors.brand.primary : theme.colors.canvas.surfaceMuted, borderColor: active ? theme.colors.brand.primary : theme.colors.border.default }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <UIText style={[styles.tabText, { color: active ? theme.colors.text.inverse : theme.colors.text.secondary }]}>
                {labels[tabKey]}
              </UIText>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, isTablet && styles.listTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand.primary}
            colors={[theme.colors.brand.primary]}
          />
        }
        renderItem={({ item, index }) => (
          <ProductCard product={item} index={index} onScan={handleScan} colors={theme.colors} styles={styles} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={theme.colors.brand.primary} />
            </View>
          ) : isError ? (
            <EmptyState
              illustrationName="offline"
              title={t("errors.network").split(".")[0]}
              subtitle={t("errors.network")}
              action={{ label: t("common.retry"), onPress: () => void onRefresh() }}
            />
          ) : (
            <EmptyState
              icon="cube-outline"
              title={tab === "search" && query.length === 0 ? t("pharmacist.inventorySearchPrompt", "اكتب للبحث…") : t("pharmacist.emptySearch")}
            />
          )
        }
      />
    </Screen>
  );
}

function createStyles(theme: NativeTheme, pagePad: number) {
  return StyleSheet.create({
    hero: { paddingTop: 12, paddingBottom: 16, gap: 14 },
    heroRow: { alignItems: "center", justifyContent: "space-between", gap: 10 },
    heroEyebrow: { color: "rgba(255,255,255,0.78)", letterSpacing: 1, marginBottom: 2 },
    scannerBtn: {
      width: 40, height: 40, borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    },
    heroStatRow: { gap: 10 },
    heroStat: {
      flex: 1, alignItems: "center", paddingVertical: 10,
      borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", gap: 2,
    },
    heroStatValue: { fontSize: 20, fontFamily: "Cairo_900Black", color: "#fff" },
    heroStatLabel: { fontSize: 10, fontFamily: "Cairo_700Bold", color: "rgba(255,255,255,0.8)", textAlign: "center" },
    searchBar: {
      alignItems: "center",
      gap: 10,
      marginHorizontal: pagePad,
      marginVertical: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 16,
      borderWidth: 1,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontFamily: "Cairo_400Regular",
      padding: 0,
      textAlign: TEXT_START,
    },
    tabs: {
      gap: 8,
      paddingHorizontal: pagePad,
      marginBottom: 10,
      flexWrap: "wrap",
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 9999,
      borderWidth: 1,
    },
    tabText: { fontSize: 12, fontFamily: "Cairo_700Bold" },
    list: { paddingHorizontal: pagePad, paddingBottom: 60 },
    listTablet: { maxWidth: 720, alignSelf: "center", width: "100%" },
    card: {
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      gap: 8,
    },
    cardHeader: { alignItems: "flex-start", gap: 12 },
    price: { fontSize: 14, fontFamily: "Cairo_900Black", flexShrink: 0 },
    metaRow: { alignItems: "center", gap: 6, flexWrap: "wrap" },
    chip: {
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 9999,
      borderWidth: 1,
    },
    chipText: { fontSize: 10, fontFamily: "Cairo_700Bold" },
    stockRow: {
      alignItems: "center",
      gap: 6,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border.default,
    },
    stockCell: { flex: 1, alignItems: "center", borderRadius: 10, paddingVertical: 8 },
    stockValue: { fontSize: 18, fontFamily: "Cairo_900Black", color: theme.colors.text.primary },
    stockLabel: { fontSize: 9, fontFamily: "Cairo_700Bold", marginTop: 2 },
    scanBtn: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1,
      flexShrink: 0,
    },
    empty: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },
  });
}
