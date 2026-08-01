/**
 * InventoryScreen — product search and low-stock monitor for pharmacist.
 * Supports text search and barcode scan.
 */
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet,
  TextInput, View,
} from "react-native";
import { Ionicons }       from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Screen, Text as UIText }  from "@/shared/ui";
import { kit }                     from "@/shared/kit";
import { theme }                   from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice }             from "@/utils/format";

import { useProductSearch, useLowStockProducts } from "../hooks/usePharmacistQueries";
import { PharmacistScreenHeader }                from "../components/PharmacistScreenHeader";
import type { PharmacistProduct }                from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

function ProductCard({ product }: { product: PharmacistProduct }) {
  const { t } = useTranslation();
  const isLow = product.available <= 5;
  return (
    <View style={[s.card, isLow && s.cardLow]}>
      <View style={[s.cardRow, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={{ flex: 1 }}>
          <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>
            {product.nameAr ?? product.nameEn ?? product.name}
          </UIText>
          {product.nameEn && product.nameAr ? (
            <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>
              {product.nameEn}
            </UIText>
          ) : null}
          {product.code ? (
            <UIText variant="eyebrow" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>
              {product.code}
            </UIText>
          ) : null}
        </View>
        <View style={s.stockBadge}>
          <UIText
            variant="caption"
            style={{ color: isLow ? kit.color.danger : kit.color.success, fontFamily: theme.fonts.black }}
          >
            {product.available}
          </UIText>
          <UIText variant="eyebrow" color="secondary">{t("pharmacist.available")}</UIText>
        </View>
      </View>
      <View style={[s.cardFooter, { flexDirection: flexRow(IS_RTL) }]}>
        <UIText variant="caption" color="secondary">
          {t("pharmacist.onHand")}: {product.onHand}  ·  {t("pharmacist.reserved")}: {product.reserved}
        </UIText>
        <UIText variant="body-sm" weight="bold" style={{ color: kit.color.accentDeep }}>
          {formatPrice(product.effectivePrice)}
        </UIText>
      </View>
    </View>
  );
}

export function InventoryScreen(): React.ReactElement {
  const { t }       = useTranslation();
  const [query, setQuery]   = useState("");
  const [mode,  setMode]    = useState<"search" | "lowstock">("lowstock");

  const searchQuery   = useProductSearch(query);
  const lowStockQuery = useLowStockProducts();

  const items: PharmacistProduct[] =
    mode === "search"
      ? (searchQuery.data ?? [])
      : (lowStockQuery.data ?? []);

  const isLoading =
    mode === "search" ? searchQuery.isLoading : lowStockQuery.isLoading;

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (text.length >= 1) setMode("search");
    else                   setMode("lowstock");
  }, []);

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <PharmacistScreenHeader
        title={t("pharmacist.inventoryTitle")}
        subtitle={t("pharmacist.inventorySubtitle")}
      />

      {/* Search bar */}
      <View style={[s.searchBar, { flexDirection: flexRow(IS_RTL) }]}>
        <Ionicons name="search-outline" size={16} color={kit.color.inkFaint} />
        <TextInput
          value={query}
          onChangeText={handleQueryChange}
          placeholder={t("pharmacist.inventorySearch")}
          placeholderTextColor={kit.color.inkFaint}
          autoCorrect={false}
          autoCapitalize="none"
          style={s.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(""); setMode("lowstock"); }} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={kit.color.inkFaint} />
          </Pressable>
        )}
      </View>

      {/* Mode tabs */}
      <View style={[s.modeTabs, { flexDirection: flexRow(IS_RTL) }]}>
        {(["lowstock", "search"] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[s.modeTab, mode === m && s.modeTabActive]}
          >
            <UIText variant="caption" style={{ color: mode === m ? kit.color.onAccent : kit.color.inkSoft }}>
              {m === "lowstock" ? t("pharmacist.modeLowStock") : t("pharmacist.modeSearch")}
            </UIText>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <ProductCard product={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={s.empty}><ActivityIndicator size="large" color={kit.color.accent} /></View>
          ) : (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={40} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
                {mode === "lowstock" ? t("pharmacist.emptyLowStock") : t("pharmacist.emptySearch")}
              </UIText>
            </View>
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  searchBar: {
    alignItems:        "center",
    gap:               10,
    marginHorizontal:  kit.inset.screen,
    marginVertical:    12,
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
  modeTabs: {
    gap:               8,
    paddingHorizontal: kit.inset.screen,
    marginBottom:      8,
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical:   7,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  modeTabActive: {
    backgroundColor: kit.color.accent,
    borderColor:     kit.color.accent,
  },
  list: {
    paddingHorizontal: kit.inset.screen,
    paddingBottom:     60,
  },
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    padding:         14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
    gap:             8,
  },
  cardLow: {
    borderColor: kit.color.danger,
    borderWidth: 1.5,
  },
  cardRow: {
    alignItems: "flex-start",
    gap:        12,
  },
  stockBadge: {
    alignItems:      "center",
    paddingHorizontal: 10,
    paddingVertical:  6,
    borderRadius:     kit.radius.lg,
    backgroundColor:  kit.color.well,
    minWidth:         52,
  },
  cardFooter: {
    justifyContent: "space-between",
    alignItems:     "center",
    paddingTop:     8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  empty: {
    alignItems:  "center",
    paddingTop:  60,
  },
});
