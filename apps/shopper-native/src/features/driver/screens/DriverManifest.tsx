/**
 * DriverManifest — the driver section's home screen. Shows any pending
 * assignment offers up top (needs a response), then today's active manifest
 * (accepted orders still being prepared/delivered).
 */
import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Text as UIText, SkeletonCard } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { useAuth } from "@/features/auth";
import { useUnreadCount } from "@/features/notifications";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import MetricCard from "@/components/MetricCard";
import DriverMapPreview from "./DriverMap";
import EmptyState from "@/components/EmptyState";
import { OrderCardNew } from "../components/OrderCardNew";
import { useDriverManifest, useDriverOffers, driverQueryKeys } from "../hooks/useDriverManifest";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// NOTE: DriverHero and inline offer banner were removed during redesign —
// keep this file focused on manifest rendering.

export function DriverManifest(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const unreadCount = useUnreadCount(user?.id);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const manifestQuery = useDriverManifest(user?.id);
  const offersQuery = useDriverOffers(user?.id);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: driverQueryKeys.manifest(user.id) }),
        queryClient.invalidateQueries({ queryKey: driverQueryKeys.offers(user.id) }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, user?.id]);

  const orders = manifestQuery.data ?? [];
  const offerCount = offersQuery.data?.length ?? 0;

  return (
    <Screen edgeTop background={kit.color.canvas}>
      {/* Header + KPIs */}
      <View style={s.heroWrap}>
        <LinearGradient colors={[kit.color.accentDeep, kit.color.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.heroGradient}>
          <View style={s.heroTopRow}>
            <View style={{ flex: 1 }}>
              <UIText variant="eyebrow" color="inverse">{t("driver.eyebrow")}</UIText>
              <UIText style={s.heroTitle}>{t("driver.greeting", { name: user?.name ?? "" })}</UIText>
            </View>

            <View style={s.headerActions}>
              <Pressable onPress={() => router.push("/notifications" as never)} style={s.headerAction} accessibilityRole="button" accessibilityLabel={t("notifications.title")}>
                <Ionicons name="notifications-outline" size={22} color="#fff" />
                {unreadCount > 0 && <View style={s.notificationDot} />}
              </Pressable>
              <Pressable onPress={() => void signOut()} style={s.logoutBtn} accessibilityRole="button" accessibilityLabel={t("driver.signOut")}>
                <Ionicons name="log-out-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={s.kpiRow}>
            <MetricCard label={t("driver.todayEarnings")} value={formatPrice(orders.reduce((s, o) => s + Number(o.total ?? 0), 0))} compact icon={<Ionicons name="cash-outline" size={18} color={kit.color.accentDeep} />} inverse />
            <MetricCard label={t("driver.completed")} value={orders.filter((o) => o.status === "delivered").length} compact icon={<Ionicons name="checkmark-done-outline" size={18} color={kit.color.success} />} inverse />
            <MetricCard label={t("driver.activeOrders")} value={orders.length} compact icon={<Ionicons name="list-outline" size={18} color="#fff" />} inverse />
          </View>
        </LinearGradient>

        <View style={s.quickActionsRow}>
          <Pressable onPress={() => router.push("/(driver)/offers" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="notifications" size={20} color={kit.color.accentDeep} />
            <UIText variant="caption" color="secondary">{t("driver.offers")}</UIText>
            {offerCount > 0 && <View style={s.offerCount}><UIText style={s.offerCountText}>{offerCount}</UIText></View>}
          </Pressable>
          <Pressable onPress={() => router.push("/(driver)/map" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="map-outline" size={20} color={kit.color.accentDeep} />
            <UIText variant="caption" color="secondary">{t("driver.map")}</UIText>
          </Pressable>
          <Pressable onPress={() => router.push("/(driver)/profile" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="person-circle" size={20} color={kit.color.accentDeep} />
            <UIText variant="caption" color="secondary">{t("driver.profile")}</UIText>
          </Pressable>
        </View>

        <View style={s.mapPreviewWrap}>
          <DriverMapPreview compact />
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kit.color.accent} />}
        ListHeaderComponent={
          <>
            <View style={s.sectionHeaderRow}>
              <UIText variant="section-head" style={{ textAlign: TEXT_START }}>{t("driver.manifestTitle")}</UIText>
              <Pressable onPress={() => onRefresh()} style={s.smallRefresh} accessibilityRole="button"><Ionicons name="refresh" size={16} color={kit.color.inkFaint} /></Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <OrderCardNew
            order={item}
            onPress={() => router.push(`/(driver)/delivery/${item.id}` as never)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={manifestQuery.isLoading ? (
          <View style={{ paddingHorizontal: kit.inset.screen, paddingTop: 8 }}>
            {[1,2,3].map((i) => <SkeletonCard key={i} lines={4} style={{ marginBottom: 10 }} />)}
          </View>
        ) : manifestQuery.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t("errors.network")}
            subtitle={t("driver.emptyRetryHint")}
            actionLabel={t("common.retry")}
            onAction={() => void onRefresh()}
          />
        ) : (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title={t("driver.emptyManifestTitle")}
            subtitle={t("driver.emptyManifestBody")}
            actionLabel={t("driver.checkOffers")}
            onAction={() => router.push("/(driver)/offers" as never)}
          />
        )}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: kit.inset.screen,
    paddingTop: 12,
    paddingBottom: 8,
  },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: kit.color.surface,
    borderWidth: 1, borderColor: kit.color.line,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAction: { position: "relative", width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.well },
  notificationDot: { position: "absolute", top: 8, end: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: kit.color.danger, borderWidth: 1, borderColor: kit.color.canvas },
  listContent: {
    paddingHorizontal: kit.inset.screen,
    paddingBottom: 40,
  },
  summaryCard: { backgroundColor: kit.color.ink, borderRadius: kit.radius.xl, padding: 16, marginBottom: 14, ...kit.shadow.raised },
  summaryIntro: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  summaryMetrics: { flexDirection: flexRow(IS_RTL), alignItems: "center", marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.18)" },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 20, fontFamily: theme.fonts.black, color: kit.color.onInk },
  metricLabel: { fontSize: 9, color: "rgba(255,255,255,0.68)", textAlign: "center", marginTop: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: "rgba(255,255,255,0.22)" },
  offerBanner: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 12,
    backgroundColor: kit.color.ink,
    borderRadius: kit.radius.xl,
    padding: 16,
    marginBottom: 16,
    ...kit.shadow.raised,
  },
  offerIconWell: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  card: {
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.xl,
    padding: 16,
    ...kit.shadow.card,
  },
  cardHeader: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: kit.radius.pill,
  },
  cardFooter: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  summaryRow: {
    marginTop: 14,
    flexDirection: flexRow(IS_RTL),
    gap: 10,
    paddingHorizontal: kit.inset.screen,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  retryBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: kit.radius.pill, backgroundColor: kit.color.accentTint },
  heroWrap: { marginBottom: 8 },
  heroGradient: { paddingHorizontal: kit.inset.screen, paddingTop: 14, paddingBottom: 18, borderRadius: kit.radius.xl, marginHorizontal: kit.inset.screen, overflow: 'hidden', ...kit.shadow.raised },
  heroTopRow: { flexDirection: flexRow(IS_RTL), alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 20, fontFamily: theme.fonts.black, color: '#fff', marginTop: 6 },
  kpiRow: { flexDirection: flexRow(IS_RTL), gap: 8, marginTop: 12 },
  quickActionsRow: { flexDirection: flexRow(IS_RTL), gap: 10, paddingHorizontal: kit.inset.screen, marginTop: 12 },
  quickTile: { flex: 1, backgroundColor: kit.color.surface, paddingVertical: 10, borderRadius: kit.radius.lg, alignItems: 'center', justifyContent: 'center', ...kit.shadow.card },
  offerCount: { position: 'absolute', top: -6, end: -6, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: kit.color.danger, alignItems: 'center', justifyContent: 'center' },
  offerCountText: { color: '#fff', fontSize: 11, fontFamily: theme.fonts.black },
  mapPreviewWrap: { marginTop: 12, marginHorizontal: kit.inset.screen, borderRadius: kit.radius.xl, overflow: 'hidden', height: 120, ...kit.shadow.card },
  sectionHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: kit.inset.screen, marginTop: 16, marginBottom: 8 },
  smallRefresh: { padding: 8 },
});
