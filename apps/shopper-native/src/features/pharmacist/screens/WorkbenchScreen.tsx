import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  Screen,
  Text,
  Card,
  Chip,
  Avatar,
  EmptyState,
  ErrorState,
  SkeletonCard,
  StatusIndicator,
  useTheme,
} from "@pharmacy/ui-native";

import { useAuth } from "@/features/auth";
import { isRtl, flexRow } from "@/utils/layout";

import { usePharmacistOrderQueue, usePharmacistDashboard, useAllPrescriptions } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import { OrderQueueCard } from "../components/OrderQueueCard";

const IS_RTL = isRtl();

function timeAgo(iso: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return t("pharmacist.submittedAt", { time: "<1m" });
  if (diffMin < 60) return t("pharmacist.submittedAt", { time: `${diffMin}m` });
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return t("pharmacist.submittedAt", { time: `${hrs}h` });
  return t("pharmacist.submittedAt", { time: `${Math.floor(hrs / 24)}d` });
}

export function WorkbenchScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "prescriptions">("orders");

  const queueQ = usePharmacistOrderQueue();
  const statsQ = usePharmacistDashboard();
  const rxQ = useAllPrescriptions("pending_review");

  const stats = statsQ.data;
  const orders = queueQ.data ?? [];
  const pendingRx = rxQ.data ?? [];
  const isLive = queueQ.isFetching || statsQ.isFetching || rxQ.isFetching;

  const activeQuery = activeTab === "orders" ? queueQ : rxQ;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() }),
      qc.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const initials = useMemo(() => (user?.name?.trim()?.[0] ?? "P").toUpperCase(), [user?.name]);

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
        <View style={[styles.headerTop, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1 }}>
            <View style={[styles.liveRow, { flexDirection: flexRow(IS_RTL) }]}>
              <StatusIndicator active={isLive} pulse={isLive} />
              <Text variant="eyebrow" color="brand" style={styles.eyebrowSpacing}>
                {isLive ? t("pharmacist.liveQueue", "Live") : t("pharmacist.eyebrow")}
              </Text>
            </View>
            <Text variant="screen-title" color="primary">{t("pharmacist.workbench", "Workbench")}</Text>
          </View>
          <Avatar initials={initials} size="md" status={isLive ? "online" : undefined} />
        </View>

        {/* Metric cards */}
        <View style={[styles.metricsRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Card padding="md" style={styles.metricCard}>
            <Text variant="metric" color="brand">{stats?.activeOrders ?? 0}</Text>
            <Text variant="caption" color="secondary">{t("pharmacist.statActiveOrders")}</Text>
          </Card>
          <Card padding="md" style={styles.metricCard}>
            <Text variant="metric" color="warn">{stats?.preparing ?? 0}</Text>
            <Text variant="caption" color="secondary">{t("pharmacist.statPreparing")}</Text>
          </Card>
          <Card padding="md" style={styles.metricCard}>
            <Text variant="metric" color="danger">{pendingRx.length}</Text>
            <Text variant="caption" color="secondary">{t("pharmacist.statPendingRx")}</Text>
          </Card>
        </View>
      </View>

      {/* Segmented control */}
      <View style={[styles.segmentContainer, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surfaceMuted }]}>
        <Chip
          label={t("pharmacist.orderQueueTitle")}
          selected={activeTab === "orders"}
          selectable
          onPress={() => setActiveTab("orders")}
          style={styles.segmentBtn}
        />
        <Chip
          label={t("pharmacist.rxQueueTitle")}
          selected={activeTab === "prescriptions"}
          selectable
          onPress={() => setActiveTab("prescriptions")}
          style={styles.segmentBtn}
        />
      </View>

      {/* Data feed */}
      {activeQuery.isLoading ? (
        <View style={styles.feedContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : activeQuery.isError ? (
        <ErrorState
          message={t("common.error")}
          retry={() => { void activeQuery.refetch(); }}
        />
      ) : (
        <Animated.ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
        >
          {activeTab === "orders" ? (
            orders.length === 0 ? (
              <EmptyState title={t("pharmacist.emptyQueueTitle")} subtitle={t("pharmacist.emptyQueueBody")} />
            ) : (
              orders.map((o, i) => (
                <Animated.View key={o.id} entering={FadeInDown.delay(i * 40).duration(260)} style={styles.cardSpacing}>
                  <OrderQueueCard order={o} onPress={() => router.push(`/(pharmacist)/order/${o.id}`)} />
                </Animated.View>
              ))
            )
          ) : pendingRx.length === 0 ? (
            <EmptyState title={t("pharmacist.emptyRxTitle")} subtitle={t("pharmacist.emptyRxBody")} />
          ) : (
            pendingRx.map((rx, i) => (
              <Animated.View key={rx.id} entering={FadeInDown.delay(i * 40).duration(260)} style={styles.cardSpacing}>
                <Card onPress={() => router.push(`/(pharmacist)/prescription/${rx.id}`)} padding="md">
                  <View style={[styles.rxRow, { flexDirection: flexRow(IS_RTL) }]}>
                    <View style={[styles.rxIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
                      <Ionicons name="document-text" size={22} color={theme.colors.brand.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="card-title" color="primary" numberOfLines={1}>{rx.customerName || rx.name}</Text>
                      <Text variant="caption" color="secondary">{timeAgo(rx.createdAt, t)}</Text>
                    </View>
                    <Ionicons name={IS_RTL ? "chevron-back" : "chevron-forward"} size={18} color={theme.colors.text.muted} />
                  </View>
                </Card>
              </Animated.View>
            ))
          )}
        </Animated.ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  headerTop: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  liveRow: {
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  eyebrowSpacing: {
    letterSpacing: 1,
  },
  metricsRow: {
    gap: 10,
  },
  metricCard: {
    flex: 1,
  },
  segmentContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 4,
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  cardSpacing: {
    marginBottom: 12,
  },
  rxRow: {
    alignItems: "center",
    gap: 12,
  },
  rxIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
