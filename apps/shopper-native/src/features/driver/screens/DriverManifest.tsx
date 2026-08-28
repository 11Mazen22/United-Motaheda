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
import { FlatList, Pressable, RefreshControl, StyleSheet, View, type TextStyle, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Text as UIText, SkeletonCard, EmptyState, Card, StatusIndicator, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme, gradients } from "@pharmacy/design-tokens";
import { useAuth } from "@/features/auth";
import { useUnreadCount } from "@/features/notifications";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { displayNameFromEmail } from "@/utils/displayName";
import { useScreenLayout } from "@/utils/responsive";
import { OrderCardNew } from "../components/OrderCardNew";
import { DriverGuideCard } from "../components/DriverGuideCard";
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
  // Fixed kit.inset.screen (20px, always) previously fed every horizontal
  // padding on this screen -- fine on a phone, but on a tablet it left far
  // too little breathing room relative to the available width, and on a
  // real narrow phone (~375px) it was one of the reasons the metrics row
  // below had so little room per card that values got ellipsis-truncated.
  // pagePad scales with the actual viewport (16/24/32) like every other
  // screen in this app already does.
  const { pagePad, isTablet } = useScreenLayout();

  const s = useMemo(() => StyleSheet.create({
    logoutBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
    headerActions: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    headerAction: { position: "relative", width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
    notificationDot: { position: "absolute", top: 8, end: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
    listContent: { paddingHorizontal: pagePad, paddingBottom: 40, maxWidth: isTablet ? 720 : undefined, alignSelf: isTablet ? "center" : undefined, width: isTablet ? "100%" : undefined },
    heroWrap: { marginBottom: 8 },
    heroGradient: { paddingHorizontal: pagePad, paddingTop: 14, paddingBottom: 18 },
    heroTopRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    heroTitle: { fontSize: 20, fontFamily: legacyTheme.fonts.black, color: "#fff", marginTop: 4 },
    availabilityCard: {
      marginHorizontal: pagePad, marginTop: 14,
      padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", gap: 10,
    },
    availabilityTopRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between" },
    availabilityLabelCol: { flex: 1, minWidth: 0 },
    availabilitySubtitle: { fontSize: 11.5, lineHeight: 16, color: "rgba(255,255,255,0.78)", marginTop: 4 },
    availabilityToggle: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },
    availabilityKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
    quickActionsRow: { flexDirection: flexRow(IS_RTL), gap: 10, paddingHorizontal: pagePad, marginTop: 14 },
    quickTile: { flex: 1, backgroundColor: theme.colors.canvas.surface, paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 4, ...theme.shadows[1] },
    offerCount: { position: "absolute", top: -6, end: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.status.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    offerCountText: { color: "#fff", fontSize: 11, fontFamily: legacyTheme.fonts.black },

    // ── Performance card — one unified card instead of three cramped
    // icon-cards side by side. The earnings figure gets a full-width hero
    // row (it's the single number a driver actually cares about most);
    // completed/acceptance share a simple two-column row below with no
    // icon well eating into their text space, so neither value nor label
    // ever needs to truncate even on a narrow phone. ──
    perfSectionHeader: { paddingHorizontal: pagePad, marginTop: 20, marginBottom: 8 },
    perfSectionTitle: { fontSize: 15, fontFamily: legacyTheme.fonts.extrabold, color: theme.colors.text.primary, textAlign: TEXT_START },
    perfSectionSubtitle: { fontSize: 12, lineHeight: 16, color: theme.colors.text.muted, textAlign: TEXT_START, marginTop: 2 },
    sectionHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", paddingHorizontal: pagePad, marginTop: 20, marginBottom: 8 },
    perfCard: { marginHorizontal: pagePad, backgroundColor: theme.colors.canvas.surface, borderRadius: 18, padding: 16, gap: 14, ...theme.shadows[1] },
    perfHeroRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
    perfHeroIconWell: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.primaryLight, flexShrink: 0 },
    perfHeroLabel: { fontSize: 12, color: theme.colors.text.muted, textAlign: TEXT_START },
    perfHeroValue: { fontSize: 24, lineHeight: 30, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary, textAlign: TEXT_START, marginTop: 2 },
    perfDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default },
    perfSecondaryRow: { flexDirection: flexRow(IS_RTL) },
    perfStatCell: { flex: 1, minWidth: 0, alignItems: "center", gap: 3 },
    perfStatVDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default, marginVertical: 2 },
    perfStatValue: { fontSize: 17, lineHeight: 22, fontFamily: legacyTheme.fonts.extrabold, color: theme.colors.text.primary },
    perfStatLabel: { fontSize: 11, lineHeight: 15, color: theme.colors.text.muted, textAlign: "center" },

    // ── Daily goal — its own full-width card instead of being crammed at
    // the tail end of the gradient hero, which is what was clipping the
    // percentage off-screen on a real phone. ──
    goalCard: { marginHorizontal: pagePad, marginTop: 12, backgroundColor: theme.colors.canvas.surface, borderRadius: 18, padding: 16, gap: 10, ...theme.shadows[1] },
    goalHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", gap: 8 },
    goalTitle: { fontSize: 13, fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.primary, flexShrink: 1, minWidth: 0 },
    goalPct: { fontSize: 13, fontFamily: legacyTheme.fonts.black, flexShrink: 0 },
    goalTrack: { height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: theme.colors.canvas.surfaceMuted },
    goalFill: { height: "100%", borderRadius: 5 },
    goalHint: { fontSize: 11.5, lineHeight: 16, color: theme.colors.text.muted, textAlign: TEXT_START },

    smallRefresh: { padding: 8 },
    spotlightCard: { marginHorizontal: pagePad, gap: 10 },
    spotlightHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    spotlightIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.primaryLight },
    spotlightBtn: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50, borderRadius: 14, backgroundColor: theme.colors.brand.primary, marginTop: 4 },
  }), [theme, pagePad, isTablet]);

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
              <UIText style={s.heroTitle}>{t("driver.greeting", { name: user?.name ?? displayNameFromEmail(user?.email) ?? "" })}</UIText>
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
            <View style={[s.availabilityTopRow]}>
              <View style={s.availabilityLabelCol}>
                <StatusIndicator active={isOnline} pulse={isOnline} color={isOnline ? "#4ADE80" : "rgba(255,255,255,0.5)"} label={isOnline ? t("driver.online") : t("driver.offline")} />
              </View>
              <View style={[s.availabilityToggle, { backgroundColor: isOnline ? "#22C55E" : "rgba(255,255,255,0.25)", alignItems: isOnline ? (IS_RTL ? "flex-start" : "flex-end") : (IS_RTL ? "flex-end" : "flex-start") }]}>
                <View style={s.availabilityKnob} />
              </View>
            </View>
            {/* Reported live: "why is this switch even here, what does it do?"
                -- this is the single most important control on the whole
                screen (it's what actually makes you eligible to receive
                delivery offers at all), and it had zero explanation. */}
            <UIText numberOfLines={2} style={[s.availabilitySubtitle, { textAlign: TEXT_START }]}>
              {isOnline ? t("driver.onlineSubtitle") : t("driver.offlineSubtitle")}
            </UIText>
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

        <View style={{ paddingHorizontal: pagePad }}>
          <DriverGuideCard />
        </View>

        <View style={s.perfSectionHeader}>
          <UIText style={s.perfSectionTitle}>{t("driver.performanceTitle")}</UIText>
          <UIText style={s.perfSectionSubtitle}>{t("driver.performanceSubtitle")}</UIText>
        </View>

        <View style={s.perfCard}>
          <Pressable onPress={() => router.push("/(driver)/earnings" as never)} accessibilityRole="button" style={s.perfHeroRow}>
            <View style={s.perfHeroIconWell}>
              <Ionicons name="cash-outline" size={20} color={theme.colors.brand.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <UIText numberOfLines={1} style={s.perfHeroLabel}>{t("driver.todayEarnings")}</UIText>
              <UIText numberOfLines={1} style={s.perfHeroValue}>{formatPrice(todayEarnings)}</UIText>
            </View>
            <Ionicons name={IS_RTL ? "chevron-back" : "chevron-forward"} size={18} color={theme.colors.text.muted} />
          </Pressable>

          <View style={s.perfDivider} />

          <View style={s.perfSecondaryRow}>
            <View style={s.perfStatCell}>
              <UIText numberOfLines={1} style={s.perfStatValue}>{orders.filter((o) => o.status === "delivered").length}</UIText>
              <UIText numberOfLines={1} style={s.perfStatLabel}>{t("driver.completedSubtitle")}</UIText>
            </View>
            <View style={s.perfStatVDivider} />
            <View style={s.perfStatCell}>
              <UIText numberOfLines={1} style={s.perfStatValue}>{acceptanceRateQuery.data != null ? `${acceptanceRateQuery.data}%` : "—"}</UIText>
              <UIText numberOfLines={1} style={s.perfStatLabel}>{t("driver.acceptanceRateSubtitle")}</UIText>
            </View>
          </View>
        </View>

        <DailyGoalCard earnings={todayEarnings} styles={s} theme={theme} t={t} />
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
          <View style={{ paddingHorizontal: pagePad, paddingTop: 8 }}>
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

// ── Daily goal progress — motivational touch, no new backend: just today's
// already-computed earnings against a fixed reference target. Common gig-app
// pattern (Uber/Careem-style "X% of your daily goal"). Its own full-width
// card now (was crammed inline at the tail of the gradient hero, which is
// what clipped the percentage off-screen on a real phone), and shows the
// actual target amount instead of a bare, context-free percentage.
const DAILY_GOAL_EGP = 500;

interface DailyGoalStyles {
  goalCard: ViewStyle;
  goalHeaderRow: ViewStyle;
  goalTitle: TextStyle;
  goalPct: TextStyle;
  goalTrack: ViewStyle;
  goalFill: ViewStyle;
  goalHint: TextStyle;
}

function DailyGoalCard({
  earnings, styles, theme, t,
}: {
  earnings: number;
  styles: DailyGoalStyles;
  theme: NativeTheme;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const pct = Math.max(0, Math.min(1, earnings / DAILY_GOAL_EGP));
  const reached = pct >= 1;
  const tone = reached ? theme.colors.status.success : theme.colors.brand.primary;
  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeaderRow}>
        <UIText numberOfLines={1} style={styles.goalTitle}>
          {t("driver.dailyGoalTarget", { amount: formatPrice(DAILY_GOAL_EGP) })}
        </UIText>
        <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 4 }}>
          {reached && <Ionicons name="trophy" size={14} color={tone} />}
          <UIText numberOfLines={1} style={[styles.goalPct, { color: tone }]}>{Math.round(pct * 100)}%</UIText>
        </View>
      </View>
      <View style={styles.goalTrack}>
        <View style={[styles.goalFill, { width: `${pct * 100}%`, backgroundColor: tone }]} />
      </View>
      <UIText numberOfLines={1} style={styles.goalHint}>
        {reached ? t("driver.dailyGoalReached") : t("driver.dailyGoalRemaining", { amount: formatPrice(DAILY_GOAL_EGP - earnings) })}
      </UIText>
    </View>
  );
}
