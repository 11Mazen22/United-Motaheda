/**
 * WorkbenchScreen — pharmacist home screen / dashboard.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │  Header: greeting + search + signout│
 *   ├─────────────────────────────────────┤
 *   │  Stats band: 4 KPI tiles (2×2)      │
 *   ├─────────────────────────────────────┤
 *   │  Quick actions row                  │
 *   ├─────────────────────────────────────┤
 *   │  "Order Queue" section header       │
 *   │  FlatList of OrderQueueCards        │
 *   └─────────────────────────────────────┘
 *
 * Realtime:
 *   usePharmacistRealtimeSync (mounted in layout) invalidates order queue +
 *   dashboard queries on any order/prescription change. The FlatList is
 *   backed by usePharmacistOrderQueue, so it updates live.
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useRouter }         from "expo-router";
import { Ionicons }          from "@expo/vector-icons";
import { useTranslation }    from "react-i18next";
import { useQueryClient }    from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Screen, Text as UIText }  from "@/shared/ui";
import { kit }                     from "@/shared/kit";
import { theme }                   from "@/shared/theme";
import { useAuth }                 from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { usePharmacistOrderQueue } from "../hooks/usePharmacistQueries";
import { usePharmacistDashboard }  from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys }     from "../hooks/queryKeys";
import { OrderQueueCard }          from "../components/OrderQueueCard";
import { StatCard }                from "../components/StatCard";
import type { PharmacistOrder }    from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Quick action button ───────────────────────────────────────────────────────

function QuickAction({
  icon, label, onPress, badge,
}: {
  icon:    React.ComponentProps<typeof Ionicons>["name"];
  label:   string;
  onPress: () => void;
  badge?:  number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.quickAction, pressed && s.quickActionPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={s.quickActionIcon}>
        <Ionicons name={icon} size={20} color={kit.color.accentDeep} />
        {badge != null && badge > 0 && (
          <View style={s.badge}>
            <UIText variant="eyebrow" style={s.badgeText}>
              {badge > 99 ? "99+" : String(badge)}
            </UIText>
          </View>
        )}
      </View>
      <UIText variant="caption" color="secondary" style={{ textAlign: "center" }}>
        {label}
      </UIText>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function WorkbenchScreen(): React.ReactElement {
  const { t }       = useTranslation();
  const router      = useRouter();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const queueQuery = usePharmacistOrderQueue();
  const statsQuery = usePharmacistDashboard();

  const stats  = statsQuery.data;
  const orders = queueQuery.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
        queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const handleOrderPress = useCallback((order: PharmacistOrder) => {
    router.push(`/(pharmacist)/order/${order.id}` as never);
  }, [router]);

  return (
    <Screen edgeTop background={kit.color.canvas}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <UIText variant="caption" color="brand" style={{ textAlign: TEXT_START }}>
            {t("pharmacist.eyebrow")}
          </UIText>
          <UIText variant="screen-title" style={{ textAlign: TEXT_START, marginTop: 2 }}>
            {t("pharmacist.greeting", { name: user?.name?.split(" ")[0] ?? "" })}
          </UIText>
        </View>
        <View style={[s.headerActions]}>
          <Pressable
            onPress={() => router.push("/(pharmacist)/search" as never)}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t("pharmacist.search")}
          >
            <Ionicons name="search-outline" size={20} color={kit.color.inkSoft} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(pharmacist)/notifications" as never)}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t("pharmacist.notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color={kit.color.inkSoft} />
          </Pressable>
          <Pressable
            onPress={() => void signOut()}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t("pharmacist.signOut")}
          >
            <Ionicons name="log-out-outline" size={20} color={kit.color.inkSoft} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
            colors={[kit.color.accent]}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Stats band ─────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(0).duration(320)}>
              <View style={s.statsGrid}>
                <StatCard
                  value={stats?.activeOrders ?? "—"}
                  label={t("pharmacist.statActiveOrders")}
                  icon="bag-handle-outline"
                  onPress={() => {/* already on queue */}}
                />
                <StatCard
                  value={stats?.pendingPrescriptions ?? "—"}
                  label={t("pharmacist.statPendingRx")}
                  icon="document-text-outline"
                  iconColor="#7C3AED"
                  iconBg="#F5F3FF"
                  onPress={() => router.push("/(pharmacist)/prescriptions" as never)}
                />
              </View>
              <View style={[s.statsGrid, { marginTop: 10 }]}>
                <StatCard
                  value={stats?.preparing ?? "—"}
                  label={t("pharmacist.statPreparing")}
                  icon="construct-outline"
                  iconColor={kit.color.accentDeep}
                  iconBg={kit.color.accentTint}
                />
                <StatCard
                  value={stats?.lowStockCount ?? "—"}
                  label={t("pharmacist.statLowStock")}
                  icon="alert-circle-outline"
                  iconColor={kit.color.danger}
                  iconBg={kit.color.dangerTint}
                  onPress={() => router.push("/(pharmacist)/inventory" as never)}
                />
              </View>
            </Animated.View>

            {/* ── Quick actions ───────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(60).duration(320)} style={s.quickActions}>
              <QuickAction
                icon="document-text-outline"
                label={t("pharmacist.qaPrescriptions")}
                badge={stats?.pendingPrescriptions}
                onPress={() => router.push("/(pharmacist)/prescriptions" as never)}
              />
              <QuickAction
                icon="barcode-outline"
                label={t("pharmacist.qaScanner")}
                onPress={() => router.push("/(pharmacist)/scanner" as never)}
              />
              <QuickAction
                icon="cube-outline"
                label={t("pharmacist.qaInventory")}
                onPress={() => router.push("/(pharmacist)/inventory" as never)}
              />
              <QuickAction
                icon="bar-chart-outline"
                label={t("pharmacist.qaAnalytics", "تحليلات")}
                onPress={() => router.push("/(pharmacist)/analytics" as never)}
              />
            </Animated.View>

            {/* ── Section header ──────────────────────────────────────── */}
            <View style={[s.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
              <UIText variant="section-head" style={{ flex: 1, textAlign: TEXT_START }}>
                {t("pharmacist.orderQueueTitle")}
              </UIText>
              <UIText variant="caption" color="secondary">
                {t("pharmacist.orderCount", { count: orders.length })}
              </UIText>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40).duration(280)}>
            <OrderQueueCard
              order={item}
              onPress={() => handleOrderPress(item)}
            />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          queueQuery.isLoading ? (
            <View style={s.emptyState}>
              <ActivityIndicator size="large" color={kit.color.accent} />
              <UIText variant="body-sm" color="secondary" style={{ marginTop: 12 }}>
                {t("common.loading")}
              </UIText>
            </View>
          ) : queueQuery.isError ? (
            <View style={s.emptyState}>
              <Ionicons name="cloud-offline-outline" size={40} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
                {t("errors.network")}
              </UIText>
              <Pressable onPress={() => void onRefresh()} style={s.retryBtn}>
                <UIText variant="body-sm" color="brand">{t("common.retry")}</UIText>
              </Pressable>
            </View>
          ) : (
            <View style={s.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={44} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
                {t("pharmacist.emptyQueueTitle")}
              </UIText>
              <UIText variant="body-sm" color="secondary" style={{ marginTop: 4, textAlign: "center" }}>
                {t("pharmacist.emptyQueueBody")}
              </UIText>
            </View>
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: kit.inset.screen,
    paddingTop:        12,
    paddingBottom:     10,
    gap:               8,
  },
  headerActions: {
    flexDirection: flexRow(IS_RTL),
    gap:           4,
  },
  iconBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  listContent: {
    paddingHorizontal: kit.inset.screen,
    paddingBottom:     48,
    gap:               0,
  },
  statsGrid: {
    flexDirection: flexRow(IS_RTL),
    gap:           10,
    marginTop:     14,
  },
  quickActions: {
    flexDirection:   flexRow(IS_RTL),
    justifyContent:  "space-around",
    marginTop:       18,
    marginBottom:    6,
    paddingVertical: 14,
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
  },
  quickAction: {
    alignItems: "center",
    gap:        6,
    flex:       1,
  },
  quickActionPressed: {
    opacity: 0.75,
  },
  quickActionIcon: {
    width:           44,
    height:          44,
    borderRadius:    14,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.accentTint,
  },
  badge: {
    position:        "absolute",
    top:             -4,
    right:           -4,
    minWidth:        18,
    height:          18,
    borderRadius:    9,
    backgroundColor: kit.color.danger,
    alignItems:      "center",
    justifyContent:  "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color:    "#fff",
    fontSize: 9,
    fontFamily: theme.fonts.black,
  },
  sectionHeader: {
    alignItems:  "center",
    marginTop:   22,
    marginBottom: 12,
  },
  emptyState: {
    alignItems:    "center",
    paddingTop:    52,
    paddingBottom: 40,
  },
  retryBtn: {
    marginTop:         12,
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderRadius:      kit.radius.lg,
    backgroundColor:   kit.color.accentTint,
  },
});
