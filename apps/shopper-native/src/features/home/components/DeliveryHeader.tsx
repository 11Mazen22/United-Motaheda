/**
 * DeliveryHeader — 2026 Premium Redesign.
 *
 * Matches the reference image exactly:
 *   • White background, clean and minimal
 *   • United Pharmacy logo on the leading edge
 *   • Notification bell with badge count on the trailing edge
 *   • No search bar here — search lives inside the hero gradient card
 *
 * Ambient system (subtle, gated on reduced-motion):
 *   • Logo ring breathes opacity 0.12 → 0.30
 *
 * All previous props/callbacks preserved for backward compatibility.
 */

import React, { memo, useEffect } from "react";
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
  user: _user,
  cartCount: _cartCount,
  onCartPress: _onCartPress,
  onSearchPress: _onSearchPress,
  onNotifPress,
}: DeliveryHeaderProps) {
  const { t }              = useTranslation();
  const reduced            = useReducedMotion() ?? false;
  const { isTablet, pagePad } = useScreenLayout();
  const { user: authUser } = useAuth();
  const unreadCount        = useUnreadCount(authUser?.id);

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

  // Action buttons
  actions: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           4,
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
