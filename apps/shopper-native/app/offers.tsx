import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ProductGrid,
  useInfiniteProducts,
  type NativeProduct,
  type ProductSortMode,
} from "@/features/products";
import { useEndOfDayCountdown } from "@/features/home/hooks/useEndOfDayCountdown";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: {
  id:       ProductSortMode;
  labelKey: string;
  icon:     React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { id: "price_asc",  labelKey: "category.sortPriceAsc",  icon: "arrow-up-outline"    },
  { id: "price_desc", labelKey: "category.sortPriceDesc", icon: "arrow-down-outline"  },
  { id: "newest",     labelKey: "category.sortNewest",    icon: "time-outline"        },
  { id: "name_asc",   labelKey: "category.sortNameAsc",   icon: "text-outline"        },
];

// ─── Countdown unit ──────────────────────────────────────────────────────────

function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <View style={cs.unit}>
      <LinearGradient
        colors={[kit.color.accent, kit.color.accentDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cs.cell}
      >
        <UIText style={cs.value}>{value}</UIText>
      </LinearGradient>
      <UIText style={cs.unitLabel}>{label}</UIText>
    </View>
  );
}

function CountdownRow() {
  const { t }       = useTranslation();
  const { h, m, s } = useEndOfDayCountdown();
  return (
    <View style={cs.row}>
      <CountdownUnit value={h} label={t("home.flashHrs")} />
      <UIText style={cs.colon}>:</UIText>
      <CountdownUnit value={m} label={t("home.flashMin")} />
      <UIText style={cs.colon}>:</UIText>
      <CountdownUnit value={s} label={t("home.flashSec")} />
    </View>
  );
}

// ─── OffersScreen ─────────────────────────────────────────────────────────────

export default function OffersScreen() {
  const { t }                 = useTranslation();
  const router                = useRouter();
  const insets                = useSafeAreaInsets();
  const { isTablet } = useScreenLayout();

  const [sortBy, setSortBy]           = useState<ProductSortMode>("price_asc");
  const [inStockOnly, setInStockOnly] = useState(false);

  const {
    products,
    totalCount,
    isLoading,
    isError,
    isFetchingNextPage,
    isRefreshing,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteProducts({
    isSale:  true,
    sortBy,
    inStock: inStockOnly || undefined,
  });

  const handleProductPress = useCallback(
    (p: NativeProduct) => router.push({ pathname: "/product/[id]", params: { id: p.id } }),
    [router],
  );

  const toggleInStock = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setInStockOnly((v) => !v);
  }, []);

  const pickSort = useCallback((id: ProductSortMode) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setSortBy(id);
  }, []);

  return (
    <View style={s.root}>

      {/* ══════════════════════════════════════════════════ */}
      {/* HEADER                                           */}
      {/* ══════════════════════════════════════════════════ */}
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>

        {/* Gradient wash */}
        <LinearGradient
          colors={[kit.color.accent + "22", kit.color.accent + "08", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Nav row */}
        <View style={[s.navRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.navBtn}>
            <Ionicons name={BACK_CHEVRON} size={17} color={kit.color.inkSoft} />
          </Pressable>
          <Pressable onPress={() => router.push("/(tabs)/cart")} style={s.navBtn}>
            <Ionicons name="bag-outline" size={17} color={kit.color.inkSoft} />
          </Pressable>
        </View>

        {/* Identity block */}
        <View style={[s.identity, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.iconWell}>
            <Ionicons name="flash" size={28} color={kit.color.accent} />
          </View>
          <View style={s.titleBlock}>
            <UIText style={[s.eyebrow, { textAlign: TEXT_START }]}>
              {t("offers.eyebrow")}
            </UIText>
            <UIText style={[s.title, { textAlign: TEXT_START }]}>
              {t("offers.title")}
            </UIText>
            {totalCount > 0 && !isLoading && (
              <View style={[s.countBadge, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.countDot} />
                <UIText style={s.countText}>
                  {totalCount} {t("offers.dealsAvailable")}
                </UIText>
              </View>
            )}
          </View>
          <CountdownRow />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.chipsRow, { flexDirection: flexRow(IS_RTL) }]}
        >
          <Pressable
            onPress={toggleInStock}
            style={[s.chip, inStockOnly ? s.chipActive : s.chipOff]}
          >
            <Ionicons
              name={inStockOnly ? "checkmark-circle" : "cube-outline"}
              size={13}
              color={inStockOnly ? kit.color.accent : kit.color.inkFaint}
            />
            <UIText style={[s.chipText, { color: inStockOnly ? kit.color.accent : kit.color.inkSoft }]}>
              {t("category.inStockOnly")}
            </UIText>
          </Pressable>

          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => pickSort(opt.id)}
                style={[s.chip, active ? s.chipActive : s.chipOff]}
              >
                <Ionicons name={opt.icon} size={13} color={active ? kit.color.accent : kit.color.inkFaint} />
                <UIText style={[s.chipText, { color: active ? kit.color.accent : kit.color.inkSoft }]}>
                  {t(opt.labelKey)}
                </UIText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════════ */}
      {/* CONTENT                                          */}
      {/* ══════════════════════════════════════════════════ */}
      {isLoading ? (
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          numColumns={2}
          keyExtractor={(k) => String(k)}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          columnWrapperStyle={{ gap: 10, flexDirection: flexRow(IS_RTL) }}
          showsVerticalScrollIndicator={false}
          renderItem={() => <View style={{ flex: 1 }}><ProductCardSkeleton /></View>}
        />
      ) : isError ? (
        <EmptyState
          icon="wifi-outline"
          title={t("offers.loadError")}
          description={t("offers.loadErrorDesc")}
          actionLabel={t("category.tryAgain")}
          onAction={refetch}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon="flash-outline"
          title={t("offers.empty")}
          description={t("offers.emptyDescription")}
        />
      ) : (
        <ProductGrid
          products={products}
          onProductPress={handleProductPress}
          onEndReached={hasNextPage && !isFetchingNextPage ? fetchNextPage : undefined}
          refreshing={isRefreshing}
          onRefresh={refetch}
          contentContainerStyle={{ padding: isTablet ? 16 : 12, paddingBottom: insets.bottom + 90 }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator color={kit.color.accent} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  header: {
    backgroundColor:   kit.color.surface,
    paddingBottom:     16,
    paddingHorizontal: 16,
    gap:               14,
    overflow:          "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },

  navRow: {
    justifyContent: "space-between",
    alignItems:     "center",
    marginTop:      4,
  },
  navBtn: {
    width:           40,
    height:          40,
    borderRadius:    13,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },

  identity: {
    alignItems: "center",
    gap:        12,
  },
  iconWell: {
    width:           68,
    height:          68,
    borderRadius:    21,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.accent + "33",
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  titleBlock: {
    flex: 1,
    gap:  5,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accent,
    letterSpacing:      0.8,
    includeFontPadding: false,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    lineHeight:         28,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  countBadge: {
    alignSelf:         "flex-start",
    alignItems:        "center",
    gap:               5,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   4,
    backgroundColor:   kit.color.accentTint,
  },
  countDot: {
    width:           5,
    height:          5,
    borderRadius:    3,
    backgroundColor: kit.color.accent,
  },
  countText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         15,
    color:              kit.color.accent,
    includeFontPadding: false,
  },

  chipsRow: {
    gap:          8,
    paddingEnd: 4,
  },
  chip: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 13,
    paddingVertical:   9,
    borderRadius:      kit.radius.control,
    borderWidth:       1,
  },
  chipActive: {
    backgroundColor: kit.color.accentTint,
    borderColor:     kit.color.accent + "44",
  },
  chipOff: {
    backgroundColor: kit.color.well,
    borderColor:     kit.color.line,
  },
  chipText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           12,
    lineHeight:         16,
    includeFontPadding: false,
  },
});

// ─── Countdown styles ─────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           4,
  },
  unit: {
    alignItems: "center",
    gap:        3,
  },
  cell: {
    width:          36,
    height:         36,
    borderRadius:   9,
    alignItems:     "center",
    justifyContent: "center",
  },
  value: {
    fontFamily:         theme.fonts.black,
    fontSize:           16,
    lineHeight:         20,
    color:              "#fff",
    includeFontPadding: false,
  },
  unitLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           8,
    lineHeight:         10,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  colon: {
    fontFamily:         theme.fonts.black,
    fontSize:           16,
    lineHeight:         36,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
    marginBottom:       12,
  },
});
