/**
 * Tab Layout — 2026 Premium Redesign.
 *
 * Matches the reference image bottom navigation exactly:
 *   • Pure white bar with ultra-soft top shadow
 *   • 5 tabs: حسابي / طلباتي / السلة (cart, center, badge) / أقسام / الرئيسية
 *   • Active tab: teal (#0E7E74) icon + bold label + teal underline dot
 *   • Inactive tab: outline icon + muted label
 *   • Cart tab: elevated teal circle FAB in the center
 *   • Spring-animated icon scale + underline dot on focus change
 *   • Notification badge on the profile tab
 *   • Arrival overlay: cinematic intro covers tab bar + content, plays once per cold launch
 */

import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Redirect, Tabs } from "expo-router";
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

const TEAL     = "#0E7E74";
const INACTIVE = "rgba(10,18,32,0.38)";
const BAR_BG   = "#FFFFFF";

// ─── Animation preset ─────────────────────────────────────────────────────────

const SPRING = { damping: 20, stiffness: 300, mass: 0.6 } as const;

// ─── Tab Item ─────────────────────────────────────────────────────────────────

interface TabItemProps {
  name:    string;
  focused: boolean;
  badge?:  number;
  onPress: () => void;
}

function TabItem({ name, focused, badge, onPress }: TabItemProps) {
  const { t }     = useTranslation();
  const cfg       = TAB_CONFIG[name] ?? TAB_CONFIG.index;
  const label     = t(TAB_LABEL_KEY[name] ?? "tabs.home");
  const { width } = useWindowDimensions();
  const isTablet  = width >= 600;
  const iconSize  = isTablet ? 24 : 22;

  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, progress]);

  // Icon scale + lift on focus
  const iconAnim = useAnimatedStyle(() => ({
    transform: [
      { scale:      interpolate(progress.value, [0, 1], [0.88, 1.06], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [0,    -2  ], Extrapolation.CLAMP) },
    ],
  }));

  // Label: fade from muted to teal + slight lift
  const labelAnim = useAnimatedStyle(() => ({
    opacity:   interpolate(progress.value, [0, 1], [0.55, 1.0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -1], Extrapolation.CLAMP) },
    ],
  }));

  // Active teal underline dot
  const dotAnim = useAnimatedStyle(() => ({
    opacity:   interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scaleX: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  const iconColor = focused ? TEAL : INACTIVE;
  const labelFont = focused ? theme.fonts.black : theme.fonts.regular;
  const labelColor = focused ? TEAL : INACTIVE;

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
      style={styles.tabItem}
    >
      {/* Icon */}
      <Animated.View style={iconAnim}>
        <Ionicons
          name={focused ? cfg.active : cfg.inactive}
          size={iconSize}
          color={iconColor}
        />
      </Animated.View>

      {/* Label */}
      <Animated.View style={labelAnim}>
        <UIText
          numberOfLines={1}
          style={[styles.label, { color: labelColor, fontFamily: labelFont }]}
        >
          {label}
        </UIText>
      </Animated.View>

      {/* Teal underline dot */}
      <Animated.View style={[styles.activeDot, dotAnim]} />

      {/* Notification badge */}
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
  const barH         = isTablet ? 72 : BAR_H;

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
    <View
      style={[
        styles.barOuter,
        { paddingBottom: Math.max(insets.bottom, isTablet ? 8 : 6) },
      ]}
    >
      {/* Hairline top separator */}
      <View style={styles.topHairline} />

      <View
        style={[
          styles.barInner,
          { height: barH, paddingHorizontal: isTablet ? 24 : 8 },
        ]}
      >
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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [showArrival, setShowArrival] = useState(!arrivalComplete);

  const handleArrivalComplete = useCallback(() => {
    arrivalComplete = true;
    setShowArrival(false);
  }, []);

  // Symmetric to (driver)/_layout.tsx's reverse check. Before this, a
  // customer/pharmacist promoted to driver mid-session (now live via
  // AuthContext's realtime subscription) had no path into (driver) until the
  // app was restarted — app/index.tsx's role-based redirect only runs once,
  // at cold launch, and nothing here re-checked role on the way back in.
  if (user?.role === "driver") {
    // as never: same typed-routes escape hatch app/index.tsx already uses
    // for this exact target — (driver) group routes aren't always present
    // in the generated route union at typecheck time.
    return <Redirect href={"/(driver)" as never} />;
  }

  // Symmetric guard for pharmacist — a customer promoted to pharmacist
  // mid-session is redirected out of the customer tabs immediately.
  if (user?.role === "pharmacist") {
    return <Redirect href={"/(pharmacist)" as never} />;
  }

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

const BAR_H = 64;

const styles = StyleSheet.create({

  // ── Outer bar ───────────────────────────────────────────────────────────
  barOuter: {
    width:           "100%",
    backgroundColor: BAR_BG,
    // Premium upward shadow
    shadowColor:     "#0C2240",
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.08,
    shadowRadius:    12,
    elevation:       16,
  },

  // Hairline top separator
  topHairline: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: "rgba(15,23,42,0.08)",
  },

  // Inner flex row
  barInner: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 8,
  },

  // ── Tab item ────────────────────────────────────────────────────────────
  tabItem: {
    flex:           1,
    maxWidth:       120,
    height:         BAR_H,
    alignItems:     "center",
    justifyContent: "center",
    gap:            4,
    position:       "relative",
    paddingTop:     2,
  },

  // Label
  label: {
    fontSize:           10,
    lineHeight:         13,
    letterSpacing:      0.1,
    textAlign:          "center",
    includeFontPadding: false,
  },

  // Teal underline dot (active indicator)
  activeDot: {
    position:        "absolute",
    bottom:          6,
    width:           20,
    height:          3,
    borderRadius:    2,
    backgroundColor: TEAL,
  },

  // ── Notification badge ───────────────────────────────────────────────────
  badge: {
    position:          "absolute",
    top:               8,
    end:               "15%",
    minWidth:          16,
    height:            16,
    borderRadius:      8,
    backgroundColor:   "#EF4444",
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 3,
    borderWidth:       2,
    borderColor:       "#FFFFFF",
  },
  badgeText: {
    color:              "#FFFFFF",
    fontSize:           9,
    lineHeight:         11,
    fontFamily:         theme.fonts.black,
    includeFontPadding: false,
    textAlign:          "center",
  },
});
