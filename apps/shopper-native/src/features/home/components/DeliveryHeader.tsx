/**
 * DeliveryHeader — 2026 Premium Redesign (improved).
 *
 * Changes from previous version:
 *   • Time-aware greeting (morning/afternoon/evening) with user first name
 *   • Cart shortcut removed — cart is already accessible via the tab bar,
 *     adding it here would be redundant and clutter the compact header
 *   • Props `cartCount` and `onCartPress` removed (were already suppressed)
 *   • Notification bell preserved with unread badge
 *   • Logo ring breath animation preserved
 *   • Clean RTL/LTR layout throughout
 *
 * Layout (RTL example):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  🟢 United Pharmacy   مرحباً، أحمد  [bell🔔]            │
 *   └──────────────────────────────────────────────────────────┘
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
  withTiming,
} from "react-native-reanimated";
import { Text as UIText } from "@pharmacy/ui-native";
import { AppLogo } from "@/shared/components/AppLogo";
import { flexRow, isRtl } from "@/utils/layout";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { useScreenLayout } from "@/utils/responsive";
import { useUnreadCount } from "@/features/notifications";
import { useAuth } from "@/features/auth";

const IS_RTL = isRtl();

// ── Time-of-day greeting key helper ────────────────────────────────────────────
function greetingKey(): "home.heroMorning" | "home.heroDay" | "home.heroEvening" {
  const h = new Date().getHours();
  if (h < 12) return "home.heroMorning";
  if (h < 18) return "home.heroDay";
  return "home.heroEvening";
}

interface DeliveryHeaderProps {
  insets:        { top: number };
  user:          { name?: string | null } | null;
  onNotifPress?: () => void;
}

export const DeliveryHeader = memo(function DeliveryHeader({
  insets,
  user: _user,
  onNotifPress,
}: DeliveryHeaderProps) {
  const { t }              = useTranslation();
  const reduced            = useReducedMotion() ?? false;
  const { isTablet, pagePad } = useScreenLayout();
  const { user: authUser } = useAuth();
  const unreadCount        = useUnreadCount(authUser?.id);

  // Derive display name once
  const firstName = useMemo(
    () => (authUser?.name ?? "").split(" ")[0].trim() || null,
    [authUser?.name],
  );

  // Greeting key is stable per mount (changes after midnight, fine for now)
  const greetKey = useMemo(() => greetingKey(), []);

  // Subtle logo ring breath
  const ringOpacity = useSharedValue(0.0);

  useEffect(() => {
    if (reduced) return;
    ringOpacity.value = withRepeat(
      withTiming(0.25, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(ringOpacity);
  }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const ringAnim = useAnimatedStyle(() => ({ opacity: ringOpacity.value }));

  const notifBadge = typeof unreadCount === "number" ? unreadCount : 0;

  return (
    <View
      style={[
        s.header,
        {
          paddingTop:        insets.top + (isTablet ? 14 : 10),
          paddingHorizontal: pagePad,
        },
      ]}
    >
      {/* ── Logo ── */}
      <View style={s.logoOuter}>
        {/* Breathing ring */}
        <Animated.View
          style={[s.logoRing, ringAnim]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
        <View style={s.logoWrap}>
          <AppLogo size={36} />
        </View>
      </View>

      {/* ── Greeting ── */}
      <View style={s.greetingBlock}>
        <UIText style={s.greetingText} numberOfLines={1}>
          {firstName
            ? t(greetKey, { defaultValue: "مرحباً" }) + "، " + firstName
            : t("home.heroGuestPitch", { defaultValue: "صيدليتك الموثوقة" })}
        </UIText>
      </View>

      {/* ── Spacer ── */}
      <View style={{ flex: 1 }} />

      {/* ── Action buttons ── */}
      <View style={s.actions}>
        {/* Notification bell */}
        {onNotifPress && (
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              onNotifPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("profile.notifications")}
            style={s.actionBtn}
          >
            <Ionicons name="notifications-outline" size={22} color={kit.color.ink} />
            {notifBadge > 0 && (
              <View style={s.notifBadge}>
                <UIText style={s.notifBadgeText}>
                  {notifBadge > 9 ? "9+" : notifBadge}
                </UIText>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    backgroundColor:  "#FFFFFF",
    paddingBottom:    12,
    flexDirection:    flexRow(IS_RTL),
    alignItems:       "center",
    gap:              10,
    // Hairline bottom border
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },

  // Logo outer: hosts breathing ring + logo tile
  logoOuter: {
    width:          48,
    height:         48,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  logoRing: {
    position:     "absolute",
    width:        48,
    height:       48,
    borderRadius: 16,
    borderWidth:  1.5,
    borderColor:  kit.color.accent,
  },
  logoWrap: {
    width:           42,
    height:          42,
    borderRadius:    14,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.accentDeep + "18",
  },

  // Greeting
  greetingBlock: {
    flexShrink: 1,
    minWidth:   0,
  },
  greetingText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },

  // Action buttons
  actions: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           4,
    flexShrink:    0,
  },
  actionBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.well,
  },

  // Notification badge
  notifBadge: {
    position:          "absolute",
    top:               6,
    end:               6,
    minWidth:          17,
    height:            17,
    borderRadius:      9,
    backgroundColor:   kit.color.danger,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 3,
    borderWidth:       2,
    borderColor:       "#FFFFFF",
  },
  notifBadgeText: {
    color:              "#FFFFFF",
    fontSize:           9,
    lineHeight:         11,
    fontFamily:         theme.fonts.black,
    includeFontPadding: false,
  },
});
