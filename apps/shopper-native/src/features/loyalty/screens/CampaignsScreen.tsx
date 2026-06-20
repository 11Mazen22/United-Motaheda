/**
 * CampaignsScreen — active reward campaigns with live countdown and
 * a rich empty state that guides users toward earning opportunities.
 */

import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenTrace } from "@/features/observability";
import { SubScreenHeader } from "../components/SubScreenHeader";
import { useActiveCampaigns } from "../hooks/useActiveCampaigns";
import type { RewardCampaign } from "../types";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Screen ──────────────────────────────────────────────────────────────────

export function CampaignsScreen() {
  useScreenTrace("loyalty-campaigns");
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const campaigns  = useActiveCampaigns();
  const refreshing = campaigns.isFetching && !campaigns.isLoading;

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void campaigns.refetch();
  }, [campaigns]);

  // ── Loading ───────────────────────────────────────────────────────────
  if (campaigns.isLoading) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.campaignsTitle")} subtitle={t("loyalty.campaignsSubtitle")} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={s.skeletonCard} />
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (campaigns.isError) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
        <SubScreenHeader title={t("loyalty.campaignsTitle")} subtitle={t("loyalty.campaignsSubtitle")} />
        <View style={s.centerPanel}>
          <View style={s.errorIconBox}>
            <Ionicons name="cloud-offline-outline" size={32} color={kit.color.inkFaint} />
          </View>
          <UIText style={s.errorTitle}>{t("loyalty.campaignsErrorTitle")}</UIText>
          <Pressable
            onPress={() => void campaigns.refetch()}
            accessibilityRole="button"
            style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.88 }]}>
            <Ionicons name="refresh" size={14} color="#fff" />
            <UIText style={s.retryBtnText}>{t("common.retry")}</UIText>
          </Pressable>
        </View>
      </View>
    );
  }

  const list = campaigns.data ?? [];

  return (
    <View style={[s.screen, { paddingTop: insets.top + 8 }]}>
      <SubScreenHeader title={t("loyalty.campaignsTitle")} subtitle={t("loyalty.campaignsSubtitle")} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
            accessibilityLabel={t("loyalty.campaignsRefreshA11y")}
          />
        }
        showsVerticalScrollIndicator={false}>

        {list.length === 0 ? (
          <RichEmptyState />
        ) : (
          <View style={{ gap: 12, marginTop: 4 }}>
            {list.map((c, idx) => (
              <Animated.View key={c.id} entering={FadeInDown.delay(idx * 60).duration(280)}>
                <CampaignCard campaign={c} />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── RichEmptyState ───────────────────────────────────────────────────────────

function RichEmptyState() {
  const { t }   = useTranslation();
  const router  = useRouter();
  const IS_RTL  = isRtl();

  const actions: { icon: IoniconsName; color: string; label: string; sub: string; route: string }[] = [
    {
      icon:   "bag-handle-outline",
      color:  kit.color.accent,
      label:  t("loyalty.campaignsActionEarn"),
      sub:    t("loyalty.campaignsActionEarnSub"),
      route:  "/(tabs)/products",
    },
    {
      icon:   "people-outline",
      color:  "#7C3AED",
      label:  t("loyalty.campaignsActionInvite"),
      sub:    t("loyalty.campaignsActionInviteSub"),
      route:  "/invite",
    },
    {
      icon:   "gift-outline",
      color:  kit.color.success,
      label:  t("loyalty.campaignsActionRewards"),
      sub:    t("loyalty.campaignsActionRewardsSub"),
      route:  "/gifts",
    },
  ];

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={s.emptyRoot}>
      {/* Illustration */}
      <View style={s.emptyIconWrap}>
        <View style={s.emptyIconOuter}>
          <View style={s.emptyIconInner}>
            <Ionicons name="megaphone-outline" size={36} color={kit.color.accent} />
          </View>
        </View>
        {/* Decorative dots */}
        <View style={[s.emptyDot, { top: 8,  right: 12, backgroundColor: kit.color.accentTint }]} />
        <View style={[s.emptyDot, { bottom: 12, left: 8, backgroundColor: kit.color.warnTint, width: 10, height: 10 }]} />
      </View>

      <UIText style={[s.emptyTitle, { textAlign: "center" }]}>
        {t("loyalty.campaignsEmpty")}
      </UIText>
      <UIText style={[s.emptyBody, { textAlign: "center" }]}>
        {t("loyalty.campaignsEmptyBody")}
      </UIText>

      {/* Action suggestions */}
      <UIText style={[s.emptyActionsLabel, { textAlign: textAlignStart(IS_RTL) }]}>
        {t("loyalty.campaignsEmptyActions")}
      </UIText>

      <View style={s.emptyActions}>
        {actions.map((a, idx) => (
          <Animated.View key={a.route} entering={FadeInDown.delay(120 + idx * 60).duration(260)}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                router.push(a.route as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => [s.actionCard, { flexDirection: flexRow(IS_RTL) }, pressed && { opacity: 0.86 }]}>
              <View style={[s.actionIconBox, { backgroundColor: a.color + "18" }]}>
                <Ionicons name={a.icon} size={20} color={a.color} />
              </View>
              <View style={s.actionText}>
                <UIText style={[s.actionLabel, { textAlign: textAlignStart(IS_RTL) }]}>{a.label}</UIText>
                <UIText style={[s.actionSub,   { textAlign: textAlignStart(IS_RTL) }]}>{a.sub}</UIText>
              </View>
              <Ionicons
                name={IS_RTL ? "chevron-back" : "chevron-forward"}
                size={16}
                color={kit.color.inkFaint}
              />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── CampaignCard ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: RewardCampaign }) {
  const { t }   = useTranslation();
  const IS_RTL  = isRtl();
  const countdown = useCountdown(campaign.ends_at);

  // Multiplier drives the accent color — higher = warmer
  const accentColor =
    campaign.multiplier >= 3 ? kit.color.danger :
    campaign.multiplier >= 2 ? kit.color.warn   :
    kit.color.accent;

  return (
    <View
      style={s.card}
      accessibilityRole="text"
      accessibilityLabel={`${campaign.name}, ${t("loyalty.tierEarnMultiplier", { n: campaign.multiplier })}`}>

      {/* ── Colored top band with multiplier ─────────────────────────── */}
      <View style={[s.cardBand, { backgroundColor: accentColor, flexDirection: flexRow(IS_RTL) }]}>
        <View style={s.bandMultBox}>
          <UIText style={s.bandMultNum}>{campaign.multiplier}</UIText>
          <UIText style={s.bandMultX}>×</UIText>
        </View>
        <View style={s.bandText}>
          <UIText style={[s.cardName, { textAlign: textAlignStart(IS_RTL) }]} numberOfLines={2}>
            {campaign.name}
          </UIText>
          {campaign.description ? (
            <UIText style={[s.cardDesc, { textAlign: textAlignStart(IS_RTL) }]} numberOfLines={2}>
              {campaign.description}
            </UIText>
          ) : null}
        </View>
      </View>

      {/* ── Meta chips ───────────────────────────────────────────────── */}
      <View style={[s.cardFoot, { flexDirection: flexRow(IS_RTL) }]}>
        {countdown && (
          <View style={[s.chip, { backgroundColor: kit.color.dangerTint, borderColor: `${kit.color.danger}25` }]}>
            <Ionicons name="timer-outline" size={11} color={kit.color.danger} />
            <UIText style={[s.chipText, { color: kit.color.danger }]}>{countdown}</UIText>
          </View>
        )}
        {campaign.min_purchase_cents != null && campaign.min_purchase_cents > 0 && (
          <View style={s.chip}>
            <Ionicons name="cart-outline" size={11} color={kit.color.inkFaint} />
            <UIText style={s.chipText}>
              {t("loyalty.minSpend", { amount: (campaign.min_purchase_cents / 100).toLocaleString() })}
            </UIText>
          </View>
        )}
        {campaign.category_restrictions && campaign.category_restrictions.length > 0 && (
          <View style={s.chip}>
            <Ionicons name="pricetag-outline" size={11} color={kit.color.inkFaint} />
            <UIText style={s.chipText} numberOfLines={1}>
              {campaign.category_restrictions.join(" · ")}
            </UIText>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(endsAt: string | null): string | null {
  const { t }  = useTranslation();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setLabel(t("loyalty.countdownEnded")); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      if (d > 0)      setLabel(t("loyalty.countdownDays",  { d }));
      else if (h > 0) setLabel(t("loyalty.countdownHours", { h }));
      else            setLabel(t("loyalty.countdownMins",  { m }));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [endsAt, t]);

  return label;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // Empty state
  emptyRoot: {
    paddingTop:  40,
    paddingBottom: 24,
    gap:         20,
  },
  emptyIconWrap: {
    alignItems:     "center",
    justifyContent: "center",
    height:         120,
  },
  emptyIconOuter: {
    width:           96,
    height:          96,
    borderRadius:    28,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     `${kit.color.accent}25`,
  },
  emptyIconInner: {
    width:           72,
    height:          72,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  emptyDot: {
    position:     "absolute",
    width:        14,
    height:       14,
    borderRadius: 7,
  },
  emptyTitle: {
    fontFamily:    theme.fonts.black,
    fontSize:      18,
    color:         kit.color.ink,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: theme.fonts.regular,
    fontSize:   14,
    color:      kit.color.inkSoft,
    lineHeight: 22,
    maxWidth:   300,
    alignSelf:  "center",
  },
  emptyActionsLabel: {
    fontFamily:    theme.fonts.black,
    fontSize:      14,
    color:         kit.color.ink,
    letterSpacing: -0.1,
    marginTop:     4,
  },
  emptyActions: { gap: 10 },

  // Action suggestion cards
  actionCard: {
    alignItems:      "center",
    gap:             12,
    backgroundColor: kit.color.surface,
    borderRadius:    16,
    padding:         14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  actionIconBox: {
    width:          44,
    height:         44,
    borderRadius:   13,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  actionText:  { flex: 1, gap: 2 },
  actionLabel: {
    fontFamily:    theme.fonts.black,
    fontSize:      14,
    color:         kit.color.ink,
    letterSpacing: -0.1,
  },
  actionSub: {
    fontFamily: theme.fonts.regular,
    fontSize:   12,
    color:      kit.color.inkFaint,
  },

  // Campaign card
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    18,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  cardBand: {
    padding:    16,
    gap:        14,
    alignItems: "flex-start",
  },
  bandMultBox: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "baseline",
    gap:               2,
    backgroundColor:   "rgba(255,255,255,0.22)",
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      12,
    flexShrink:        0,
  },
  bandMultNum: { fontFamily: theme.fonts.black, fontSize: 22, color: "#fff", writingDirection: "ltr" },
  bandMultX:   { fontFamily: theme.fonts.bold,  fontSize: 14, color: "rgba(255,255,255,0.80)" },
  bandText: { flex: 1, gap: 4 },
  cardName: {
    fontFamily:    theme.fonts.black,
    fontSize:      15,
    color:         "#fff",
    letterSpacing: -0.2,
    lineHeight:    22,
  },
  cardDesc: {
    fontFamily: theme.fonts.regular,
    fontSize:   12,
    color:      "rgba(255,255,255,0.72)",
    lineHeight: 17,
  },

  // Meta footer
  cardFoot: {
    flexWrap:   "wrap",
    gap:        8,
    padding:    12,
    borderTopWidth: 1,
    borderTopColor: kit.color.line,
  },
  chip: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.well,
    borderRadius:      8,
    paddingHorizontal: 9,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  chipText: {
    fontFamily: theme.fonts.bold,
    fontSize:   11,
    color:      kit.color.inkSoft,
  },

  // Center panel (error)
  centerPanel: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               12,
    paddingTop:        60,
  },
  errorIconBox: {
    width:           72,
    height:          72,
    borderRadius:    22,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  errorTitle: {
    fontFamily: theme.fonts.black,
    fontSize:   16,
    color:      kit.color.ink,
    textAlign:  "center",
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
  retryBtnText: { fontFamily: theme.fonts.black, fontSize: 13, color: "#fff" },
  skeletonCard: { height: 130, borderRadius: 18, backgroundColor: kit.color.well },
});

export default CampaignsScreen;
