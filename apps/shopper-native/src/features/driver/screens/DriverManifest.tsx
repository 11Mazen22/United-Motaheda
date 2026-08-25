/**
 * DriverManifest — the driver section's home screen. Shows any pending
 * assignment offers up top (needs a response), then today's active manifest
 * (accepted orders still being prepared/delivered).
 */
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Text as UIText, SkeletonCard, EmptyState, useTheme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme as legacyTheme, gradients } from "@pharmacy/design-tokens";
import { useAuth } from "@/features/auth";
import { useUnreadCount } from "@/features/notifications";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import MetricCard from "@/components/MetricCard";
import DriverMapPreview from "./DriverMap";
import { OrderCardNew } from "../components/OrderCardNew";
import { useDriverManifest, useDriverOffers, driverQueryKeys } from "../hooks/useDriverManifest";
import { useMyDriverProfile, useMyEarnings } from "../hooks/useDriverProfile";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// NOTE: DriverHero and inline offer banner were removed during redesign —
// keep this file focused on manifest rendering.

export function DriverManifest(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const unreadCount = useUnreadCount(user?.id);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const s = useMemo(() => StyleSheet.create({
    logoutBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.canvas.surface,
      borderWidth: 1, borderColor: theme.colors.border.default,
    },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    headerAction: { position: "relative", width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.canvas.surfaceMuted },
    notificationDot: { position: "absolute", top: 8, end: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.status.error, borderWidth: 1, borderColor: theme.colors.canvas.background },
    listContent: {
      paddingHorizontal: kit.inset.screen,
      paddingBottom: 40,
    },
    metricLabel: { fontSize: 9, color: "rgba(255,255,255,0.68)", textAlign: "center", marginTop: 2 },
    heroWrap: { marginBottom: 8 },
    heroGradient: { paddingHorizontal: kit.inset.screen, paddingTop: 14, paddingBottom: 18, borderRadius: 16, marginHorizontal: kit.inset.screen, overflow: 'hidden', ...theme.shadows[1] },
    heroTopRow: { flexDirection: flexRow(IS_RTL), alignItems: 'center', gap: 8 },
    heroTitle: { fontSize: 20, fontFamily: legacyTheme.fonts.black, color: '#fff', marginTop: 6 },
    kpiRow: { flexDirection: flexRow(IS_RTL), gap: 8, marginTop: 12 },
    quickActionsRow: { flexDirection: flexRow(IS_RTL), gap: 10, paddingHorizontal: kit.inset.screen, marginTop: 12 },
    quickTile: { flex: 1, backgroundColor: theme.colors.canvas.surface, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...theme.shadows[1] },
    offerCount: { position: 'absolute', top: -6, end: -6, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.status.error, alignItems: 'center', justifyContent: 'center' },
    offerCountText: { color: '#fff', fontSize: 11, fontFamily: legacyTheme.fonts.black },
    mapPreviewWrap: { marginTop: 12, marginHorizontal: kit.inset.screen, borderRadius: 16, overflow: 'hidden', height: 120, ...theme.shadows[1] },
    sectionHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: kit.inset.screen, marginTop: 16, marginBottom: 8 },
    smallRefresh: { padding: 8 },
  }), [theme]);

  const manifestQuery = useDriverManifest(user?.id);
  const offersQuery = useDriverOffers(user?.id);
  const driverProfileQuery = useMyDriverProfile(user?.id);
  const earningsQuery = useMyEarnings(driverProfileQuery.data?.id);
  const todayEarnings = (earningsQuery.data ?? [])
    .filter((e) => new Date(e.earnedAt).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + e.totalAmount, 0);

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
    <Screen edgeTop background={theme.colors.canvas.background}>
      {/* Header + KPIs */}
      <View style={s.heroWrap}>
        <LinearGradient colors={gradients.brandPrimary as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroGradient}>
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
            <MetricCard label={t("driver.todayEarnings")} value={formatPrice(todayEarnings)} compact icon={<Ionicons name="cash-outline" size={18} color={theme.colors.brand.primary} />} inverse />
            <MetricCard label={t("driver.completed")} value={orders.filter((o) => o.status === "delivered").length} compact icon={<Ionicons name="checkmark-done-outline" size={18} color={theme.colors.status.success} />} inverse />
            <MetricCard label={t("driver.activeOrders")} value={orders.length} compact icon={<Ionicons name="list-outline" size={18} color="#fff" />} inverse />
          </View>
        </LinearGradient>

        <View style={s.quickActionsRow}>
          <Pressable onPress={() => router.push("/(driver)/offers" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="notifications" size={20} color={theme.colors.brand.primary} />
            <UIText variant="caption" color="secondary">{t("driver.offers")}</UIText>
            {offerCount > 0 && <View style={s.offerCount}><UIText style={s.offerCountText}>{offerCount}</UIText></View>}
          </Pressable>
          <Pressable onPress={() => router.push("/(driver)/map" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="map-outline" size={20} color={theme.colors.brand.primary} />
            <UIText variant="caption" color="secondary">{t("driver.map")}</UIText>
          </Pressable>
          <Pressable onPress={() => router.push("/(driver)/profile" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="person-circle" size={20} color={theme.colors.brand.primary} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
        ListHeaderComponent={
          <>
            <View style={s.sectionHeaderRow}>
              <UIText variant="section-head" style={{ textAlign: TEXT_START }}>{t("driver.manifestTitle")}</UIText>
              <Pressable onPress={() => onRefresh()} style={s.smallRefresh} accessibilityRole="button"><Ionicons name="refresh" size={16} color={theme.colors.text.muted} /></Pressable>
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
            action={{ label: t("common.retry"), onPress: () => void onRefresh() }}
          />
        ) : (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title={t("driver.emptyManifestTitle")}
            subtitle={t("driver.emptyManifestBody")}
            action={{ label: t("driver.checkOffers"), onPress: () => router.push("/(driver)/offers" as never) }}
          />
        )}
      />
    </Screen>
  );
}
