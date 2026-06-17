/**
 * TiersScreen — shows the full tier ladder with the user's current position,
 * progress bar, perks, and earn multipliers.
 */

import React, { useCallback } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { theme } from "@/shared/theme";
import { useScreenTrace } from "@/features/observability";
import { SubScreenHeader } from "../components/SubScreenHeader";
import { useRewardTiers } from "../hooks/useRewardTiers";
import { useLoyaltyBalance } from "../hooks/useLoyaltyBalance";
import type { RewardTier } from "../types";

// Gradient pairs per display_order position (0-indexed)
const TIER_GRADIENTS: [string, string][] = [
  [theme.colors.amber[500],  theme.colors.amber[700]],
  [theme.colors.slate[400],  theme.colors.slate[600]],
  [theme.colors.amber[400],  theme.colors.amber[500]],
  [theme.colors.purple[500], theme.colors.purple[700]],
];

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TIER_ICONS: IoniconsName[] = [
  "shield-outline",
  "shield-half",
  "shield",
  "diamond",
];

export function TiersScreen() {
  useScreenTrace("loyalty-tiers");
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const tiers   = useRewardTiers();
  const balance = useLoyaltyBalance();

  const refreshing = (tiers.isFetching && !tiers.isLoading) || (balance.isFetching && !balance.isLoading);

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void tiers.refetch();
    void balance.refetch();
  }, [tiers, balance]);

  if (tiers.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.tiersTitle")} subtitle={t("loyalty.tiersSubtitle")} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[styles.tierCard, { minHeight: 120, backgroundColor: theme.colors.surfaceSunken }]} accessibilityLabel={t("common.loading")} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (tiers.isError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.tiersTitle")} subtitle={t("loyalty.tiersSubtitle")} />
        <View style={styles.errorPanel}>
          <Ionicons name="cloud-offline-outline" size={36} color={theme.colors.slate[400]} />
          <UIText style={styles.errorTitle} maxFontSizeMultiplier={1.4}>{t("loyalty.tiersErrorTitle")}</UIText>
          <Pressable
            onPress={() => void tiers.refetch()}
            accessibilityRole="button"
            accessibilityLabel={t("common.retry")}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="refresh" size={14} color="#fff" />
            <UIText style={styles.primaryBtnText}>{t("common.retry")}</UIText>
          </Pressable>
        </View>
      </View>
    );
  }

  const sorted          = [...(tiers.data ?? [])].sort((a, b) => a.display_order - b.display_order);
  const lifetimeEarned  = balance.data?.lifetime_earned ?? 0;
  const currentTierIdx  = findCurrentTierIndex(sorted, lifetimeEarned);
  const currentTier     = sorted[currentTierIdx];
  const nextTier        = sorted[currentTierIdx + 1] ?? null;
  const progress        = currentTier && nextTier
    ? Math.min(1, (lifetimeEarned - currentTier.min_lifetime_points) /
        (nextTier.min_lifetime_points - currentTier.min_lifetime_points))
    : 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <SubScreenHeader title={t("loyalty.tiersTitle")} subtitle={t("loyalty.tiersSubtitle")} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand[600]}
            accessibilityLabel={t("loyalty.tiersRefreshA11y")}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Current status chip */}
        {currentTier && (
          <View
            style={styles.statusChip}
            accessibilityRole="text"
            accessibilityLabel={t("loyalty.currentTierA11y", { name: currentTier.name })}
          >
            <View style={styles.statusLeft}>
              <UIText style={styles.statusLabel}>{t("loyalty.currentTierLabel")}</UIText>
              <UIText style={styles.statusTier}>{currentTier.name}</UIText>
            </View>
            {nextTier && (
              <View style={styles.statusProgress}>
                <UIText style={styles.statusProgressLabel} maxFontSizeMultiplier={1.3}>
                  {t("loyalty.pointsToNextTier", { n: Math.max(0, nextTier.min_lifetime_points - lifetimeEarned).toLocaleString("ar-EG") })}
                </UIText>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${progress * 100}%` }]}
                    accessibilityLabel={t("loyalty.progressPctA11y", { n: Math.round(progress * 100) })}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ gap: 10, marginTop: 16 }}>
          {sorted.map((tier, idx) => {
            const isCurrent  = tier.id === currentTier?.id;
            const isUnlocked = lifetimeEarned >= tier.min_lifetime_points;
            const gradient   = TIER_GRADIENTS[idx] ?? TIER_GRADIENTS[TIER_GRADIENTS.length - 1];
            const icon       = TIER_ICONS[idx] ?? "diamond";

            return (
              <TierCard
                key={tier.id}
                tier={tier}
                isCurrent={isCurrent}
                isUnlocked={isUnlocked}
                gradient={gradient}
                icon={icon}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Tier card ───────────────────────────────────────────────────────────────

interface TierCardProps {
  tier:       RewardTier;
  isCurrent:  boolean;
  isUnlocked: boolean;
  gradient:   [string, string];
  icon:       IoniconsName;
}

function TierCard({ tier, isCurrent, isUnlocked, gradient, icon }: TierCardProps) {
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.tierCard,
        isCurrent && { borderColor: gradient[0] + "60", borderWidth: 2 },
      ]}
      accessibilityRole="text"
      accessibilityLabel={t("loyalty.tierCardA11y", {
        name:   tier.name,
        points: tier.min_lifetime_points.toLocaleString("ar-EG"),
        mult:   tier.earn_multiplier,
      })}
    >
      <View
        style={[styles.tierIcon, { backgroundColor: isUnlocked ? gradient[0] : theme.colors.slate[100] }]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={isUnlocked ? "#fff" : theme.colors.slate[400]}
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.tierHead}>
          <UIText
            style={[styles.tierName, !isUnlocked && { color: theme.colors.slate[400] }]}
            maxFontSizeMultiplier={1.3}
          >
            {tier.name}
          </UIText>
          {isCurrent && (
            <View style={[styles.currentPill, { backgroundColor: gradient[0] + "18" }]}>
              <UIText style={[styles.currentPillText, { color: gradient[0] }]}>
                {t("loyalty.tierCurrentChip")}
              </UIText>
            </View>
          )}
          {!isUnlocked && !isCurrent && (
            <Ionicons name="lock-closed" size={12} color={theme.colors.slate[400]} />
          )}
        </View>

        <UIText style={[styles.tierPoints, !isUnlocked && { color: theme.colors.slate[400] }]} maxFontSizeMultiplier={1.4}>
          {t("loyalty.tierPointsEarned", { n: tier.min_lifetime_points.toLocaleString("ar-EG") })}
        </UIText>

        <View style={styles.multiplierRow}>
          <Ionicons
            name="star"
            size={12}
            color={isUnlocked ? theme.colors.amber[600] : theme.colors.slate[400]}
          />
          <UIText
            style={[styles.multiplierText, !isUnlocked && { color: theme.colors.slate[400] }]}
            maxFontSizeMultiplier={1.3}
          >
            {t("loyalty.tierEarnMultiplier", { n: tier.earn_multiplier })}
          </UIText>
        </View>
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findCurrentTierIndex(sorted: RewardTier[], lifetimeEarned: number): number {
  let idx = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (lifetimeEarned >= sorted[i].min_lifetime_points) {
      idx = i;
      break;
    }
  }
  return idx;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: theme.colors.bg,
  },

  statusChip: {
    backgroundColor:   theme.colors.surface,
    borderRadius:      16,
    padding:           16,
    marginTop:         4,
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    justifyContent:    "space-between",
    gap:               12,
    ...theme.shadow.card,
  },
  statusLeft: { gap: 2 },
  statusLabel: {
    fontFamily: theme.fonts.regular,
    fontSize:   11,
    color:      theme.colors.text.tertiary,
    textAlign:  textAlignStart(isRtl()),
  },
  statusTier: {
    fontFamily: theme.fonts.black,
    fontSize:   18,
    color:      theme.colors.text.primary,
    textAlign:  textAlignStart(isRtl()),
  },
  statusProgress: {
    flex: 1,
    gap:  6,
  },
  statusProgressLabel: {
    fontFamily: theme.fonts.bold,
    fontSize:   11,
    color:      theme.colors.text.secondary,
    textAlign:  textAlignStart(isRtl()),
  },
  progressTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: theme.colors.surfaceSunken,
    overflow:        "hidden",
  },
  progressFill: {
    height:          "100%",
    borderRadius:    3,
    backgroundColor: theme.colors.brand[600],
  },

  tierCard: {
    flexDirection:   flexRow(isRtl()),
    gap:             12,
    backgroundColor: theme.colors.surface,
    borderRadius:    14,
    padding:         14,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
  },
  tierIcon: {
    width:           48,
    height:          48,
    borderRadius:    14,
    alignItems:      "center",
    justifyContent:  "center",
  },
  tierHead: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    gap:            6,
    marginBottom:   4,
  },
  tierName: {
    fontFamily: theme.fonts.black,
    fontSize:   15,
    color:      theme.colors.text.primary,
  },
  currentPill: {
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  currentPillText: {
    fontFamily: theme.fonts.black,
    fontSize:   9,
  },
  tierPoints: {
    fontFamily: theme.fonts.regular,
    fontSize:   11,
    color:      theme.colors.text.secondary,
    textAlign:  textAlignStart(isRtl()),
    marginBottom: 4,
  },
  multiplierRow: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           4,
  },
  multiplierText: {
    fontFamily: theme.fonts.bold,
    fontSize:   11,
    color:      theme.colors.amber[700],
  },

  errorPanel: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               10,
  },
  errorTitle: {
    fontFamily: theme.fonts.black,
    fontSize:   16,
    color:      theme.colors.text.primary,
    marginTop:  8,
  },
  primaryBtn: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               8,
    backgroundColor:   theme.colors.brand[600],
    borderRadius:      12,
    paddingHorizontal: 18,
    paddingVertical:   11,
    marginTop:         8,
    ...theme.shadow.brand,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.black,
    fontSize:   13,
    color:      "#fff",
  },
});

export default TiersScreen;
