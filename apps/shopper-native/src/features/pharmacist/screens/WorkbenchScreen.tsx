import React, { useCallback, useState } from "react";
import { View, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { SlideInRight } from "react-native-reanimated";
import { useDarkColors } from "@/hooks/useDarkColors";
import { useAuth } from "@/features/auth";
import { isRtl, flexRow } from "@/utils/layout";

import { usePharmacistOrderQueue, usePharmacistDashboard, useAllPrescriptions } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import { OrderQueueCard } from "../components/OrderQueueCard";
import { PharmacistUI as PUI } from "@pharmacy/ui-native";

const IS_RTL = isRtl();

export function WorkbenchScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { c } = useDarkColors();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'prescriptions'>('orders');

  const queueQ = usePharmacistOrderQueue();
  const statsQ = usePharmacistDashboard();
  const rxQ = useAllPrescriptions("pending_review");

  const stats = statsQ.data;
  const orders = queueQ.data ?? [];
  const pendingRx = rxQ.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() }),
      qc.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  return (
    <View style={[styles.container, { backgroundColor: c.canvas }]}>
      {/* Operational Header */}
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
        <View style={[styles.headerTop, { flexDirection: flexRow(IS_RTL) }]}>
          <View>
            <PUI.Typography scale="caption" color="secondary" style={{ letterSpacing: 1.5, marginBottom: 4 }}>{t("pharmacist.station", "STATION 01 • ACTIVE")}</PUI.Typography>
            <PUI.Typography scale="screenTitle" color="primary">{t("pharmacist.workbench", "Workbench")}</PUI.Typography>
          </View>
          <View style={[styles.avatar, { backgroundColor: c.accent }]}>
            <PUI.Typography scale="badge" color="inverse">{user?.name?.[0] ?? 'P'}</PUI.Typography>
          </View>
        </View>

        {/* Metric Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsScroll}>
          <PUI.Card padding="md" style={styles.metricCard}>
            <PUI.Typography scale="metric" color="danger">{stats?.pendingPayment ?? 0}</PUI.Typography>
            <PUI.Typography scale="caption" color="secondary">{t("pharmacist.pendingOrders", "Pending")}</PUI.Typography>
          </PUI.Card>
          <PUI.Card padding="md" style={styles.metricCard}>
            <PUI.Typography scale="metric" color="warn">{stats?.preparing ?? 0}</PUI.Typography>
            <PUI.Typography scale="caption" color="secondary">{t("pharmacist.processing", "Processing")}</PUI.Typography>
          </PUI.Card>
          <PUI.Card padding="md" style={styles.metricCard}>
            <PUI.Typography scale="metric" color="brand">{pendingRx.length}</PUI.Typography>
            <PUI.Typography scale="caption" color="secondary">{t("pharmacist.rxReviews", "Rx Reviews")}</PUI.Typography>
          </PUI.Card>
        </ScrollView>
      </View>

      {/* Segmented Control */}
      <View style={[styles.segmentContainer, { backgroundColor: c.well }]}>
        <PUI.Chip
          label={t("pharmacist.orderQueue", "Order Queue")}
          selected={activeTab === 'orders'}
          selectable
          onPress={() => setActiveTab('orders')}
          style={styles.segmentBtn}
        />
        <PUI.Chip
          label={t("pharmacist.prescriptions", "Prescriptions")}
          selected={activeTab === 'prescriptions'}
          selectable
          onPress={() => setActiveTab('prescriptions')}
          style={styles.segmentBtn}
        />
      </View>

      {/* Data Feed */}
      <ScrollView
        style={styles.feed}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
      >
        {activeTab === 'orders' ? (
          orders.length === 0 ? (
             <PUI.EmptyState title={t("pharmacist.queueClear", "Queue Clear")} subtitle={t("pharmacist.noPending", "No pending orders to process.")} />
          ) : (
            orders.map((o, i) => (
              <Animated.View key={o.id} entering={SlideInRight.delay(i * 50).springify()}>
                <OrderQueueCard order={o} onPress={() => router.push(`/(pharmacist)/order/${o.id}`)} />
              </Animated.View>
            ))
          )
        ) : (
          pendingRx.length === 0 ? (
            <PUI.EmptyState title={t("pharmacist.noPrescriptions", "No Prescriptions")} subtitle={t("pharmacist.allReviewed", "All prescriptions have been reviewed.")} />
          ) : (
            pendingRx.map((rx, i) => (
              <Animated.View key={rx.id} entering={SlideInRight.delay(i * 50).springify()}>
                <Pressable
                  onPress={() => router.push(`/(pharmacist)/prescription/${rx.id}`)}
                  style={({ pressed }) => [
                    styles.rxCard,
                    { backgroundColor: pressed ? c.well : c.surface, borderColor: c.line }
                  ]}
                >
                  <View style={[styles.rxIcon, { backgroundColor: c.accentTint }]}>
                    <Ionicons name="document-text" size={24} color={c.accentDeep} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <PUI.Typography scale="sectionHead" color="primary">{rx.customerName || rx.name}</PUI.Typography>
                    <PUI.Typography scale="caption" color="secondary">{t("pharmacist.submitted", "Submitted")}: {new Date(rx.createdAt).toLocaleTimeString()}</PUI.Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={c.inkFaint} />
                </Pressable>
              </Animated.View>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1 },
  headerTop: { paddingHorizontal: 20, justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricsScroll: { paddingHorizontal: 16, gap: 12 },
  metricCard: { width: 140 },
  segmentContainer: { flexDirection: 'row', margin: 16, borderRadius: 8, padding: 4 },
  segmentBtn: { flex: 1 },
  feed: { flex: 1 },
  rxCard: { padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1 },
  rxIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
