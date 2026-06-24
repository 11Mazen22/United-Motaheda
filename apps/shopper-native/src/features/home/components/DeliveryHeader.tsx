/**
 * DeliveryHeader — cinematic living header (2026 Ultra).
 *
 * Ambient system:
 *   • Depth orb — translucent tinted circle in the trailing corner; drifts
 *     ±12 px vertically on a 4 s sine wave. Clipped by overflow:hidden.
 *   • Logo ring — hairline ring around the logo tile that breathes in opacity
 *     (0.12 → 0.35 → 0.12) on a 2.5 s cycle. Very subtle.
 *   • Search glow — accentTint layer behind the search bar pulses to opacity 1
 *     for ~1.2 s every 5.4 s, giving the sense the bar is alive.
 *
 * All ambient motion is gated on useReducedMotion and cancelled on unmount.
 * Props / behaviour contract: unchanged from V3.
 */

import React, { memo, useEffect, useMemo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { AppLogo } from "@/shared/components/AppLogo";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { kit } from "@/shared/kit";
import { useScreenLayout } from "@/utils/responsive";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// Orb anchors: trailing corner per text direction
const ORB_POSITION = IS_RTL ? { left: -70 } : { right: -70 };

function getTimeIcon(): React.ComponentProps<typeof Ionicons>["name"] {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "sunny-outline";
  if (h >= 12 && h < 18) return "partly-sunny-outline";
  return "moon-outline";
}

interface DeliveryHeaderProps {
  insets:        { top: number };
  user:          { name?: string | null } | null;
  cartCount:     number;
  onCartPress:   () => void;
  onSearchPress: () => void;
  onNotifPress?: () => void;
}

export const DeliveryHeader = memo(function DeliveryHeader({
  insets,
  user,
  cartCount,
  onCartPress,
  onSearchPress,
  onNotifPress,
}: DeliveryHeaderProps) {
  const { t }              = useTranslation();
  const reduced            = useReducedMotion() ?? false;
  const timeIcon           = useMemo(() => getTimeIcon(), []);
  const { isTablet, pagePad } = useScreenLayout();

  // ── Ambient shared values ─────────────────────────────────────────────────
  const orbY              = useSharedValue(0);
  const logoRingOpacity   = useSharedValue(0.12);
  const searchGlowOpacity = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;

    // Depth orb: gentle vertical float
    orbY.value = withRepeat(
      withTiming(12, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    // Logo ring: slow breath
    logoRingOpacity.value = withRepeat(
      withTiming(0.35, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    // Search glow: brief pulse every ~5.4 s
    searchGlowOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 4200 }),   // hold quiet
        withTiming(1, { duration: 500  }),   // glow in
        withTiming(0, { duration: 700  }),   // glow out
      ),
      -1,
    );

    return () => {
      cancelAnimation(orbY);
      cancelAnimation(logoRingOpacity);
      cancelAnimation(searchGlowOpacity);
    };
  }, [reduced]);

  const orbAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: orbY.value }],
  }));
  const logoRingAnim = useAnimatedStyle(() => ({
    opacity: logoRingOpacity.value,
  }));
  const searchGlowAnim = useAnimatedStyle(() => ({
    opacity: searchGlowOpacity.value,
  }));

  const greeting = user?.name
    ? t("home.greeting",      { name: user.name.split(" ")[0] })
    : t("home.greetingGuest");

  return (
    <View style={[s.header, { paddingTop: insets.top + (isTablet ? 18 : 14), paddingHorizontal: pagePad }]}>

      {/* ── Ambient depth orb (clipped by overflow:hidden on header) ── */}
      <Animated.View
        style={[s.ambientOrb, ORB_POSITION, orbAnim]}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <View style={s.topBar}>

        {/* Logo with pulse ring */}
        <View style={s.logoOuter}>
          <Animated.View style={[s.logoRing, logoRingAnim]} />
          <View style={s.logoWrap}>
            <AppLogo size={40} />
          </View>
        </View>

        <View style={s.topActions}>
          {onNotifPress && (
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                onNotifPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={t("profile.notifications")}
              style={s.actionBtn}>
              <Ionicons name="notifications-outline" size={19} color="rgba(255,255,255,0.75)" />
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              onCartPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("tabs.cart")}
            style={s.cartBtn}>
            <Ionicons name="bag-outline" size={19} color="rgba(255,255,255,0.75)" />
            {cartCount > 0 && (
              <View style={s.cartBadge}>
                <UIText style={s.cartBadgeText}>{cartCount > 9 ? "9+" : cartCount}</UIText>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Compact greeting row (metric pills moved to HomeHero) ───────────── */}
      <View style={s.greetingRow}>
        <View style={s.greetingIconWrap}>
          <Ionicons name={timeIcon} size={12} color="#2DD4C0" />
        </View>
        <UIText style={s.greetingText}>{greeting}</UIText>
      </View>

      {/* ── Search bar with living glow ──────────────────────────────────────── */}
      <View style={s.searchOuter}>
        <Animated.View
          style={[s.searchGlowLayer, searchGlowAnim]}
          pointerEvents="none"
          accessibilityElementsHidden
        />
        <Pressable
          onPress={onSearchPress}
          accessibilityRole="button"
          accessibilityLabel={t("search.placeholder")}
          style={s.searchBar}>
          <View style={s.searchIconWrap}>
            <Ionicons name="search" size={17} color={kit.color.inkFaint} />
          </View>
          <UIText style={s.searchPlaceholder} numberOfLines={1}>
            {t("search.placeholder")}
          </UIText>
          <View style={[s.searchBadge, { backgroundColor: "#0E7E74" }]}>
            <Ionicons name="sparkles" size={13} color={kit.color.onInk} />
          </View>
        </Pressable>
      </View>

    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    backgroundColor: "#0A1220",
    paddingBottom:   kit.sp(3),
    overflow:        "hidden",   // clips the ambient orb
  },

  // Ambient orb — receives ORB_POSITION spread in JSX
  ambientOrb: {
    position:      "absolute",
    top:           -90,
    width:         250,
    height:        250,
    borderRadius:  125,
    backgroundColor: "rgba(14,126,116,0.14)",
    opacity:       1,
  },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   kit.sp(3),
  },

  // Logo: outer hosts the ring + inner tile
  logoOuter: {
    width:           60,
    height:          60,
    alignItems:      "center",
    justifyContent:  "center",
  },
  logoRing: {
    position:     "absolute",
    width:        60,
    height:       60,
    borderRadius: 20,
    borderWidth:  1.5,
    borderColor:  "rgba(45,212,192,0.32)",
  },
  logoWrap: {
    width:           48,
    height:          48,
    borderRadius:    16,
    backgroundColor: "#FFFFFF",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.12)",
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
    ...kit.shadow.raised,
  },

  topActions: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  actionBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.16)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  cartBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.16)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  cartBadge: {
    position:          "absolute",
    top:               -4,
    end:               -4,
    backgroundColor:   "#0E7E74",
    borderRadius:      9,
    minWidth:          18,
    height:            18,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 4,
    borderWidth:       1.5,
    borderColor:       "#0A1220",
  },
  cartBadgeText: {
    color:              kit.color.onInk,
    fontSize:           9,
    lineHeight:         12,
    fontFamily:         theme.fonts.black,
    includeFontPadding: false,
    textAlign:          "center",
  },

  // ── Greeting row ─────────────────────────────────────────────────────────
  greetingRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
    marginBottom:  kit.sp(3),
  },
  greetingIconWrap: {
    width:           26,
    height:          26,
    borderRadius:    9,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(45,212,192,0.14)",
  },
  greetingText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         18,
    color:              "rgba(255,255,255,0.60)",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  // ── Search bar ────────────────────────────────────────────────────────────
  searchOuter: {
    position: "relative",
  },
  searchGlowLayer: {
    position:     "absolute",
    top:          -3,
    left:         -3,
    right:        -3,
    bottom:       -3,
    borderRadius: kit.radius.pill + 3,
    backgroundColor: "rgba(14,126,116,0.12)",
  },
  searchBar: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               4,
    height:            60,
    paddingHorizontal: 8,
    backgroundColor:   "#FFFFFF",
    borderRadius:      kit.radius.pill,
    borderWidth:       1,
    borderColor:       "rgba(10,18,32,0.14)",
    ...kit.shadow.floating,
  },
  searchIconWrap: {
    width:           40,
    height:          40,
    alignItems:      "center",
    justifyContent:  "center",
  },
  searchPlaceholder: {
    flex:               1,
    fontSize:           14,
    lineHeight:         20,
    fontFamily:         theme.fonts.semibold,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  searchBadge: {
    width:          44,
    height:         44,
    borderRadius:   22,
    alignItems:     "center",
    justifyContent: "center",
  },

});
