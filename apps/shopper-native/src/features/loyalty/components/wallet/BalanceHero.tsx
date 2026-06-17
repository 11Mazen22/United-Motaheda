/**
 * BalanceHero — animated balance card for the Loyalty Wallet.
 *
 * Animation migration (C-1 fix):
 *   BEFORE: RNAnimated.Value + addListener + setState + useNativeDriver:false
 *           → every frame tick drove a JS-thread setState → re-render cascade
 *   AFTER:  Reanimated useSharedValue + withTiming + useAnimatedProps on
 *           AnimatedTextInput → 100 % UI-thread, zero JS-thread involvement
 */

import React, { memo, useEffect } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import type { LoyaltyBalance, RewardTier } from "../../types";
import {
  heroStyles as s,
  AnimatedTextInput,
} from "./wallet.styles";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Tier helpers (pure, no React) ────────────────────────────────────────────

function getTierIcon(name: string): IoniconsName {
  const n = name.toLowerCase();
  if (n.includes("بلاتين") || n.includes("plat")) return "diamond-outline";
  if (n.includes("ذهب")   || n.includes("gold")) return "trophy-outline";
  if (n.includes("فضي")   || n.includes("silv")) return "medal-outline";
  return "star-outline";
}

function getTierColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("بلاتين") || n.includes("plat")) return "#E5E4E2";
  if (n.includes("ذهب")   || n.includes("gold")) return theme.colors.amber[500];
  if (n.includes("فضي")   || n.includes("silv")) return theme.colors.slate[400];
  return "#CD7F32"; // bronze — no theme token, intentional brand colour
}

// ─── BalanceHero ──────────────────────────────────────────────────────────────

interface BalanceHeroProps {
  balance:     LoyaltyBalance;
  currentTier: RewardTier | null;
  nextTier:    RewardTier | null;
  progress:    number; // 0–1
}

export const BalanceHero = memo(function BalanceHero({
  balance,
  currentTier,
  nextTier,
  progress,
}: BalanceHeroProps) {
  const { t } = useTranslation();

  const tierLabel = currentTier?.name ?? "برونزي";
  const tierIcon  = getTierIcon(tierLabel);
  const tierColor = getTierColor(tierLabel);

  const pointsToNext = nextTier
    ? nextTier.min_lifetime_points - balance.lifetime_earned
    : null;

  // ── Balance counter — 100 % UI thread ───────────────────────────────────────
  // Reanimated worklet: no JS-thread listener, no setState on each frame tick.
  const animatedBalance = useSharedValue(balance.balance);

  useEffect(() => {
    animatedBalance.value = withTiming(balance.balance, {
      duration: 800,
      easing:   Easing.out(Easing.exp),
    });
  }, [balance.balance, animatedBalance]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const balanceAnimatedProps = useAnimatedProps((): any => ({
    text: Math.round(animatedBalance.value).toLocaleString("ar-EG"),
  }));

  return (
    <View style={s.wrap}>
      <View style={[s.card, { backgroundColor: kit.color.ink }]}>

        {/* Tier badge + multiplier */}
        <View style={s.topRow}>
          <View style={[s.tierBadge, { backgroundColor: tierColor + "33", borderColor: tierColor }]}>
            <Ionicons name={tierIcon} size={13} color={tierColor} />
            <Text style={[s.tierBadgeText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
          <View style={s.multiplierBadge}>
            <Text style={s.multiplierText}>
              {t("loyalty.walletMultiplier", { n: (currentTier?.earn_multiplier ?? 1).toFixed(1) })}
            </Text>
          </View>
        </View>

        {/* Balance — UI-thread animated via Reanimated useAnimatedProps */}
        <View style={s.balanceCenter}>
          <Text style={s.balanceEyebrow}>{t("loyalty.walletCurrentBalance")}</Text>
          <View style={s.balanceRow}>
            <AnimatedTextInput
              animatedProps={balanceAnimatedProps}
              editable={false}
              underlineColorAndroid="transparent"
              style={s.balanceValue}
              defaultValue={balance.balance.toLocaleString("ar-EG")}
            />
            <Text style={s.balanceUnit}>{t("loyalty.pointsUnit")}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <StatChip label={t("loyalty.walletTotalEarned")}   value={balance.lifetime_earned} />
          <View style={s.statsSep} />
          <StatChip label={t("loyalty.walletTotalRedeemed")} value={balance.lifetime_redeemed} />
        </View>

        {/* Next-tier progress bar */}
        {nextTier && (
          <View style={s.progressSection}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>
                {pointsToNext && pointsToNext > 0
                  ? t("loyalty.walletPointsToNext", {
                      n:    pointsToNext.toLocaleString("ar-EG"),
                      name: nextTier.name,
                    })
                  : t("loyalty.walletReachedTier", { name: nextTier.name })}
              </Text>
              <Text style={s.progressPct}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  { width: `${Math.min(100, progress * 100)}%` as `${number}%` },
                ]}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

// ─── StatChip ─────────────────────────────────────────────────────────────────

export const StatChip = memo(function StatChip({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View
      style={s.statChip}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.statChipValue}>{value.toLocaleString("ar-EG")}</Text>
      <Text style={s.statChipLabel}>{label}</Text>
    </View>
  );
});
