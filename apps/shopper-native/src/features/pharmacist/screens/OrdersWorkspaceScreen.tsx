/**
 * OrdersWorkspaceScreen — the full order workspace, distinct from
 * WorkbenchScreen's at-a-glance triage snapshot. Same Needs Attention / In
 * Progress / Ready / Recently Completed structure (domain/orderBuckets.ts
 * keeps the two screens in agreement), but adds search and a filter that
 * lets a pharmacist narrow to exactly one bucket when the queue is busy.
 *
 * Gradient hero header matches WorkbenchScreen's visual language so the two
 * order-facing screens read as one product, and states its own live counts
 * so a pharmacist can tell at a glance whether the workspace they just
 * opened has anything the Workbench snapshot didn't already show them.
 */
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { gradients } from "@pharmacy/design-tokens";

import { Screen, Text, Input, Chip, EmptyState, ErrorState, SkeletonCard, useTheme } from "@pharmacy/ui-native";

import { isRtl, flexRow } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { findBranchById } from "@/features/delivery/branches/data";
import { usePharmacistOrderQueue, useRecentlyCompletedOrders } from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import { OrderQueueCard } from "../components/OrderQueueCard";
import { bucketOrders } from "../domain/orderBuckets";
import type { PharmacistOrder } from "../api/types";

const IS_RTL = isRtl();

type FilterKey = "all" | "attention" | "inProgress" | "ready" | "completed";

function matchesQuery(order: PharmacistOrder, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  // Both language names, regardless of the app's current display language —
  // a pharmacist might type either, and this is a search filter, not a
  // display value that needs to follow the UI language.
  const branch = order.branchId ? findBranchById(order.branchId) : null;
  const haystack = [
    order.id.slice(-8),
    order.customerName,
    order.customerPhone,
    order.status,
    branch?.nameAr ?? "",
    branch?.nameEn ?? "",
    order.zoneName ?? "",
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function OrdersWorkspaceScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { pagePad, isTablet } = useScreenLayout();
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
      {/* Gradient hero — same visual language as WorkbenchScreen so Orders
          reads as the same product's "find a specific order" mode, not a
          disconnected screen with a plain title bar. */}
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingHorizontal: pagePad }]}
      >
        <View style={[styles.heroTop, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="eyebrow" style={styles.heroEyebrow}>
              {t("pharmacist.ordersEyebrow", "Order Workspace")}
            </Text>
            <Text variant="screen-title" style={{ color: "#fff" }}>
              {t("pharmacist.ordersTitle", "Orders")}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(pharmacist)/returns" as never)}
            accessibilityRole="button"
            accessibilityLabel={t("pharmacist.returnsTitle", "Returns")}
            style={styles.heroIcon}
          >
            <Ionicons name="return-up-back" size={20} color="#fff" />
          </Pressable>
        </View>

        {!isLoading && !isError && (
          <View style={[styles.heroStatRow, { flexDirection: flexRow(IS_RTL) }]}>
            <HeroStat value={buckets.attention.length} label={t("pharmacist.sectionNeedsAttention", "Needs Attention")} />
            <HeroStat value={buckets.inProgress.length} label={t("pharmacist.sectionInProgress", "In Progress")} />
            <HeroStat value={buckets.ready.length} label={t("pharmacist.sectionReady", "Ready")} />
          </View>
        )}
      </LinearGradient>

      <View style={[styles.searchBar, { paddingHorizontal: pagePad }]}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t("pharmacist.ordersSearchPlaceholder", "Search order, customer, branch…")}
          prefixIcon={<Ionicons name="search-outline" size={16} color={theme.colors.text.muted} />}
          returnKeyType="search"
        />
      </View>

      <View style={[styles.filterRow, { flexDirection: flexRow(IS_RTL), paddingHorizontal: pagePad }]}>
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
        <View style={[styles.content, { paddingHorizontal: pagePad }]}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <ErrorState message={t("common.error")} retry={() => { void queueQ.refetch(); }} />
      ) : totalVisible === 0 ? (
        <View style={[styles.content, { paddingHorizontal: pagePad }]}>
          <EmptyState
            icon={hasActiveFilter ? "search-outline" : "checkmark-circle-outline"}
            title={hasActiveFilter ? t("pharmacist.noMatchingOrders", "No matching orders") : t("pharmacist.emptyQueueTitle")}
            subtitle={hasActiveFilter ? t("pharmacist.tryDifferentSearch", "Try a different search or clear filters.") : t("pharmacist.emptyQueueBody")}
          />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: pagePad },
            isTablet && { maxWidth: 720, alignSelf: "center", width: "100%" },
          ]}
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
        <Text variant="card-title" style={{ flex: 1, minWidth: 0 }}>{t(titleKey)}</Text>
        <View style={[styles.countPill, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
          <Text variant="eyebrow" color="secondary">{orders.length}</Text>
        </View>
      </View>
      {orders.map((o, i) => (
        <Animated.View key={o.id} entering={FadeInDown.delay(Math.min(i, 6) * 30).duration(220)} style={[styles.cardSpacing, muted && styles.mutedCard]}>
          <OrderQueueCard order={o} onPress={() => onPress(o.id)} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingBottom: 16,
    gap: 14,
  },
  heroTop: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    gap: 10,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.78)",
    letterSpacing: 1,
    marginBottom: 2,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    flexShrink: 0,
  },
  heroStatRow: {
    gap: 10,
  },
  heroStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    gap: 2,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  searchBar: { paddingTop: 14, paddingBottom: 8 },
  filterRow: {
    gap: 8,
    paddingBottom: 12,
    flexWrap: "wrap",
  },
  content: {
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
