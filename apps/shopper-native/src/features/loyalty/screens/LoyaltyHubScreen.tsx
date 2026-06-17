/**
 * LoyaltyHubScreen — V2 dashboard rebuild (PRODUCT_BLUEPRINT §4.15).
 *
 * New information hierarchy (reward-first dashboard):
 *   balance hero → REDEEM (reward discovery, promoted to the top) → tier
 *   progress → campaigns → recent activity → ways to earn.
 *
 * Reward discovery (gifts / coupons / wallet / history) is now a prominent
 * action grid directly under the balance — not a nav row buried below tiers.
 * Data hooks, derived values, parallel-load architecture, and every nav
 * callback are preserved; only structure / hierarchy / presentation changed.
 */

import React, { useCallback, useMemo } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { Text as UIText } from "@/shared/ui";
import { Button } from "@/shared/kit";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { PressableScale } from "@/shared/motion";
import { useScreenTrace } from "@/features/observability";
import { useAuth } from "@/features/auth/context";

import { useLoyaltyBalance }  from "../hooks/useLoyaltyBalance";
import { useRewardTiers }     from "../hooks/useRewardTiers";
import { useActiveCampaigns } from "../hooks/useActiveCampaigns";
import { useLoyaltyHistory }  from "../hooks/useLoyaltyHistory";

import { SubScreenHeader }    from "../components/SubScreenHeader";
import { LoyaltyPointsCard }  from "../components/hub/LoyaltyPointsCard";
import { TierProgress }       from "../components/hub/TierProgress";
import { CampaignsBanner }    from "../components/hub/CampaignsBanner";
import { RecentActivity }     from "../components/hub/RecentActivity";
import { WaysToEarn }         from "../components/hub/WaysToEarn";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const REDEEM_TITLE = IS_RTL ? "استبدل نقاطك" : "Redeem your points";

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface LoyaltyHubScreenProps {
  onGoToWallet?:    () => void;
  onGoToCoupons?:   () => void;
  onGoToGifts?:     () => void;
  onGoToHistory?:   () => void;
  onGoToTiers?:     () => void;
  onGoToCampaigns?: () => void;
  onGoToInvite?:    () => void;
  onGoToShop?:      () => void;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export function LoyaltyHubScreen({
  onGoToWallet,
  onGoToCoupons,
  onGoToGifts,
  onGoToHistory,
  onGoToTiers,
  onGoToCampaigns,
  onGoToInvite,
  onGoToShop,
}: LoyaltyHubScreenProps) {
  useScreenTrace("loyalty-hub");
  const insets   = useSafeAreaInsets();
  const { t }    = useTranslation();
  const { user } = useAuth();
  const isAuthed = !!user;

  // ── All 4 queries mount simultaneously — true parallel fetching (unchanged) ──
  const balance   = useLoyaltyBalance(isAuthed);
  const tiers     = useRewardTiers(isAuthed);
  const campaigns = useActiveCampaigns(isAuthed);
  const history   = useLoyaltyHistory({ enabled: isAuthed });

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void balance.refetch();
    void tiers.refetch();
    void campaigns.refetch();
    void history.refetch();
  }, [balance, tiers, campaigns, history]);

  const refreshing = balance.isFetching && !balance.isLoading;

  // ── Derived data (unchanged) ──────────────────────────────────────────────
  const tierList = useMemo(
    () => [...(tiers.data ?? [])].sort((a, b) => a.min_lifetime_points - b.min_lifetime_points),
    [tiers.data],
  );
  const bal = balance.data ?? null;
  const currentTier = useMemo(
    () => (bal ? tierList.find((t) => t.id === bal.tier_id) ?? tierList[0] ?? null : null),
    [bal, tierList],
  );
  const nextTier = useMemo(
    () => (bal ? tierList.find((t) => t.min_lifetime_points > bal.lifetime_earned) ?? null : null),
    [bal, tierList],
  );
  const activeCampaigns = useMemo(
    () => (campaigns.data ?? []).filter((c) => c.is_active),
    [campaigns.data],
  );
  const recentEntries = useMemo(() => {
    const pages = history.data?.pages ?? [];
    return pages.flatMap((p) => p.entries).slice(0, 3);
  }, [history.data]);

  useFocusEffect(useCallback(() => () => blurActiveElementOnWeb(), []));

  // ── Header action — campaigns shortcut (kit) ──────────────────────────────
  const campaignsBadge = onGoToCampaigns ? (
    <Pressable
      onPress={onGoToCampaigns}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t("loyalty.hubCampaignsA11y")}
      style={s.campaignsBadge}>
      <Ionicons name="megaphone-outline" size={15} color={kit.color.accentDeep} />
      <UIText style={s.campaignsBadgeText}>{t("loyalty.hubCampaignsLabel")}</UIText>
    </Pressable>
  ) : undefined;

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <SubScreenHeader title={t("loyalty.hubTitle")} rightElement={campaignsBadge} />
        <UnauthPanel />
      </View>
    );
  }

  // ── Full-screen error (balance failed, no cache) ──────────────────────────
  if (balance.isError && !bal) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <SubScreenHeader title={t("loyalty.hubTitle")} rightElement={campaignsBadge} />
        <FullErrorPanel onRetry={onRefresh} />
      </View>
    );
  }

  // ── Main dashboard ────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <SubScreenHeader title={t("loyalty.hubTitle")} rightElement={campaignsBadge} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kit.color.accent} />
        }
        showsVerticalScrollIndicator={false}>

        {/* 1 — Balance hero (anchor) */}
        {balance.isLoading || !bal ? (
          <HeroSkeleton />
        ) : (
          <LoyaltyPointsCard
            user={user}
            balance={bal}
            currentTier={currentTier}
            nextTier={nextTier}
            onGoToTiers={onGoToTiers}
          />
        )}

        {/* 2 — REDEEM: reward discovery, promoted directly under the balance */}
        <RewardActions
          onGifts={onGoToGifts}
          onCoupons={onGoToCoupons}
          onWallet={onGoToWallet}
          onHistory={onGoToHistory}
        />

        {/* 3 — Tier journey */}
        {bal && (
          <TierProgress
            tiers={tierList}
            balance={bal}
            currentTier={currentTier}
            nextTier={nextTier}
            onGoToTiers={onGoToTiers}
          />
        )}

        {/* 4 — Campaigns (discovery) */}
        {(activeCampaigns.length > 0 || campaigns.isLoading) && (
          <CampaignsBanner
            campaigns={activeCampaigns}
            isLoading={campaigns.isLoading}
            onSeeAll={onGoToCampaigns}
          />
        )}

        {/* 5 — Recent activity */}
        <RecentActivity
          entries={recentEntries}
          isLoading={history.isLoading}
          isError={history.isError}
          onSeeAll={onGoToHistory}
          onRetry={() => void history.refetch()}
        />

        {/* 6 — Ways to earn (motivation) */}
        <WaysToEarn
          onInvite={onGoToInvite}
          onShop={onGoToShop}
          onCampaigns={onGoToCampaigns}
        />
      </ScrollView>
    </View>
  );
}

// ─── RewardActions — promoted reward-discovery grid (kit) ──────────────────────

function RewardActions({
  onGifts, onCoupons, onWallet, onHistory,
}: {
  onGifts?:   () => void;
  onCoupons?: () => void;
  onWallet?:  () => void;
  onHistory?: () => void;
}) {
  const { t } = useTranslation();
  const items: { icon: IoniconsName; label: string; onPress: () => void }[] = [
    onGifts   && { icon: "gift-outline"      as IoniconsName, label: t("loyalty.destGifts"),   onPress: onGifts },
    onCoupons && { icon: "pricetags-outline" as IoniconsName, label: t("loyalty.destCoupons"), onPress: onCoupons },
    onWallet  && { icon: "wallet-outline"    as IoniconsName, label: t("loyalty.destWallet"),  onPress: onWallet },
    onHistory && { icon: "time-outline"      as IoniconsName, label: t("loyalty.destHistory"), onPress: onHistory },
  ].filter(Boolean) as { icon: IoniconsName; label: string; onPress: () => void }[];

  if (items.length === 0) return null;

  return (
    <View style={s.section}>
      <UIText style={s.sectionTitle}>{REDEEM_TITLE}</UIText>
      <View style={s.grid}>
        {items.map((it) => (
          <PressableScale
            key={it.label}
            onPress={it.onPress}
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            style={s.actionCard}>
            <View style={s.actionIcon}>
              <Ionicons name={it.icon} size={22} color={kit.color.accentDeep} />
            </View>
            <UIText numberOfLines={1} style={s.actionLabel}>{it.label}</UIText>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

// ─── Panels (kit) ──────────────────────────────────────────────────────────────

function UnauthPanel() {
  const { t } = useTranslation();
  return (
    <View style={s.panel}>
      <View style={s.panelIcon}>
        <Ionicons name="lock-closed-outline" size={32} color={kit.color.accentDeep} />
      </View>
      <UIText style={s.panelTitle}>{t("loyalty.unauthTitle")}</UIText>
      <UIText style={s.panelBody}>{t("loyalty.unauthBody")}</UIText>
    </View>
  );
}

function FullErrorPanel({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={s.panel}>
      <View style={[s.panelIcon, { backgroundColor: kit.color.well }]}>
        <Ionicons name="cloud-offline-outline" size={32} color={kit.color.inkFaint} />
      </View>
      <UIText style={s.panelTitle}>{t("loyalty.hubErrorTitle")}</UIText>
      <UIText style={s.panelBody}>{t("loyalty.hubErrorBody")}</UIText>
      <Button
        label={t("common.retry")}
        icon="refresh"
        variant="primary"
        size="md"
        onPress={onRetry}
        style={{ marginTop: kit.sp(2) }}
      />
    </View>
  );
}

function HeroSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <View style={s.skeletonHero} />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <View style={s.skeletonRow} />
        <View style={{ flexDirection: flexRow(IS_RTL), gap: 8 }}>
          {[0, 1, 2].map((i) => <View key={i} style={s.skeletonCard} />)}
        </View>
        <View style={s.skeletonRow} />
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blurActiveElementOnWeb() {
  if (Platform.OS !== "web" || typeof globalThis === "undefined") return;
  const webDoc = (globalThis as unknown as {
    document?: { activeElement?: { blur?: () => void } };
  }).document;
  webDoc?.activeElement?.blur?.();
}

// ─── Styles (kit) ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: kit.color.canvas },

  campaignsBadge: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: kit.radius.pill,
    backgroundColor: kit.color.accentTint,
  },
  campaignsBadgeText: { fontFamily: theme.fonts.bold, fontSize: 12, color: kit.color.accentDeep },

  // Reward discovery
  section: { paddingHorizontal: theme.layout.pagePaddingH, paddingTop: kit.sp(5), gap: kit.sp(3) },
  sectionTitle: {
    fontFamily: theme.fonts.black, fontSize: kit.type.heading.fontSize,
    lineHeight: kit.type.heading.lineHeight, color: kit.color.ink,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  grid: { flexDirection: flexRow(IS_RTL), flexWrap: "wrap", gap: 10 },
  actionCard: {
    width: "47.8%", flexGrow: 1,
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12,
    paddingVertical: kit.sp(3), paddingHorizontal: kit.sp(3),
    backgroundColor: kit.color.surface, borderRadius: kit.radius.card,
    borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center", backgroundColor: kit.color.accentTint,
  },
  actionLabel: {
    flex: 1, fontFamily: theme.fonts.bold, fontSize: 13, color: kit.color.ink,
    textAlign: TEXT_START, includeFontPadding: false,
  },

  // Panels
  panel: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  panelIcon: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: kit.color.accentTint,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  panelTitle: {
    fontFamily: theme.fonts.black, fontSize: 17, color: kit.color.ink,
    textAlign: "center", letterSpacing: -0.3,
  },
  panelBody: {
    fontFamily: theme.fonts.regular, fontSize: 14, color: kit.color.inkSoft,
    textAlign: "center", lineHeight: 22, maxWidth: 280,
  },

  // Skeleton
  skeletonHero: { height: 220, marginHorizontal: 16, borderRadius: 24, backgroundColor: kit.color.well },
  skeletonRow:  { height: 56, borderRadius: 14, backgroundColor: kit.color.well },
  skeletonCard: { flex: 1, height: 80, borderRadius: 14, backgroundColor: kit.color.well },
});

export default LoyaltyHubScreen;
