/**
 * RedemptionHistoryScreen — V2 redemption-history journey (PRODUCT_BLUEPRINT §4.15).
 *
 * The tail of the redemption flow: discover → redeem → confirm → HISTORY.
 * Organised by status (Active: reserved/fulfilled → Past: cancelled/expired);
 * each card surfaces status, dates, the reservation deadline, and the tracking
 * number (retrieval confidence). Reserved items can be cancelled; a "browse the
 * catalog" card closes the loop (redeem again). Cancel logic, grouping, and all
 * GiftRedemption business rules preserved verbatim.
 */

import React, { useCallback, useMemo } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { kit, Button } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { PressableScale } from "@/shared/motion";
import { useScreenTrace } from "@/features/observability";
import { SubScreenHeader } from "../components/SubScreenHeader";
import { useRedemptions } from "../hooks/useRedemptions";
import { useCancelGiftRedemption } from "../hooks/useCancelGiftRedemption";
import type { GiftRedemption, GiftRedemptionState } from "../types";
import { showConfirmSheet } from "@/shared/store/appSheetStore";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type TFunc = ReturnType<typeof useTranslation>["t"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const FWD        = FORWARD_CHEVRON;


export function RedemptionHistoryScreen() {
  useScreenTrace("loyalty-redemption-history");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t }  = useTranslation();

  const redemptions = useRedemptions();
  const cancel      = useCancelGiftRedemption();

  const refreshing = redemptions.isFetching && !redemptions.isLoading;
  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void redemptions.refetch();
  }, [redemptions]);

  const { active, inactive } = useMemo(() => {
    const all = redemptions.data ?? [];
    return {
      active:   all.filter((r) => r.state === "reserved" || r.state === "fulfilled"),
      inactive: all.filter((r) => r.state === "cancelled" || r.state === "expired"),
    };
  }, [redemptions.data]);

  // ── Cancel — unchanged business logic ──
  const handleCancel = useCallback((r: GiftRedemption) => {
    showConfirmSheet(
      t("loyalty.cancelOrderTitle"),
      t("loyalty.cancelOrderBody"),
      () => {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        cancel.cancel({ redemptionId: r.id, reason: "user_cancelled" });
      },
      { confirmLabel: t("loyalty.cancelConfirmLabel"), danger: true },
    );
  }, [cancel, t]);

  const browseGifts = useCallback(
    () => router.push("/gifts" as Parameters<typeof router.push>[0]),
    [router],
  );

  if (redemptions.isLoading) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.redemptionsTitle")} subtitle={t("loyalty.redemptionsSubtitle")} />
        <ScrollView contentContainerStyle={s.scroll}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={s.skeletonCard} accessibilityLabel={t("common.loading")} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (redemptions.isError) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.redemptionsTitle")} subtitle={t("loyalty.redemptionsSubtitle")} />
        <View style={s.centerPanel}>
          <View style={s.centerIcon}><Ionicons name="cloud-offline-outline" size={32} color={kit.color.inkFaint} /></View>
          <UIText style={s.centerTitle} maxFontSizeMultiplier={1.4}>{t("loyalty.redemptionsErrorTitle")}</UIText>
          <Button label={t("common.retry")} icon="refresh" variant="primary" size="md" onPress={() => void redemptions.refetch()} style={{ marginTop: kit.sp(2) }} />
        </View>
      </View>
    );
  }

  const isEmpty = active.length === 0 && inactive.length === 0;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      <SubScreenHeader title={t("loyalty.redemptionsTitle")} subtitle={t("loyalty.redemptionsSubtitle")} />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kit.color.accent}
            accessibilityLabel={t("loyalty.redemptionsRefreshA11y")} />
        }
        showsVerticalScrollIndicator={false}>

        {isEmpty ? (
          <View style={s.centerPanel}>
            <View style={s.centerIcon}><Ionicons name="gift-outline" size={32} color={kit.color.accentDeep} /></View>
            <UIText style={s.centerTitle} maxFontSizeMultiplier={1.4}>{t("loyalty.redemptionsEmpty")}</UIText>
            <UIText style={s.centerBody} maxFontSizeMultiplier={1.5}>{t("loyalty.redemptionsEmptyBody")}</UIText>
          </View>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <GroupHeader title={t("loyalty.activeOrders")} />
                {active.map((r) => (
                  <RedemptionCard key={r.id} redemption={r}
                    onCancel={r.state === "reserved" ? () => handleCancel(r) : undefined}
                    cancelling={cancel.isPending} />
                ))}
              </>
            )}
            {inactive.length > 0 && (
              <>
                <GroupHeader title={t("loyalty.pastOrders")} />
                {inactive.map((r) => <RedemptionCard key={r.id} redemption={r} />)}
              </>
            )}
          </>
        )}

        {/* ── Redeem-again loop ── */}
        <PressableScale onPress={browseGifts} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={t("loyalty.walletBrowseGifts")} style={s.browseCard}>
          <View style={s.browseIcon}><Ionicons name="gift-outline" size={22} color={kit.color.accentDeep} /></View>
          <View style={s.browseBody}>
            <UIText numberOfLines={1} style={s.browseTitle}>{t("loyalty.walletBrowseGifts")}</UIText>
            <UIText numberOfLines={1} style={s.browseSub}>{t("loyalty.redemptionsBrowseSub")}</UIText>
          </View>
          <Ionicons name={FWD} size={18} color={kit.color.inkFaint} />
        </PressableScale>
      </ScrollView>
    </View>
  );
}

// ─── GroupHeader ───────────────────────────────────────────────────────────────

function GroupHeader({ title }: { title: string }) {
  return (
    <UIText style={s.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{title}</UIText>
  );
}

// ─── RedemptionCard ─────────────────────────────────────────────────────────────

interface RedemptionCardProps {
  redemption:  GiftRedemption;
  onCancel?:   () => void;
  cancelling?: boolean;
}

function RedemptionCard({ redemption: r, onCancel, cancelling }: RedemptionCardProps) {
  const { t } = useTranslation();
  const reservedDate  = new Date(r.reserved_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
  const fulfilledDate = r.fulfilled_at ? new Date(r.fulfilled_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) : null;
  const expiryDate    = new Date(r.expires_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
  const muted = r.state === "cancelled" || r.state === "expired";
  const color = stateColor(r.state);
  const tint  = stateTint(r.state);

  return (
    <View
      style={[s.card, muted && s.cardMuted]}
      accessibilityRole="text"
      accessibilityLabel={t("loyalty.redemptionA11y", {
        points: r.points_spent.toLocaleString("ar-EG"),
        state:  getStateLabel(r.state, t),
        date:   reservedDate,
      })}>
      <View style={s.cardTop}>
        <View style={[s.stateIcon, { backgroundColor: tint }]}>
          <Ionicons name={stateIcon(r.state)} size={18} color={color} />
        </View>

        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <UIText style={s.pointsText} maxFontSizeMultiplier={1.3}>
              {r.points_spent.toLocaleString("ar-EG")} {t("loyalty.pointsUnit")}
            </UIText>
            <View style={[s.statePill, { backgroundColor: tint }]}>
              <UIText style={[s.statePillText, { color }]}>{getStateLabel(r.state, t)}</UIText>
            </View>
          </View>

          <UIText style={s.metaText} maxFontSizeMultiplier={1.4}>{t("loyalty.orderedOn", { date: reservedDate })}</UIText>
          {fulfilledDate && <UIText style={s.metaText} maxFontSizeMultiplier={1.4}>{t("loyalty.deliveredOn", { date: fulfilledDate })}</UIText>}
          {r.state === "reserved" && <UIText style={[s.metaText, { color: kit.color.warn }]} maxFontSizeMultiplier={1.4}>{t("loyalty.reservationEnds", { date: expiryDate })}</UIText>}

          {r.tracking_number && (
            <View style={s.trackingRow}>
              <Ionicons name="cube-outline" size={13} color={kit.color.accentDeep} />
              <UIText style={s.trackingText} maxFontSizeMultiplier={1.3} selectable>{r.tracking_number}</UIText>
            </View>
          )}
          {r.cancellation_reason && <UIText style={s.cancelReason} maxFontSizeMultiplier={1.4}>{r.cancellation_reason}</UIText>}
        </View>
      </View>

      {onCancel && (
        <View style={s.cardFoot}>
          <Button
            label={t("loyalty.cancelOrder")}
            icon="close-circle-outline"
            variant="danger"
            size="sm"
            loading={cancelling}
            onPress={onCancel}
            accessibilityLabel={t("loyalty.cancelOrderA11y")}
          />
        </View>
      )}
    </View>
  );
}

// ─── Status helpers ──────────────────────────────────────────────────────────────

function getStateLabel(state: GiftRedemptionState, t: TFunc): string {
  switch (state) {
    case "reserved":  return t("loyalty.stateReserved");
    case "fulfilled": return t("loyalty.stateFulfilled");
    case "cancelled": return t("loyalty.stateCancelled");
    case "expired":   return t("loyalty.stateExpired");
    default:          return state;
  }
}

function stateColor(state: GiftRedemptionState): string {
  switch (state) {
    case "reserved":  return kit.color.warn;
    case "fulfilled": return kit.color.success;
    case "cancelled": return kit.color.danger;
    case "expired":   return kit.color.inkFaint;
    default:          return kit.color.inkFaint;
  }
}

function stateTint(state: GiftRedemptionState): string {
  switch (state) {
    case "reserved":  return kit.color.warnTint;
    case "fulfilled": return kit.color.successTint;
    case "cancelled": return kit.color.dangerTint;
    default:          return kit.color.well;
  }
}

function stateIcon(state: GiftRedemptionState): IoniconsName {
  switch (state) {
    case "reserved":  return "time-outline";
    case "fulfilled": return "checkmark-circle";
    case "cancelled": return "close-circle-outline";
    case "expired":   return "alert-circle-outline";
    default:          return "ellipse-outline";
  }
}

// ─── Styles (kit) ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },
  scroll: { paddingHorizontal: theme.layout.pagePaddingH, paddingBottom: 32, gap: kit.sp(2) },

  groupTitle: {
    fontFamily: theme.fonts.black, fontSize: kit.type.heading.fontSize, lineHeight: kit.type.heading.lineHeight,
    color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false, marginTop: kit.sp(4), marginBottom: kit.sp(1),
  },

  card: {
    padding: kit.sp(3), backgroundColor: kit.color.surface, borderRadius: kit.radius.card,
    borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised, gap: kit.sp(3),
  },
  cardMuted: { opacity: 0.7 },
  cardTop: { flexDirection: flexRow(IS_RTL), alignItems: "flex-start", gap: 12 },
  stateIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTitleRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", gap: 8 },
  pointsText: { fontFamily: theme.fonts.black, fontSize: 15, color: kit.color.ink, includeFontPadding: false },
  statePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: kit.radius.pill },
  statePillText: { fontFamily: theme.fonts.bold, fontSize: 10, includeFontPadding: false },
  metaText: { fontFamily: theme.fonts.regular, fontSize: 12, color: kit.color.inkFaint, textAlign: TEXT_START, includeFontPadding: false },

  trackingRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6, marginTop: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: kit.color.accentTint, borderRadius: kit.radius.control, alignSelf: "flex-start" },
  trackingText: { fontFamily: theme.fonts.bold, fontSize: 12, color: kit.color.accentDeep, letterSpacing: 0.5, includeFontPadding: false },
  cancelReason: { fontFamily: theme.fonts.regular, fontSize: 11, color: kit.color.danger, textAlign: TEXT_START, includeFontPadding: false },
  cardFoot: { flexDirection: flexRow(IS_RTL), justifyContent: "flex-end", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: kit.color.line, paddingTop: kit.sp(3) },

  centerPanel: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: kit.sp(10), gap: 10 },
  centerIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: kit.color.accentTint, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  centerTitle: { fontFamily: theme.fonts.black, fontSize: 17, color: kit.color.ink, textAlign: "center" },
  centerBody: { fontFamily: theme.fonts.regular, fontSize: 14, color: kit.color.inkSoft, textAlign: "center", lineHeight: 22, maxWidth: 280 },

  skeletonCard: { height: 110, borderRadius: kit.radius.card, backgroundColor: kit.color.well },

  browseCard: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12, marginTop: kit.sp(5),
    padding: kit.sp(3), backgroundColor: kit.color.surface, borderRadius: kit.radius.card,
    borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised,
  },
  browseIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.accentTint },
  browseBody: { flex: 1, minWidth: 0, gap: 2 },
  browseTitle: { fontFamily: theme.fonts.bold, fontSize: 14, color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false },
  browseSub:   { fontFamily: theme.fonts.regular, fontSize: 12, color: kit.color.inkFaint, textAlign: TEXT_START, includeFontPadding: false },
});

export default RedemptionHistoryScreen;
