/**
 * OrdersScreen — premium ground-up redesign.
 *
 * Replaces generic AppHeader + floating stats row with a unified dark-gradient
 * header that contains the page title + eyebrow + inline stat pills.
 * Consistent with Home / Profile / Search / Payment visual language.
 */

import React, { useCallback, useMemo } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, EmptyState, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAuth } from "@/features/auth";
import type { Order } from "@/stores/orders";
import { useOrders } from "../hooks/useOrders";
import { UnauthenticatedState } from "../components/UnauthenticatedState";
import { EmptyOrdersState }     from "../components/EmptyOrdersState";
import { OrderCard, SkeletonCard } from "../components/OrderCard";
import { getOrdersStyles } from "../components/orders.styles";

// ─── OrdersHeader — light editorial header with embedded stats (kit) ──────────

function OrdersHeader({
  t, insetsTop, orders, showBack, onBack,
}: {
  t:         (key: string, opts?: Record<string, unknown>) => string;
  insetsTop: number;
  orders:    Order[];
  showBack:  boolean;
  onBack:    () => void;
}) {
  const { theme } = useTheme();
  const h = useMemo(() => getHeaderStyles(theme), [theme]);
  const total     = orders.length;
  const active    = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const { pagePad } = useScreenLayout();

  return (
    <View style={[h.header, { paddingTop: insetsTop + 14, paddingHorizontal: pagePad }]}>
      {/* Top row — back + icon tile + title block */}
      <View style={[h.topRow, { flexDirection: flexRow(isRtl()) }]}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            style={h.backBtnTouchable}
            accessibilityRole="button"
            hitSlop={8}>
            {({ pressed }) => (
              <View style={[h.backBtn, pressed && h.backBtnPressed]}>
                <Ionicons name={BACK_CHEVRON} size={18} color={theme.colors.text.secondary} />
              </View>
            )}
          </Pressable>
        ) : null}

        <View style={h.iconTile}>
          <Ionicons name="bag-handle-outline" size={22} color={theme.colors.brand.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <UIText style={h.eyebrow}>{t("orders.eyebrow")}</UIText>
          <UIText style={h.title}>{t("orders.title")}</UIText>
        </View>
      </View>

      {/* Inline stat band — 3 columns with tinted icon wells */}
      <View style={h.statsRow}>
        <View style={[h.statCell, h.statCellBorder]}>
          <View style={[h.statIconWell, { backgroundColor: theme.colors.brand.primaryLight }]}>
            <Ionicons name="bag-handle-outline" size={13} color={theme.colors.brand.primary} />
          </View>
          <UIText style={h.statVal}>{total}</UIText>
          <UIText style={h.statLbl}>{t("orders.countOrders", { count: total })}</UIText>
        </View>

        <View style={[h.statCell, h.statCellBorder]}>
          <View style={[h.statIconWell, { backgroundColor: `${theme.colors.status.warning}1A` }]}>
            <Ionicons name="refresh-outline" size={13} color={theme.colors.status.warning} />
          </View>
          <UIText style={h.statVal}>{active}</UIText>
          <UIText style={h.statLbl}>{t("orders.processing")}</UIText>
        </View>

        <View style={h.statCell}>
          <View style={[h.statIconWell, { backgroundColor: `${theme.colors.status.success}1A` }]}>
            <Ionicons name="checkmark-circle-outline" size={13} color={theme.colors.status.success} />
          </View>
          <UIText style={h.statVal}>{delivered}</UIText>
          <UIText style={h.statLbl}>{t("orders.delivered")}</UIText>
        </View>
      </View>
    </View>
  );
}

// ─── OrdersList — virtualized populated list ──────────────────────────────────

function OrdersList({
  orders, isRefetching, onRefresh, onOrderPress, showBack,
}: {
  orders:       Order[];
  isRefetching: boolean;
  onRefresh:    () => void;
  onOrderPress: (id: string) => void;
  showBack:     boolean;
}): React.ReactElement {
  const { theme } = useTheme();
  const { listS } = useMemo(() => getOrdersStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();
  const { pagePad } = useScreenLayout();

  const renderItem = useCallback(
    ({ item }: { item: Order }) => (
      <OrderCard order={item} onPress={onOrderPress} />
    ),
    [onOrderPress],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas.background }}>
      <OrdersHeader
        t={t}
        insetsTop={insets.top}
        orders={orders}
        showBack={showBack}
        onBack={() => router.back()}
      />

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={
          [
            listS.listContent,
            { paddingHorizontal: pagePad, paddingBottom: insets.bottom + 32 },
          ]
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand.primary}
            colors={[theme.colors.brand.primary]}
          />
        }
        renderItem={renderItem}
      />
    </View>
  );
}

// ─── OrdersErrorState — header + network-error empty state ───────────────────

function OrdersErrorState({
  insetsTop, showBack, onBack, onRetry,
}: { insetsTop: number; showBack: boolean; onBack: () => void; onRetry: () => void }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas.background }}>
      <OrdersHeader t={t} insetsTop={insetsTop} orders={[]} showBack={showBack} onBack={onBack} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState
          illustrationName="offline"
          title={t("errors.network").split(".")[0]}
          subtitle={t("errors.network")}
          action={{ label: t("common.retry"), onPress: onRetry }}
        />
      </View>
    </View>
  );
}

// ─── OrdersLoadingState — header + skeleton with responsive gutter ────────────

function OrdersLoadingState({
  insetsTop, showBack, onBack,
}: { insetsTop: number; showBack: boolean; onBack: () => void }) {
  const { theme } = useTheme();
  const { listS } = useMemo(() => getOrdersStyles(theme), [theme]);
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas.background }}>
      <OrdersHeader t={t} insetsTop={insetsTop} orders={[]} showBack={showBack} onBack={onBack} />
      <View style={[listS.skeletonContainer, { paddingHorizontal: pagePad }]}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    </View>
  );
}

// ─── OrdersScreen — root ──────────────────────────────────────────────────────

export interface OrdersScreenProps {
  showBack?: boolean;
}

export function OrdersScreen({ showBack = true }: OrdersScreenProps): React.ReactElement {
  const router   = useRouter();
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const {
    data:        orders        = [],
    isLoading,
    isRefetching,
    refetch,
    isSuccess,
    isError,
  } = useOrders(user?.id);

  const handleOrderPress = useCallback(
    (orderId: string) => router.push(`/order/${orderId}`),
    [router],
  );
  const handleRefresh = useCallback(() => { void refetch(); }, [refetch]);

  // ── Unauthenticated ──────────────────────────────────────────────────────────
  if (!user) return <UnauthenticatedState showBack={showBack} />;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <OrdersLoadingState insetsTop={insets.top} showBack={showBack} onBack={() => router.back()} />;
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (isError && orders.length === 0) {
    return (
      <OrdersErrorState
        insetsTop={insets.top}
        showBack={showBack}
        onBack={() => router.back()}
        onRetry={() => { void refetch(); }}
      />
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (isSuccess && orders.length === 0) return <EmptyOrdersState showBack={showBack} />;

  // ── Populated ────────────────────────────────────────────────────────────────
  return (
    <OrdersList
      orders={orders}
      isRefetching={isRefetching}
      onRefresh={handleRefresh}
      onOrderPress={handleOrderPress}
      showBack={showBack}
    />
  );
}

// ─── Header styles ────────────────────────────────────────────────────────────

function getHeaderStyles(theme: NativeTheme) {
  return StyleSheet.create({
    // paddingHorizontal is set inline via useScreenLayout().pagePad for breakpoint-aware gutter
    header: {
      paddingBottom:     18,
      gap:               16,
      backgroundColor:   theme.colors.canvas.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border.default,
      ...theme.shadows[1],
    },

    // Top row
    topRow: {
      alignItems: "center",
      gap:        14,
    },
    // Touchable wrapper carries only sizing/radius — visual styling lives on
    // the plain View inside instead of on the Pressable's own function-computed
    // style, which is unreliable under this app's RN/Fabric setup.
    backBtnTouchable: {
      width:        40,
      height:       40,
      borderRadius: 20,
      flexShrink:   0,
    },
    backBtn: {
      width:           40,
      height:          40,
      borderRadius:    20,
      backgroundColor: theme.colors.canvas.surfaceMuted,
      alignItems:      "center",
      justifyContent:  "center",
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      flexShrink:      0,
    },
    backBtnPressed: {
      opacity:   0.82,
      transform: [{ scale: 0.96 }],
    },
    eyebrow: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           10,
      lineHeight:         14,
      color:              theme.colors.brand.primary,
      letterSpacing:      0.5,
      textAlign:          textAlignStart(isRtl()),
      includeFontPadding: false,
    },
    title: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           28,
      lineHeight:         36,
      color:              theme.colors.text.primary,
      letterSpacing:      -0.6,
      textAlign:          textAlignStart(isRtl()),
      includeFontPadding: false,
    },
    iconTile: {
      width:           52,
      height:          52,
      borderRadius:    16,
      backgroundColor: theme.colors.brand.primaryLight,
      alignItems:      "center",
      justifyContent:  "center",
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      flexShrink:      0,
    },

    // Stat band — white kit card with tinted icon wells
    statsRow: {
      flexDirection:   flexRow(isRtl()),
      backgroundColor: theme.colors.canvas.surface,
      borderRadius:    12,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      overflow:        "hidden",
      ...theme.shadows[1],
    },
    statCell: {
      flex:            1,
      alignItems:      "center",
      justifyContent:  "center",
      gap:             6,
      paddingVertical: 16,
    },
    statCellBorder: {
      borderEndWidth: StyleSheet.hairlineWidth,
      borderEndColor: theme.colors.border.strong,
    },
    statIconWell: {
      width:          32,
      height:         32,
      borderRadius:   10,
      alignItems:     "center",
      justifyContent: "center",
    },
    statVal: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           20,
      lineHeight:         26,
      color:              theme.colors.text.primary,
      letterSpacing:      -0.4,
      includeFontPadding: false,
    },
    statLbl: {
      fontFamily:         legacyTheme.fonts.regular,
      fontSize:           9,
      lineHeight:         13,
      color:              theme.colors.text.muted,
      textAlign:          "center",
      includeFontPadding: false,
    },
  });
}
