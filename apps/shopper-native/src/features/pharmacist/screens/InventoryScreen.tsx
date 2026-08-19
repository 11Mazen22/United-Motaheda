/**

 * InventoryScreen — product search and low-stock monitor for pharmacist.

 *

 * Smart Search (2026):

 *   • Client-side fuzzy scoring on top of the RPC full-text results

 *   • Partial match: "brufen" matches "إيبوبروفين / Ibuprofen Brufen"

 *   • Typo tolerance: Levenshtein distance ≤ 2 for tokens of length ≥ 4

 *   • Multi-field: searches nameAr, nameEn, code, barcode simultaneously

 *   • Ranked by relevance score (exact > prefix > fuzzy)

 *   • Debounced 200 ms so it feels instant without hammering the API

 */

import React, { useState, useCallback, useMemo } from "react";

import {

  ActivityIndicator, StyleSheet,

  View,

} from "react-native";

import { FlashList } from "@shopify/flash-list";

import { Ionicons }       from "@expo/vector-icons";

import { useTranslation } from "react-i18next";



import { Screen, Text as UIText, Card, Input, Badge, Chip } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";

import { kit }                     from "@pharmacy/ui-native";



import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { formatPrice }             from "@/utils/format";



import { useProductSearch, useLowStockProducts } from "../hooks/usePharmacistQueries";

import { PharmacistScreenHeader }                from "../components/PharmacistScreenHeader";

import EmptyState from "@/components/EmptyState";

import type { PharmacistProduct }                from "../api/types";



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



// ─── Fuzzy matching ───────────────────────────────────────────────────────────



/** Normalise: lowercase, strip diacritics, collapse spaces. */

function normalise(s: string): string {

  return s

    .toLowerCase()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")       // strip Latin diacritics

    .replace(/[\u064B-\u065F]/g, "")       // strip Arabic diacritics

    .replace(/\s+/g, " ")

    .trim();

}



    

/**

 * Levenshtein distance (capped at maxDist + 1 for early exit).

 * O(min(a,b)) space, O(a*b) time — fast enough for short strings.

 */

function levenshtein(a: string, b: string, maxDist = 2): number {

  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {

    let prev = i;

    for (let j = 1; j <= b.length; j++) {

      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      const next = Math.min(prev + 1, row[j] + 1, row[j - 1] + cost);

      row[j - 1] = prev;

      prev = next;

    }

    row[b.length] = prev;

  }

  return row[b.length];

}



/**

 * Score a product against the query.

 * Higher = better match. Returns 0 when there is no match at all.

 *

 * Scoring tiers:

 *   100 — exact match on any field

 *    80 — starts-with on any field

 *    60 — contains (substring) on any field

 *    40 — every query token found as a substring in any field

 *    20 — every query token has a fuzzy match (Levenshtein ≤ 2)

 *     0 — no match

 */

function scoreProduct(product: PharmacistProduct, normQuery: string): number {

  const fields = [

    normalise(product.nameAr  ?? ""),

    normalise(product.nameEn  ?? ""),

    normalise(product.code    ?? ""),

    normalise(product.barcode ?? ""),

  ].filter(Boolean);



  // Exact full match

  if (fields.some((f) => f === normQuery)) return 100;



  // Starts-with

  if (fields.some((f) => f.startsWith(normQuery))) return 80;



  // Substring

  if (fields.some((f) => f.includes(normQuery))) return 60;



  // Token-level matching

  const tokens = normQuery.split(" ").filter((t) => t.length > 0);

  if (tokens.length === 0) return 0;



  const allText = fields.join(" ");



  // All tokens present as substrings

  if (tokens.every((tok) => allText.includes(tok))) return 40;



  // All tokens fuzzy-match some word in allText

  const words = allText.split(" ").filter((w) => w.length > 0);

  const allFuzzy = tokens.every((tok) => {

    if (tok.length < 3) return allText.includes(tok);      // short tokens: exact only

    return words.some((w) => levenshtein(tok, w, 2) <= 2);

  });

  if (allFuzzy) return 20;



  return 0;

}



/** Apply fuzzy re-ranking on top of the RPC results. */

function fuzzyRank(products: PharmacistProduct[], query: string): PharmacistProduct[] {

  const norm = normalise(query);

  if (!norm) return products;



  const scored = products

    .map((p) => ({ p, score: scoreProduct(p, norm) }))

    .filter((x) => x.score > 0);



  scored.sort((a, b) => b.score - a.score);

  return scored.map((x) => x.p);

}



// ─── Product card ─────────────────────────────────────────────────────────────



function ProductCard({ product }: { product: PharmacistProduct; query?: string }) {

  const { t } = useTranslation();

  const isLow = product.available <= 5;

  const displayName = product.nameAr ?? product.nameEn ?? product.name;



  return (

    <Card style={[styles.card, isLow && styles.cardLow]} elevation="sm">

      <View style={[styles.cardRow, { flexDirection: flexRow(IS_RTL) }]}>

        {/* Identity */}

        <View style={{ flex: 1 }}>

          <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>

            {displayName}

          </UIText>

          {product.nameEn && product.nameAr ? (

            <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>

              {product.nameEn}

            </UIText>

          ) : null}

          <View style={[styles.tagRow, { flexDirection: flexRow(IS_RTL) }]}>

            {product.code ? (

              <View style={styles.tag}>

                <Ionicons name="barcode-outline" size={11} color={kit.color.inkFaint} />

                <UIText variant="eyebrow" color="muted" style={{ includeFontPadding: false } as any}>

                  {product.code}

                </UIText>

              </View>

            ) : null}

            {product.categoryName ? (

              <View style={styles.tag}>

                <Ionicons name="folder-outline" size={11} color={kit.color.inkFaint} />

                <UIText variant="eyebrow" color="muted" style={{ includeFontPadding: false } as any}>

                  {product.categoryName}

                </UIText>

              </View>

            ) : null}

          </View>

        </View>



        {/* Stock badge */}

        <View style={[styles.stockBadge, isLow && styles.stockBadgeLow]}>

          <UIText

            style={[styles.stockNumber, { color: isLow ? kit.color.danger : kit.color.accentDeep }]}

          >

            {product.available}

          </UIText>

          <UIText variant="eyebrow" color="secondary">{t("pharmacist.available")}</UIText>

        </View>

      </View>



      {/* Footer */}

      <View style={[styles.cardFooter, { flexDirection: flexRow(IS_RTL) }]}>

        <View style={[styles.footerStats, { flexDirection: flexRow(IS_RTL) }]}>

          <UIText variant="caption" color="secondary">

            {t("pharmacist.onHand")}: {product.onHand}

          </UIText>

          <View style={styles.footerDot} />

          <UIText variant="caption" color="secondary">

            {t("pharmacist.reserved")}: {product.reserved}

          </UIText>

        </View>

        <UIText variant="body-sm" weight="bold" style={{ color: kit.color.accentDeep }}>

          {formatPrice(product.effectivePrice)}

        </UIText>

      </View>

    </Card>

  );

}



export function InventoryScreen(): React.ReactElement {

  const { c } = useDarkColors();
  
  const { t }       = useTranslation();

  const [query, setQuery]   = useState("");

  const [mode,  setMode]    = useState<"search" | "lowstock">("lowstock");



  const searchQuery   = useProductSearch(query);

  const lowStockQuery = useLowStockProducts();



  // Apply fuzzy re-ranking on the RPC results

  const rankedSearch = useMemo(() => {

    const raw = searchQuery.data ?? [];

    return fuzzyRank(raw, query);

  }, [searchQuery.data, query]);



  const items: PharmacistProduct[] =

    mode === "search"

      ? rankedSearch

      : (lowStockQuery.data ?? []);



  const isLoading =

    mode === "search" ? searchQuery.isLoading : lowStockQuery.isLoading;



  const handleQueryChange = useCallback((text: string) => {

    setQuery(text);

    if (text.length >= 1) setMode("search");

    else                   setMode("lowstock");

  }, []);



  const TABS: { key: "lowstock" | "search" | "all"; label: string }[] = [

    { key: "lowstock", label: t("pharmacist.modeLowStock", "مخزون منخفض") },

    { key: "search",   label: t("pharmacist.modeSearch",   "بحث")          },

  ];



  return (

    <Screen edgeTop background={kit.color.canvas}>

      <PharmacistScreenHeader

        title={t("pharmacist.inventoryTitle")}

        subtitle={t("pharmacist.inventorySubtitle")}

      />



<View style={styles.searchWrap}>

        <Input

          value={query}

          onChangeText={handleQueryChange}

          placeholder={t("pharmacist.inventorySearch")}

          clearButton

          prefixIcon={<Ionicons name="search-outline" size={18} color={kit.color.inkFaint} />}

          autoCorrect={false}

          autoCapitalize="none"

          style={styles.searchInput}

        />

      </View>



      <View style={styles.summaryRow}> 

        <Badge label={t("pharmacist.lowStockCount", { count: lowStockQuery.data?.length ?? 0 })} variant="warning" />

        <Badge label={t("pharmacist.mode", { mode: mode === "search" ? t("pharmacist.modeSearch") : t("pharmacist.modeLowStock") })} variant="info" />

        {mode === "search" && query.length >= 1 && !isLoading ? (

          <UIText variant="caption" color="secondary" style={styles.summaryText}>

            {items.length > 0

              ? t("pharmacist.searchResultsCount", { count: items.length, defaultValue: `${items.length} نتيجة` })

              : t("pharmacist.searchNoResults", "لم يُعثر على نتائج — جرّب مصطلحاً آخر")}

          </UIText>

        ) : null}

      </View>



      {/* Mode tabs */}

      <View style={[styles.modeTabs, { flexDirection: flexRow(IS_RTL) }]}> 

        {TABS.map((tab) => (

          <Chip

            key={tab.key}

            label={tab.label}

            selected={mode === tab.key}

            selectable

            onPress={() => {

              setMode(tab.key as "search" | "lowstock");

              if (tab.key !== "search") setQuery("");

            }}

            style={[styles.modeChip, mode === tab.key && styles.modeChipActive]}

          />

        ))}

      </View>



      <FlashList

        data={items}

        keyExtractor={(p) => p.id}

        overrideItemLayout={(layout: any) => {

          layout.size = 110;

        }}

        contentContainerStyle={styles.list}

        showsVerticalScrollIndicator={false}

        renderItem={({ item }) => <ProductCard product={item} query={query} />}

        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}

        ListEmptyComponent={

          isLoading ? (

            <View style={styles.empty}>

              <ActivityIndicator size="large" color={kit.color.accent} />

              <UIText variant="caption" color="secondary" style={{ marginTop: 10 }}>

                {t("common.loading")}

              </UIText>

            </View>

          ) : mode === "search" && query.length < 1 ? (

            <EmptyState

              icon="search-outline"

              title={t("pharmacist.searchPrompt", "اكتب للبحث…")}

            />

          ) : (

            <EmptyState

              icon="cube-outline"

              title={mode === "lowstock" ? t("pharmacist.emptyLowStock") : t("pharmacist.emptySearch")}

            />

          )

        }

      />

    </Screen>

  );

}



const styles = StyleSheet.create({

  searchBar: {

    alignItems:        "center",

    gap:               10,

    marginHorizontal:  kit.inset.screen,

    marginVertical:    12,

    paddingHorizontal: 14,

    paddingVertical:   12,

    backgroundColor:   kit.color.surface,

    borderRadius:      16,

    borderWidth:       1.5,

    borderColor:       kit.color.line,

    ...kit.shadow.raised,

  },

  searchInput: {

    flex:       1,

    fontSize:   14,

    fontFamily: "Cairo_400Regular",

    color:      kit.color.ink,

    padding:    0,

    textAlign:  TEXT_START,

    minHeight:  22,

  },

  searchHint: {

    alignItems:        "center",

    gap:               6,

    paddingHorizontal: kit.inset.screen,

    marginBottom:      4,

  },

  searchWrap: {

    marginHorizontal:  kit.inset.screen,

    marginBottom:     12,

  },

  summaryRow: {

    flexDirection:    flexRow(IS_RTL),

    alignItems:       "center",

    gap:              8,

    marginHorizontal: kit.inset.screen,

    marginBottom:     8,

    flexWrap:         "wrap",

  },

  summaryText: {

    flex: 1,

  },

  modeTabs: {

    gap:               8,

    paddingHorizontal: kit.inset.screen,

    marginBottom:      8,

  },

  modeChip: {

    borderColor:     kit.color.line,

    backgroundColor: kit.color.surface,

  },

  modeChipActive: {

    backgroundColor: kit.color.accentTint,

    borderColor:     kit.color.accent,

  },

  list: {

    paddingHorizontal: kit.inset.screen,

    paddingBottom:     60,

  },



  // ── Card ────────────────────────────────────────────────────────────────

  card: {

    backgroundColor: kit.color.surface,

    borderRadius:    16,

    padding:         14,

    borderWidth:     1,

    borderColor:     kit.color.line,

    ...kit.shadow.card,

    gap:             8,

    overflow:        "hidden",

  },

  cardLow: {

    borderColor: kit.color.danger + "60",

    borderWidth: 1.5,

  },

  lowBar: {

    position:        "absolute",

    top:             0,

    start:           0,

    bottom:          0,

    width:           4,

    backgroundColor: kit.color.danger,

    borderTopStartRadius: 16,

    borderBottomStartRadius: 16,

  },

  cardRow: {

    alignItems: "flex-start",

    gap:        12,

  },

  tagRow: {

    flexWrap:    "wrap",

    gap:         6,

    marginTop:   6,

    alignItems:  "center",

  },

  tag: {

    flexDirection:     "row",

    alignItems:        "center",

    gap:               4,

    paddingHorizontal: 7,

    paddingVertical:   3,

    borderRadius:      9999,

    backgroundColor:   kit.color.well,

  },

  stockBadge: {

    alignItems:        "center",

    paddingHorizontal: 12,

    paddingVertical:   8,

    borderRadius:      12,

    backgroundColor:   kit.color.well,

    minWidth:          56,

    gap:               2,

  },

  stockBadgeLow: {

    backgroundColor: kit.color.dangerTint,

  },

  stockNumber: {

    fontSize:           20,

    fontFamily:         "Cairo_900Black",

    lineHeight:         24,

    includeFontPadding: false,

  },

  cardFooter: {

    justifyContent: "space-between",

    alignItems:     "center",

    paddingTop:     8,

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: kit.color.line,

  },

  footerStats: {

    alignItems: "center",

    gap:        6,

  },

  footerDot: {

    width:           3,

    height:          3,

    borderRadius:    1.5,

    backgroundColor: kit.color.inkFaint,

  },



  empty: {

    alignItems:  "center",

    paddingTop:  60,

    gap:         10,

  },

});

