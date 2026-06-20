/**
 * HomeHero — Tier-1 personalised hero card (2026 reimagining).
 *
 * Single above-the-fold focal point that replaces the old PromoBanner +
 * QuickActions + TrustStrip triple. One clear hierarchy:
 *
 *   ┌───────────────────────────────────────────┐
 *   │  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ (accent rail)        │
 *   │  EYEBROW (live status)                    │
 *   │  Greeting line, name              [seal]  │
 *   │  Status row: orders · rx · points         │
 *   │  ───────── hairline ──────────            │
 *   │  ⌬ Scan Rx     ☷ Deals     ☎ Pharmacist  │
 *   └───────────────────────────────────────────┘
 *
 * For guests the status row collapses into a single value-prop line and the
 * loyalty pill is replaced by a "Sign in to save" affordance.
 *
 * Motion: breathing seal halo on a 3 s sine, gated on useReducedMotion.
 * Single floating shadow tier; nothing else on the page is allowed to feel
 * as heavy as this card.
 */

import React, { memo, useCallback, useEffect, useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useLoyaltyBalance } from "@/features/loyalty/hooks/useLoyaltyBalance";
import { useAuth } from "@/features/auth";
import { useOrders } from "@/features/orders/hooks/useOrders";
import { usePrescriptions } from "@/features/prescriptions/hooks/usePrescriptions";
import type { TFunction } from "i18next";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function greetingFor(now: Date, t: TFunction): string {
  const h = now.getHours();
  if (h >= 5 && h < 12)  return t("home.heroMorning");
  if (h >= 12 && h < 18) return t("home.heroDay");
  return t("home.heroEvening");
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface HomeHeroProps {
  onScanRx:   () => void;
  onDeals:    () => void;
  onLoyalty?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const HomeHero = memo(function HomeHero({
  onScanRx,
  onDeals,
  onLoyalty,
}: HomeHeroProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion() ?? false;
  const { user } = useAuth();
  const isAuthed = Boolean(user);
  const userName = user?.name ?? null;

  // Own data subscriptions — parent never re-renders for these
  const { data: loyalty } = useLoyaltyBalance(isAuthed);
  const { data: orders } = useOrders(user?.id);
  const prescriptions = usePrescriptions();

  const activeOrders = useMemo(
    () =>
      (orders ?? []).filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled",
      ).length,
    [orders],
  );

  const readyRx = useMemo(
    () => prescriptions.filter((p) => p.status === "ready").length,
    [prescriptions],
  );

  // ── Breathing halo on the seal ───────────────────────────────────────────
  const halo = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) {
      halo.value = 0.35;
      return;
    }
    halo.value = withRepeat(
      withTiming(0.75, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(halo);
  }, [reduced, halo]);

  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));

  // ── Greeting ─────────────────────────────────────────────────────────────
  const greeting = useMemo(() => greetingFor(new Date(), t), [t]);
  const displayName = (userName ?? "").split(" ")[0] || t("home.heroGuestDefault");

  // ── Status row content ───────────────────────────────────────────────────
  const statusItems = useMemo(() => {
    if (!isAuthed) {
      return [{ kind: "guest" as const, label: t("home.heroGuestPitch") }];
    }
    const items: Array<{ kind: "order" | "rx" | "points" | "calm"; label: string; icon: IoniconsName; tone: string }> = [];
    if (activeOrders > 0) {
      items.push({
        kind: "order",
        label: `${activeOrders} ${t("home.heroOrderActive")}`,
        icon: "cube-outline",
        tone: kit.color.success,
      });
    }
    if (readyRx > 0) {
      items.push({
        kind: "rx",
        label: `${readyRx} ${t("home.heroRxReady")}`,
        icon: "medkit-outline",
        tone: kit.color.warn,
      });
    }
    if (loyalty?.balance != null && loyalty.balance > 0) {
      items.push({
        kind: "points",
        label: `${loyalty.balance.toLocaleString()} ${t("home.heroPoints")}`,
        icon: "sparkles",
        tone: kit.color.accentDeep,
      });
    }
    if (items.length === 0) {
      items.push({
        kind: "calm",
        label: t("home.heroCalmMsg"),
        icon: "checkmark-circle-outline",
        tone: kit.color.accentDeep,
      });
    }
    return items;
  }, [isAuthed, activeOrders, readyRx, loyalty?.balance, t]);

  const sealLabel = t("home.heroSealLabel");

  return (
    <View style={s.wrap}>
      <View style={s.card}>
        {/* Accent rail */}
        <View style={s.rail} />

        {/* Top row: greeting stack + seal */}
        <View style={s.topRow}>
          <View style={s.greetStack}>
            <UIText style={s.eyebrow} numberOfLines={1}>
              {greeting}
            </UIText>
            <UIText style={s.displayName} numberOfLines={1}>
              {displayName}
            </UIText>
          </View>

          <Pressable
            onPress={isAuthed && onLoyalty ? onLoyalty : undefined}
            accessibilityRole={isAuthed && onLoyalty ? "button" : undefined}
            accessibilityLabel={sealLabel}
            style={s.sealWrap}>
            <Animated.View style={[s.sealHalo, haloStyle]} pointerEvents="none" />
            <View style={s.sealInner}>
              <Ionicons name="shield-checkmark" size={22} color={kit.color.accentDeep} />
            </View>
            <UIText style={s.sealLabel}>{sealLabel}</UIText>
          </Pressable>
        </View>

        {/* Status row — animates between order/rx/points/calm/guest */}
        <View style={s.statusWrap}>
          {statusItems.map((item, i) => {
            if (item.kind === "guest") {
              return (
                <View key={i} style={s.statusGuest}>
                  <UIText style={s.statusGuestText} numberOfLines={2}>
                    {item.label}
                  </UIText>
                </View>
              );
            }
            return (
              <View
                key={`${item.kind}-${i}`}
                style={[s.statusPill, { backgroundColor: item.tone + "12" }]}>
                <Ionicons name={item.icon} size={13} color={item.tone} />
                <UIText style={[s.statusPillText, { color: item.tone }]} numberOfLines={1}>
                  {item.label}
                </UIText>
              </View>
            );
          })}
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Primary action chips */}
        <View style={s.chipRow}>
          <HeroChip
            icon="scan-outline"
            label={t("home.heroScanRx")}
            primary
            onPress={onScanRx}
          />
          <HeroChip
            icon="compass-outline"
            label={t("home.heroExplore")}
            onPress={onDeals}
          />
        </View>
      </View>
    </View>
  );
});

// ─── HeroChip ────────────────────────────────────────────────────────────────

interface HeroChipProps {
  icon:    IoniconsName;
  label:   string;
  primary?: boolean;
  onPress: () => void;
}

const HeroChip = memo(function HeroChip({ icon, label, primary, onPress }: HeroChipProps) {
  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.chip,
        primary && s.chipPrimary,
        pressed && (primary ? s.chipPrimaryPressed : s.chipPressed),
      ]}>
      <Ionicons
        name={icon}
        size={18}
        color={primary ? kit.color.onAccent : kit.color.accentDeep}
      />
      <UIText
        style={[s.chipLabel, primary && s.chipLabelPrimary]}
        numberOfLines={1}>
        {label}
      </UIText>
      {primary && (
        <Ionicons
          name={FORWARD_CHEVRON}
          size={14}
          color={kit.color.onAccent}
        />
      )}
    </Pressable>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Outer page padding
  wrap: {
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingTop:        kit.sp(3),
    paddingBottom:     kit.sp(2),
  },

  // The hero card itself — only floating-shadow surface on the page
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
    paddingTop:      kit.sp(6),
    paddingBottom:   kit.sp(4),
    paddingHorizontal: kit.sp(5),
    gap:             kit.sp(4),
    overflow:        "hidden",
    ...kit.shadow.floating,
  },

  // Top accent rail
  rail: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    height:          4,
    backgroundColor: kit.color.accentDeep,
  },

  // Top row: greeting + seal
  topRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            kit.sp(3),
  },

  greetStack: {
    flex: 1,
    gap:  2,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    letterSpacing:      1.0,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  displayName: {
    fontFamily:         theme.fonts.black,
    fontSize:           26,
    lineHeight:         32,
    color:              kit.color.ink,
    letterSpacing:      -0.5,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Seal (trust badge with breathing halo)
  sealWrap: {
    width:          64,
    alignItems:     "center",
    gap:            2,
  },
  sealHalo: {
    position:        "absolute",
    top:             -3,
    width:           54,
    height:          54,
    borderRadius:    27,
    backgroundColor: kit.color.accentTint,
  },
  sealInner: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1.5,
    borderColor:     kit.color.accentDeep,
  },
  sealLabel: {
    fontFamily:         theme.fonts.black,
    fontSize:           9,
    lineHeight:         13,
    letterSpacing:      0.8,
    color:              kit.color.accentDeep,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },

  // Status row
  statusWrap: {
    flexDirection: flexRow(IS_RTL),
    flexWrap:      "wrap",
    gap:           8,
  },
  statusPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      kit.radius.pill,
  },
  statusPillText: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         15,
    includeFontPadding: false,
  },
  statusGuest: {
    paddingVertical: 2,
  },
  statusGuestText: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  divider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  kit.color.line,
    marginVertical:   2,
  },

  // Action chips
  chipRow: {
    flexDirection: flexRow(IS_RTL),
    gap:           8,
  },
  chip: {
    flex:              1,
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    height:            48,
    paddingHorizontal: 10,
    borderRadius:      kit.radius.lg,
    backgroundColor:   kit.color.well,
  },
  chipPressed: {
    backgroundColor: kit.color.accentTint,
  },
  chipPrimary: {
    backgroundColor: kit.color.accentDeep,
    ...kit.shadow.raised,
  },
  chipPrimaryPressed: {
    opacity: 0.88,
  },
  chipLabel: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         16,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
    flexShrink:         1,
  },
  chipLabelPrimary: {
    color: kit.color.onAccent,
  },
});
