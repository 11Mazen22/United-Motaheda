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
  RefreshControl,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme, EmptyState } from "@pharmacy/ui-native";

import { useScreenLayout } from "@/utils/responsive";
import { useAuth } from "@/features/auth";
import type { Order } from "@/stores/orders";
import { useOrders } from "../hooks/useOrders";
import { UnauthenticatedState } from "../components/UnauthenticatedState";
import { EmptyOrdersState }     from "../components/EmptyOrdersState";
import { OrdersHeader }         from "../components/OrdersHeader";
import { OrderCard, SkeletonCard } from "../components/OrderCard";
import { getOrdersStyles } from "../components/orders.styles";

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
