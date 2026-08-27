/**
 * OrdersWorkspaceScreen — the full order workspace, distinct from
 * WorkbenchScreen's at-a-glance triage snapshot. Same Needs Attention / In
 * Progress / Ready / Recently Completed structure (domain/orderBuckets.ts
 * keeps the two screens in agreement), but adds search and a filter that
 * lets a pharmacist narrow to exactly one bucket when the queue is busy.
 */
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Screen, Text, Input, Chip, EmptyState, ErrorState, SkeletonCard, useTheme } from "@pharmacy/ui-native";

import { isRtl, flexRow } from "@/utils/layout";
import { findBranchById } from "@/features/delivery/branches/data";
import { usePharmacistOrderQueue, useRecentlyCompletedOrders } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";
import { OrderQueueCard } from "../components/OrderQueueCard";
import { bucketOrders } from "../domain/orderBuckets";
import type { PharmacistOrder } from "../api/types";

const IS_RTL = isRtl();

type FilterKey = "all" | "attention" | "inProgress" | "ready" | "completed";

function matchesQuery(order: PharmacistOrder, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  const branchName = order.branchId ? findBranchById(order.branchId)?.nameAr ?? "" : "";
  const haystack = [
    order.id.slice(-8),
    order.customerName,
    order.customerPhone,
    order.status,
    branchName,
    order.zoneName ?? "",
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}

export function OrdersWorkspaceScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  const queueQ = usePharmacistOrderQueue();
  const recentQ = useRecentlyCompletedOrders();

  const orders = queueQ.data ?? [];
  const recentlyCompleted = recentQ.data ?? [];

  const buckets = useMemo(() => bucketOrders(orders), [orders]);

  const filteredBuckets = useMemo(() => ({
    attention: buckets.attention.filter((o) => matchesQuery(o, query)),
    inProgress: buckets.inProgress.filter((o) => matchesQuery(o, query)),
    ready: buckets.ready.filter((o) => matchesQuery(o, query)),
    completed: recentlyCompleted.filter((o) => matchesQuery(o, query)),
  }), [buckets, recentlyCompleted, query]);

  const totalVisible = filteredBuckets.attention.length + filteredBuckets.inProgress.length + filteredBuckets.ready.length + filteredBuckets.completed.length;
  const hasActiveFilter = query.trim().length > 0 || filter !== "all";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.recentlyCompleted() }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const goOrder = useCallback((id: string) => router.push(`/(pharmacist)/order/${id}`), [router]);
  const clearAll = useCallback(() => { setQuery(""); setFilter("all"); }, []);

  const isLoading = queueQ.isLoading;
  const isError = queueQ.isError;

  const FILTERS: { key: FilterKey; labelKey: string }[] = [
    { key: "all",        labelKey: "pharmacist.filterAll" },
    { key: "attention",  labelKey: "pharmacist.sectionNeedsAttention" },
    { key: "inProgress", labelKey: "pharmacist.sectionInProgress" },
    { key: "ready",      labelKey: "pharmacist.sectionReady" },
    { key: "completed",  labelKey: "pharmacist.sectionRecentlyCompleted" },
  ];

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <PharmacistScreenHeader title={t("pharmacist.ordersTitle", "Orders")} />

      <View style={[styles.searchBar, { paddingHorizontal: 16 }]}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t("pharmacist.ordersSearchPlaceholder", "Search order, customer, branch…")}
          prefixIcon={<Ionicons name="search-outline" size={16} color={theme.colors.text.muted} />}
          returnKeyType="search"
        />
      </View>

      <View style={[styles.filterRow, { flexDirection: flexRow(IS_RTL) }]}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={t(f.labelKey)}
            selected={filter === f.key}
            selectable
            onPress={() => setFilter(f.key)}
          />
        ))}
        {hasActiveFilter && (
          <Chip
            label={t("pharmacist.clearFilters", "Clear")}
            onPress={clearAll}
            icon={<Ionicons name="close-outline" size={14} color={theme.colors.text.secondary} />}
          />
        )}
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <ErrorState message={t("common.error")} retry={() => { void queueQ.refetch(); }} />
      ) : totalVisible === 0 ? (
        <View style={styles.content}>
          <EmptyState
            icon={hasActiveFilter ? "search-outline" : "checkmark-circle-outline"}
            title={hasActiveFilter ? t("pharmacist.noMatchingOrders", "No matching orders") : t("pharmacist.emptyQueueTitle")}
            subtitle={hasActiveFilter ? t("pharmacist.tryDifferentSearch", "Try a different search or clear filters.") : t("pharmacist.emptyQueueBody")}
          />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
        >
          {(filter === "all" || filter === "attention") && filteredBuckets.attention.length > 0 && (
            <OrderSection titleKey="pharmacist.sectionNeedsAttention" orders={filteredBuckets.attention} onPress={goOrder} />
          )}
          {(filter === "all" || filter === "inProgress") && filteredBuckets.inProgress.length > 0 && (
            <OrderSection titleKey="pharmacist.sectionInProgress" orders={filteredBuckets.inProgress} onPress={goOrder} />
          )}
          {(filter === "all" || filter === "ready") && filteredBuckets.ready.length > 0 && (
            <OrderSection titleKey="pharmacist.sectionReady" orders={filteredBuckets.ready} onPress={goOrder} />
          )}
          {(filter === "all" || filter === "completed") && filteredBuckets.completed.length > 0 && (
            <OrderSection titleKey="pharmacist.sectionRecentlyCompleted" orders={filteredBuckets.completed} onPress={goOrder} muted />
          )}
        </Animated.ScrollView>
      )}
    </Screen>
  );
}

function OrderSection({ titleKey, orders, onPress, muted }: {
  titleKey: string;
  orders: PharmacistOrder[];
  onPress: (id: string) => void;
  muted?: boolean;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <Text variant="card-title">{t(titleKey)}</Text>
        <View style={[styles.countPill, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
          <Text variant="eyebrow" color="secondary">{orders.length}</Text>
        </View>
      </View>
      {orders.map((o, i) => (
        <Animated.View key={o.id} entering={FadeInDown.delay(i * 30).duration(220)} style={[styles.cardSpacing, muted && styles.mutedCard]}>
          <OrderQueueCard order={o} onPress={() => onPress(o.id)} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: { paddingTop: 12, paddingBottom: 8 },
  filterRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexWrap: "wrap",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  countPill: {
    minWidth: 22,
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  cardSpacing: {
    marginBottom: 10,
  },
  mutedCard: {
    opacity: 0.72,
  },
});
