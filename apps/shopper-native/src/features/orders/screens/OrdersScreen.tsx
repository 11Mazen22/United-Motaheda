/**
 * OrdersScreen — premium ground-up redesign.
 *
 * Replaces generic AppHeader + floating stats row with a unified dark-gradient
 * header that contains the page title + eyebrow + inline stat pills.
 * Consistent with Home / Profile / Search / Payment visual language.
 */

import React, { useCallback } from "react";
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
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAuth } from "@/features/auth";
import type { Order } from "@/stores/orders";
import { useOrders } from "../hooks/useOrders";
import { UnauthenticatedState } from "../components/UnauthenticatedState";
import { EmptyOrdersState }     from "../components/EmptyOrdersState";
import { OrderCard, SkeletonCard } from "../components/OrderCard";
import { listS } from "../components/orders.styles";
import { EmptyState } from "@/components/ui/EmptyState";

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
                <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
              </View>
            )}
          </Pressable>
        ) : null}

        <View style={h.iconTile}>
          <Ionicons name="bag-handle-outline" size={22} color={kit.color.accentDeep} />
        </View>

        <View style={{ flex: 1 }}>
          <UIText style={h.eyebrow}>{t("orders.eyebrow")}</UIText>
          <UIText style={h.title}>{t("orders.title")}</UIText>
        </View>
      </View>

      {/* Inline stat band — 3 columns with tinted icon wells */}
      <View style={h.statsRow}>
        <View style={[h.statCell, h.statCellBorder]}>
          <View style={[h.statIconWell, { backgroundColor: kit.color.accentTint }]}>
            <Ionicons name="bag-handle-outline" size={13} color={kit.color.accentDeep} />
          </View>
          <UIText style={h.statVal}>{total}</UIText>
          <UIText style={h.statLbl}>{t("orders.countOrders", { count: total })}</UIText>
        </View>

        <View style={[h.statCell, h.statCellBorder]}>
          <View style={[h.statIconWell, { backgroundColor: kit.color.warnTint }]}>
            <Ionicons name="refresh-outline" size={13} color={kit.color.warn} />
          </View>
          <UIText style={h.statVal}>{active}</UIText>
          <UIText style={h.statLbl}>{t("orders.processing")}</UIText>
        </View>

        <View style={h.statCell}>
          <View style={[h.statIconWell, { backgroundColor: kit.color.successTint }]}>
            <Ionicons name="checkmark-circle-outline" size={13} color={kit.color.success} />
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
    <View style={{ flex: 1, backgroundColor: kit.color.canvas }}>
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
        contentContainerStyle={[
          listS.listContent,
          { paddingHorizontal: pagePad, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
            colors={[kit.color.accent]}
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
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: kit.color.canvas }}>
      <OrdersHeader t={t} insetsTop={insetsTop} orders={[]} showBack={showBack} onBack={onBack} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState
          icon="wifi-outline"
          title={t("errors.network").split(".")[0]}
          description={t("errors.network")}
          actionLabel={t("common.retry")}
          onAction={onRetry}
        />
      </View>
    </View>
  );
}

// ─── OrdersLoadingState — header + skeleton with responsive gutter ────────────

function OrdersLoadingState({
  insetsTop, showBack, onBack,
}: { insetsTop: number; showBack: boolean; onBack: () => void }) {
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  return (
    <View style={{ flex: 1, backgroundColor: kit.color.canvas }}>
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

const h = StyleSheet.create({
  // paddingHorizontal is set inline via useScreenLayout().pagePad for breakpoint-aware gutter
  header: {
    paddingBottom:     18,
    gap:               16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
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
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    flexShrink:      0,
  },
  backBtnPressed: {
    opacity:   0.82,
    transform: [{ scale: 0.96 }],
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    textAlign:          textAlignStart(isRtl()),
    includeFontPadding: false,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         36,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    textAlign:          textAlignStart(isRtl()),
    includeFontPadding: false,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    flexShrink:      0,
  },

  // Stat band — white kit card with tinted icon wells
  statsRow: {
    flexDirection:   flexRow(isRtl()),
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    ...kit.shadow.raised,
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
    borderEndColor: kit.color.lineStrong,
  },
  statIconWell: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  statVal: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    lineHeight:         26,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  statLbl: {
    fontFamily:         theme.fonts.regular,
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    includeFontPadding: false,
  },
});
