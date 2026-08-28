import React, { useCallback, useMemo, useState } from "react";
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
import { Text as UIText, useTheme, EmptyState, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
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

function CountdownUnit({ value, label, theme, cs }: { value: string; label: string; theme: NativeTheme; cs: ReturnType<typeof getCountdownStyles> }) {
  return (
    <View style={cs.unit}>
      <LinearGradient
        colors={[theme.colors.brand.primary, theme.colors.brand.primary]}
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

function CountdownRow({ theme }: { theme: NativeTheme }) {
  const cs = useMemo(() => getCountdownStyles(theme), [theme]);
  const { t }       = useTranslation();
  const { h, m, s } = useEndOfDayCountdown();
  return (
    <View style={cs.row}>
      <CountdownUnit value={h} label={t("home.flashHrs")} theme={theme} cs={cs} />
      <UIText style={cs.colon}>:</UIText>
      <CountdownUnit value={m} label={t("home.flashMin")} theme={theme} cs={cs} />
      <UIText style={cs.colon}>:</UIText>
      <CountdownUnit value={s} label={t("home.flashSec")} theme={theme} cs={cs} />
    </View>
  );
}

// ─── OffersScreen ─────────────────────────────────────────────────────────────

export default function OffersScreen() {
  const { theme }              = useTheme();
  const s                     = useMemo(() => getStyles(theme), [theme]);
  const { t }                 = useTranslation();
  const router                = useRouter();
  const insets                = useSafeAreaInsets();
  const { isTablet, pagePad } = useScreenLayout();

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
      <View style={[s.header, { paddingTop: insets.top + 6, paddingHorizontal: pagePad }]}>

        {/* Gradient wash */}
        <LinearGradient
          colors={[theme.colors.brand.primary + "22", theme.colors.brand.primary + "08", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Nav row */}
        <View style={[s.navRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.navBtn}>
            <Ionicons name={BACK_CHEVRON} size={17} color={theme.colors.text.secondary} />
          </Pressable>
          <Pressable onPress={() => router.push("/(customer)/(tabs)/cart")} style={s.navBtn}>
            <Ionicons name="bag-outline" size={17} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* Identity block -- title gets the full row to itself so a long
            headline ("العروض والتخفيضات") never has to compete with the
            countdown timer for width and wrap mid-word. The countdown gets
            its own full-width row below instead, which also reads better
            as a real countdown banner rather than a cramped corner widget. */}
        <View style={[s.identity, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.iconWell}>
            <Ionicons name="flash" size={28} color={theme.colors.brand.primary} />
          </View>
          <View style={[s.titleBlock, { minWidth: 0 }]}>
            <UIText style={[s.eyebrow, { textAlign: TEXT_START }]}>
              {t("offers.eyebrow")}
            </UIText>
            <UIText style={[s.title, { textAlign: TEXT_START }]} numberOfLines={1} adjustsFontSizeToFit>
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
        </View>

        <View style={[s.countdownRow, { flexDirection: flexRow(IS_RTL) }]}>
          <UIText style={s.countdownLabel}>{t("offers.endsIn", "Ends in")}</UIText>
          <CountdownRow theme={theme} />
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
              color={inStockOnly ? theme.colors.brand.primary : theme.colors.text.muted}
            />
            <UIText style={[s.chipText, { color: inStockOnly ? theme.colors.brand.primary : theme.colors.text.secondary }]}>
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
                <Ionicons name={opt.icon} size={13} color={active ? theme.colors.brand.primary : theme.colors.text.muted} />
                <UIText style={[s.chipText, { color: active ? theme.colors.brand.primary : theme.colors.text.secondary }]}>
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
          contentContainerStyle={{ padding: isTablet ? 16 : 12, gap: 10 }}
          columnWrapperStyle={{ gap: 10, flexDirection: flexRow(IS_RTL) }}
          showsVerticalScrollIndicator={false}
          renderItem={() => <View style={{ flex: 1 }}><ProductCardSkeleton /></View>}
        />
      ) : isError ? (
        <EmptyState
          illustrationName="offline"
          title={t("offers.loadError")}
          subtitle={t("offers.loadErrorDesc")}
          action={{ label: t("category.tryAgain"), onPress: refetch }}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon="flash-outline"
          title={t("offers.empty")}
          subtitle={t("offers.emptyDescription")}
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
                <ActivityIndicator color={theme.colors.brand.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root: {
      flex:            1,
      backgroundColor: theme.colors.canvas.background,
    },

    header: {
      backgroundColor:   theme.colors.canvas.surface,
      paddingBottom:     16,
      paddingHorizontal: 16,
      gap:               14,
      overflow:          "hidden",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border.default,
      ...theme.shadows[1],
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
      backgroundColor: theme.colors.canvas.surface,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      alignItems:      "center",
      justifyContent:  "center",
      ...theme.shadows[1],
    },

    identity: {
      alignItems: "center",
      gap:        12,
    },
    countdownRow: {
      alignItems:        "center",
      justifyContent:    "space-between",
      paddingHorizontal: 12,
      paddingVertical:   8,
      borderRadius:      12,
      backgroundColor:   theme.colors.canvas.surfaceMuted,
    },
    countdownLabel: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           12,
      color:              theme.colors.text.secondary,
      includeFontPadding: false,
    },
    iconWell: {
      width:           68,
      height:          68,
      borderRadius:    21,
      backgroundColor: theme.colors.brand.primaryLight,
      borderWidth:     1,
      borderColor:     theme.colors.brand.primary + "33",
      alignItems:      "center",
      justifyContent:  "center",
      ...theme.shadows[1],
    },
    titleBlock: {
      flex: 1,
      gap:  5,
    },
    eyebrow: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           10,
      lineHeight:         14,
      color:              theme.colors.brand.primary,
      letterSpacing:      0.8,
      includeFontPadding: false,
    },
    title: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           22,
      lineHeight:         28,
      color:              theme.colors.text.primary,
      letterSpacing:      -0.4,
      includeFontPadding: false,
    },
    countBadge: {
      alignSelf:         "flex-start",
      alignItems:        "center",
      gap:               5,
      borderRadius:      9999,
      paddingHorizontal: 10,
      paddingVertical:   4,
      backgroundColor:   theme.colors.brand.primaryLight,
    },
    countDot: {
      width:           5,
      height:          5,
      borderRadius:    3,
      backgroundColor: theme.colors.brand.primary,
    },
    countText: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           11,
      lineHeight:         15,
      color:              theme.colors.brand.primary,
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
      borderRadius:      10,
      borderWidth:       1,
    },
    chipActive: {
      backgroundColor: theme.colors.brand.primaryLight,
      borderColor:     theme.colors.brand.primary + "44",
    },
    chipOff: {
      backgroundColor: theme.colors.canvas.surfaceMuted,
      borderColor:     theme.colors.border.default,
    },
    chipText: {
      fontFamily:         legacyTheme.fonts.semibold,
      fontSize:           12,
      lineHeight:         16,
      includeFontPadding: false,
    },
  });
}

// ─── Countdown styles ─────────────────────────────────────────────────────────

function getCountdownStyles(theme: NativeTheme) {
  return StyleSheet.create({
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
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           16,
      lineHeight:         20,
      color:              "#fff",
      includeFontPadding: false,
    },
    unitLabel: {
      fontFamily:         legacyTheme.fonts.semibold,
      fontSize:           8,
      lineHeight:         10,
      color:              theme.colors.text.muted,
      includeFontPadding: false,
    },
    colon: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           16,
      lineHeight:         36,
      color:              theme.colors.brand.primary,
      includeFontPadding: false,
      marginBottom:       12,
    },
  });
}
