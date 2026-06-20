/**
 * TiersScreen — premium tier ladder.
 *
 * Each tier card has:
 *   • Colored header band with icon, name, threshold, and multiplier badge
 *   • Per-tier benefits list (static lookup by sorted index)
 *   • Animated progress bar on the current tier card
 *   • Lock badge + reduced opacity for locked tiers
 *   • Pulsing ring animation on the current tier icon
 */

import React, { useCallback, useEffect } from "react";
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { useScreenTrace } from "@/features/observability";
import { SubScreenHeader } from "../components/SubScreenHeader";
import { useRewardTiers } from "../hooks/useRewardTiers";
import { useLoyaltyBalance } from "../hooks/useLoyaltyBalance";
import type { RewardTier } from "../types";

// ─── Per-tier design tokens (indexed by sorted display_order position) ────────

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type TierDef = {
  color:  string;
  icon:   IoniconsName;
};

// Fallback-safe: if API returns more tiers than defined here, the last entry repeats.
const TIER_DEFS: TierDef[] = [
  { color: "#CD7F32", icon: "shield-outline"  }, // 0 – Bronze
  { color: "#8BA7B5", icon: "shield-half"     }, // 1 – Silver
  { color: "#D4AF37", icon: "shield"          }, // 2 – Gold
  { color: "#9B59B6", icon: "diamond-outline" }, // 3 – Platinum
  { color: "#2980B9", icon: "diamond"         }, // 4 – Diamond
  { color: "#E74C3C", icon: "trophy"          }, // 5 – VIP
];

type BenefitDef = { icon: IoniconsName; key: string };

// Benefits indexed by sorted tier position (0 = lowest/entry tier).
// All tiers also get the base multiplier benefit added automatically.
const TIER_EXTRA_BENEFITS: BenefitDef[][] = [
  [{ icon: "pricetags-outline", key: "loyalty.tierBenefitWelcomeCoupons"    }],
  [{ icon: "pricetags-outline", key: "loyalty.tierBenefitExclusiveCoupons"  },
   { icon: "car-outline",       key: "loyalty.tierBenefitDiscountedShipping" }],
  [{ icon: "gift-outline",      key: "loyalty.tierBenefitBirthdayGift"      },
   { icon: "flash-outline",     key: "loyalty.tierBenefitPriorityOffers"    }],
  [{ icon: "ribbon-outline",      key: "loyalty.tierBenefitVipService"      },
   { icon: "trending-up-outline", key: "loyalty.tierBenefitVipPromotions"   }],
  [{ icon: "medal-outline",  key: "loyalty.tierBenefitPremiumProducts"      },
   { icon: "people-outline", key: "loyalty.tierBenefitPersonalPharmacist"   }],
  [{ icon: "infinite-outline", key: "loyalty.tierBenefitUnlimitedRewards"   },
   { icon: "trophy-outline",   key: "loyalty.tierBenefitPremiumProducts"    }],
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function TiersScreen() {
  useScreenTrace("loyalty-tiers");
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const tiers   = useRewardTiers();
  const balance = useLoyaltyBalance();

  const refreshing =
    (tiers.isFetching && !tiers.isLoading) ||
    (balance.isFetching && !balance.isLoading);

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void tiers.refetch();
    void balance.refetch();
  }, [tiers, balance]);

  if (tiers.isLoading) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.tiersTitle")} subtitle={t("loyalty.tiersSubtitle")} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={s.skeletonCard} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (tiers.isError) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.tiersTitle")} subtitle={t("loyalty.tiersSubtitle")} />
        <View style={s.errorPanel}>
          <View style={s.errorIconBox}>
            <Ionicons name="cloud-offline-outline" size={32} color={kit.color.inkFaint} />
          </View>
          <UIText style={s.errorTitle}>{t("loyalty.tiersErrorTitle")}</UIText>
          <Pressable
            onPress={() => void tiers.refetch()}
            accessibilityRole="button"
            style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.88 }]}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <UIText style={s.retryBtnText}>{t("common.retry")}</UIText>
          </Pressable>
        </View>
      </View>
    );
  }

  const sorted         = [...(tiers.data ?? [])].sort((a, b) => a.display_order - b.display_order);
  const lifetimeEarned = balance.data?.lifetime_earned ?? 0;

  let currentIdx = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (lifetimeEarned >= sorted[i].min_lifetime_points) { currentIdx = i; break; }
  }

  const currentTier = sorted[currentIdx] ?? null;
  const nextTier    = sorted[currentIdx + 1] ?? null;

  const progress =
    currentTier && nextTier
      ? Math.min(
          1,
          (lifetimeEarned - currentTier.min_lifetime_points) /
            (nextTier.min_lifetime_points - currentTier.min_lifetime_points),
        )
      : 1;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      <SubScreenHeader title={t("loyalty.tiersTitle")} subtitle={t("loyalty.tiersSubtitle")} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
            accessibilityLabel={t("loyalty.tiersRefreshA11y")}
          />
        }
        showsVerticalScrollIndicator={false}>

        {/* ── Current status banner ──────────────────────────────────── */}
        {currentTier && (
          <View style={[s.statusBanner, { flexDirection: flexRow(isRtl()) }]}>
            <View style={s.statusLeft}>
              <UIText style={s.statusLabel}>{t("loyalty.currentTierLabel")}</UIText>
              <UIText style={s.statusTierName}>{currentTier.name}</UIText>
            </View>
            {nextTier && (
              <View style={s.statusRight}>
                <UIText style={[s.statusHint, { textAlign: textAlignStart(isRtl()) }]}>
                  {t("loyalty.pointsToNextTier", {
                    n: Math.max(0, nextTier.min_lifetime_points - lifetimeEarned).toLocaleString(),
                  })}
                </UIText>
                <View style={s.statusTrack}>
                  <View style={[s.statusFill, { width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Tier cards ────────────────────────────────────────────── */}
        <View style={{ gap: 12, marginTop: 16 }}>
          {sorted.map((tier, idx) => {
            const isCurrent  = tier.id === currentTier?.id;
            const isUnlocked = lifetimeEarned >= tier.min_lifetime_points;
            const def        = TIER_DEFS[idx] ?? TIER_DEFS[TIER_DEFS.length - 1]!;
            const extras     = TIER_EXTRA_BENEFITS[idx] ?? [];
            const pointsLeft = isCurrent && nextTier
              ? Math.max(0, nextTier.min_lifetime_points - lifetimeEarned)
              : null;

            return (
              <TierCard
                key={tier.id}
                tier={tier}
                def={def}
                extras={extras}
                isCurrent={isCurrent}
                isUnlocked={isUnlocked}
                progress={isCurrent ? progress : 0}
                pointsLeft={pointsLeft}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── TierCard ────────────────────────────────────────────────────────────────

interface TierCardProps {
  tier:       RewardTier;
  def:        TierDef;
  extras:     BenefitDef[];
  isCurrent:  boolean;
  isUnlocked: boolean;
  progress:   number;
  pointsLeft: number | null;
}

const TierCard = React.memo(function TierCard({
  tier, def, extras, isCurrent, isUnlocked, progress, pointsLeft,
}: TierCardProps) {
  const { t }  = useTranslation();
  const IS_RTL = isRtl();

  const activeColor = isUnlocked ? def.color : "#A8B5C0";

  const scale = useSharedValue(1);
  useEffect(() => {
    if (!isCurrent) { scale.value = withTiming(1, { duration: 200 }); return; }
    scale.value = withRepeat(
      withSequence(
        withTiming(1.10, { duration: 850, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.00, { duration: 850, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [isCurrent, scale]);
  const iconAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View
      style={[
        s.card,
        isCurrent  && { borderColor: def.color, borderWidth: 2 },
        !isUnlocked && { opacity: 0.70 },
      ]}
      accessibilityRole="text"
      accessibilityLabel={t("loyalty.tierCardA11y", {
        name:   tier.name,
        points: tier.min_lifetime_points.toLocaleString(),
        mult:   tier.earn_multiplier,
      })}>

      {/* ── Colored header band ─────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: activeColor }]}>
        <View style={[s.headerLeft, { flexDirection: flexRow(IS_RTL) }]}>
          <Animated.View style={[s.headerIconBox, iconAnim]}>
            <Ionicons
              name={def.icon}
              size={22}
              color={isUnlocked ? "#fff" : "rgba(255,255,255,0.55)"}
            />
          </Animated.View>
          <View>
            <UIText style={s.headerName}>{tier.name}</UIText>
            <UIText style={s.headerThreshold}>
              {tier.min_lifetime_points > 0
                ? `${tier.min_lifetime_points.toLocaleString()} ${t("loyalty.pointsUnit")}+`
                : t("loyalty.tierFreeLabel")}
            </UIText>
          </View>
        </View>

        <View style={[s.headerRight, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.multBadge}>
            <UIText style={s.multNum}>{tier.earn_multiplier}</UIText>
            <UIText style={s.multX}>×</UIText>
          </View>
          {isCurrent && (
            <View style={s.currentPill}>
              <UIText style={s.currentPillText}>{t("loyalty.tierCurrentChip")}</UIText>
            </View>
          )}
          {!isUnlocked && !isCurrent && (
            <View style={s.lockPill}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.75)" />
            </View>
          )}
        </View>
      </View>

      {/* ── Card body ───────────────────────────────────────────────── */}
      <View style={s.body}>
        <UIText style={[s.benefitsTitle, { textAlign: textAlignStart(IS_RTL) }]}>
          {t("loyalty.tierBenefitsTitle")}
        </UIText>

        {/* Base multiplier row */}
        <BenefitRow
          icon="star"
          label={t("loyalty.tierEarnMultiplier", { n: tier.earn_multiplier })}
          color={activeColor}
          isUnlocked={isUnlocked}
        />

        {/* Per-tier extras */}
        {extras.map((b) => (
          <BenefitRow key={b.key} icon={b.icon} label={t(b.key)} color={activeColor} isUnlocked={isUnlocked} />
        ))}

        {/* Progress toward next tier (only on current) */}
        {isCurrent && pointsLeft !== null && pointsLeft > 0 && (
          <View style={s.progressSection}>
            <View style={[s.progressMeta, { flexDirection: flexRow(IS_RTL) }]}>
              <UIText style={[s.progressHint, { flex: 1, textAlign: textAlignStart(IS_RTL) }]}>
                {t("loyalty.pointsToNextTier", { n: pointsLeft.toLocaleString() })}
              </UIText>
              <UIText style={s.progressPct}>{Math.round(progress * 100)}%</UIText>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { backgroundColor: def.color, width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
            </View>
          </View>
        )}

        {/* Max tier or tier reached congrats */}
        {isCurrent && (pointsLeft === null || pointsLeft <= 0) && (
          <View style={[s.maxBanner, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="checkmark-circle" size={14} color={def.color} />
            <UIText style={[s.maxBannerText, { color: def.color, flex: 1, textAlign: textAlignStart(IS_RTL) }]}>
              {t("loyalty.progressCongrats", { name: tier.name })}
            </UIText>
          </View>
        )}
      </View>
    </View>
  );
});

// ─── BenefitRow ──────────────────────────────────────────────────────────────

const BenefitRow = React.memo(function BenefitRow({
  icon, label, color, isUnlocked,
}: { icon: IoniconsName; label: string; color: string; isUnlocked: boolean }) {
  const IS_RTL = isRtl();
  return (
    <View style={[s.benefitRow, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={[s.benefitIconBox, { backgroundColor: isUnlocked ? color + "18" : kit.color.well }]}>
        <Ionicons name={icon} size={13} color={isUnlocked ? color : kit.color.inkFaint} />
      </View>
      <UIText
        numberOfLines={1}
        style={[
          s.benefitLabel,
          { textAlign: textAlignStart(IS_RTL) },
          !isUnlocked && { color: kit.color.inkFaint },
        ]}>
        {label}
      </UIText>
    </View>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // Status banner
  statusBanner: {
    alignItems:      "center",
    justifyContent:  "space-between",
    marginTop:       4,
    backgroundColor: kit.color.surface,
    borderRadius:    16,
    padding:         16,
    gap:             16,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  statusLeft: { gap: 3 },
  statusLabel: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    textAlign:          textAlignStart(isRtl()),
    includeFontPadding: false,
  },
  statusTierName: {
    fontFamily:         theme.fonts.black,
    fontSize:           19,
    lineHeight:         24,
    color:              kit.color.ink,
    textAlign:          textAlignStart(isRtl()),
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  statusRight: { flex: 1, gap: 6 },
  statusHint: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  statusTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: kit.color.well,
    overflow:        "hidden",
  },
  statusFill: {
    height:          "100%",
    borderRadius:    3,
    backgroundColor: kit.color.accent,
  },

  // Card
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    20,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },

  // Header band
  header: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:             10,
  },
  headerLeft: { alignItems: "center", gap: 12, flex: 1 },
  headerIconBox: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerName: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    lineHeight:         22,
    color:              "#fff",
    letterSpacing:      -0.2,
    textAlign:          textAlignStart(isRtl()),
    includeFontPadding: false,
  },
  headerThreshold: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              "rgba(255,255,255,0.65)",
    textAlign:          textAlignStart(isRtl()),
    writingDirection:   "ltr",
    fontVariant:        ["tabular-nums"],
    includeFontPadding: false,
  },
  headerRight: { alignItems: "center", gap: 6, flexShrink: 0 },
  multBadge: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "baseline",
    gap:               2,
    backgroundColor:   "rgba(255,255,255,0.22)",
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      12,
  },
  multNum: { fontFamily: theme.fonts.black, fontSize: 20, lineHeight: 26, color: "#fff", writingDirection: "ltr", includeFontPadding: false },
  multX:   { fontFamily: theme.fonts.bold,  fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.75)", includeFontPadding: false },
  currentPill: {
    backgroundColor:   "rgba(255,255,255,0.25)",
    borderRadius:      999,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  currentPillText: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    color:              "#fff",
    letterSpacing:      0.2,
    includeFontPadding: false,
  },
  lockPill: {
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius:    999,
    padding:         7,
  },

  // Body
  body: { padding: 16, gap: 10 },
  benefitsTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         14,
    letterSpacing:      0.8,
    textTransform:      "uppercase",
    color:              kit.color.inkFaint,
    marginBottom:       2,
    includeFontPadding: false,
  },

  // Benefit rows
  benefitRow:    { alignItems: "center", gap: 10 },
  benefitIconBox: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  benefitLabel: {
    flex:               1,
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.ink,
    includeFontPadding: false,
  },

  // Progress
  progressSection: { marginTop: 6, gap: 7 },
  progressMeta:    { alignItems: "center", justifyContent: "space-between" },
  progressHint: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  progressPct: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    writingDirection:   "ltr",
    fontVariant:        ["tabular-nums"],
    includeFontPadding: false,
  },
  progressTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: kit.color.well,
    overflow:        "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },

  // Max tier banner
  maxBanner: {
    alignItems:        "center",
    gap:               7,
    marginTop:         4,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  maxBannerText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         18,
    includeFontPadding: false,
  },

  // Error + skeleton
  errorPanel: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  errorIconBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: kit.color.well,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  errorTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           16,
    lineHeight:         22,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  retryBtn: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               8,
    backgroundColor:   kit.color.accent,
    borderRadius:      12,
    paddingHorizontal: 18,
    paddingVertical:   11,
    marginTop:         4,
    ...kit.shadow.raised,
  },
  retryBtnText: { fontFamily: theme.fonts.black, fontSize: 13, lineHeight: 18, color: "#fff", includeFontPadding: false },
  skeletonCard: { height: 170, borderRadius: 20, backgroundColor: kit.color.well },
});

export default TiersScreen;
