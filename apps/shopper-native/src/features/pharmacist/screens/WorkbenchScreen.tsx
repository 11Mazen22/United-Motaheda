import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  ScrollView,
} from "react-native";
import { useRouter }         from "expo-router";
import { Ionicons }          from "@expo/vector-icons";
import { useTranslation }    from "react-i18next";
import { useQueryClient }    from "@tanstack/react-query";

import { Screen, Text as UIText } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { kit }                    from "@pharmacy/ui-native";
import { useAuth }                from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout }        from "@/utils/responsive";

import { usePharmacistOrderQueue, usePharmacistDashboard, useAllPrescriptions } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys }  from "../hooks/queryKeys";
import { OrderQueueCard }       from "../components/OrderQueueCard";
import { StatCard }             from "../components/StatCard";
import EmptyState from "@/components/EmptyState";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function WorkbenchScreen(): React.ReactElement {
  const { t }          = useTranslation();
  const router         = useRouter();
  const { user }       = useAuth();
  const qc             = useQueryClient();
  const { pagePad }    = useScreenLayout();
  const [refreshing, setRefreshing] = useState(false);

  const queueQ = usePharmacistOrderQueue();
  const statsQ = usePharmacistDashboard();
  const rxQ = useAllPrescriptions("pending_review");
  
  const stats  = statsQ.data;
  const orders = queueQ.data ?? [];
  const pendingRx = rxQ.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
        qc.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() }),
        qc.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const firstName = user?.name?.split(" ")[0] ?? "";
  const branchName = t("pharmacist.mainBranch", "Main Branch");

  return (
    <Screen edgeTop background={kit.color.canvas}>
      {/* ── Compact Header ── */}
      <View style={[s.header, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL) }]}>
        <View style={{ flex: 1 }}>
          <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>
            {branchName}
          </UIText>
          <UIText variant="h3" style={{ textAlign: TEXT_START }}>
            {t("pharmacist.greeting", { name: firstName })}
          </UIText>
        </View>
        <View style={[s.headerActions, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable onPress={() => router.push("/(pharmacist)/search" as never)} style={s.iconBtn}>
            <Ionicons name="search-outline" size={20} color={kit.color.ink} />
          </Pressable>
          <Pressable onPress={() => router.push("/(pharmacist)/notifications" as never)} style={s.iconBtn}>
            <Ionicons name="notifications-outline" size={20} color={kit.color.ink} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kit.color.accent} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── KPI Strip ── */}
        <View style={[s.kpiStrip, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL) }]}>
          <StatCard
            value={stats?.activeOrders ?? 0}
            label={t("pharmacist.statActiveOrders", "Orders Today")}
          />
          <StatCard
            value={stats?.pendingPrescriptions ?? 0}
            label={t("pharmacist.statPendingRx", "Pending Rx")}
            accent={stats?.pendingPrescriptions ? kit.color.warn : undefined}
          />
          <StatCard
            value={stats?.lowStockCount ?? 0}
            label={t("pharmacist.statLowStock", "Low Stock")}
            accent={stats?.lowStockCount ? kit.color.danger : undefined}
          />
        </View>

        {/* ── Active Orders ── */}
        <View style={[s.sectionHeader, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL) }]}>
          <UIText variant="body" style={{ textAlign: TEXT_START }}>
            {t("pharmacist.orderQueueTitle", "Active Orders")}
          </UIText>
          <View style={s.badge}>
            <UIText variant="caption" weight="bold" style={{ color: kit.color.accentDeep }}>{orders.length}</UIText>
          </View>
        </View>
        
        <View style={[s.listContainer, { paddingHorizontal: pagePad }]}>
          {queueQ.isLoading ? (
            <ActivityIndicator size="small" color={kit.color.accent} style={{ marginVertical: 20 }} />
          ) : orders.length === 0 ? (
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={t("pharmacist.emptyQueueTitle", "No active orders")}
              subtitle={t("pharmacist.emptyQueueBody", "You're all caught up!")}
            />
          ) : (
            orders.map((order) => (
              <View key={order.id} style={{ marginBottom: 8 }}>
                <OrderQueueCard order={order} onPress={() => router.push(`/(pharmacist)/order/${order.id}` as never)} />
              </View>
            ))
          )}
        </View>

        {/* ── Pending Prescriptions ── */}
        <View style={[s.sectionHeader, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL), marginTop: 24 }]}>
          <UIText variant="body" style={{ textAlign: TEXT_START }}>
            {t("pharmacist.pendingRxTitle", "Pending Prescriptions")}
          </UIText>
          <View style={[s.badge, pendingRx.length > 0 && { backgroundColor: kit.color.warnTint }]}>
            <UIText variant="caption" weight="bold" style={{ color: pendingRx.length > 0 ? kit.color.warn : kit.color.accentDeep }}>
              {pendingRx.length}
            </UIText>
          </View>
        </View>
        
        <View style={[s.listContainer, { paddingHorizontal: pagePad }]}>
          {rxQ.isLoading ? (
            <ActivityIndicator size="small" color={kit.color.accent} style={{ marginVertical: 20 }} />
          ) : pendingRx.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title={t("pharmacist.emptyRxTitle", "No pending prescriptions")}
              subtitle={""}
            />
          ) : (
            pendingRx.map((rx) => (
              <Pressable
                key={rx.id}
                style={s.rxCard}
                onPress={() => router.push(`/(pharmacist)/prescription/${rx.id}` as never)}
              >
                <View style={{ flexDirection: flexRow(IS_RTL), justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <UIText variant="body" weight="bold">{rx.name || "Unknown Rx"}</UIText>
                    <UIText variant="body-sm" color="secondary">{rx.customerName}</UIText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={kit.color.inkFaint} />
                </View>
                <UIText variant="caption" color="muted" style={{ marginTop: 8 }}>
                  {new Date(rx.addedAt).toLocaleString()}
                </UIText>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: kit.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: kit.color.line,
  },
  headerActions: {
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: kit.color.canvas,
  },
  kpiStrip: {
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
    gap: 8,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: kit.color.accentTint,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  listContainer: {
    minHeight: 100,
  },
  rxCard: {
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: kit.color.line,
    ...kit.shadow.card,
  },
});
