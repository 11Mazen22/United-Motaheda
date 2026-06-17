/**
 * Tab Layout — White Bar with Top Indicator (single-accent)
 *
 * Quiet monochrome navigation (Linear / Things / Stripe):
 *   • White bar, hairline top separator, flush to the bottom edge
 *   • Active tab: teal top-indicator line + filled teal icon + black label
 *   • Inactive tab: outline icon + muted slate label — no shapes, no backgrounds
 *   • ONE accent (kit teal) across all tabs; wayfinding via icon + weight, not hue
 */

import React, { useCallback, useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
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

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Tab configuration ────────────────────────────────────────────────────────

interface TabConfig {
  active:   IoniconsName;
  inactive: IoniconsName;
  color:    string;              // single color for icon + label when active
  grad:     [string, string];   // gradient for the indicator line
}

// One accent across all tabs — wayfinding comes from icon + weight, not hue.
const ACCENT_GRAD: [string, string] = [kit.color.accent, kit.color.accentDeep];
const TAB_CONFIG: Record<string, TabConfig> = {
  index: {
    active:   "home",
    inactive: "home-outline",
    color:    kit.color.accent,
    grad:     ACCENT_GRAD,
  },
  meds: {
    active:   "medkit",
    inactive: "medkit-outline",
    color:    kit.color.accent,
    grad:     ACCENT_GRAD,
  },
  products: {
    active:   "grid",
    inactive: "grid-outline",
    color:    kit.color.accent,
    grad:     ACCENT_GRAD,
  },
  orders: {
    active:   "cube",
    inactive: "cube-outline",
    color:    kit.color.accent,
    grad:     ACCENT_GRAD,
  },
  profile: {
    active:   "person-circle",
    inactive: "person-circle-outline",
    color:    kit.color.accent,
    grad:     ACCENT_GRAD,
  },
};

const TAB_LABEL_KEY: Record<string, string> = {
  index:    "tabs.home",
  meds:     "tabs.meds",
  products: "tabs.shop",
  orders:   "tabs.orders",
  profile:  "tabs.profile",
};

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
  const { t } = useTranslation();
  const cfg   = TAB_CONFIG[name] ?? TAB_CONFIG.index;
  const label = t(TAB_LABEL_KEY[name] ?? "tabs.home");

  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, progress]);

  // Top indicator: scaleX 0 → 1, opacity 0 → 1
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(progress.value, [0, 1], [0, 1],   Extrapolation.CLAMP),
    transform: [
      { scaleX: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP) },
    ],
  }));

  // Icon: scale up, slight lift
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale:      interpolate(progress.value, [0, 1], [0.88, 1.06], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [0, -2],      Extrapolation.CLAMP) },
    ],
  }));

  // Label: match icon lift
  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -1], Extrapolation.CLAMP) },
    ],
  }));

  // Light bar — inactive tabs use dark slate at reduced opacity
  const iconColor  = focused ? cfg.color                   : "rgba(100,116,139,0.60)";
  const labelColor = focused ? cfg.color                   : "rgba(100,116,139,0.55)";
  const labelFont  = focused ? theme.fonts.black           : theme.fonts.regular;
  const iconSize   = focused ? 24 : 22;

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

      {/* ── Top indicator — flat teal line, stays inside bounds ── */}
      <Animated.View style={[styles.indicatorWrap, indicatorStyle]}>
        <View style={[styles.indicatorLine, { backgroundColor: kit.color.accent }]} />
      </Animated.View>

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
    <View style={[styles.barOuter, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      {/* Hairline separator — 1px dark line at top of bar */}
      <View style={styles.topHairline} />
      <View style={styles.barInner}>
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
  return (
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
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BAR_H        = 62;
const INDICATOR_W  = 28;
const INDICATOR_H  = 3;

const styles = StyleSheet.create({

  // Outer bar: clean white, flush to bottom, upward shadow
  barOuter: {
    width:           "100%",
    backgroundColor: "#FFFFFF",
    shadowColor:     "#0C1A2E",
    shadowOffset:    { width: 0, height: -2 },
    shadowOpacity:   0.07,
    shadowRadius:    10,
    elevation:       12,
  },

  // Single-pixel separator between content and bar
  topHairline: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "rgba(15,23,42,0.10)",
  },

  // Inner row of tab items
  barInner: {
    flexDirection:    "row",
    height:           BAR_H,
    alignItems:       "center",
    paddingHorizontal: 4,
  },

  // Each tab fills equal space
  tabItem: {
    flex:           1,
    height:         BAR_H,
    alignItems:     "center",
    justifyContent: "center",
    gap:            3,
    paddingTop:     INDICATOR_H, // make room for the indicator at the very top
    position:       "relative",
  },

  // Gradient indicator line — INSIDE the bar, no overflow
  indicatorWrap: {
    position:     "absolute",
    top:          0,              // flush with the top edge of each tab item
    width:        INDICATOR_W,
    height:       INDICATOR_H,
    borderRadius: INDICATOR_H,
    overflow:     "hidden",
  },
  indicatorLine: {
    flex: 1,
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
