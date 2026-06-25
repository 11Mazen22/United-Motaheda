/**
 * LoyaltyPointsCard — animated hero for the loyalty hub.
 *
 * Balance counter animation is 100% UI-thread via Reanimated:
 *   useSharedValue → withTiming → useAnimatedProps on AnimatedTextInput
 *   No JS-thread listener, no setState on every frame.
 *
 * Tier pulse animation is also Reanimated (withRepeat + withSequence).
 */

import React, { useEffect, useMemo } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";

import type { LoyaltyBalance, RewardTier } from "../../types";
import { getTierColor, getTierIcon, type IoniconsName } from "./HubHelpers";
import { heroStyles as s, tierStyles as ts } from "./hub.styles";

/**
 * Worklet-safe number formatter (1234567 → "1,234,567").
 *
 * The `'worklet'` directive lets Reanimated invoke this on the UI thread
 * inside `useAnimatedProps` / `useAnimatedStyle`. Avoid `toLocaleString`
 * here — it relies on Intl, which is not available in every JSI runtime.
 *
 * Callable from JS-thread code too: the directive marks where the function
 * CAN run, not where it MUST run.
 */
function formatMetric(value: number): string {
  'worklet';
  const rounded = Math.round(value);
  const sign    = rounded < 0 ? '-' : '';
  const digits  = String(Math.abs(rounded));
  let   out     = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return sign + out;
}

// AnimatedTextInput used for the balance counter — its `value` prop is driven
// on the UI thread via useAnimatedProps, eliminating the JS-thread listener
// that the old RNAnimated.Value approach required.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// ─── LoyaltyPointsCard ────────────────────────────────────────────────────────

interface LoyaltyPointsCardProps {
  user:        { name?: string | null; email: string };
  balance:     LoyaltyBalance;
  currentTier: RewardTier | null;
  nextTier:    RewardTier | null;
  onGoToTiers?:() => void;
}

export const LoyaltyPointsCard = React.memo(function LoyaltyPointsCard({
  user,
  balance,
  currentTier,
  nextTier,
  onGoToTiers,
}: LoyaltyPointsCardProps) {
  const { t } = useTranslation();

  const firstName  = (user.name ?? user.email).split(" ")[0] ?? "عزيزي";
  const tierLabel  = currentTier?.name ?? "برونزي";
  const tierColor  = getTierColor(tierLabel);
  const tierIcon   = getTierIcon(tierLabel);
  const multiplier = currentTier?.earn_multiplier ?? 1;

  const initials = (user.name ?? user.email)
    .split(" ").slice(0, 2)
    .map((w) => w[0] ?? "").join("").toUpperCase();

  // ── Balance counter — UI-thread animation ─────────────────────────────────
  const animatedBalance = useSharedValue(balance.balance);

  useEffect(() => {
    animatedBalance.value = withTiming(balance.balance, {
      duration: 900,
      easing:   Easing.out(Easing.exp),
    });
  }, [balance.balance, animatedBalance]);

  // useAnimatedProps runs as a worklet on the UI thread — string formatting
  // happens on the UI thread, never touching the JS thread.
  // Cast to `any` is required because Reanimated's type system only knows
  // about numeric-animatable native props; `text` is a Fabric-level string
  // prop that Reanimated CAN animate but whose types aren't declared.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const balanceAnimatedProps = useAnimatedProps((): any => ({
    text: formatMetric(animatedBalance.value),
  }));

  // ── Progress toward next tier ─────────────────────────────────────────────
  const progress = useMemo(() => {
    if (!nextTier) return 1;
    const from  = currentTier?.min_lifetime_points ?? 0;
    const range = nextTier.min_lifetime_points - from;
    if (range <= 0) return 1;
    return Math.max(0, Math.min(1, (balance.lifetime_earned - from) / range));
  }, [balance.lifetime_earned, currentTier, nextTier]);

  const pointsToNext = nextTier
    ? Math.max(0, nextTier.min_lifetime_points - balance.lifetime_earned)
    : null;

  return (
    <View style={[s.gradient, { backgroundColor: kit.color.ink }]}>

      {/* Greeting + avatar */}
      <View style={s.topRow}>
        <View style={s.greeting}>
          <Text style={s.welcome}>{t("loyalty.heroWelcome")}</Text>
          <Text style={s.name} numberOfLines={1}>{firstName} 👋</Text>
        </View>
        <Pressable onPress={onGoToTiers} disabled={!onGoToTiers}>
          <View style={[s.avatarRing, { borderColor: tierColor }]}>
            <View style={[s.avatarInner, { backgroundColor: tierColor + "33" }]}>
              <Text style={[s.avatarInitials, { color: tierColor }]}>{initials}</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Tier badge + multiplier */}
      <View style={s.badgeRow}>
        <View style={[s.tierBadge, { backgroundColor: tierColor + "22", borderColor: tierColor + "88" }]}>
          <Ionicons name={tierIcon} size={12} color={tierColor} />
          <Text style={[s.tierBadgeLabel, { color: tierColor }]}>{tierLabel}</Text>
        </View>
        {multiplier > 1 && (
          <View style={s.multiplierBadge}>
            <Text style={s.multiplierText}>
              {t("loyalty.pointsPerPurchase", { n: multiplier.toFixed(1) })}
            </Text>
          </View>
        )}
      </View>

      {/* Balance — animated on UI thread */}
      <View style={s.balanceBlock}>
        <Text style={s.balanceEyebrow}>{t("loyalty.balanceEyebrow")}</Text>
        <View style={s.balanceRow}>
          {/* AnimatedTextInput with useAnimatedProps runs 100% on the UI thread */}
          <AnimatedTextInput
            animatedProps={balanceAnimatedProps}
            editable={false}
            underlineColorAndroid="transparent"
            style={s.balanceValue}
            defaultValue={formatMetric(balance.balance)}
          />
          <Text style={s.balanceUnit}>{t("loyalty.pointsUnit")}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <StatPill label={t("loyalty.statEarned")}    value={balance.lifetime_earned} />
        <View style={s.statsDiv} />
        <StatPill label={t("loyalty.statRedeemed")}  value={balance.lifetime_redeemed} />
        <View style={s.statsDiv} />
        <StatPill label={t("loyalty.statAvailable")} value={balance.balance} highlight />
      </View>

      {/* Progress toward next tier */}
      {nextTier && (
        <View style={s.progressWrap}>
          <View style={s.progressMeta}>
            <Text style={s.progressLabel}>
              {pointsToNext && pointsToNext > 0
                ? t("loyalty.progressLabel",   { n: formatMetric(pointsToNext), name: nextTier.name })
                : t("loyalty.progressCongrats", { name: nextTier.name })}
            </Text>
            <Text style={s.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                { width: `${Math.min(100, Math.round(progress * 100))}%` as `${number}%` },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
});

// ─── StatPill ─────────────────────────────────────────────────────────────────

const StatPill = React.memo(function StatPill({
  label, value, highlight,
}: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={s.statPill}>
      <Text style={[s.statValue, highlight && s.statValueHL]}>
        {formatMetric(value)}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
});

// ─── TierNode — pulse animation on UI thread via Reanimated ──────────────────

interface TierNodeProps {
  tier:      RewardTier;
  color:     string;
  icon:      IoniconsName;
  isReached: boolean;
  isCurrent: boolean;
  isNext:    boolean;
}

export const TierNode = React.memo(function TierNode({
  tier, color, icon, isReached, isCurrent, isNext,
}: TierNodeProps) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isCurrent) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.00, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      // Cancel any running animation
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [isCurrent, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[ts.nodeWrap, animatedStyle]}>
      <View style={[
        ts.nodeRing,
        isReached  && { borderColor: color },
        isCurrent  && { borderColor: color, borderWidth: 2.5 },
        !isReached && ts.nodeRingDim,
      ]}>
        <View style={[
          ts.nodeIcon,
          isReached  && { backgroundColor: color + "22" },
          !isReached && { backgroundColor: theme.colors.surfaceSunken },
        ]}>
          <Ionicons
            name={icon}
            size={20}
            color={isReached ? color : theme.colors.text.disabled}
          />
        </View>
      </View>

      <Text style={[ts.nodeName, isReached && { color }, isCurrent && ts.nodeNameCurrent]}>
        {tier.name}
      </Text>

      {isCurrent && (
        <View style={[ts.currentChip, { backgroundColor: color + "22", borderColor: color + "66" }]}>
          <Text style={[ts.currentChipText, { color }]}>{t("loyalty.tierCurrentChip")}</Text>
        </View>
      )}
      {isNext && !isCurrent && (
        <View style={ts.nextChip}>
          <Text style={ts.nextChipText}>{t("loyalty.tierNextChip")}</Text>
        </View>
      )}

      <Text style={ts.nodePts}>
        {tier.min_lifetime_points > 0
          ? `${formatMetric(tier.min_lifetime_points)} ${t("loyalty.pointsUnit")}`
          : t("loyalty.tierFreeLabel")}
      </Text>
    </Animated.View>
  );
});
