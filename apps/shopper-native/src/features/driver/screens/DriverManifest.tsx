/**
 * DriverManifest — the driver section's home screen.
 *
 * Structure, in the order a driver actually needs it answered the instant
 * the screen opens (see features/driver/lib/deliveryStage.ts for the stage
 * ranking that drives the spotlight):
 *
 *   1. Am I online?            — availability, backed by DriverProfile.isOnline
 *                                via the set_driver_availability RPC.
 *   2. What do I do right now? — the single most urgent in-progress delivery,
 *                                picked by stage (at_customer > to_customer >
 *                                at_pharmacy > to_pharmacy), not by sort order.
 *   3. Where else can I go?    — quick actions, with the live pending-offer count.
 *   4. How am I doing?         — today's earnings, completed, acceptance rate,
 *                                and progress against a daily goal.
 *   5. What's queued?          — the rest of the manifest as compact rows.
 *
 * Layout note, and the reason this file was restructured: the hero + stat
 * cards used to be siblings of the FlatList rather than its header. That
 * pinned roughly two thirds of the viewport in place on a real phone, left
 * the list a sliver to scroll in, and clipped the "today's tasks" empty state
 * off the bottom edge entirely. Everything above the queue is now the list's
 * ListHeaderComponent, so the page scrolls as one surface and nothing can be
 * pushed out of reach.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View, type TextStyle, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Screen, Text as UIText, SkeletonCard, EmptyState, Card, useTheme, type NativeTheme } from "@pharmacy/ui-native";
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
import { getDriverActionErrorMessage } from "../lib/errorMessage";
import { showErrorSheet } from "@/shared/store/appSheetStore";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const STAGE_URGENCY: Record<DeliveryStage, number> = {
  at_customer: 4, to_customer: 3, at_pharmacy: 2, to_pharmacy: 1, delivered: 0, unknown: 0,
};

/** Reference target for the daily-goal card. No backend behind it — this is
 *  the same motivational pattern Uber/Careem use, computed off earnings we
 *  already have. */
const DAILY_GOAL_EGP = 500;

const TOGGLE_TRAVEL = 24;

export function DriverManifest(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const unreadCount = useUnreadCount(user?.id);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { pagePad, isTablet } = useScreenLayout();
  const insets = useSafeAreaInsets();

  const s = useMemo(() => getStyles(theme, pagePad, isTablet), [theme, pagePad, isTablet]);

  const manifestQuery       = useDriverManifest(user?.id);
  const offersQuery         = useDriverOffers(user?.id);
  const driverProfileQuery  = useMyDriverProfile(user?.id);
  const acceptanceRateQuery = useMyAcceptanceRate(user?.id);
  const earningsQuery       = useMyEarnings(driverProfileQuery.data?.id);
  const mutations           = useDriverMutations(user?.id);

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

  const orders     = manifestQuery.data ?? [];
  const offerCount = offersQuery.data?.length ?? 0;
  const isOnline   = driverProfileQuery.data?.isOnline ?? false;

  const rankedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const urgencyDiff = STAGE_URGENCY[getDeliveryStage(b.status, b)] - STAGE_URGENCY[getDeliveryStage(a.status, a)];
      if (urgencyDiff !== 0) return urgencyDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [orders]);
  const spotlightOrder = rankedOrders[0];
  const queueOrders    = rankedOrders.slice(1);

  const completedToday = orders.filter((o) => o.status === "delivered").length;

  // The knob genuinely animates now; it used to be an Animated.View carrying a
  // plain conditional transform, i.e. it snapped.
  const knob = useSharedValue(isOnline ? 1 : 0);
  useEffect(() => {
    knob.value = withSpring(isOnline ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [isOnline, knob]);
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knob.value * (IS_RTL ? -TOGGLE_TRAVEL : TOGGLE_TRAVEL) }],
  }));
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      knob.value > 0.5 ? theme.colors.status.success : theme.colors.border.strong,
      { duration: 180 },
    ),
  }));

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
      showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
    }
  };

  const spotlightStage       = spotlightOrder ? getDeliveryStage(spotlightOrder.status, spotlightOrder) : "unknown";
  const spotlightAction      = spotlightOrder ? getStageAction(spotlightStage) : null;
  const spotlightStatusLabel = spotlightOrder ? getStageStatusLabel(spotlightStage) : null;

  const quickActions = [
    {
      key: "offers",
      icon: "flash-outline" as const,
      label: t("tabs.driverOffers"),
      badge: offerCount,
      onPress: () => router.push("/(driver)/offers" as never),
    },
    {
      key: "map",
      icon: "map-outline" as const,
      label: t("tabs.driverMap"),
      badge: 0,
      onPress: () => router.push("/(driver)/map" as never),
    },
    {
      key: "earnings",
      icon: "wallet-outline" as const,
      label: t("driver.earningsTitle", { defaultValue: "Earnings" }),
      badge: 0,
      onPress: () => router.push("/(driver)/earnings" as never),
    },
  ];

  const header = (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.heroGradient, { paddingTop: Math.max(insets.top + 10, 24) }]}
      >
        <View style={s.heroTopRow}>
          <Pressable
            onPress={() => router.push("/(driver)/profile" as never)}
            style={s.profileAvatarBtn}
            accessibilityRole="button"
            accessibilityLabel={t("driver.profileTitle", { defaultValue: "Profile" })}
          >
            <Ionicons name="person-circle" size={44} color="#fff" />
          </Pressable>

          <View style={s.heroTitleCol}>
            <UIText variant="eyebrow" style={s.heroEyebrow} numberOfLines={1}>{t("driver.eyebrow")}</UIText>
            <UIText style={s.heroTitle} numberOfLines={1}>
              {t("driver.greeting", { name: user?.name ?? displayNameFromEmail(user?.email) ?? "" })}
            </UIText>
          </View>

          <Pressable
            onPress={() => router.push("/driver-notifications" as never)}
            style={s.headerAction}
            accessibilityRole="button"
            accessibilityLabel={t("notifications.title")}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {unreadCount > 0 ? (
              <View style={s.headerBadge}>
                <UIText style={s.headerBadgeText} numberOfLines={1}>
                  {unreadCount > 9 ? "9+" : String(unreadCount)}
                </UIText>
              </View>
            ) : null}
          </Pressable>
        </View>
      </LinearGradient>

      {/* ── Availability ───────────────────────────────────────────────── */}
      <Card style={s.availabilityCard} elevation="none">
        <Pressable
          onPress={() => void handleToggleAvailability()}
          style={s.availabilityRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: isOnline }}
          accessibilityLabel={isOnline ? t("driver.statusOnline") : t("driver.statusOffline")}
        >
          <View style={[s.availabilityDot, { backgroundColor: isOnline ? theme.colors.status.success : theme.colors.text.muted }]} />
          <View style={s.availabilityLabelCol}>
            <UIText style={s.availabilityTitle} numberOfLines={1}>
              {isOnline ? t("driver.statusOnline") : t("driver.statusOffline")}
            </UIText>
            <UIText numberOfLines={2} style={s.availabilitySubtitle}>
              {isOnline ? t("driver.onlineSubtitle") : t("driver.offlineSubtitle")}
            </UIText>
          </View>
          <Animated.View style={[s.availabilityToggle, trackStyle]}>
            <Animated.View style={[s.availabilityKnob, knobStyle]} />
          </Animated.View>
        </Pressable>
      </Card>

      {/* ── Active delivery ────────────────────────────────────────────── */}
      {spotlightOrder && spotlightAction ? (
        <View style={s.blockGap}>
          <View style={s.sectionHeaderRow}>
            <UIText variant="section-head" style={s.sectionTitle}>{t("driver.activeDelivery")}</UIText>
          </View>
          <Card style={s.spotlightCard} padding="lg" elevation="md">
            <View style={s.spotlightHeaderRow}>
              <View style={s.spotlightIcon}>
                <Ionicons name="navigate" size={18} color={theme.colors.brand.primaryDark} />
              </View>
              <View style={s.flexMin}>
                <UIText variant="caption" color="brand" style={s.startText} numberOfLines={1}>
                  {t(spotlightStatusLabel!.key, spotlightStatusLabel!.fallback)}
                </UIText>
                <UIText variant="card-title" style={[s.startText, s.spotlightRef]} numberOfLines={1}>
                  #{spotlightOrder.id.slice(-8).toUpperCase()}
                </UIText>
              </View>
            </View>

            <UIText variant="body-sm" color="secondary" numberOfLines={2} style={s.startText}>
              {spotlightOrder.customerName
                ? `${spotlightOrder.customerName} · ${spotlightOrder.customerAddress || "—"}`
                : (spotlightOrder.customerAddress || "—")}
            </UIText>

            <Pressable
              onPress={() => router.push(`/(driver)/delivery/${spotlightOrder.id}` as never)}
              style={s.spotlightBtn}
              accessibilityRole="button"
            >
              <Ionicons name={spotlightAction.icon} size={16} color="#fff" />
              <UIText color="#fff" variant="label">{t(spotlightAction.labelKey, spotlightAction.fallback)}</UIText>
            </Pressable>
          </Card>
        </View>
      ) : null}

      {/* ── Quick actions ──────────────────────────────────────────────── */}
      <View style={s.quickActionsRow}>
        {quickActions.map((a) => (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            style={s.quickTile}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <View style={s.quickIconWell}>
              <Ionicons name={a.icon} size={19} color={theme.colors.brand.primaryDark} />
              {a.badge > 0 ? (
                <View style={s.offerCount}>
                  <UIText style={s.offerCountText} numberOfLines={1}>
                    {a.badge > 9 ? "9+" : String(a.badge)}
                  </UIText>
                </View>
              ) : null}
            </View>
            <UIText style={s.quickLabel} numberOfLines={1}>{a.label}</UIText>
          </Pressable>
        ))}
      </View>

      <View style={s.guideWrap}>
        <DriverGuideCard />
      </View>

      {/* ── Performance ────────────────────────────────────────────────── */}
      <View style={s.perfSectionHeader}>
        <UIText style={s.perfSectionTitle}>{t("driver.performanceTitle")}</UIText>
        <UIText style={s.perfSectionSubtitle}>{t("driver.performanceSubtitle")}</UIText>
      </View>

      <View style={s.perfCard}>
        <Pressable
          onPress={() => router.push("/(driver)/earnings" as never)}
          accessibilityRole="button"
          style={s.perfHeroRow}
        >
          <View style={s.perfHeroIconWell}>
            <Ionicons name="cash-outline" size={20} color={theme.colors.brand.primaryDark} />
          </View>
          <View style={s.flexMin}>
            <UIText numberOfLines={1} style={s.perfHeroLabel}>{t("driver.todayEarnings")}</UIText>
            <UIText numberOfLines={1} style={s.perfHeroValue}>{formatPrice(todayEarnings)}</UIText>
          </View>
          <Ionicons name={IS_RTL ? "chevron-back" : "chevron-forward"} size={18} color={theme.colors.text.muted} />
        </Pressable>

        <View style={s.perfDivider} />

        <View style={s.perfSecondaryRow}>
          <View style={s.perfStatCell}>
            <UIText numberOfLines={1} style={s.perfStatValue}>{completedToday}</UIText>
            <UIText numberOfLines={2} style={s.perfStatLabel}>{t("driver.completedSubtitle")}</UIText>
          </View>
          <View style={s.perfStatVDivider} />
          <View style={s.perfStatCell}>
            <UIText numberOfLines={1} style={s.perfStatValue}>
              {acceptanceRateQuery.data != null ? `${acceptanceRateQuery.data}%` : "—"}
            </UIText>
            <UIText numberOfLines={2} style={s.perfStatLabel}>{t("driver.acceptanceRateSubtitle")}</UIText>
          </View>
        </View>
      </View>

      <DailyGoalCard earnings={todayEarnings} styles={s} theme={theme} t={t} />

      {/* ── Queue heading ──────────────────────────────────────────────── */}
      <View style={s.sectionHeaderRow}>
        <UIText variant="section-head" style={s.sectionTitle} numberOfLines={1}>
          {spotlightOrder ? t("driver.nextDeliveries", "Next deliveries") : t("driver.manifestTitle")}
        </UIText>
        <Pressable onPress={() => void onRefresh()} style={s.smallRefresh} accessibilityRole="button" accessibilityLabel={t("common.retry")} hitSlop={8}>
          <Ionicons name="refresh" size={16} color={theme.colors.text.muted} />
        </Pressable>
      </View>
    </>
  );

  return (
    <Screen edgeToEdge background={theme.colors.canvas.background}>
      <FlatList
        data={queueOrders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={s.rowWrap}>
            <OrderCardNew order={item} onPress={() => router.push(`/(driver)/delivery/${item.id}` as never)} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={s.rowSeparator} />}
        ListEmptyComponent={
          manifestQuery.isLoading ? (
            <View style={s.emptyWrap}>
              {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} style={s.skeleton} />)}
            </View>
          ) : manifestQuery.isError ? (
            <View style={s.emptyWrap}>
              <EmptyState
                illustrationName="offline"
                title={t("errors.network")}
                subtitle={t("driver.emptyRetryHint")}
                action={{ label: t("common.retry"), onPress: () => void onRefresh() }}
              />
            </View>
          ) : !spotlightOrder ? (
            <View style={s.emptyWrap}>
              <EmptyState
                icon="checkmark-done-circle-outline"
                title={t("driver.emptyManifestTitle")}
                subtitle={t("driver.emptyManifestBody")}
                action={{ label: t("driver.checkOffers"), onPress: () => router.push("/(driver)/offers" as never) }}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface DailyGoalStyles {
  goalCard: ViewStyle;
  goalHeaderRow: ViewStyle;
  goalTitle: TextStyle;
  goalPct: TextStyle;
  goalTrack: ViewStyle;
  goalFill: ViewStyle;
  goalHint: TextStyle;
  goalPctRow: ViewStyle;
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
  const tone = reached ? theme.colors.status.success : theme.colors.brand.primaryDark;
  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeaderRow}>
        <UIText numberOfLines={1} style={styles.goalTitle}>
          {t("driver.dailyGoalTarget", { amount: formatPrice(DAILY_GOAL_EGP) })}
        </UIText>
        <View style={styles.goalPctRow}>
          {reached ? <Ionicons name="trophy" size={14} color={tone} /> : null}
          <UIText numberOfLines={1} style={[styles.goalPct, { color: tone }]}>{Math.round(pct * 100)}%</UIText>
        </View>
      </View>
      <View style={styles.goalTrack}>
        <View style={[styles.goalFill, { width: `${pct * 100}%`, backgroundColor: tone }]} />
      </View>
      <UIText numberOfLines={2} style={styles.goalHint}>
        {reached
          ? t("driver.dailyGoalReached")
          : t("driver.dailyGoalRemaining", { amount: formatPrice(DAILY_GOAL_EGP - earnings) })}
      </UIText>
    </View>
  );
}

function getStyles(theme: NativeTheme, pagePad: number, isTablet: boolean) {
  return StyleSheet.create({
    listContent: {
      paddingBottom: 40,
      maxWidth: isTablet ? 720 : undefined,
      alignSelf: isTablet ? "center" : undefined,
      width: isTablet ? "100%" : undefined,
    },
    flexMin: { flex: 1, minWidth: 0 },
    startText: { textAlign: TEXT_START },
    blockGap: { marginBottom: 8 },
    rowWrap: { paddingHorizontal: pagePad },
    rowSeparator: { height: 10 },
    emptyWrap: { paddingHorizontal: pagePad, paddingTop: 8 },
    skeleton: { marginBottom: 10 },

    // Hero
    heroGradient: {
      paddingHorizontal: pagePad,
      paddingBottom: 36,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    heroTopRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10 },
    heroTitleCol: { flex: 1, minWidth: 0 },
    heroEyebrow: { color: "#FFFFFF" },
    heroTitle: {
      fontSize: 20,
      lineHeight: 28,
      fontFamily: legacyTheme.fonts.black,
      color: "#fff",
      marginTop: 4,
      textAlign: TEXT_START,
    },
    profileAvatarBtn: { flexShrink: 0 },
    headerAction: {
      position: "relative",
      width: 46, height: 46, borderRadius: 17,
      alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
      flexShrink: 0,
    },
    headerBadge: {
      position: "absolute", top: 6, end: 6,
      minWidth: 17, height: 17, borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: theme.colors.status.error,
      alignItems: "center", justifyContent: "center",
    },
    headerBadgeText: { color: "#fff", fontSize: 10, lineHeight: 14, fontFamily: legacyTheme.fonts.black },

    // Availability
    availabilityCard: {
      marginHorizontal: pagePad,
      marginTop: -24,
      padding: 16,
      borderRadius: 20,
      backgroundColor: theme.colors.canvas.surfaceElevated,
      ...theme.shadows[3],
      zIndex: 10,
    },
    availabilityRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
    availabilityDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
    availabilityLabelCol: { flex: 1, minWidth: 0 },
    availabilityTitle: {
      fontSize: 16,
      lineHeight: 23,
      fontFamily: legacyTheme.fonts.bold,
      color: theme.colors.text.primary,
      textAlign: TEXT_START,
    },
    availabilitySubtitle: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.text.muted,
      marginTop: 3,
      textAlign: TEXT_START,
    },
    availabilityToggle: {
      width: 56, height: 32, borderRadius: 16,
      padding: 3,
      justifyContent: "center",
      flexShrink: 0,
    },
    availabilityKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff", ...theme.shadows[1] },

    // Quick actions
    quickActionsRow: { flexDirection: flexRow(IS_RTL), gap: 10, paddingHorizontal: pagePad, marginTop: 14 },
    quickTile: {
      flex: 1, minWidth: 0,
      backgroundColor: theme.colors.canvas.surface,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center", justifyContent: "center",
      gap: 7,
      ...theme.shadows[1],
    },
    quickIconWell: {
      position: "relative",
      width: 40, height: 40, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.brand.primaryLight,
    },
    quickLabel: {
      fontSize: 12,
      lineHeight: 17,
      fontFamily: legacyTheme.fonts.bold,
      color: theme.colors.text.secondary,
      textAlign: "center",
    },
    offerCount: {
      position: "absolute", top: -5, end: -5,
      minWidth: 19, height: 19, borderRadius: 10,
      backgroundColor: theme.colors.status.error,
      alignItems: "center", justifyContent: "center",
      paddingHorizontal: 4,
    },
    offerCountText: { color: "#fff", fontSize: 10.5, lineHeight: 15, fontFamily: legacyTheme.fonts.black },

    guideWrap: { paddingHorizontal: pagePad, marginTop: 14 },

    // Performance
    perfSectionHeader: { paddingHorizontal: pagePad, marginTop: 20, marginBottom: 8 },
    perfSectionTitle: {
      fontSize: 15, lineHeight: 21,
      fontFamily: legacyTheme.fonts.extrabold,
      color: theme.colors.text.primary,
      textAlign: TEXT_START,
    },
    perfSectionSubtitle: {
      fontSize: 12, lineHeight: 17,
      color: theme.colors.text.muted,
      textAlign: TEXT_START,
      marginTop: 2,
    },
    sectionHeaderRow: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingHorizontal: pagePad,
      marginTop: 20,
      marginBottom: 8,
    },
    sectionTitle: { textAlign: TEXT_START, flexShrink: 1, minWidth: 0 },
    perfCard: {
      marginHorizontal: pagePad,
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 18,
      padding: 16,
      gap: 14,
      ...theme.shadows[1],
    },
    perfHeroRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
    perfHeroIconWell: {
      width: 46, height: 46, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.brand.primaryLight,
      flexShrink: 0,
    },
    perfHeroLabel: { fontSize: 12, lineHeight: 17, color: theme.colors.text.muted, textAlign: TEXT_START },
    perfHeroValue: {
      fontSize: 24, lineHeight: 31,
      fontFamily: legacyTheme.fonts.black,
      color: theme.colors.text.primary,
      textAlign: TEXT_START,
      marginTop: 2,
    },
    perfDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default },
    perfSecondaryRow: { flexDirection: flexRow(IS_RTL) },
    perfStatCell: { flex: 1, minWidth: 0, alignItems: "center", gap: 3 },
    perfStatVDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default, marginVertical: 2 },
    perfStatValue: {
      fontSize: 17, lineHeight: 23,
      fontFamily: legacyTheme.fonts.extrabold,
      color: theme.colors.text.primary,
    },
    perfStatLabel: { fontSize: 11, lineHeight: 15, color: theme.colors.text.muted, textAlign: "center" },

    // Daily goal
    goalCard: {
      marginHorizontal: pagePad,
      marginTop: 12,
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 18,
      padding: 16,
      gap: 10,
      ...theme.shadows[1],
    },
    goalHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", gap: 8 },
    goalPctRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 4, flexShrink: 0 },
    goalTitle: {
      fontSize: 13, lineHeight: 19,
      fontFamily: legacyTheme.fonts.bold,
      color: theme.colors.text.primary,
      flexShrink: 1, minWidth: 0,
      textAlign: TEXT_START,
    },
    goalPct: { fontSize: 13, lineHeight: 19, fontFamily: legacyTheme.fonts.black, flexShrink: 0 },
    goalTrack: { height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: theme.colors.canvas.surfaceMuted },
    goalFill: { height: "100%", borderRadius: 5 },
    goalHint: { fontSize: 11.5, lineHeight: 16, color: theme.colors.text.muted, textAlign: TEXT_START },

    // Spotlight
    smallRefresh: { padding: 8, flexShrink: 0 },
    spotlightCard: { marginHorizontal: pagePad, gap: 10 },
    spotlightHeaderRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    spotlightIcon: {
      width: 40, height: 40, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.brand.primaryLight,
      flexShrink: 0,
    },
    spotlightRef: { marginTop: 2 },
    spotlightBtn: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center", justifyContent: "center",
      gap: 8,
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: theme.colors.brand.primaryDark,
      marginTop: 4,
    },
  });
}
