import { defaultTheme as theme } from "@pharmacy/ui-native";
/**
 * InventoryIntelligenceScreen — pharmacist inventory intelligence dashboard.
 *
 * Tabs:
 *   • Low Stock  — products with available <= 5, sorted by most critical
 *   • Search     — full-text + barcode search
 *   • Out of Stock — available = 0
 *
 * Each product card shows:
 *   - Name (Arabic + English)
 *   - Code / Barcode
 *   - On-hand / Reserved / Available
 *   - Category
 *   - Price
 *   - Urgency colour band (red = 0, amber = 1-3, yellow = 4-5)
 */



import React, { useState, useCallback, useDeferredValue } from "react";

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

import { Ionicons }       from "@expo/vector-icons";

import { useTranslation } from "react-i18next";

import { useQueryClient } from "@tanstack/react-query";

import Animated, { FadeInDown } from "react-native-reanimated";



import { Screen, Text as UIText, EmptyState } from "@pharmacy/ui-native";
import { useTheme, type NativeTheme } from "@pharmacy/ui-native";

import { kit }                    from "@pharmacy/ui-native";



import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { formatPrice }            from "@/utils/format";



import {

  useLowStockProducts,

  useOutOfStockProducts,

  useProductSearch,

} from "../hooks/usePharmacistQueries";

import { pharmacistQueryKeys } from "../hooks/queryKeys";

import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";


import type { PharmacistProduct } from "../api/types";



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



type InventoryTab = "lowstock" | "search" | "outofstock";



// ─── Urgency band ──────────────────────────────────────────────────────────────



function urgencyColor(available: number, colors: NativeTheme["colors"]): string {

  if (available === 0) return colors.status.error;

  if (available <= 3)  return colors.status.warning;

  return colors.status.warning;

}



// ─── Product card ─────────────────────────────────────────────────────────────



function ProductCard({

  product,

  index,

  onScan,

  colors,

}: {

  product: PharmacistProduct;

  index:   number;

  onScan:  (barcode: string) => void;

  colors: NativeTheme["colors"];

}) {

  const { t } = useTranslation();

  const urg   = urgencyColor(product.available, colors);

  const isOut = product.available === 0;



  return (

    <Animated.View entering={FadeInDown.delay(index * 30).duration(240)}>

      <View style={[styles.card, { borderStartColor: urg, borderStartWidth: 4, backgroundColor: colors.surface, borderColor: colors.line }]}>

        {/* Header row */}

        <View style={[styles.cardHeader, { flexDirection: flexRow(IS_RTL) }]}>

          <View style={{ flex: 1 }}>

            <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>

              {product.nameAr ?? product.nameEn ?? product.name}

            </UIText>

            {product.nameEn && product.nameAr && (

              <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>

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

              <UIText style={[styles.chipText, { color: colors.inkSoft }]}>{product.categoryName}</UIText>

            </View>

          )}

          {isOut && (

            <View style={[styles.chip, styles.chipDanger, { flexDirection: flexRow(IS_RTL), backgroundColor: colors.statusSoft.error.bg, borderColor: colors.status.error }]}>

              <Ionicons name="close-circle" size={10} color={colors.status.error} />

              <UIText style={[styles.chipText, { color: colors.status.error }]}>                {t("pharmacist.stockExhausted", "نفد المخزون")}

              </UIText>

            </View>

          )}

        </View>



        {/* Stock grid */}

        <View style={[styles.stockRow, { flexDirection: flexRow(IS_RTL) }]}>

          {[

            { label: t("pharmacist.onHand",   "في المخزن"), value: product.onHand   },

            { label: t("pharmacist.reserved", "محجوز"),      value: product.reserved },

            { label: t("pharmacist.available","متاح"),       value: product.available, warn: true },

          ].map(({ label, value, warn }) => (

            <View key={label} style={[styles.stockCell, { backgroundColor: colors.canvas.surfaceMuted }]}>

              <UIText

                style={[

                  styles.stockValue,

                  warn && { color: urgencyColor(product.available, colors) },

                ]}

              >

                {value}

              </UIText>

              <UIText style={[styles.stockLabel, { color: colors.inkSoft }]}>{label}</UIText>

            </View>

          ))}



          {/* Scan button */}

          {product.barcode && (

            <Pressable

              onPress={() => onScan(product.barcode!)}

              style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.75 }, { backgroundColor: colors.brand.primaryLight, borderColor: colors.line }]}

              accessibilityRole="button"

              accessibilityLabel={t("pharmacist.scannerTitle")}

            >

              <Ionicons name="barcode-outline" size={14} color={colors.brand.primaryDark} />

            </Pressable>

          )}

        </View>

      </View>

    </Animated.View>

  );

}



// ─── Screen ───────────────────────────────────────────────────────────────────



export function InventoryIntelligenceScreen(): React.ReactElement {

  const { theme } = useTheme();

  const { t }       = useTranslation();

  const router      = useRouter();

  const params      = useLocalSearchParams<{ query?: string }>();

  const queryClient = useQueryClient();



  const [tab,        setTab]        = useState<InventoryTab>("lowstock");

  const [rawQuery,   setRawQuery]   = useState("");

  const [refreshing, setRefreshing] = useState(false);

  const query = useDeferredValue(rawQuery.trim());



  React.useEffect(() => {

    if (typeof params.query !== "string") return;

    const nextQuery = params.query.trim();

    if (!nextQuery || nextQuery === rawQuery) return;

    setRawQuery(nextQuery);

    setTab("search");

  }, [params.query, rawQuery]);



  const lowStockQuery   = useLowStockProducts();

  const outOfStockQuery = useOutOfStockProducts();

  const searchQuery     = useProductSearch(query);



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

      params: {

        mode: "inventory",

        barcode,

      },

    });

  }, [router]);



  // Derive current list

  const items: PharmacistProduct[] =

    tab === "lowstock"   ? (lowStockQuery.data  ?? []) :

    tab === "outofstock" ? (outOfStockQuery.data ?? []) :

    (searchQuery.data ?? []);



  const isLoading =

    tab === "lowstock"   ? lowStockQuery.isLoading  :

    tab === "outofstock" ? outOfStockQuery.isLoading :

    (query.length > 0 && searchQuery.isLoading);



  const isError =

    tab === "lowstock"   ? lowStockQuery.isError  :

    tab === "outofstock" ? outOfStockQuery.isError :

    (query.length > 0 && searchQuery.isError);



  return (

    <Screen edgeTop background={theme.colors.canvas.background}>

      <PharmacistScreenHeader

        title={t("pharmacist.inventoryTitle")}

        subtitle={t("pharmacist.inventorySubtitle")}

        trailing={

          <Pressable

            onPress={() => router.push("/(pharmacist)/scanner")}

            style={styles.scannerBtn}

            accessibilityRole="button"

            accessibilityLabel={t("pharmacist.scannerTitle")}

          >

            <Ionicons name="barcode-outline" size={18} color={theme.colors.brand.primary} />

          </Pressable>

        }

      />



      {/* Search bar — always visible */}

      <View style={[styles.searchBar, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default }]}>

        <Ionicons name="search-outline" size={16} color={theme.colors.text.muted} />

        <TextInput

          value={rawQuery}

          onChangeText={(v) => { setRawQuery(v); if (v.trim()) setTab('search'); }}

          placeholder={t('pharmacist.inventorySearch')}

          placeholderTextColor={theme.colors.text.muted}

          autoCorrect={false}

          autoCapitalize="none"

          style={[styles.searchInput, { color: theme.colors.text.primary }]}

          returnKeyType="search"

        />

        {rawQuery.length > 0 && (

          <Pressable onPress={() => { setRawQuery(''); setTab('lowstock'); }} hitSlop={8}>

            <Ionicons name="close-circle" size={16} color={theme.colors.text.muted} />

          </Pressable>

        )}

      </View>



      {/* Tab bar */}

      <View style={[styles.tabs, { flexDirection: flexRow(IS_RTL) }]}>

        {(["lowstock", "outofstock", "search"] as InventoryTab[]).map((tabKey) => {

          const labels: Record<InventoryTab, string> = {

            lowstock:   t("pharmacist.modeLowStock"),

            outofstock: t("pharmacist.modeOutOfStock", "نفد"),

            search:     t("pharmacist.modeSearch"),

          };

          const active = tab === tabKey;

          return (

            <Pressable

              key={tabKey}

              onPress={() => {

                setTab(tabKey);

                if (tabKey !== 'search') setRawQuery('');

              }}

              style={[styles.tab, active && styles.tabActive, { backgroundColor: active ? theme.colors.brand.primary : theme.colors.canvas.surfaceMuted, borderColor: active ? theme.colors.brand.primary : theme.colors.border.default }]}

              accessibilityRole="button"

            >

              <UIText style={[styles.tabText, active && styles.tabTextActive, { color: active ? theme.colors.text.inverse : theme.colors.text.secondary }]}>                {labels[tabKey]}

              </UIText>

            </Pressable>

          );

        })}

      </View>



      {/* List */}

      <FlatList

        data={items}

        keyExtractor={(p) => p.id}

        contentContainerStyle={styles.list}

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

          <ProductCard product={item} index={index} onScan={handleScan} colors={theme.colors} />

        )}

        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}

        ListEmptyComponent={

          isLoading ? (

            <View style={styles.empty}>

              <ActivityIndicator size="large" color={theme.colors.brand.primary} />

            </View>

          ) : isError ? (

            <EmptyState

              icon="wifi-outline"

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



const styles = StyleSheet.create({

  scannerBtn: {

    width: 38, height: 38, borderRadius: 12,

    backgroundColor: theme.colors.brand.primaryLight,

    alignItems: "center", justifyContent: "center",

    borderWidth: 1, borderColor: theme.colors.brand.primary,

  },

  searchBar: {

    alignItems:        "center",

    gap:               10,

    marginHorizontal:  kit.inset.screen,

    marginVertical:    10,

    paddingHorizontal: 14,

    paddingVertical:   11,

    borderRadius:      16,

    borderWidth:       1,

  },

  searchInput: {

    flex:       1,

    fontSize:   14,

    fontFamily: "Cairo_400Regular",

    padding:    0,

    textAlign:  TEXT_START,

  },

  tabs: {

    gap:               8,

    paddingHorizontal: kit.inset.screen,

    marginBottom:      10,

    flexWrap:          "wrap",

  },

  tab: {

    paddingHorizontal: 14,

    paddingVertical:   7,

    borderRadius:      9999,

    borderWidth:       1,

  },

  tabActive: {  },

  tabText:       { fontSize: 12, fontFamily: "Cairo_700Bold" },

  tabTextActive: { color: "#fff" },

  list: { paddingHorizontal: kit.inset.screen, paddingBottom: 60 },

  card: {

    borderRadius:    16,

    padding:         14,

    borderWidth:     1,

    gap:             8,

  },

  cardHeader: { alignItems: "flex-start", gap: 12 },

  price:       { fontSize: 14, fontFamily: "Cairo_900Black", flexShrink: 0 },

  metaRow:     { alignItems: "center", gap: 6, flexWrap: "wrap" },

  chip: {

    alignItems:        "center",

    gap:               4,

    paddingHorizontal: 8,

    paddingVertical:   3,

    borderRadius:      9999,

    borderWidth:       1,

  },

  chipDanger: {  },

  chipText:   { fontSize: 10, fontFamily: "Cairo_700Bold" },

  stockRow: {

    alignItems:  "center",

    gap:         6,

    paddingTop:  8,

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: theme.colors.border.default,

  },

  stockCell:   { flex: 1, alignItems: "center", borderRadius: 10, paddingVertical: 8 },

  stockValue:  { fontSize: 18, fontFamily: "Cairo_900Black", color: theme.colors.text.primary },

  stockLabel:  { fontSize: 9,  fontFamily: "Cairo_700Bold",  marginTop: 2 },

  scanBtn: {

    width: 40, height: 40, borderRadius: 12,

    alignItems: "center", justifyContent: "center",

    borderWidth: 1,

    flexShrink: 0,

  },

  empty: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },

  retryBtn: {

    marginTop:         12,

    paddingHorizontal: 20,

    paddingVertical:   10,

    borderRadius:      12,

    backgroundColor:   theme.colors.brand.primaryLight,

  },

});
