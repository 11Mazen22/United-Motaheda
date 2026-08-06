/**
 * InventoryIntelligenceScreen — pharmacist inventory intelligence dashboard.
 *
 * Tabs:
 *   • Low Stock  — products with available ≤ 5, sorted by most critical
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
import { useRouter }      from "expo-router";
import { Ionicons }       from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Screen, Text as UIText } from "@/shared/ui";
import { kit }                    from "@/shared/kit";
import { theme }                  from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice }            from "@/utils/format";

import {
  useLowStockProducts,
  useProductSearch,
} from "../hooks/usePharmacistQueries";
import { getLowStockProducts } from "../api/inventory";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";
import type { PharmacistProduct } from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type InventoryTab = "lowstock" | "search" | "outofstock";

// ─── Urgency band ────────────────────────────────────────────────────────────

function urgencyColor(available: number): string {
  if (available === 0) return kit.color.danger;
  if (available <= 3)  return "#F59E0B"; // amber
  return "#EAB308";                      // yellow
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  index,
  onScan,
}: {
  product: PharmacistProduct;
  index:   number;
  onScan:  (barcode: string) => void;
}) {
  const { t } = useTranslation();
  const urg   = urgencyColor(product.available);
  const isOut = product.available === 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).duration(240)}>
      <View style={[s.card, { borderLeftColor: urg, borderLeftWidth: 4 }]}>
        {/* Header row */}
        <View style={[s.cardHeader, { flexDirection: flexRow(IS_RTL) }]}>
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
          <UIText style={s.price}>{formatPrice(product.effectivePrice)}</UIText>
        </View>

        {/* Code + category */}
        <View style={[s.metaRow, { flexDirection: flexRow(IS_RTL) }]}>
          {product.code && (
            <View style={[s.chip, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="barcode-outline" size={10} color={kit.color.inkSoft} />
              <UIText style={s.chipText}>{product.code}</UIText>
            </View>
          )}
          {product.categoryName && (
            <View style={[s.chip, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="folder-outline" size={10} color={kit.color.inkSoft} />
              <UIText style={s.chipText}>{product.categoryName}</UIText>
            </View>
          )}
          {isOut && (
            <View style={[s.chip, s.chipDanger, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="close-circle" size={10} color={kit.color.danger} />
              <UIText style={[s.chipText, { color: kit.color.danger }]}>
                {t("pharmacist.stockExhausted", "نفد المخزون")}
              </UIText>
            </View>
          )}
        </View>

        {/* Stock grid */}
        <View style={[s.stockRow, { flexDirection: flexRow(IS_RTL) }]}>
          {[
            { label: t("pharmacist.onHand",   "في المخزن"), value: product.onHand   },
            { label: t("pharmacist.reserved", "محجوز"),      value: product.reserved },
            { label: t("pharmacist.available","متاح"),       value: product.available, warn: true },
          ].map(({ label, value, warn }) => (
            <View key={label} style={s.stockCell}>
              <UIText
                style={[
                  s.stockValue,
                  warn && { color: urgencyColor(product.available) },
                ]}
              >
                {value}
              </UIText>
              <UIText style={s.stockLabel}>{label}</UIText>
            </View>
          ))}

          {/* Scan button */}
          {product.barcode && (
            <Pressable
              onPress={() => onScan(product.barcode!)}
              style={({ pressed }) => [s.scanBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityLabel={t("pharmacist.scannerTitle")}
            >
              <Ionicons name="barcode-outline" size={14} color={kit.color.accentDeep} />
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function InventoryIntelligenceScreen(): React.ReactElement {
  const { t }       = useTranslation();
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [tab,        setTab]        = useState<InventoryTab>("lowstock");
  const [rawQuery,   setRawQuery]   = useState("");
  const query = useDeferredValue(rawQuery.trim());

  const lowStockQuery   = useLowStockProducts();
  const searchQuery     = useProductSearch(query);
  // Out-of-stock is just a stricter low-stock fetch with threshold 0
  const [outOfStock, setOutOfStock] = useState<PharmacistProduct[]>([]);
  const [oosLoading, setOosLoading] = useState(false);

  const loadOutOfStock = useCallback(async () => {
    if (tab !== "outofstock") return;
    setOosLoading(true);
    try {
      const data = await getLowStockProducts(0, 100);
      setOutOfStock(data.filter((p) => p.available === 0));
    } catch { /* swallow */ }
    finally { setOosLoading(false); }
  }, [tab]);

  React.useEffect(() => {
    if (tab === "outofstock") void loadOutOfStock();
  }, [tab, loadOutOfStock]);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.lowStock() }),
      queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.products(query) }),
    ]);
    if (tab === "outofstock") await loadOutOfStock();
  }, [queryClient, query, tab, loadOutOfStock]);

  const handleScan = useCallback((barcode: string) => {
    router.push("/(pharmacist)/scanner" as never);
    // Pre-fill handled inside the scanner via search param in a future iteration
    void barcode; // acknowledge the arg
  }, [router]);

  // Derive current list
  const items: PharmacistProduct[] =
    tab === "lowstock"   ? (lowStockQuery.data  ?? []) :
    tab === "outofstock" ? outOfStock                  :
    (searchQuery.data ?? []);

  const isLoading =
    tab === "lowstock"   ? lowStockQuery.isLoading  :
    tab === "outofstock" ? oosLoading               :
    (query.length > 0 && searchQuery.isLoading);

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <PharmacistScreenHeader
        title={t("pharmacist.inventoryTitle")}
        subtitle={t("pharmacist.inventorySubtitle")}
        trailing={
          <Pressable
            onPress={() => router.push("/(pharmacist)/scanner" as never)}
            style={s.scannerBtn}
            accessibilityRole="button"
            accessibilityLabel={t("pharmacist.scannerTitle")}
          >
            <Ionicons name="barcode-outline" size={18} color={kit.color.accentDeep} />
          </Pressable>
        }
      />

      {/* Search bar — always visible */}
      <View style={[s.searchBar, { flexDirection: flexRow(IS_RTL) }]}>
        <Ionicons name="search-outline" size={16} color={kit.color.inkFaint} />
        <TextInput
          value={rawQuery}
          onChangeText={(v) => { setRawQuery(v); if (v.trim()) setTab('search'); }}
          placeholder={t('pharmacist.inventorySearch')}
          placeholderTextColor={kit.color.inkFaint}
          autoCorrect={false}
          autoCapitalize="none"
          style={s.searchInput}
          returnKeyType="search"
        />
        {rawQuery.length > 0 && (
          <Pressable onPress={() => { setRawQuery(''); setTab('lowstock'); }} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={kit.color.inkFaint} />
          </Pressable>
        )}
      </View>

      {/* Tab bar */}
      <View style={[s.tabs, { flexDirection: flexRow(IS_RTL) }]}>
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
              style={[s.tab, active && s.tabActive]}
              accessibilityRole="button"
            >
              <UIText style={[s.tabText, active && s.tabTextActive]}>
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
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
          />
        }
        renderItem={({ item, index }) => (
          <ProductCard product={item} index={index} onScan={handleScan} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={s.empty}>
              <ActivityIndicator size="large" color={kit.color.accent} />
            </View>
          ) : (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={44} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 12, textAlign: "center" }}>
                {tab === "search" && query.length === 0
                  ? t("pharmacist.inventorySearchPrompt", "اكتب للبحث…")
                  : t("pharmacist.emptySearch")}
              </UIText>
            </View>
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  scannerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: kit.color.accentTint,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: kit.color.accentDeep,
  },
  searchBar: {
    alignItems:        "center",
    gap:               10,
    marginHorizontal:  kit.inset.screen,
    marginVertical:    10,
    paddingHorizontal: 14,
    paddingVertical:   11,
    backgroundColor:   kit.color.well,
    borderRadius:      kit.radius.xl,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  searchInput: {
    flex:       1,
    fontSize:   14,
    fontFamily: theme.fonts.regular,
    color:      kit.color.ink,
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
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  tabActive: {
    backgroundColor: kit.color.accent,
    borderColor:     kit.color.accent,
  },
  tabText:       { fontSize: 12, fontFamily: theme.fonts.bold, color: kit.color.inkSoft },
  tabTextActive: { color: "#fff" },
  list: { paddingHorizontal: kit.inset.screen, paddingBottom: 60 },
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    padding:         14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
    gap:             8,
  },
  cardHeader: { alignItems: "flex-start", gap: 12 },
  price:       { fontSize: 14, fontFamily: theme.fonts.black, color: kit.color.accentDeep, flexShrink: 0 },
  metaRow:     { alignItems: "center", gap: 6, flexWrap: "wrap" },
  chip: {
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  chipDanger: { backgroundColor: kit.color.dangerTint, borderColor: kit.color.danger },
  chipText:   { fontSize: 10, fontFamily: theme.fonts.bold, color: kit.color.inkSoft },
  stockRow: {
    alignItems:  "center",
    gap:         6,
    paddingTop:  8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  stockCell:   { flex: 1, alignItems: "center", backgroundColor: kit.color.well, borderRadius: 10, paddingVertical: 8 },
  stockValue:  { fontSize: 18, fontFamily: theme.fonts.black, color: kit.color.ink },
  stockLabel:  { fontSize: 9,  fontFamily: theme.fonts.bold,  color: kit.color.inkSoft, marginTop: 2 },
  scanBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: kit.color.accentTint,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: kit.color.line,
    flexShrink: 0,
  },
  empty: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },
});
