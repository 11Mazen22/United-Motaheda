/**
 * LoyaltyWalletScreen — V2 experience rebuild (PRODUCT_BLUEPRINT §4.15).
 *
 * New mental model — Balance → Rewards → Redemptions:
 *   balance hero → REWARDS (your usable coupons + browse the gift catalog) →
 *   REDEMPTIONS (gifts you've claimed) → activity access (full ledger + earn).
 *
 * The old 5-link "quick actions" soup is gone; every nav path it carried is
 * preserved and reorganised into the section the user is actually thinking
 * about. Data hooks (balance/coupons/redemptions/tiers), the wallet tour,
 * refresh, and tier math are unchanged.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { PressableScale } from "@/shared/motion";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useScreenTrace } from "@/features/observability";
import { useAuth } from "@/features/auth/context";
import { useLoyaltyBalance } from "../hooks/useLoyaltyBalance";
import { useUserCoupons }    from "../hooks/useUserCoupons";
import { useRedemptions }    from "../hooks/useRedemptions";
import { useRewardTiers }    from "../hooks/useRewardTiers";
import type { LoyaltyBalance, RewardTier } from "../types";
import { BalanceHero }               from "../components/wallet/BalanceHero";
import { WalletCouponsSection, SectionHeader } from "../components/wallet/WalletCouponsSection";
import { WalletRedemptionsSection }  from "../components/wallet/WalletRedemptionsSection";
import { WalletTourModal }           from "../components/wallet/WalletTourModal";
import {
  ScreenHeader,
  WalletSkeleton,
  ErrorPanel,
  UnauthPanel,
} from "../components/wallet/WalletSharedViews";

const TOUR_SEEN_KEY = "loyalty_tour_seen_v1";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
// Reuse the canonical directional constant so every loyalty screen reads from
// one source of truth (was: inline `IS_RTL ? "chevron-back" : "chevron-forward"`).
const FWD        = FORWARD_CHEVRON;

const TXT = IS_RTL
  ? { rewards: "مكافآتك", browseGifts: "تصفّح كتالوج الهدايا", browseGiftsSub: "استبدل نقاطك بهدايا", redemptions: "استبدالاتك", history: "سجل النقاط الكامل", earn: "اكسب المزيد من النقاط", frozen: "حسابك مجمّد مؤقتاً" }
  : { rewards: "Your rewards", browseGifts: "Browse the gift catalog", browseGiftsSub: "Trade points for gifts", redemptions: "Your redemptions", history: "Full points history", earn: "Earn more points", frozen: "Your account is temporarily frozen" };

export interface LoyaltyWalletScreenProps {
  title?:             string;
  onBrowseCoupons?:   () => void;
  onBrowseGifts?:     () => void;
  onViewHistory?:     () => void;
  onEarnPoints?:      () => void;
  onViewRedemptions?: () => void;
}

export function LoyaltyWalletScreen({
  title,
  onBrowseCoupons,
  onBrowseGifts,
  onViewHistory,
  onEarnPoints,
  onViewRedemptions,
}: LoyaltyWalletScreenProps) {
  useScreenTrace("loyalty-wallet");
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const { t }    = useTranslation();
  const isAuthed = !!user;

  const balance = useLoyaltyBalance(isAuthed);
  const coupons = useUserCoupons(isAuthed);
  const redeems = useRedemptions(isAuthed);
  const tiers   = useRewardTiers(isAuthed);

  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep,    setTourStep]    = useState(0);

  useEffect(() => {
    if (!isAuthed) return;
    AsyncStorage.getItem(TOUR_SEEN_KEY)
      .then((seen) => { if (!seen) setTourVisible(true); })
      .catch(() => {});
  }, [isAuthed]);

  const dismissTour = useCallback(async () => {
    setTourVisible(false);
    setTourStep(0);
    await AsyncStorage.setItem(TOUR_SEEN_KEY, "1").catch(() => {});
  }, []);

  const advanceTour = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setTourStep((stp) => {
      if (stp < 3) return stp + 1;
      void dismissTour();
      return stp;
    });
  }, [dismissTour]);

  const refreshing =
    (balance.isFetching && !balance.isLoading) ||
    (coupons.isFetching && !coupons.isLoading);

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void balance.refetch();
    void coupons.refetch();
    void redeems.refetch();
    void tiers.refetch();
  }, [balance, coupons, redeems, tiers]);

  const resolvedTitle = title ?? t("loyalty.walletTitle");

  if (!isAuthed) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader title={resolvedTitle} />
        <UnauthPanel />
      </View>
    );
  }
  if (balance.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader title={resolvedTitle} />
        <WalletSkeleton />
      </View>
    );
  }
  if (balance.isError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader title={resolvedTitle} />
        <ErrorPanel onRetry={onRefresh} />
      </View>
    );
  }

  const bal          = balance.data!;
  const tierList     = tiers.data ?? [];
  const currentTier  = tierList.find((tier) => tier.id === bal.tier_id) ?? null;
  const nextTier     = getNextTier(bal, tierList);
  const tierProgress = getTierProgress(bal, currentTier, nextTier);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <WalletTourModal visible={tourVisible} step={tourStep} onNext={advanceTour} onSkip={dismissTour} />
      <ScreenHeader title={resolvedTitle} onTourPress={() => setTourVisible(true)} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
            accessibilityLabel={t("loyalty.walletRefreshA11y")}
          />
        }
        showsVerticalScrollIndicator={false}>

        {/* ── BALANCE — what you have ── */}
        <BalanceHero balance={bal} currentTier={currentTier} nextTier={nextTier} progress={tierProgress} />

        {bal.frozen && (
          <View style={s.frozenBanner} accessibilityRole="alert">
            <Ionicons name="lock-closed" size={16} color={kit.color.danger} />
            <UIText style={s.frozenText}>{TXT.frozen}</UIText>
          </View>
        )}

        {/* ── REWARDS — what you can use / get ── */}
        <UIText style={s.groupTitle}>{TXT.rewards}</UIText>

        <SectionHeader title={t("loyalty.walletMyCoupons")} icon="pricetag-outline" onSeeAll={onBrowseCoupons} />
        <WalletCouponsSection
          isLoading={coupons.isLoading}
          isError={coupons.isError}
          coupons={coupons.data ?? []}
          onRetry={() => void coupons.refetch()}
          onBrowse={onBrowseCoupons}
        />

        {onBrowseGifts && (
          <PressableScale onPress={onBrowseGifts} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={TXT.browseGifts} style={s.browseCard}>
            <View style={s.browseIcon}><Ionicons name="gift-outline" size={22} color={kit.color.accentDeep} /></View>
            <View style={s.browseBody}>
              <UIText numberOfLines={1} style={s.browseTitle}>{TXT.browseGifts}</UIText>
              <UIText numberOfLines={1} style={s.browseSub}>{TXT.browseGiftsSub}</UIText>
            </View>
            <Ionicons name={FWD} size={18} color={kit.color.inkFaint} />
          </PressableScale>
        )}

        {/* ── REDEMPTIONS — what you've claimed ── */}
        <SectionHeader title={t("loyalty.walletPendingGifts")} icon="gift-outline" onSeeAll={onViewRedemptions} />
        <WalletRedemptionsSection
          isLoading={redeems.isLoading}
          isError={redeems.isError}
          redemptions={redeems.data ?? []}
          onRetry={() => void redeems.refetch()}
          onViewAll={onViewRedemptions}
        />

        {/* ── ACTIVITY access — full ledger + earn ── */}
        <View style={s.ledger}>
          {onViewHistory && <LedgerLink icon="time-outline"   label={TXT.history} onPress={onViewHistory} />}
          {onEarnPoints  && <LedgerLink icon="trending-up"    label={TXT.earn}    onPress={onEarnPoints} />}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── LedgerLink — compact utility row ──────────────────────────────────────────

function LedgerLink({
  icon, label, onPress,
}: {
  icon:    React.ComponentProps<typeof Ionicons>["name"];
  label:   string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={label} style={s.ledgerRow}>
      <View style={s.ledgerIcon}><Ionicons name={icon} size={18} color={kit.color.inkSoft} /></View>
      <UIText style={s.ledgerLabel}>{label}</UIText>
      <Ionicons name={FWD} size={16} color={kit.color.inkFaint} />
    </PressableScale>
  );
}

// ─── Tier helpers (unchanged) ──────────────────────────────────────────────────

function getNextTier(balance: LoyaltyBalance, tierList: RewardTier[]): RewardTier | null {
  if (!tierList.length) return null;
  const sorted = [...tierList].sort((a, b) => a.min_lifetime_points - b.min_lifetime_points);
  return sorted.find((t) => t.min_lifetime_points > balance.lifetime_earned) ?? null;
}

function getTierProgress(balance: LoyaltyBalance, current: RewardTier | null, next: RewardTier | null): number {
  if (!next) return 1;
  const from  = current?.min_lifetime_points ?? 0;
  const range = next.min_lifetime_points - from;
  if (range <= 0) return 1;
  return Math.max(0, Math.min(1, (balance.lifetime_earned - from) / range));
}

// ─── Styles (kit) ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },
});

const s = StyleSheet.create({
  frozenBanner: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8,
    marginHorizontal: theme.layout.pagePaddingH, marginTop: kit.sp(3),
    padding: kit.sp(3), backgroundColor: kit.color.dangerTint, borderRadius: kit.radius.control,
  },
  frozenText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 12, color: kit.color.danger, textAlign: TEXT_START, includeFontPadding: false },

  groupTitle: {
    fontFamily: theme.fonts.black, fontSize: kit.type.heading.fontSize, lineHeight: kit.type.heading.lineHeight,
    color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false,
    paddingHorizontal: theme.layout.pagePaddingH, paddingTop: kit.sp(5), paddingBottom: kit.sp(1),
  },

  browseCard: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12,
    marginHorizontal: theme.layout.pagePaddingH, marginTop: kit.sp(2),
    padding: kit.sp(3), backgroundColor: kit.color.surface, borderRadius: kit.radius.card,
    borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised,
  },
  browseIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.accentTint },
  browseBody: { flex: 1, minWidth: 0, gap: 2 },
  browseTitle: { fontFamily: theme.fonts.bold, fontSize: 14, color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false },
  browseSub:   { fontFamily: theme.fonts.regular, fontSize: 12, color: kit.color.inkFaint, textAlign: TEXT_START, includeFontPadding: false },

  ledger: { marginHorizontal: theme.layout.pagePaddingH, marginTop: kit.sp(5), gap: 8 },
  ledgerRow: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12,
    paddingVertical: kit.sp(3), paddingHorizontal: kit.sp(3),
    backgroundColor: kit.color.surface, borderRadius: kit.radius.control,
    borderWidth: 1, borderColor: kit.color.line,
  },
  ledgerIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.well },
  ledgerLabel: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 13, color: kit.color.ink, textAlign: TEXT_START, includeFontPadding: false },
});

export default LoyaltyWalletScreen;
