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
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, EmptyState, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme, gradients } from "@pharmacy/design-tokens";

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
    <LinearGradient
      colors={gradients.brandPrimary as unknown as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[h.header, { paddingTop: insetsTop + 14, paddingHorizontal: pagePad }]}
    >
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
                <Ionicons name={BACK_CHEVRON} size={18} color="#fff" />
              </View>
            )}
          </Pressable>
        ) : null}

        <View style={h.iconTile}>
          <Ionicons name="bag-handle-outline" size={22} color="#fff" />
        </View>

        <View style={{ flex: 1 }}>
          <UIText style={h.eyebrow}>{t("orders.eyebrow")}</UIText>
          <UIText style={h.title}>{t("orders.title")}</UIText>
        </View>
      </View>

      {/* Inline stat band — glass pills on the gradient, matching the same
          hero-stat treatment now shared with Pharmacist's Workbench header. */}
      <View style={[h.statsRow, { flexDirection: flexRow(isRtl()) }]}>
        <View style={h.statCell}>
          <View style={h.statIconWell}>
            <Ionicons name="bag-handle-outline" size={13} color="#fff" />
          </View>
          <UIText style={h.statVal}>{total}</UIText>
          <UIText style={h.statLbl} numberOfLines={1}>{t("orders.countOrders", { count: total })}</UIText>
        </View>

        <View style={h.statCell}>
          <View style={h.statIconWell}>
            <Ionicons name="refresh-outline" size={13} color="#fff" />
          </View>
          <UIText style={h.statVal}>{active}</UIText>
          <UIText style={h.statLbl} numberOfLines={1}>{t("orders.processing")}</UIText>
        </View>

        <View style={h.statCell}>
          <View style={h.statIconWell}>
            <Ionicons name="checkmark-circle-outline" size={13} color="#fff" />
          </View>
          <UIText style={h.statVal}>{delivered}</UIText>
          <UIText style={h.statLbl} numberOfLines={1}>{t("orders.delivered")}</UIText>
        </View>
      </View>
    </LinearGradient>
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
    ({ item, index }: { item: Order; index: number }) => (
      <Animated.View entering={FadeInDown.duration(340).delay(Math.min(index, 6) * 45).springify()}>
        <OrderCard order={item} onPress={onOrderPress} />
      </Animated.View>
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
    // paddingHorizontal is set inline via useScreenLayout().pagePad for breakpoint-aware gutter.
    // Gradient hero -- same brand treatment now shared with Home's TodayCare,
    // Pharmacist's Workbench header, and Driver's manifest hero, instead of
    // the plain white bar this used to be.
    header: {
      paddingBottom: 18,
      gap:           16,
      ...theme.shadows[2],
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
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems:      "center",
      justifyContent:  "center",
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
      color:              "rgba(255,255,255,0.75)",
      letterSpacing:      0.5,
      textAlign:          textAlignStart(isRtl()),
      includeFontPadding: false,
    },
    title: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           28,
      lineHeight:         36,
      color:              "#fff",
      letterSpacing:      -0.6,
      textAlign:          textAlignStart(isRtl()),
      includeFontPadding: false,
    },
    iconTile: {
      width:           52,
      height:          52,
      borderRadius:    16,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems:      "center",
      justifyContent:  "center",
      flexShrink:      0,
    },

    // Stat band — glass pills on the gradient
    statsRow: {
      gap: 10,
    },
    statCell: {
      flex:            1,
      alignItems:      "center",
      justifyContent:  "center",
      gap:             4,
      paddingVertical: 14,
      borderRadius:    14,
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    statIconWell: {
      width:           28,
      height:          28,
      borderRadius:    9,
      alignItems:      "center",
      justifyContent:  "center",
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    statVal: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           20,
      lineHeight:         26,
      color:              "#fff",
      letterSpacing:      -0.4,
      includeFontPadding: false,
    },
    statLbl: {
      fontFamily:         legacyTheme.fonts.semibold,
      fontSize:           9,
      lineHeight:         13,
      color:              "rgba(255,255,255,0.8)",
      textAlign:          "center",
      includeFontPadding: false,
    },
  });
}
