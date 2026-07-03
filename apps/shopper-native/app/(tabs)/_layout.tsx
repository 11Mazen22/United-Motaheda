/**
 * Tab Layout — White Bar with Ink Pill (single-accent)
 *
 * Premium ink navigation (United Pharmacies 2026):
 *   • White bar, hairline top separator, flush to the bottom edge
 *   • Active tab: filled ink pill (#0A1220) + mint icon (#2DD4C0) + white label
 *   • Inactive tab: outline icon + ink/35 label — no shapes, no backgrounds
 *   • ONE accent across all tabs; wayfinding via icon + weight, not hue
 *
 * Arrival overlay: the cinematic Home intro (ArrivalOverlay) is mounted here,
 * above the whole <Tabs> tree, rather than inside the Home screen itself —
 * so its opaque canvas covers the bottom tab bar too, not just Home's own
 * content. It dissolves once, revealing tab bar + content together in the
 * same cross-fade. Plays once per cold launch (module-level flag).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { useUnreadCount } from "@/features/notifications";
import { useAuth } from "@/features/auth";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { Text as UIText } from "@/shared/ui";
import { ArrivalOverlay } from "@/features/home/components/ArrivalOverlay";

// Resets on each cold launch (JS reload); persists across in-app navigations.
let arrivalComplete = false;

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Tab configuration ────────────────────────────────────────────────────────

interface TabConfig {
  active:   IoniconsName;
  inactive: IoniconsName;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index:    { active: "home",          inactive: "home-outline"          },
  meds:     { active: "medkit",        inactive: "medkit-outline"        },
  products: { active: "grid",          inactive: "grid-outline"          },
  orders:   { active: "cube",          inactive: "cube-outline"          },
  profile:  { active: "person-circle", inactive: "person-circle-outline" },
};

const TAB_LABEL_KEY: Record<string, string> = {
  index:    "tabs.home",
  meds:     "tabs.meds",
  products: "tabs.shop",
  orders:   "tabs.orders",
  profile:  "tabs.profile",
};

// ─── Design tokens ────────────────────────────────────────────────────────────

const INK         = "#0A1220";
const MINT        = "#2DD4C0";
const INACTIVE    = "rgba(10,18,32,0.35)";

// ─── Animation preset ─────────────────────────────────────────────────────────

const SPRING = { damping: 22, stiffness: 320, mass: 0.7 } as const;

// ─── Tab Item ─────────────────────────────────────────────────────────────────

interface TabItemProps {
  name:    string;
  focused: boolean;
  badge?:  number;
  onPress: () => void;
}

function TabItem({ name, focused, badge, onPress }: TabItemProps) {
  const { t }        = useTranslation();
  const cfg          = TAB_CONFIG[name] ?? TAB_CONFIG.index;
  const label        = t(TAB_LABEL_KEY[name] ?? "tabs.home");
  const { width }    = useWindowDimensions();
  const isTablet     = width >= 600;
  const iconSize     = isTablet ? 24 : 22;

  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, progress]);

  // Ink pill: scales in and fades in
  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 0.6, 1], [0.80, 0.95, 1], Extrapolation.CLAMP) },
    ],
  }));

  // Icon: slight lift on focus
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale:      interpolate(progress.value, [0, 1], [0.90, 1.04], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [0,    -1  ], Extrapolation.CLAMP) },
    ],
  }));

  // Label: match lift
  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -1], Extrapolation.CLAMP) },
    ],
  }));

  const iconColor  = focused ? MINT     : INACTIVE;
  const labelColor = focused ? "#FFFFFF" : INACTIVE;
  const labelFont  = focused ? theme.fonts.black : theme.fonts.regular;

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={6}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={styles.tabItem}>

      {/* ── Ink pill background ── */}
      <Animated.View style={[styles.activePill, pillStyle]} />

      {/* ── Icon ── */}
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? cfg.active : cfg.inactive}
          size={iconSize}
          color={iconColor}
        />
      </Animated.View>

      {/* ── Label — always visible ── */}
      <Animated.View style={labelStyle}>
        <UIText numberOfLines={1} style={[styles.label, { color: labelColor, fontFamily: labelFont }]}>
          {label}
        </UIText>
      </Animated.View>

      {/* ── Notification badge ── */}
      {badge != null && badge > 0 && (
        <View style={styles.badge}>
          <UIText style={styles.badgeText}>{badge > 9 ? "9+" : badge}</UIText>
        </View>
      )}
    </Pressable>
  );
}

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────

function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets       = useSafeAreaInsets();
  const { user }     = useAuth();
  const unreadNotifs = useUnreadCount(user?.id);
  const { width }    = useWindowDimensions();
  const isTablet     = width >= 600;
  const barH         = isTablet ? 76 : BAR_H;

  const onPress = useCallback(
    (route: { key: string; name: string }, focused: boolean) => {
      const event = navigation.emit({
        type:              "tabPress",
        target:            route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    },
    [navigation],
  );

  const visibleRoutes = state.routes.filter((r) => r.name in TAB_CONFIG);

  return (
    <View style={[styles.barOuter, { paddingBottom: Math.max(insets.bottom, isTablet ? 6 : 4) }]}>
      {/* Hairline separator */}
      <View style={styles.topHairline} />
      <View style={[styles.barInner, { height: barH, paddingHorizontal: isTablet ? 24 : 4 }]}>
        {visibleRoutes.map((route) => {
          const realIdx = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === realIdx;
          return (
            <TabItem
              key={route.key}
              name={route.name}
              focused={focused}
              badge={route.name === "profile" ? (unreadNotifs || undefined) : undefined}
              onPress={() => onPress(route, focused)}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [showArrival, setShowArrival] = useState(!arrivalComplete);

  const handleArrivalComplete = useCallback(() => {
    arrivalComplete = true;
    setShowArrival(false);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index"    />
        <Tabs.Screen name="meds"     />
        <Tabs.Screen name="products" />
        <Tabs.Screen name="orders"   />
        <Tabs.Screen name="profile"  />
        <Tabs.Screen name="cart"   options={{ href: null }} />
        <Tabs.Screen name="search" options={{ href: null }} />
      </Tabs>

      {/* Cinematic arrival — sits above tab bar + content, dissolves once */}
      {showArrival && (
        <ArrivalOverlay
          topInset={insets.top}
          onComplete={handleArrivalComplete}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BAR_H = 68;

const styles = StyleSheet.create({

  // Outer bar: clean white, flush to bottom
  barOuter: {
    width:           "100%",
    backgroundColor: "#FFFFFF",
    shadowColor:     INK,
    shadowOffset:    { width: 0, height: -2 },
    shadowOpacity:   0.07,
    shadowRadius:    10,
    elevation:       12,
  },

  // Single-pixel ink separator at top of bar
  topHairline: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "rgba(10,18,32,0.10)",
  },

  // Inner row
  barInner: {
    flexDirection:     "row",
    height:            BAR_H,
    alignItems:        "center",
    paddingHorizontal: 4,
  },

  // Each tab fills equal space
  tabItem: {
    flex:           1,
    maxWidth:       140,
    height:         BAR_H,
    alignItems:     "center",
    justifyContent: "center",
    gap:            3,
    position:       "relative",
  },

  // Ink pill — absolutely positioned behind icon+label
  activePill: {
    position:        "absolute",
    top:             8,
    bottom:          8,
    left:            4,
    right:           4,
    borderRadius:    14,
    backgroundColor: INK,
  },

  // Label — always rendered
  label: {
    fontSize:      10,
    letterSpacing: 0.2,
    textAlign:     "center",
    lineHeight:    13,
  },

  // Notification badge
  badge: {
    position:          "absolute",
    top:               6,
    end:               "14%",
    minWidth:          16,
    height:            16,
    borderRadius:      8,
    backgroundColor:   kit.color.danger,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 3,
    borderWidth:       2,
    borderColor:       "#FFFFFF",
    shadowColor:       kit.color.danger,
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.55,
    shadowRadius:      4,
    elevation:         5,
  },
  badgeText: {
    color:               "#fff",
    fontSize:            9,
    lineHeight:          9,
    fontFamily:          theme.fonts.black,
    includeFontPadding:  false,
    textAlign:           "center",
    textAlignVertical:   "center",
  },
});
