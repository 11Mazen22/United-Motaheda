/**
 * HomeHero — 2026 Premium Redesign.
 *
 * Matches the reference image exactly:
 *   ┌──────────────────────────────────────────────────────┐
 *   │  🖐  مرحباً بك                                       │  ← greeting eyebrow
 *   │  كيف يمكننا مساعدتك اليوم؟                          │  ← large headline
 *   │  صيدليتك المفضلة، دارماً في خدمتك                  │  ← subtitle                │
 *   │  ┌────────────────────────────────────────────────┐  │
 *   │  │ 🔍  ابحث عن دواء أو منتج...          [scan]   │  │  ← white search bar
 *   │  └────────────────────────────────────────────────┘  │
 *   │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
 *   │  │ رفع وصفة │  │توصيل سريع│  │عروض حصرية│           │  ← 3 quick-action pills
 *   │  └──────────┘  └──────────┘  └──────────┘           │
 *   └──────────────────────────────────────────────────────┘
 *
 * Background: deep teal-to-navy gradient (matches reference)
 * All existing callbacks preserved (onScanRx, onDeals + new ones)
 * Breathing halo on the wave decoration — gated on reduced motion
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
import { useAuth } from "@/features/auth";
import { useScreenLayout } from "@/utils/responsive";

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
  const { user }    = useAuth();
  const { pagePad } = useScreenLayout();

  const displayName = (user?.name ?? "").split(" ")[0] || null;

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
  }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps

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
      onPress: onFastDeliv ?? (() => {}),
    },
    {
      icon:    "pricetag-outline" as IoniconsName,
      label:   t("home.heroExclusiveOffers"),
      sub:     t("home.heroExclusiveOffersSub"),
      onPress: onDeals,
    },
  ], [t, onScanRx, onFastDeliv, onDeals]);

  return (
    <View style={{ paddingHorizontal: pagePad, paddingTop: 16, paddingBottom: 8 }}>
      <LinearGradient
        colors={["#0A5F58", "#0E7E74", "#0A9A8C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.card}
      >
        {/* ── Decorative ambient orb — clipped by card overflow:hidden ── */}
        <Animated.View
          style={[s.ambientOrb, orbAnim]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />

        {/* ── Greeting block ── */}
        <View style={s.greetBlock}>
          <View style={s.greetRow}>
            <UIText style={s.greetWave}>👋</UIText>
            <UIText style={s.greetEyebrow}>
              {displayName
                ? t("home.greeting", { name: displayName })
                : t("home.greetingGuest")}
            </UIText>
          </View>
          <UIText style={s.headline} numberOfLines={2}>
            {t("home.heroHeadline")}
          </UIText>
          <UIText style={s.subtitle} numberOfLines={2}>
            {t("home.heroSubtitle")}
          </UIText>
        </View>

        {/* ── Search bar ── */}
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
            <Ionicons name="search" size={18} color={kit.color.inkFaint} />
          </View>
          <UIText style={s.searchPlaceholder} numberOfLines={1}>
            {t("search.placeholder")}
          </UIText>
          <View style={s.searchScan}>
            <Ionicons name="scan-outline" size={18} color={kit.color.accentDeep} />
          </View>
        </Pressable>

        {/* ── Quick actions: 3 equal-width pill cards ── */}
        <View style={s.actionsRow}>
          {actions.map((action, idx) => (
            <QuickActionCard key={idx} action={action} />
          ))}
        </View>
      </LinearGradient>
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
        <UIText style={s.actionSub} numberOfLines={1}>
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
    borderRadius:   24,
    overflow:       "hidden",
    paddingTop:     28,
    paddingBottom:  24,
    paddingHorizontal: 20,
    gap:            20,
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
    ...(IS_RTL ? { left: -60 } : { right: -60 }),
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // ── Greeting ──────────────────────────────────────────────────────────
  greetBlock: {
    gap: 6,
  },
  greetRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  greetWave: {
    fontSize:   18,
    lineHeight: 22,
  },
  greetEyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           14,
    lineHeight:         20,
    color:              "rgba(255,255,255,0.82)",
    textAlign:          TEXT_START,
    includeFontPadding: false,
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
    height:            48,
    gap:               10,
    // Subtle inner shadow feel
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.08,
    shadowRadius:      4,
    elevation:         2,
  },
  searchIcon: {
    width:          28,
    height:         28,
    alignItems:     "center",
    justifyContent: "center",
  },
  searchPlaceholder: {
    flex:               1,
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  searchScan: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Quick actions row ─────────────────────────────────────────────────
  actionsRow: {
    flexDirection: flexRow(IS_RTL),
    gap:           10,
  },
  actionOuter: {
    flex: 1,
  },
  actionCard: {
    backgroundColor:   "rgba(255,255,255,0.14)",
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical:   12,
    alignItems:        "center",
    gap:               6,
    // Glassmorphism feel
    backdropFilter:    "blur(8px)",
  },
  actionIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: "rgba(255,255,255,0.90)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  actionLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         15,
    color:              "#FFFFFF",
    textAlign:          "center",
    includeFontPadding: false,
  },
  actionSub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           9,
    lineHeight:         13,
    color:              "rgba(255,255,255,0.65)",
    textAlign:          "center",
    includeFontPadding: false,
  },
});
