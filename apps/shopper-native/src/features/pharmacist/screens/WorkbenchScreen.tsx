import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import { Screen, Text as UIText, kit } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";

import {
  usePharmacistOrderQueue,
  usePharmacistDashboard,
  useAllPrescriptions,
} from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import { OrderQueueCard } from "../components/OrderQueueCard";
import { StatCard } from "../components/StatCard";
import EmptyState from "@/components/EmptyState";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function WorkbenchScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { pagePad } = useScreenLayout();
  const [refreshing, setRefreshing] = useState(false);

  const queueQ = usePharmacistOrderQueue();
  const statsQ = usePharmacistDashboard();
  const rxQ = useAllPrescriptions("pending_review");

  const stats = statsQ.data;
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
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL) }]}>
        <Pressable 
          style={{ flex: 1 }}
          onPress={() => router.push("/(pharmacist)/profile" as never)}
        >
          <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>
            {branchName}
          </UIText>
          <UIText variant="h3" style={{ textAlign: TEXT_START }}>
            {t("pharmacist.greeting", { name: firstName })}
          </UIText>
        </Pressable>
        <View style={[styles.headerActions, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable onPress={() => router.push("/(pharmacist)/scanner" as never)} style={styles.iconBtn}>
            <Ionicons name="barcode-outline" size={22} color={kit.color.ink} />
          </Pressable>
          <Pressable onPress={() => router.push("/(pharmacist)/inventory" as never)} style={styles.iconBtn}>
            <Ionicons name="cube-outline" size={22} color={kit.color.ink} />
          </Pressable>
          <Pressable onPress={() => router.push("/(pharmacist)/notifications" as never)} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={kit.color.ink} />
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
        {/* KPI Strip */}
        <View style={[styles.kpiStrip, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL) }]}>
          <StatCard
            value={stats?.activeOrders ?? 0}
            label={t("pharmacist.statActiveOrders", "Orders")}
          />
          <StatCard
            value={stats?.pendingPrescriptions ?? 0}
            label={t("pharmacist.statPendingRx", "Rx")}
            accent={stats?.pendingPrescriptions ? kit.color.warn : undefined}
          />
          <StatCard
            value={stats?.lowStockCount ?? 0}
            label={t("pharmacist.statLowStock", "Low Stock")}
            accent={stats?.lowStockCount ? kit.color.danger : undefined}
          />
        </View>

        {/* Active Orders */}
        <View style={[styles.sectionHeader, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL) }]}>
          <UIText variant="body" style={{ textAlign: TEXT_START, color: kit.color.inkSoft }}>
            {t("pharmacist.orderQueueTitle", "Active Orders")}
          </UIText>
          <View style={styles.badge}>
            <UIText variant="caption" style={{ color: kit.color.accentDeep, fontFamily: "Cairo_700Bold" }}>
              {orders.length}
            </UIText>
          </View>
        </View>
        
        <View style={[styles.listContainer, { paddingHorizontal: pagePad }]}>
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

        {/* Pending Prescriptions */}
        <View style={[styles.sectionHeader, { paddingHorizontal: pagePad, flexDirection: flexRow(IS_RTL), marginTop: 24 }]}>
          <UIText variant="body" style={{ textAlign: TEXT_START, color: kit.color.inkSoft }}>
            {t("pharmacist.pendingRxTitle", "Pending Prescriptions")}
          </UIText>
          <View style={[styles.badge, pendingRx.length > 0 && { backgroundColor: kit.color.warnTint }]}>
            <UIText variant="caption" style={{ color: pendingRx.length > 0 ? kit.color.warn : kit.color.accentDeep, fontFamily: "Cairo_700Bold" }}>
              {pendingRx.length}
            </UIText>
          </View>
        </View>
        
        <View style={[styles.listContainer, { paddingHorizontal: pagePad }]}>
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
                style={styles.rxCard}
                onPress={() => router.push(`/(pharmacist)/prescription/${rx.id}` as never)}
              >
                <View style={{ flexDirection: flexRow(IS_RTL), justifyContent: "space-between" }}>
                  <UIText variant="body" weight="medium">{rx.customerName}</UIText>
                  <UIText variant="caption" color="secondary">
                    {new Date(rx.addedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </UIText>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  headerActions: {
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: kit.color.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiStrip: {
    gap: 12,
    marginVertical: 16,
  },
  sectionHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badge: {
    backgroundColor: kit.color.accentTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  listContainer: {
    gap: 8,
  },
  rxCard: {
    backgroundColor: kit.color.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: kit.color.line,
  },
});
