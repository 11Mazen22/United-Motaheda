/**
 * AssignmentOffersList — all pending assignment offers awaiting this
 * driver's response. Usually just one, but staff can offer more than one
 * order at a time, so this stays a list rather than assuming a single offer.
 *
 * Redesigned card: a driver deciding whether to accept needs to answer four
 * questions in under two seconds — how much, how far, from where, how
 * urgent — and the previous version buried all four behind small text rows
 * with the price in a badge no bigger than the order number next to it.
 * Earnings is now the single largest number on the card (it's the one thing
 * that actually drives the decision); distance is real, not omitted — the
 * API already fetched customer_lat/customer_lng for every offer preview and
 * simply never returned it, so this used to always be missing, not just
 * hidden — computed live against the driver's own GPS fix; and urgency is a
 * depleting bar instead of a sentence a driver has to stop and read.
 *
 * Confirmed bug fixed earlier and preserved here: the decline "confirm"
 * used to fire the mutation on the first tap and show a reason field
 * afterward. Reason first, submit only on explicit confirm.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, FadeIn } from "react-native-reanimated";
import { Screen, Text as UIText, Card, Button, Input, SkeletonCard, EmptyState, PressableScale, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";
import { findBranchById } from "@/features/delivery/branches/data";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { useDriverOffers, driverQueryKeys } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { useDriverLivePosition } from "../hooks/useDriverLivePosition";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { getDriverActionErrorMessage } from "../lib/errorMessage";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import type { AssignmentOffer } from "../api";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

/** Manual assignments (expiresAt is null -- see DeliveryAssignment.expiresAt)
 *  have no server-side deadline at all; this window is purely a decision aid
 *  so the depletion bar still means something for them. Auto-dispatch offers
 *  carry a REAL expiresAt now (driver_accept_assignment rejects a late
 *  accept, auto_dispatch_tick sweeps and re-offers) -- those count down to
 *  that exact timestamp instead of this soft window. */
const OFFER_ATTENTION_WINDOW_MIN = 10;

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + s2 * s2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function AssignmentOffersList(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { language } = useAppLanguage();
  const { pagePad } = useScreenLayout();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const offersQuery = useDriverOffers(user?.id);
  const offers = offersQuery.data ?? [];
  const mutations = useDriverMutations(user?.id);
  const { fix: driverFix } = useDriverLivePosition(true);
  const [pendingAccept, setPendingAccept] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Re-render every second so the real expiresAt countdown (auto-dispatch
  // offers) and the "waited Nm" indicator (manual ones) both stay live
  // without a pull-to-refresh. Once an offer's real deadline passes, its
  // server-side row is about to be swept to 'expired' and re-offered to the
  // next driver by auto_dispatch_tick (within ~7s) -- invalidate once per
  // offer so it drops off this list on its own instead of sitting there
  // looking stuck at "0s" until the driver happens to pull-to-refresh.
  const [, forceTick] = useState(0);
  const expiredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const id = setInterval(() => {
      forceTick((n) => n + 1);
      if (!user?.id) return;
      const now = Date.now();
      let justExpired = false;
      for (const offer of offers) {
        if (offer.expiresAt && Date.parse(offer.expiresAt) <= now && !expiredRef.current.has(offer.id)) {
          expiredRef.current.add(offer.id);
          justExpired = true;
        }
      }
      if (justExpired) {
        void queryClient.invalidateQueries({ queryKey: driverQueryKeys.offers(user.id) });
      }
    }, 1_000);
    return () => clearInterval(id);
  }, [offers, queryClient, user?.id]);

  const s = useMemo(() => getStyles(theme, pagePad), [theme, pagePad]);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: driverQueryKeys.offers(user.id) });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, user?.id]);

  const handleAccept = async (assignmentId: string) => {
    setPendingAccept(assignmentId);
    try {
      await mutations.accept.mutateAsync(assignmentId);
      showSuccessSheet(t("driver.acceptedTitle"), t("driver.acceptedBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
    } finally {
      setPendingAccept(null);
    }
  };

  const startDecline = (assignmentId: string) => {
    setDecliningId(assignmentId);
    setReason("");
  };

  const confirmDecline = async (assignmentId: string, orderId: string) => {
    try {
      await mutations.decline.mutateAsync({ assignmentId, orderId, reason });
      showSuccessSheet(t("driver.declinedTitle"), t("driver.declinedBody"));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
    } finally {
      setDecliningId(null);
      setReason("");
    }
  };

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driver.offersTitle")} subtitle={t("driver.tapToRespond")} />

      <FlatList
        data={offers}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
        renderItem={({ item }) => (
          <OfferCard
            item={item}
            styles={s}
            theme={theme}
            t={t}
            language={language}
            driverFix={driverFix}
            isDeclining={decliningId === item.id}
            reason={reason}
            setReason={setReason}
            accepting={pendingAccept === item.id}
            declinePending={mutations.decline.isPending}
            onAccept={() => void handleAccept(item.id)}
            onStartDecline={() => startDecline(item.id)}
            onCancelDecline={() => setDecliningId(null)}
            onConfirmDecline={() => void confirmDecline(item.id, item.orderId)}
            onView={() => router.push(`/(driver)/offer/${item.id}` as never)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={offersQuery.isLoading ? (
          <View>{[1, 2].map((i) => <SkeletonCard key={i} lines={4} style={{ marginBottom: 10 }} />)}</View>
        ) : offersQuery.isError ? (
          <EmptyState illustrationName="offline" title={t("errors.network")} subtitle={t("common.retryShort")} action={{ label: t("common.retry"), onPress: () => void onRefresh() }} />
        ) : (
          <EmptyState icon="checkmark-circle-outline" title={t("driver.noOffersTitle")} />
        )}
      />
    </Screen>
  );
}

// ── Offer card ───────────────────────────────────────────────────────────

interface OfferCardProps {
  item: AssignmentOffer;
  styles: ReturnType<typeof getStyles>;
  theme: NativeTheme;
  t: (key: string, opts?: Record<string, unknown>) => string;
  language: string;
  driverFix: { lat: number; lng: number } | null;
  isDeclining: boolean;
  reason: string;
  setReason: (v: string) => void;
  accepting: boolean;
  declinePending: boolean;
  onAccept: () => void;
  onStartDecline: () => void;
  onCancelDecline: () => void;
  onConfirmDecline: () => void;
  onView: () => void;
}

function OfferCard({
  item, styles: s, theme, t, language, driverFix,
  isDeclining, reason, setReason, accepting, declinePending,
  onAccept, onStartDecline, onCancelDecline, onConfirmDecline, onView,
}: OfferCardProps) {
  const waitedMin = minutesSince(item.offeredAt);
  const hasDeadline = Boolean(item.expiresAt);
  const secondsLeft = item.expiresAt ? secondsUntil(item.expiresAt) : null;
  const urgencyFrac = hasDeadline && item.expiresAt
    ? (() => {
        const totalMs = Date.parse(item.expiresAt) - Date.parse(item.offeredAt);
        const remainingMs = Date.parse(item.expiresAt) - Date.now();
        return totalMs > 0 ? 1 - Math.max(0, Math.min(1, remainingMs / totalMs)) : 1;
      })()
    : Math.min(1, waitedMin / OFFER_ATTENTION_WINDOW_MIN);
  const isUrgent = hasDeadline ? (secondsLeft ?? 0) <= 5 : urgencyFrac >= 1;
  const branch = item.branchId ? findBranchById(item.branchId) : null;
  const branchName = branch ? (language === "ar" ? branch.nameAr : branch.nameEn) : null;
  const branchPhone = branch?.phones?.[0] ?? null;

  const distanceKm = driverFix && item.customerLat != null && item.customerLng != null
    ? haversineKm(driverFix, { lat: item.customerLat, lng: item.customerLng })
    : null;

  const barWidth = useSharedValue(1 - urgencyFrac);
  useEffect(() => {
    barWidth.value = withTiming(1 - urgencyFrac, { duration: 600 });
  }, [urgencyFrac, barWidth]);
  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value * 100}%` }));

  // status.{error,warning,success} are tuned for icon/border use (~3:1
  // against light backgrounds), not text -- statusSoft.{...}.text is the
  // token this design system actually built for colored text on a tinted
  // pill (verified against packages/design-tokens/semantic.ts: paired
  // with a matching .bg at proper contrast, not just the raw status color
  // at reduced opacity).
  const urgencySoft = isUrgent ? theme.colors.statusSoft.error : urgencyFrac > 0.5 ? theme.colors.statusSoft.warning : theme.colors.statusSoft.success;
  const urgencyBarColor = isUrgent ? theme.colors.status.error : urgencyFrac > 0.5 ? theme.colors.status.warning : theme.colors.status.success;

  return (
    <Animated.View entering={FadeIn.duration(280)}>
      <Card style={[s.card, isUrgent && s.urgentCard]} padding="none" elevation="sm">
        {/* Urgency depletion bar */}
        <View style={s.urgencyTrack}>
          <Animated.View style={[s.urgencyFill, { backgroundColor: urgencyBarColor }, barStyle]} />
        </View>

        <View style={s.body}>
          {/* Earnings hero + order ref */}
          <View style={[s.heroRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.flexMin}>
              <UIText variant="eyebrow" color="tertiary" style={s.start}>
                #{item.orderId?.slice(-8).toUpperCase()}
              </UIText>
              <UIText style={[s.earningsText, { color: theme.colors.brand.primaryDark }]} numberOfLines={1}>
                {formatPrice(item.total)}
              </UIText>
            </View>
            <View style={[s.waitPill, { backgroundColor: urgencySoft.bg }]}>
              <Ionicons name={isUrgent ? "alert-circle" : "time-outline"} size={13} color={urgencySoft.text} />
              <UIText weight="bold" style={[s.waitPillText, { color: urgencySoft.text }]}>
                {hasDeadline
                  ? (secondsLeft && secondsLeft > 0 ? t("driver.expiresInSeconds", { count: secondsLeft }) : t("driver.expiringNow"))
                  : (waitedMin < 1 ? t("driver.elapsedJustNow") : t("driver.elapsedMinutes", { count: waitedMin }))}
              </UIText>
            </View>
          </View>

          {/* Distance + branch + destination, icon rows */}
          <View style={s.infoGrid}>
            {distanceKm != null ? (
              <View style={[s.infoRow, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.infoIconWell}><Ionicons name="navigate-outline" size={13} color={theme.colors.brand.primary} /></View>
                <UIText variant="body-sm" weight="bold" style={[s.start, { color: theme.colors.text.primary }]}>
                  {distanceKm < 1 ? t("driver.distanceMeters", { value: Math.round(distanceKm * 1000) }) : t("driver.distanceKm", { value: distanceKm.toFixed(1) })}
                </UIText>
              </View>
            ) : null}
            {branchName ? (
              <View style={[s.infoRow, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.infoIconWell}><Ionicons name="storefront-outline" size={13} color={theme.colors.text.muted} /></View>
                <UIText variant="body-sm" color="secondary" style={s.start} numberOfLines={1}>{branchName}</UIText>
              </View>
            ) : null}
            {item.destinationArea ? (
              <View style={[s.infoRow, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.infoIconWell}><Ionicons name="location-outline" size={13} color={theme.colors.text.muted} /></View>
                <UIText variant="body-sm" color="secondary" style={s.start} numberOfLines={1}>{item.destinationArea}</UIText>
              </View>
            ) : null}
            {item.zoneName ? (
              <View style={[s.infoRow, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.infoIconWell}><Ionicons name="map-outline" size={13} color={theme.colors.text.muted} /></View>
                <UIText variant="body-sm" color="secondary" style={s.start} numberOfLines={1}>{item.zoneName}</UIText>
              </View>
            ) : null}
          </View>

          {!isDeclining ? (
            <>
              <View style={[s.actionsRow, { flexDirection: flexRow(IS_RTL) }]}>
                <Button style={s.acceptBtn} size="lg" label={t("driver.accept")} onPress={onAccept} loading={accepting} />
                {branchPhone ? (
                  <PressableScale onPress={() => void Linking.openURL(`tel:${branchPhone}`)} style={s.quickBtn} accessibilityRole="button" accessibilityLabel={t("driver.callPharmacy")}>
                    <Ionicons name="call-outline" size={18} color={theme.colors.text.secondary} />
                  </PressableScale>
                ) : null}
              </View>
              <View style={[s.secondaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                <Pressable onPress={onStartDecline} disabled={accepting} hitSlop={8}>
                  <UIText variant="body-sm" style={{ color: theme.colors.status.error }}>{t("driver.decline")}</UIText>
                </Pressable>
                <Pressable onPress={onView} hitSlop={8}>
                  <UIText variant="body-sm" color="secondary">{t("common.view")}</UIText>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={s.declineWrap}>
              <UIText variant="label" style={s.start}>{t("driver.declineReasonTitle")}</UIText>
              <Input
                value={reason}
                onChangeText={setReason}
                placeholder={t("driver.declineReasonPlaceholder")}
                multiline
                numberOfLines={3}
                style={s.declineInput}
              />
              <View style={[s.declineActions, { flexDirection: flexRow(IS_RTL) }]}>
                <Button label={t("common.cancel")} variant="ghost" onPress={onCancelDecline} />
                <Button label={t("driver.confirmDecline")} variant="danger" onPress={onConfirmDecline} loading={declinePending} />
              </View>
            </View>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

function getStyles(theme: NativeTheme, pagePad: number) {
  return StyleSheet.create({
    listContent: { paddingHorizontal: pagePad, paddingBottom: 40, paddingTop: 4 },
    flexMin: { flex: 1, minWidth: 0 },
    start: { textAlign: TEXT_START },

    card: { overflow: "hidden" },
    urgentCard: { borderColor: theme.colors.status.error, borderWidth: 1.5 },

    urgencyTrack: { height: 3, backgroundColor: theme.colors.canvas.surfaceMuted },
    urgencyFill: { height: "100%", borderRadius: 2 },

    body: { padding: 16, gap: 14 },

    heroRow: { alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    earningsText: {
      fontSize: 30, lineHeight: 36,
      fontFamily: legacyTheme.fonts.black,
      marginTop: 2,
      textAlign: TEXT_START,
    },
    waitPill: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center", gap: 5,
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 999,
      flexShrink: 0,
    },
    waitPillText: { fontSize: 11.5 },

    infoGrid: { gap: 8 },
    infoRow: { alignItems: "center", gap: 8 },
    infoIconWell: {
      width: 22, height: 22, borderRadius: 7,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.canvas.surfaceMuted,
      flexShrink: 0,
    },

    actionsRow: { alignItems: "center", gap: 10 },
    acceptBtn: { flex: 1 },
    quickBtn: {
      width: 50, height: 50, borderRadius: 15,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.canvas.surfaceMuted,
    },
    secondaryRow: { justifyContent: "space-between", paddingTop: 2 },

    declineWrap: { gap: 10 },
    declineInput: { minHeight: 70, textAlignVertical: "top" },
    declineActions: { justifyContent: "flex-end", gap: 10 },
  });
}
