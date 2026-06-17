/**
 * CouponsScreen — V2 coupon-management journey (PRODUCT_BLUEPRINT §4.15).
 *
 * Journey rebuild (was: flat "My Coupons" list + "Redeem New" list):
 *   balance context → ACQUISITION (redeem points for coupons, affordability-aware)
 *   → OWNED, organised by EXPIRATION (expiring-soon surfaced with urgency, then
 *   usable). Each owned coupon shows its code ready to use at checkout.
 *
 * All business logic preserved verbatim: useCouponBatches / useUserCoupons /
 * useLoyaltyBalance / useRedeemCoupon, the confirm + error sheets, affordability
 * / sold-out / low-stock states, redeemingBatchId lifecycle, decodeRedeemError.
 */

import React, { useCallback, useMemo, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { kit } from "@/shared/kit";
import { Button } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { PressableScale } from "@/shared/motion";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenTrace } from "@/features/observability";
import { SubScreenHeader } from "../components/SubScreenHeader";
import { useCouponBatches } from "../hooks/useCouponBatches";
import { useUserCoupons } from "../hooks/useUserCoupons";
import { useLoyaltyBalance } from "../hooks/useLoyaltyBalance";
import { useRedeemCoupon } from "../hooks/useRedeemCoupon";
import type { Coupon, CouponBatch, CouponDiscountKind } from "../types";
import { showErrorSheet, showConfirmSheet } from "@/shared/store/appSheetStore";

type TFunc = ReturnType<typeof useTranslation>["t"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const SOON_DAYS  = 7;

const TXT = IS_RTL
  ? { acquire: "استبدل نقاطك بكوبونات", expiringSoon: "تنتهي قريباً", usable: "كوبوناتك الجاهزة", expiresInDays: (n: number) => (n <= 0 ? "تنتهي اليوم" : `تنتهي خلال ${n} يوم`), expiringPill: "ينتهي قريباً", usablePill: "جاهز", balance: "رصيدك" }
  : { acquire: "Redeem points for coupons", expiringSoon: "Expiring soon", usable: "Ready to use", expiresInDays: (n: number) => (n <= 0 ? "Expires today" : `Expires in ${n} day${n === 1 ? "" : "s"}`), expiringPill: "Expiring", usablePill: "Ready", balance: "Your points" };

function daysToExpiry(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

export function CouponsScreen() {
  useScreenTrace("loyalty-coupons");
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const balance = useLoyaltyBalance();
  const batches = useCouponBatches();
  const coupons = useUserCoupons();
  const redeem  = useRedeemCoupon();

  const [redeemingBatchId, setRedeemingBatchId] = useState<string | null>(null);

  const refreshing =
    (balance.isFetching && !balance.isLoading) ||
    (batches.isFetching && !batches.isLoading) ||
    (coupons.isFetching && !coupons.isLoading);

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void balance.refetch();
    void batches.refetch();
    void coupons.refetch();
  }, [balance, batches, coupons]);

  // ── Redeem flow — unchanged business logic ───────────────────────────────
  const handleRedeem = useCallback(
    (batch: CouponBatch) => {
      const currentBalance = balance.data?.balance ?? 0;
      if (currentBalance < batch.points_cost) {
        showErrorSheet(
          t("loyalty.insufficientPointsTitle"),
          t("loyalty.insufficientPointsBody", {
            cost:    batch.points_cost.toLocaleString("ar-EG"),
            balance: currentBalance.toLocaleString("ar-EG"),
          }),
        );
        return;
      }
      showConfirmSheet(
        t("loyalty.redeemConfirmTitle"),
        t("loyalty.redeemConfirmBody", { cost: batch.points_cost.toLocaleString("ar-EG"), name: batch.name }),
        () => {
          if (Platform.OS !== "web")
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setRedeemingBatchId(batch.id);
          redeem.redeem({ batchId: batch.id });
        },
        { confirmLabel: t("loyalty.redeemConfirmLabel") },
      );
    },
    [balance.data, redeem, t],
  );

  React.useEffect(() => {
    if (!redeem.isPending && redeemingBatchId !== null) {
      setRedeemingBatchId(null);
      if (redeem.isError && redeem.error) {
        showErrorSheet(t("loyalty.redeemErrorTitle"), decodeRedeemError(redeem.error, t));
      }
    }
  }, [redeem.isPending, redeem.isError, redeem.error, redeemingBatchId, t]);

  // ── Owned coupons, organised by expiration ────────────────────────────────
  const issued = useMemo(() => (coupons.data ?? []).filter((c) => c.state === "issued"), [coupons.data]);
  const { expiringSoon, usable } = useMemo(() => {
    const soon: Coupon[] = [];
    const rest: Coupon[] = [];
    for (const c of issued) {
      const d = daysToExpiry(c.expires_at);
      if (d !== null && d <= SOON_DAYS) soon.push(c);
      else rest.push(c);
    }
    soon.sort((a, b) => (daysToExpiry(a.expires_at) ?? 0) - (daysToExpiry(b.expires_at) ?? 0));
    return { expiringSoon: soon, usable: rest };
  }, [issued]);

  const availableBatches = batches.data ?? [];

  if (coupons.isLoading && batches.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.couponsTitle")} subtitle={t("loyalty.couponsSubtitle")} />
        <ScrollView contentContainerStyle={s.scroll}><ListSkeleton rows={3} /></ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <SubScreenHeader title={t("loyalty.couponsTitle")} subtitle={t("loyalty.couponsSubtitle")} />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kit.color.accent}
            accessibilityLabel={t("loyalty.couponsRefreshA11y")} />
        }
        showsVerticalScrollIndicator={false}>

        {/* ── Balance context — the acquisition budget ── */}
        {balance.data && (
          <View style={s.balanceBar} accessibilityRole="text"
                accessibilityLabel={t("loyalty.balanceA11y", { n: balance.data.balance })}>
            <View style={s.balanceIcon}><Ionicons name="star" size={16} color={kit.color.accentDeep} /></View>
            <UIText style={s.balanceLabel}>{TXT.balance}</UIText>
            <UIText style={s.balanceValue}>{balance.data.balance.toLocaleString("ar-EG")}</UIText>
          </View>
        )}

        {/* ── ACQUISITION — redeem points for coupons ── */}
        <GroupHeader title={TXT.acquire} />
        {batches.isError ? (
          <ErrorRow onRetry={() => void batches.refetch()} />
        ) : availableBatches.length === 0 ? (
          <EmptyRow icon="storefront-outline" message={t("loyalty.couponsBatchesEmpty")} />
        ) : (
          availableBatches.map((b) => (
            <BatchAcquisitionCard
              key={b.id}
              batch={b}
              currentBalance={balance.data?.balance ?? 0}
              isRedeeming={redeemingBatchId === b.id}
              onRedeem={() => handleRedeem(b)}
            />
          ))
        )}

        {/* ── EXPIRATION — owned coupons expiring soon (urgent) ── */}
        {expiringSoon.length > 0 && (
          <>
            <GroupHeader title={TXT.expiringSoon} tone="warn" icon="alarm-outline" />
            {expiringSoon.map((c) => <CouponCard key={c.id} coupon={c} expiring />)}
          </>
        )}

        {/* ── ORGANIZATION — ready-to-use owned coupons ── */}
        <GroupHeader title={TXT.usable} />
        {coupons.isError ? (
          <ErrorRow onRetry={() => void coupons.refetch()} />
        ) : usable.length === 0 && expiringSoon.length === 0 ? (
          <EmptyRow icon="pricetag-outline" message={t("loyalty.couponsIssuedEmpty")} />
        ) : (
          usable.map((c) => <CouponCard key={c.id} coupon={c} />)
        )}
      </ScrollView>
    </View>
  );
}

// ─── GroupHeader ───────────────────────────────────────────────────────────────

function GroupHeader({ title, tone, icon }: {
  title: string;
  tone?: "warn";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const color = tone === "warn" ? kit.color.warn : kit.color.ink;
  return (
    <View style={s.groupHeader}>
      {icon && <Ionicons name={icon} size={15} color={color} />}
      <UIText style={[s.groupTitle, { color }]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{title}</UIText>
    </View>
  );
}

// ─── CouponCard (owned) — code ready to use, expiry-aware ──────────────────────

function CouponCard({ coupon, expiring }: { coupon: Coupon; expiring?: boolean }) {
  const { t } = useTranslation();
  const days   = daysToExpiry(coupon.expires_at);
  const expiry = coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString("ar-EG") : null;
  const fg = expiring ? kit.color.warn : kit.color.success;
  const bg = expiring ? kit.color.warnTint : kit.color.successTint;
  return (
    <View
      style={[s.couponCard, expiring && { borderColor: kit.color.warn }]}
      accessibilityRole="text"
      accessibilityLabel={t("loyalty.couponA11y", {
        code: coupon.code,
        expiry: expiry ? t("loyalty.couponExpiryA11y", { date: expiry }) : "",
      })}>
      <View style={[s.codeBox, { backgroundColor: bg }]}>
        <UIText style={[s.codeText, { color: fg }]} selectable maxFontSizeMultiplier={1.2}>{coupon.code}</UIText>
      </View>
      <View style={s.couponBody}>
        <UIText style={s.couponLabel} maxFontSizeMultiplier={1.4}>{t("loyalty.couponLabel")}</UIText>
        {expiring && days !== null ? (
          <UIText style={[s.couponMeta, { color: kit.color.warn }]} maxFontSizeMultiplier={1.4}>{TXT.expiresInDays(days)}</UIText>
        ) : expiry ? (
          <UIText style={s.couponMeta} maxFontSizeMultiplier={1.4}>{t("loyalty.validUntil", { date: expiry })}</UIText>
        ) : null}
      </View>
      <View style={[s.statusPill, { backgroundColor: bg }]}>
        <UIText style={[s.statusPillText, { color: fg }]}>{expiring ? TXT.expiringPill : TXT.usablePill}</UIText>
      </View>
    </View>
  );
}

// ─── BatchAcquisitionCard — redeem points for a coupon ─────────────────────────

interface BatchCardProps {
  batch:          CouponBatch;
  currentBalance: number;
  isRedeeming:    boolean;
  onRedeem:       () => void;
}

function BatchAcquisitionCard({ batch, currentBalance, isRedeeming, onRedeem }: BatchCardProps) {
  const { t } = useTranslation();
  const canAfford = currentBalance >= batch.points_cost;
  const remaining = batch.total_supply ? Math.max(batch.total_supply - batch.issued_count, 0) : null;
  const lowStock  = remaining !== null && remaining > 0 && remaining < 20;
  const soldOut   = remaining !== null && remaining <= 0;
  const disabled  = isRedeeming || soldOut || !canAfford;

  const label = soldOut
    ? t("loyalty.redeemSoldOutLabel")
    : !canAfford
    ? t("loyalty.redeemInsufficientLabel")
    : t("loyalty.redeemLabel");

  return (
    <View style={s.batchCard}
          accessibilityLabel={t("loyalty.batchA11y", { name: batch.name, cost: batch.points_cost.toLocaleString("ar-EG") })}>
      <View style={s.batchHead}>
        <View style={s.discountBadge}>
          <UIText style={s.discountText} maxFontSizeMultiplier={1.2}>{formatDiscount(batch.discount_kind, batch.discount_value, t)}</UIText>
        </View>
        <View style={s.batchBody}>
          <UIText style={s.batchTitle} numberOfLines={2} maxFontSizeMultiplier={1.3}>{batch.name}</UIText>
          {batch.min_spend_cents != null && batch.min_spend_cents > 0 && (
            <UIText style={s.batchMeta} maxFontSizeMultiplier={1.4}>
              {t("loyalty.minSpendBatch", { amount: (batch.min_spend_cents / 100).toLocaleString("ar-EG") })}
            </UIText>
          )}
          {lowStock && <UIText style={[s.batchMeta, { color: kit.color.warn }]} maxFontSizeMultiplier={1.4}>{t("loyalty.lowStock", { n: remaining })}</UIText>}
          {soldOut  && <UIText style={[s.batchMeta, { color: kit.color.danger }]} maxFontSizeMultiplier={1.4}>{t("loyalty.soldOut")}</UIText>}
        </View>
      </View>

      <View style={s.batchFoot}>
        <View style={s.costWrap}>
          <Ionicons name="star" size={14} color={kit.color.accentDeep} />
          <UIText style={s.costText} maxFontSizeMultiplier={1.3}>{t("loyalty.costLabel", { n: batch.points_cost.toLocaleString("ar-EG") })}</UIText>
        </View>
        <Button
          label={label}
          variant="primary"
          size="sm"
          loading={isRedeeming}
          disabled={disabled}
          onPress={onRedeem}
          accessibilityLabel={t("loyalty.redeemBtnA11y", { name: batch.name, cost: batch.points_cost.toLocaleString("ar-EG") })}
        />
      </View>
    </View>
  );
}

// ─── Feedback rows (kit) ────────────────────────────────────────────────────────

function ListSkeleton({ rows }: { rows: number }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={s.skeletonRow} accessibilityLabel={t("common.loading")} />
      ))}
    </View>
  );
}

function EmptyRow({ icon, message }: { icon: React.ComponentProps<typeof Ionicons>["name"]; message: string }) {
  return (
    <View style={s.emptyRow} accessibilityRole="text" accessibilityLabel={message}>
      <Ionicons name={icon} size={20} color={kit.color.inkFaint} />
      <UIText style={s.emptyText} maxFontSizeMultiplier={1.5}>{message}</UIText>
    </View>
  );
}

function ErrorRow({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={s.errorRow}>
      <UIText style={s.errorText} maxFontSizeMultiplier={1.4}>{t("loyalty.recentLoadError")}</UIText>
      <PressableScale onPress={onRetry} scaleTo={0.96} accessibilityRole="button" accessibilityLabel={t("common.retry")} style={s.errorBtn}>
        <Ionicons name="refresh" size={13} color={kit.color.accentDeep} />
        <UIText style={s.errorBtnText}>{t("common.retry")}</UIText>
      </PressableScale>
    </View>
  );
}

// ─── Helpers (unchanged) ────────────────────────────────────────────────────────

function formatDiscount(kind: CouponDiscountKind, value: number, t: TFunc): string {
  switch (kind) {
    case "percent":       return `${value}%-`;
    case "flat":          return `${(value / 100).toLocaleString("ar-EG")} ج.م`;
    case "free_shipping": return t("loyalty.freeShipping");
    default:              return "";
  }
}

function decodeRedeemError(error: Error, t: TFunc): string {
  const m = error.message ?? "";
  if (m.includes("insufficient_balance")) return t("loyalty.redeemErrorInsufficientBalance");
  if (m.includes("batch_exhausted"))      return t("loyalty.redeemErrorBatchExhausted");
  if (m.includes("batch_expired"))        return t("loyalty.redeemErrorBatchExpired");
  if (m.includes("account_frozen"))       return t("loyalty.redeemErrorAccountFrozen");
  if (m.includes("not_authenticated"))    return t("loyalty.redeemErrorNotAuthenticated");
  return t("loyalty.redeemErrorDefault");
}

// ─── Styles (kit) ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: kit.color.canvas } });

const s = StyleSheet.create({
  scroll: { paddingBottom: 32, paddingHorizontal: theme.layout.pagePaddingH, gap: kit.sp(2) },

  balanceBar: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10, marginTop: kit.sp(2),
    padding: kit.sp(3), backgroundColor: kit.color.surface, borderRadius: kit.radius.card,
    borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised,
  },
  balanceIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.accentTint },
  balanceLabel: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 13, color: kit.color.inkSoft, textAlign: TEXT_START, includeFontPadding: false },
  balanceValue: { fontFamily: theme.fonts.black, fontSize: 18, color: kit.color.ink, includeFontPadding: false },

  groupHeader: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6, marginTop: kit.sp(4), marginBottom: kit.sp(1) },
  groupTitle: { fontFamily: theme.fonts.black, fontSize: kit.type.heading.fontSize, lineHeight: kit.type.heading.lineHeight, textAlign: TEXT_START, includeFontPadding: false },

  couponCard: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12, padding: kit.sp(3),
    backgroundColor: kit.color.surface, borderRadius: kit.radius.card, borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised,
  },
  codeBox: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: kit.radius.control, alignItems: "center", justifyContent: "center" },
  codeText: { fontFamily: theme.fonts.black, fontSize: 15, letterSpacing: 1, includeFontPadding: false },
  couponBody: { flex: 1, minWidth: 0, gap: 2 },
  couponLabel: { fontFamily: theme.fonts.bold, fontSize: 13, color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false },
  couponMeta:  { fontFamily: theme.fonts.regular, fontSize: 11, color: kit.color.inkFaint, textAlign: TEXT_START, includeFontPadding: false },
  statusPill:  { paddingHorizontal: 9, paddingVertical: 4, borderRadius: kit.radius.pill },
  statusPillText: { fontFamily: theme.fonts.bold, fontSize: 10, includeFontPadding: false },

  batchCard: {
    padding: kit.sp(3), backgroundColor: kit.color.surface, borderRadius: kit.radius.card,
    borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised, gap: kit.sp(3),
  },
  batchHead: { flexDirection: flexRow(IS_RTL), alignItems: "flex-start", gap: 12 },
  discountBadge: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: kit.radius.control, backgroundColor: kit.color.accentTint, alignItems: "center", justifyContent: "center" },
  discountText: { fontFamily: theme.fonts.black, fontSize: 15, color: kit.color.accentDeep, includeFontPadding: false },
  batchBody: { flex: 1, minWidth: 0, gap: 3 },
  batchTitle: { fontFamily: theme.fonts.bold, fontSize: 14, color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false },
  batchMeta:  { fontFamily: theme.fonts.regular, fontSize: 11, color: kit.color.inkFaint, textAlign: TEXT_START, includeFontPadding: false },
  batchFoot:  { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: kit.color.line, paddingTop: kit.sp(3) },
  costWrap:   { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6 },
  costText:   { fontFamily: theme.fonts.black, fontSize: 14, color: kit.color.ink, includeFontPadding: false },

  skeletonRow: { height: 96, borderRadius: kit.radius.card, backgroundColor: kit.color.well },
  emptyRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10, padding: kit.sp(4), backgroundColor: kit.color.surface, borderRadius: kit.radius.card, borderWidth: 1, borderColor: kit.color.line },
  emptyText: { flex: 1, fontFamily: theme.fonts.regular, fontSize: 13, color: kit.color.inkSoft, textAlign: TEXT_START, includeFontPadding: false },
  errorRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", gap: 10, padding: kit.sp(3), backgroundColor: kit.color.dangerTint, borderRadius: kit.radius.card },
  errorText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 12, color: kit.color.danger, textAlign: TEXT_START, includeFontPadding: false },
  errorBtn: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: kit.color.surface, borderRadius: kit.radius.pill },
  errorBtnText: { fontFamily: theme.fonts.bold, fontSize: 12, color: kit.color.accentDeep, includeFontPadding: false },
});

export default CouponsScreen;
