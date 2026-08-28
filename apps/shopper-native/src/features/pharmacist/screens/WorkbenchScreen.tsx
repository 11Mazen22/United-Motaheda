import React, { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { gradients } from "@pharmacy/design-tokens";

import {
  Screen,
  Text,
  Avatar,
  EmptyState,
  ErrorState,
  SkeletonCard,
  StatusIndicator,
  useTheme,
} from "@pharmacy/ui-native";

import { useAuth } from "@/features/auth";
import { isRtl, flexRow } from "@/utils/layout";

import {
  usePharmacistOrderQueue,
  useAllPrescriptions,
  useRecentlyCompletedOrders,
} from "../hooks/usePharmacistQueries";
import { pharmacistQueryKeys } from "../hooks/queryKeys";
import { OrderQueueCard } from "../components/OrderQueueCard";
import { bucketOrders } from "../domain/orderBuckets";

const IS_RTL = isRtl();
const RX_URGENT_MS = 30 * 60_000;

function timeAgo(iso: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return t("pharmacist.submittedAt", { time: "<1m" });
  if (diffMin < 60) return t("pharmacist.submittedAt", { time: `${diffMin}m` });
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return t("pharmacist.submittedAt", { time: `${hrs}h` });
  return t("pharmacist.submittedAt", { time: `${Math.floor(hrs / 24)}d` });
}

function ageMs(iso: string): number {
  return Math.max(0, Date.now() - new Date(iso).getTime());
}

// Section header: title + live count badge. The workbench's job is triage —
// "what needs attention, what's next, what's done" — so every section states
// its own count instead of the reader having to count rows themselves.
function SectionHeader({ icon, title, count, tone }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  count: number;
  tone: "danger" | "brand" | "muted";
}) {
  const { theme } = useTheme();
  const color = tone === "danger" ? theme.colors.status.error : tone === "brand" ? theme.colors.brand.primary : theme.colors.text.muted;
  return (
    <View style={[styles.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text variant="card-title" style={{ flex: 1 }}>{title}</Text>
      <View style={[styles.countPill, { backgroundColor: `${color}17` }]}>
        <Text variant="eyebrow" style={{ color }}>{count}</Text>
      </View>
    </View>
  );
}

function RxQueueCard({ rx, onPress, t }: {
  rx: { id: string; customerName?: string; name?: string; createdAt: string };
  onPress: () => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const { theme } = useTheme();
  const isUrgent = ageMs(rx.createdAt) > RX_URGENT_MS;
  const borderStartColor = isUrgent ? theme.colors.status.warning : theme.colors.tertiary.base;
  return (
    <Animated.View entering={FadeInDown.duration(220)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.rxCard,
          { borderStartColor, borderStartWidth: 4, borderColor: theme.colors.border.default },
          { backgroundColor: pressed ? theme.colors.canvas.surfaceMuted : theme.colors.canvas.surface },
        ]}
      >
        <View style={[styles.rxRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[styles.rxIcon, { backgroundColor: theme.colors.tertiary.bg }]}>
            <Ionicons name="document-text" size={22} color={theme.colors.tertiary.base} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="card-title" color="primary" numberOfLines={1}>{rx.customerName || rx.name}</Text>
            <View style={[styles.rxMetaRow, { flexDirection: flexRow(IS_RTL) }]}>
              {isUrgent && <Ionicons name="warning" size={12} color={theme.colors.status.warning} />}
              <Text variant="caption" color={isUrgent ? "warn" : "secondary"}>{timeAgo(rx.createdAt, t)}</Text>
            </View>
          </View>
          <Ionicons name={IS_RTL ? "chevron-back" : "chevron-forward"} size={18} color={theme.colors.text.muted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function WorkbenchScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const queueQ = usePharmacistOrderQueue();
  const rxQ = useAllPrescriptions("pending_review");
  const recentQ = useRecentlyCompletedOrders();

  const orders = queueQ.data ?? [];
  const pendingRx = rxQ.data ?? [];
  const recentlyCompleted = recentQ.data ?? [];
  const isLive = queueQ.isFetching || rxQ.isFetching;

  // Server order is already oldest-first (last_status_at ascending) — the
  // most urgent, longest-waiting order in each bucket surfaces first without
  // re-sorting client-side. Bucketing itself is shared with
  // OrdersWorkspaceScreen (domain/orderBuckets.ts) so the two screens never
  // disagree about what counts as "needs attention."
  const { attention: attentionOrders, inProgress: inProgressOrders, ready: readyOrders } = useMemo(() => bucketOrders(orders), [orders]);

  const allCaughtUp = attentionOrders.length === 0 && inProgressOrders.length === 0 && readyOrders.length === 0 && pendingRx.length === 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() }),
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() }),
      qc.invalidateQueries({ queryKey: pharmacistQueryKeys.recentlyCompleted() }),
      qc.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const initials = useMemo(() => (user?.name?.trim()?.[0] ?? "P").toUpperCase(), [user?.name]);
  const goOrder = useCallback((id: string) => router.push(`/(pharmacist)/order/${id}`), [router]);
  const goRx = useCallback((id: string) => router.push(`/(pharmacist)/prescription/${id}`), [router]);

  const isLoading = queueQ.isLoading || rxQ.isLoading;
  const isError = queueQ.isError || rxQ.isError;

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      {/* Header — gradient hero + glanceable stat row, matching the same
          "live dashboard" visual language DriverManifest and Home's
          TodayCare use, instead of a plain title bar with no summary at all. */}
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={[styles.headerTop, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1 }}>
            <View style={[styles.liveRow, { flexDirection: flexRow(IS_RTL) }]}>
              <StatusIndicator active={isLive} pulse={isLive} color={isLive ? "#4ADE80" : "rgba(255,255,255,0.5)"} />
              <Text variant="eyebrow" style={[styles.eyebrowSpacing, { color: "rgba(255,255,255,0.8)" }]}>
                {isLive ? t("pharmacist.liveQueue", "Live") : t("pharmacist.eyebrow")}
              </Text>
            </View>
            <Text variant="screen-title" style={{ color: "#fff" }}>
              {user?.name ? t("pharmacist.greeting", { name: user.name.split(" ")[0] }) : t("pharmacist.workbench", "Workbench")}
            </Text>
          </View>
          <Avatar initials={initials} size="md" status={isLive ? "online" : undefined} />
        </View>

        {!isLoading && !isError && (
          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>
            <StatChip value={attentionOrders.length + pendingRx.length} label={t("pharmacist.sectionNeedsAttention", "Needs Attention")} />
            <StatChip value={inProgressOrders.length} label={t("pharmacist.sectionInProgress", "In Progress")} />
            <StatChip value={readyOrders.length} label={t("pharmacist.sectionReady", "Ready")} />
          </View>
        )}
      </LinearGradient>

      {/* Sectioned feed */}
      {isLoading ? (
        <View style={styles.feedContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <ErrorState
          message={t("common.error")}
          retry={() => { void queueQ.refetch(); void rxQ.refetch(); }}
        />
      ) : allCaughtUp ? (
        <View style={styles.feedContent}>
          <EmptyState
            icon="checkmark-circle-outline"
            title={t("pharmacist.allCaughtUpTitle", "All caught up")}
            subtitle={t("pharmacist.allCaughtUpBody", "Nothing needs your attention right now.")}
          />
        </View>
      ) : (
        <Animated.ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
        >
          {(pendingRx.length > 0 || attentionOrders.length > 0) && (
            <View style={styles.section}>
              <SectionHeader
                icon="alert-circle"
                title={t("pharmacist.sectionNeedsAttention", "Needs Attention")}
                count={pendingRx.length + attentionOrders.length}
                tone="danger"
              />
              {pendingRx.map((rx, i) => (
                <Animated.View key={`rx-${rx.id}`} entering={FadeInDown.delay(i * 40).duration(260)} style={styles.cardSpacing}>
                  <RxQueueCard rx={rx} onPress={() => goRx(rx.id)} t={t} />
                </Animated.View>
              ))}
              {attentionOrders.map((o, i) => (
                <Animated.View key={o.id} entering={FadeInDown.delay((pendingRx.length + i) * 40).duration(260)} style={styles.cardSpacing}>
                  <OrderQueueCard order={o} onPress={() => goOrder(o.id)} />
                </Animated.View>
              ))}
            </View>
          )}

          {inProgressOrders.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                icon="construct"
                title={t("pharmacist.sectionInProgress", "In Progress")}
                count={inProgressOrders.length}
                tone="brand"
              />
              {inProgressOrders.map((o, i) => (
                <Animated.View key={o.id} entering={FadeInDown.delay(i * 40).duration(260)} style={styles.cardSpacing}>
                  <OrderQueueCard order={o} onPress={() => goOrder(o.id)} />
                </Animated.View>
              ))}
            </View>
          )}

          {readyOrders.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                icon="cube"
                title={t("pharmacist.sectionReady", "Ready for Pickup")}
                count={readyOrders.length}
                tone="brand"
              />
              {readyOrders.map((o, i) => (
                <Animated.View key={o.id} entering={FadeInDown.delay(i * 40).duration(260)} style={styles.cardSpacing}>
                  <OrderQueueCard order={o} onPress={() => goOrder(o.id)} />
                </Animated.View>
              ))}
            </View>
          )}

          {recentlyCompleted.length > 0 && (
            <View style={styles.section}>
              <SectionHeader
                icon="checkmark-done"
                title={t("pharmacist.sectionRecentlyCompleted", "Recently Completed")}
                count={recentlyCompleted.length}
                tone="muted"
              />
              {recentlyCompleted.map((o, i) => (
                <Animated.View key={o.id} entering={FadeInDown.delay(i * 40).duration(260)} style={[styles.cardSpacing, styles.recentCard]}>
                  <OrderQueueCard order={o} onPress={() => goOrder(o.id)} />
                </Animated.View>
              ))}
            </View>
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
    gap: 16,
  },
  statRow: {
    gap: 10,
  },
  statChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
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
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  countPill: {
    minWidth: 24,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  recentCard: {
    opacity: 0.72,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  cardSpacing: {
    marginBottom: 12,
  },
  rxCard: {
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  rxRow: {
    alignItems: "center",
    gap: 12,
  },
  rxMetaRow: {
    alignItems: "center",
    gap: 4,
    marginTop: 2,
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
