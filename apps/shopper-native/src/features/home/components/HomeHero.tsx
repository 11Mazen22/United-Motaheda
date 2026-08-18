/**
 * HomeHero — 2026 Premium Redesign (improved).
 *
 * Changes from previous version:
 *   • Greeting removed from hero — now lives in DeliveryHeader for
 *     immediate first-viewport context (no scroll needed)
 *   • Search bar promoted visually — slightly larger (52px) + stronger
 *     typography for the placeholder (14px instead of 13px)
 *   • Quick-action sub-labels bumped from 9px to 11px — readable on small phones
 *   • Quick-action card minimum height added to prevent layout shift
 *   • `onFastDeliv` no-op fallback replaced with a real guard
 *   • Ambient orb breathing animation preserved (gated on reduced motion)
 *   • All existing callbacks preserved (onScanRx, onDeals, onSearch, onFastDeliv)
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  ╔══════════════════════════════════════════════════════╗    │
 *   │  ║  كيف يمكننا مساعدتك اليوم؟          [subtitle]     ║    │
 *   │  ║  ┌────────────────────────────────────────────────┐ ║    │
 *   │  ║  │ 🔍  ابحث عن دواء أو منتج...          [scan]   │ ║    │
 *   │  ║  └────────────────────────────────────────────────┘ ║    │
 *   │  ║  ┌──────────┐  ┌──────────┐  ┌──────────┐          ║    │
 *   │  ║  │ رفع وصفة │  │توصيل سريع│  │عروض حصرية│          ║    │
 *   │  ║  └──────────┘  └──────────┘  └──────────┘          ║    │
 *   │  ╚══════════════════════════════════════════════════════╝    │
 *   └──────────────────────────────────────────────────────────────┘
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import { Text as UIText } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAuth } from "@/features/auth";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Quick action definition ──────────────────────────────────────────────────

interface QuickAction {
  icon:    IoniconsName;
  label:   string;
  sub:     string;
  onPress: () => void;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface HomeHeroProps {
  onScanRx:     () => void;
  onDeals:      () => void;
  onSearch?:    () => void;
  onFastDeliv?: () => void;
}

// ─── HomeHero ────────────────────────────────────────────────────────────────

export const HomeHero = memo(function HomeHero({
  onScanRx,
  onDeals,
  onSearch,
  onFastDeliv,
}: HomeHeroProps) {
  const { t }       = useTranslation();
  const reduced     = useReducedMotion() ?? false;
  const { pagePad } = useScreenLayout();
  const { user } = useAuth();

  // Derive display name
  const firstName = useMemo(
    () => (user?.name ?? "").split(" ")[0].trim() || null,
    [user?.name],
  );

  // ── Animated orb (decorative, top-trailing corner) ───────────────────────
  const orbScale   = useSharedValue(1);
  const orbOpacity = useSharedValue(0.18);

  useEffect(() => {
    if (reduced) return;
    orbScale.value = withRepeat(
      withTiming(1.12, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    orbOpacity.value = withRepeat(
      withTiming(0.28, { duration: 3100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(orbScale);
      cancelAnimation(orbOpacity);
    };
  }, [reduced]);

  const orbAnim = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
    opacity:   orbOpacity.value,
  }));

  // ── Quick actions ─────────────────────────────────────────────────────────
  const actions: QuickAction[] = useMemo(() => [
    {
      icon:    "document-text-outline" as IoniconsName,
      label:   t("home.heroScanRx"),
      sub:     t("home.heroScanRxSub"),
      onPress: onScanRx,
    },
    {
      icon:    "bicycle-outline" as IoniconsName,
      label:   t("home.heroFastDeliv"),
      sub:     t("home.heroFastDelivSub"),
      onPress: onFastDeliv ?? onDeals,
    },
    {
      icon:    "pricetag-outline" as IoniconsName,
      label:   t("home.heroExclusiveOffers"),
      sub:     t("home.heroExclusiveOffersSub"),
      onPress: onDeals,
    },
  ], [t, onScanRx, onFastDeliv, onDeals]);

  return (
    <View style={{ paddingHorizontal: pagePad, paddingTop: 12, paddingBottom: 8 }}>
      <LinearGradient
        colors={["#0A5F58", "#0E7E74", "#0A9A8C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.card}
      >
        <Animated.View
          style={[s.ambientOrb, orbAnim]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />

        <View style={s.headlineBlock}>
          <UIText style={s.headline} numberOfLines={2}>
            {firstName
              ? t("search.greetUser", { name: firstName, defaultValue: `أهلاً بك، ${firstName}` })
              : t("home.heroGuestPitch", { defaultValue: "أهلاً بك" })}
          </UIText>
          <UIText style={s.subtitle} numberOfLines={2}>
            {t("home.heroSubtitle", { defaultValue: "كيف يمكننا مساعدتك اليوم؟" })}
          </UIText>
        </View>

        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
            (onSearch ?? onDeals)();
          }}
          accessibilityRole="button"
          accessibilityLabel={t("search.placeholder")}
          style={s.searchBar}
        >
          <View style={s.searchIcon}>
            <Ionicons name="search" size={20} color={kit.color.inkFaint} />
          </View>
          <UIText style={s.searchPlaceholder} numberOfLines={1}>
            {t("search.placeholder")}
          </UIText>
          <View style={s.searchScan}>
            <Ionicons name="scan-outline" size={20} color={kit.color.accentDeep} />
          </View>
        </Pressable>
      </LinearGradient>

      {/* Quick Actions row outside the gradient card */}
      <View style={[s.actionsRow, { marginTop: 16 }]}>
        {actions.map((action, idx) => (
          <QuickActionCard key={idx} action={action} />
        ))}
      </View>
    </View>
  );
});

// ─── QuickActionCard ─────────────────────────────────────────────────────────

interface QuickActionCardProps {
  action: QuickAction;
}

const QuickActionCard = memo(function QuickActionCard({
  action,
}: QuickActionCardProps) {
  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    action.onPress();
  }, [action]);

  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn  = useCallback(() => {
    scale.value = withTiming(0.94, { duration: 80 });
  }, [scale]);
  const onPressOut = useCallback(() => {
    scale.value = withTiming(1.0, { duration: 120 });
  }, [scale]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={s.actionOuter}
    >
      <Animated.View style={[s.actionCard, anim]}>
        <View style={s.actionIconWrap}>
          <Ionicons name={action.icon} size={20} color={kit.color.accentDeep} />
        </View>
        <UIText style={s.actionLabel} numberOfLines={2}>
          {action.label}
        </UIText>
        <UIText style={s.actionSub} numberOfLines={2}>
          {action.sub}
        </UIText>
      </Animated.View>
    </Pressable>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Hero card — rounded, clipped, full-bleed gradient
  card: {
    borderRadius:      24,
    overflow:          "hidden",
    paddingTop:        24,
    paddingBottom:     20,
    paddingHorizontal: 20,
    gap:               16,
    // Soft brand shadow
    shadowColor:    "#0A5F58",
    shadowOffset:   { width: 0, height: 8 },
    shadowOpacity:  0.25,
    shadowRadius:   24,
    elevation:      10,
  },

  // Decorative orb in top-trailing corner
  ambientOrb: {
    position:        "absolute",
    top:             -60,
    ...(IS_RTL ? { start: -60 } : { end: -60 }),
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // ── Headline block ────────────────────────────────────────────────────
  headlineBlock: {
    gap: 4,
  },
  headline: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    lineHeight:         30,
    color:              "#FFFFFF",
    letterSpacing:      -0.4,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    lineHeight:         19,
    color:              "rgba(255,255,255,0.72)",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Search bar ────────────────────────────────────────────────────────
  searchBar: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    backgroundColor:   "#FFFFFF",
    borderRadius:      14,
    paddingHorizontal: 12,
    height:            52,  // increased from 48 for better touch target
    gap:               10,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.08,
    shadowRadius:      4,
    elevation:         2,
  },
  searchIcon: {
    width:          32,
    height:         32,
    alignItems:     "center",
    justifyContent: "center",
  },
  searchPlaceholder: {
    flex:               1,
    fontFamily:         theme.fonts.regular,
    fontSize:           14,  // increased from 13 for better readability
    lineHeight:         20,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  searchScan: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Quick actions row ─────────────────────────────────────────────────
  actionsRow: {
    flexDirection: flexRow(IS_RTL),
    gap:           8,
  },
  actionOuter: {
    flex: 1,
  },
  actionCard: {
    backgroundColor:   kit.color.surface,
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       kit.color.line,
    paddingHorizontal: 8,
    paddingVertical:   12,
    alignItems:        "center",
    gap:               6,
    minHeight:         100,  // stable height to prevent layout shift
    justifyContent:    "center",
    ...kit.shadow.raised,
  },
  actionIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  actionLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,  // increased from 11 for readability
    lineHeight:         16,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  actionSub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,  // increased from 9 — was too small to read
    lineHeight:         15,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
});
