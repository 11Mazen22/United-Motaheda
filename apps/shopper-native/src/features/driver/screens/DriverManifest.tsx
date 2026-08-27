/**
 * DriverManifest — the driver section's home screen. Rebuilt around the
 * questions a driver actually needs answered the instant this screen opens:
 * am I online, do I have an active delivery, how many more are waiting, and
 * what's the single most urgent thing to do next. Structure, in priority
 * order (see features/driver/lib/deliveryStage.ts for the stage ranking):
 *
 *   1. Online/offline availability — real, backed by DriverProfile.isOnline
 *      via the set_driver_availability RPC (previously nonexistent: the
 *      backing columns existed but nothing in this app ever read/wrote them).
 *   2. Active delivery spotlight — the single most urgent in-progress order,
 *      picked by delivery stage (at_customer > to_customer > at_pharmacy >
 *      to_pharmacy), not just "whatever sorts first".
 *   3. Next deliveries — everything else on the manifest, compact rows.
 *   4. Secondary: today's completed count, acceptance rate (previously dead
 *      code — getMyAcceptanceRate was computed and cached but never
 *      rendered anywhere), today's earnings (now real, once a delivery
 *      actually completes — see the post_driver_earning_on_delivery trigger).
 */
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Text as UIText, SkeletonCard, EmptyState, Card, StatusIndicator, useTheme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme as legacyTheme, gradients } from "@pharmacy/design-tokens";
import { useAuth } from "@/features/auth";
import { useUnreadCount } from "@/features/notifications";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import MetricCard from "@/components/MetricCard";
import { OrderCardNew } from "../components/OrderCardNew";
import { useDriverManifest, useDriverOffers, useMyAcceptanceRate, driverQueryKeys } from "../hooks/useDriverManifest";
import { useMyDriverProfile, useMyEarnings } from "../hooks/useDriverProfile";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { getDeliveryStage, getStageAction, getStageStatusLabel, type DeliveryStage } from "../lib/deliveryStage";
import { showErrorSheet, showConfirmSheet } from "@/shared/store/appSheetStore";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const STAGE_URGENCY: Record<DeliveryStage, number> = {
  at_customer: 4, to_customer: 3, at_pharmacy: 2, to_pharmacy: 1, delivered: 0, unknown: 0,
};

export function DriverManifest(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const unreadCount = useUnreadCount(user?.id);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const s = useMemo(() => StyleSheet.create({
    logoutBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
    headerActions: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    headerAction: { position: "relative", width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
    notificationDot: { position: "absolute", top: 8, end: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
    listContent: { paddingHorizontal: kit.inset.screen, paddingBottom: 40 },
    heroWrap: { marginBottom: 8 },
    heroGradient: { paddingHorizontal: kit.inset.screen, paddingTop: 14, paddingBottom: 18 },
    heroTopRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    heroTitle: { fontSize: 20, fontFamily: legacyTheme.fonts.black, color: "#fff", marginTop: 4 },
    availabilityCard: {
      marginHorizontal: kit.inset.screen, marginTop: 14,
      flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between",
      padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)",
    },
    availabilityToggle: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },
    availabilityKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
    quickActionsRow: { flexDirection: flexRow(IS_RTL), gap: 10, paddingHorizontal: kit.inset.screen, marginTop: 14 },
    quickTile: { flex: 1, backgroundColor: theme.colors.canvas.surface, paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 4, ...theme.shadows[1] },
    offerCount: { position: "absolute", top: -6, end: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.status.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    offerCountText: { color: "#fff", fontSize: 11, fontFamily: legacyTheme.fonts.black },
    metricsRow: { flexDirection: flexRow(IS_RTL), gap: 8, paddingHorizontal: kit.inset.screen, marginTop: 16 },
    sectionHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", paddingHorizontal: kit.inset.screen, marginTop: 20, marginBottom: 8 },
    smallRefresh: { padding: 8 },
    spotlightCard: { marginHorizontal: kit.inset.screen, gap: 10 },
    spotlightHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    spotlightIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.primaryLight },
    spotlightBtn: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50, borderRadius: 14, backgroundColor: theme.colors.brand.primary, marginTop: 4 },
  }), [theme]);

  const manifestQuery = useDriverManifest(user?.id);
  const offersQuery = useDriverOffers(user?.id);
  const driverProfileQuery = useMyDriverProfile(user?.id);
  const acceptanceRateQuery = useMyAcceptanceRate(user?.id);
  const earningsQuery = useMyEarnings(driverProfileQuery.data?.id);
  const mutations = useDriverMutations(user?.id);

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
  const isOnline = driverProfileQuery.data?.isOnline ?? false;

  const rankedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const urgencyDiff = STAGE_URGENCY[getDeliveryStage(b.status, b)] - STAGE_URGENCY[getDeliveryStage(a.status, a)];
      if (urgencyDiff !== 0) return urgencyDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [orders]);
  const spotlightOrder = rankedOrders[0];
  const queueOrders = rankedOrders.slice(1);

  const handleToggleAvailability = async () => {
    const next = !isOnline;
    try {
      let coords: { lat: number; lng: number } | undefined;
      if (next) {
        const permission = await ExpoLocation.getForegroundPermissionsAsync();
        if (permission.status === "granted") {
          const position = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }).catch(() => null);
          if (position) coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        }
      }
      await mutations.setAvailability.mutateAsync({ isOnline: next, coords });
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const spotlightStage = spotlightOrder ? getDeliveryStage(spotlightOrder.status, spotlightOrder) : "unknown";
  const spotlightAction = spotlightOrder ? getStageAction(spotlightStage) : null;
  const spotlightStatusLabel = spotlightOrder ? getStageStatusLabel(spotlightStage) : null;

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <View style={s.heroWrap}>
        <LinearGradient colors={gradients.brandPrimary as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroGradient}>
          <View style={s.heroTopRow}>
            <View style={{ flex: 1 }}>
              <UIText variant="eyebrow" style={{ color: "#FFFFFF" }}>{t("driver.eyebrow")}</UIText>
              <UIText style={s.heroTitle}>{t("driver.greeting", { name: user?.name ?? "" })}</UIText>
            </View>
            <View style={s.headerActions}>
              <Pressable onPress={() => router.push("/driver-notifications" as never)} style={s.headerAction} accessibilityRole="button" accessibilityLabel={t("notifications.title")}>
                <Ionicons name="notifications-outline" size={20} color="#fff" />
                {unreadCount > 0 && <View style={s.notificationDot} />}
              </Pressable>
              <Pressable
                onPress={() => showConfirmSheet(t("driver.signOutConfirmTitle", "Sign out?"), t("driver.signOutConfirmBody", "You'll stop receiving new delivery offers until you sign back in."), () => void signOut(), { danger: true, confirmLabel: t("driver.signOut") })}
                style={s.logoutBtn}
                accessibilityRole="button"
                accessibilityLabel={t("driver.signOut")}
              >
                <Ionicons name="log-out-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => void handleToggleAvailability()} disabled={mutations.setAvailability.isPending} style={s.availabilityCard} accessibilityRole="switch" accessibilityState={{ checked: isOnline }}>
            <StatusIndicator active={isOnline} pulse={isOnline} color={isOnline ? "#4ADE80" : "rgba(255,255,255,0.5)"} label={isOnline ? t("driver.online") : t("driver.offline")} />
            <View style={[s.availabilityToggle, { backgroundColor: isOnline ? "#22C55E" : "rgba(255,255,255,0.25)", alignItems: isOnline ? (IS_RTL ? "flex-start" : "flex-end") : (IS_RTL ? "flex-end" : "flex-start") }]}>
              <View style={s.availabilityKnob} />
            </View>
          </Pressable>
        </LinearGradient>

        <View style={s.quickActionsRow}>
          <Pressable onPress={() => router.push("/(driver)/offers" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="notifications" size={18} color={theme.colors.brand.primary} />
            <UIText variant="caption" color="secondary">{t("driver.offers")}</UIText>
            {offerCount > 0 && <View style={s.offerCount}><UIText style={s.offerCountText}>{offerCount}</UIText></View>}
          </Pressable>
          <Pressable onPress={() => router.push("/(driver)/map" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="map-outline" size={18} color={theme.colors.brand.primary} />
            <UIText variant="caption" color="secondary">{t("driver.map")}</UIText>
          </Pressable>
          <Pressable onPress={() => router.push("/(driver)/profile" as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="person-circle" size={18} color={theme.colors.brand.primary} />
            <UIText variant="caption" color="secondary">{t("driver.profile")}</UIText>
          </Pressable>
        </View>

        <View style={s.metricsRow}>
          <MetricCard label={t("driver.todayEarnings")} value={formatPrice(todayEarnings)} compact icon={<Ionicons name="cash-outline" size={16} color={theme.colors.brand.primary} />} />
          <MetricCard label={t("driver.completed")} value={orders.filter((o) => o.status === "delivered").length} compact icon={<Ionicons name="checkmark-done-outline" size={16} color={theme.colors.status.success} />} />
          <MetricCard label={t("driver.acceptanceRate")} value={acceptanceRateQuery.data != null ? `${acceptanceRateQuery.data}%` : "—"} compact icon={<Ionicons name="trending-up-outline" size={16} color={theme.colors.status.info} />} />
        </View>
      </View>

      <FlatList
        data={queueOrders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
        ListHeaderComponent={
          <>
            {spotlightOrder && spotlightAction ? (
              <View style={{ marginBottom: 8 }}>
                <View style={s.sectionHeaderRow}>
                  <UIText variant="section-head" style={{ textAlign: TEXT_START }}>{t("driver.activeDelivery")}</UIText>
                </View>
                <Card style={s.spotlightCard} padding="lg" elevation="md">
                  <View style={s.spotlightHeaderRow}>
                    <View style={s.spotlightIcon}><Ionicons name="navigate" size={18} color={theme.colors.brand.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <UIText variant="caption" color="brand" style={{ textAlign: TEXT_START }}>{t(spotlightStatusLabel!.key, spotlightStatusLabel!.fallback)}</UIText>
                      <UIText variant="card-title" style={{ textAlign: TEXT_START, marginTop: 2 }}>#{spotlightOrder.id.slice(-8).toUpperCase()}</UIText>
                    </View>
                  </View>
                  <UIText variant="body-sm" color="secondary" numberOfLines={2} style={{ textAlign: TEXT_START }}>
                    {spotlightOrder.customerName ? `${spotlightOrder.customerName} · ${spotlightOrder.customerAddress || "—"}` : (spotlightOrder.customerAddress || "—")}
                  </UIText>
                  <Pressable onPress={() => router.push(`/(driver)/delivery/${spotlightOrder.id}` as never)} style={s.spotlightBtn} accessibilityRole="button">
                    <Ionicons name={spotlightAction.icon} size={16} color="#fff" />
                    <UIText color="#fff" variant="label">{t(spotlightAction.labelKey, spotlightAction.fallback)}</UIText>
                  </Pressable>
                </Card>
              </View>
            ) : null}

            <View style={s.sectionHeaderRow}>
              <UIText variant="section-head" style={{ textAlign: TEXT_START }}>
                {spotlightOrder ? t("driver.nextDeliveries", "Next deliveries") : t("driver.manifestTitle")}
              </UIText>
              <Pressable onPress={() => onRefresh()} style={s.smallRefresh} accessibilityRole="button"><Ionicons name="refresh" size={16} color={theme.colors.text.muted} /></Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <OrderCardNew order={item} onPress={() => router.push(`/(driver)/delivery/${item.id}` as never)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={manifestQuery.isLoading ? (
          <View style={{ paddingHorizontal: kit.inset.screen, paddingTop: 8 }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} style={{ marginBottom: 10 }} />)}
          </View>
        ) : manifestQuery.isError ? (
          <EmptyState
            illustrationName="offline"
            title={t("errors.network")}
            subtitle={t("driver.emptyRetryHint")}
            action={{ label: t("common.retry"), onPress: () => void onRefresh() }}
          />
        ) : !spotlightOrder ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title={t("driver.emptyManifestTitle")}
            subtitle={t("driver.emptyManifestBody")}
            action={{ label: t("driver.checkOffers"), onPress: () => router.push("/(driver)/offers" as never) }}
          />
        ) : null}
      />
    </Screen>
  );
}
