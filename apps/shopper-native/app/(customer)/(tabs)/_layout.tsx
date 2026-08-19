import React, { useCallback, useEffect, useState } from "react";

import { Platform, Pressable, StyleSheet, View, useWindowDimensions, useColorScheme } from "react-native";

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

useReducedMotion } from "react-native-reanimated";

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useTranslation } from "react-i18next";

import { useUnreadCount } from "@/features/notifications";

import { useAuth } from "@/features/auth";

import { theme } from "@pharmacy/design-tokens";

import { Text as UIText, kit } from "@pharmacy/ui-native";

import { ArrivalOverlay } from "@/features/home/components/ArrivalOverlay";

import { isRtl } from "@/utils/layout";

import { useCartStore } from "@/stores/cart";



let arrivalComplete = false;

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];



interface TabConfig {

  active: IoniconsName;

  inactive: IoniconsName;

}



const TAB_CONFIG: Record<string, TabConfig> = {

  index:    { active: "home",          inactive: "home-outline"          },

  products: { active: "grid",          inactive: "grid-outline"          },

  cart:     { active: "cart",          inactive: "cart-outline"          },

  orders:   { active: "cube",          inactive: "cube-outline"          },

  profile:  { active: "person-circle", inactive: "person-circle-outline" },

};



const TAB_LABEL_KEY: Record<string, string> = {

  index:    "tabs.home",

  products: "tabs.shop",

  cart:     "tabs.cart",

  orders:   "tabs.orders",

  profile:  "tabs.profile",

};



const SPRING = { damping: 20, stiffness: 300, mass: 0.6 } as const;



interface TabItemProps {

  name: string;

  focused: boolean;

  badge?: number;

  onPress: () => void;

  isDark: boolean;

}



function TabItem({ name, focused, badge, onPress, isDark }: TabItemProps) {

  const { t } = useTranslation();

  const cfg = TAB_CONFIG[name] ?? TAB_CONFIG.index;

  const label = t(TAB_LABEL_KEY[name] ?? "tabs.home");

  const { width } = useWindowDimensions();

  const isTablet = width >= 600;

  const iconSize = isTablet ? 24 : 22;



  const progress = useSharedValue(focused ? 1 : 0);



  useEffect(() => {

    progress.value = withSpring(focused ? 1 : 0, SPRING);

  }, [focused, progress]);



  const iconAnim = useAnimatedStyle(() => ({

    transform: [

      { scale: interpolate(progress.value, [0, 1], [0.92, 1.0], Extrapolation.CLAMP) },

      { translateY: interpolate(progress.value, [0, 1], [0, -2], Extrapolation.CLAMP) },

    ],

  }));



  const labelAnim = useAnimatedStyle(() => ({

    opacity: interpolate(progress.value, [0, 1], [0.55, 1.0], Extrapolation.CLAMP),

    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -1], Extrapolation.CLAMP) }],

  }));



  const dotAnim = useAnimatedStyle(() => ({

    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),

    transform: [{ scaleX: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1], Extrapolation.CLAMP) }],

  }));



  const TEAL = isDark ? kit.darkColor.accent : kit.color.accent;

  const INACTIVE = isDark ? kit.darkColor.inkFaint : kit.color.inkFaint;

  

  const iconColor = focused ? TEAL : INACTIVE;

  const labelFont = focused ? kit.font.semiBold : kit.font.semiBold;

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

      <Animated.View style={iconAnim}>

        <Ionicons name={focused ? cfg.active : cfg.inactive} size={iconSize} color={iconColor} />

      </Animated.View>

      <Animated.View style={labelAnim}>

        <UIText numberOfLines={1} style={[styles.label, { color: labelColor, fontFamily: labelFont }]}>

          {label}

        </UIText>

      </Animated.View>

      <Animated.View style={[styles.activeDot, dotAnim, { backgroundColor: TEAL }]} />

      {badge != null && badge > 0 && (

        <View style={styles.badge}>

          <UIText style={styles.badgeText}>{badge > 9 ? "9+" : badge}</UIText>

        </View>

      )}

    </Pressable>

  );

}



function CartFab({ focused, badge, onPress, isDark }: TabItemProps) {

  const { t } = useTranslation();

  const label = t(TAB_LABEL_KEY["cart"] ?? "tabs.cart");

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

      style={styles.fabContainer}

    >

      <View style={[styles.fab, kit.shadow.brandGlow, { backgroundColor: isDark ? kit.darkColor.accent : kit.color.accent }]}>

        <Ionicons name="cart" size={24} color="#FFFFFF" />

      </View>

      {badge != null && badge > 0 && (

        <View style={styles.fabBadge}>

          <UIText style={styles.fabBadgeText}>{badge > 99 ? "99+" : badge}</UIText>

        </View>

      )}

    </Pressable>

  );

}



function BottomTabBar({ state, navigation }: BottomTabBarProps) {

  const insets = useSafeAreaInsets();

  const { user } = useAuth();

  const unreadNotifs = useUnreadCount(user?.id);

  const cartItemCount = useCartStore((s) => s.itemCount());

  const { width } = useWindowDimensions();

  const isDark = useColorScheme() === "dark";

  const IS_RTL = isRtl();

  const isTablet = width >= 600;

  const barH = isTablet ? 72 : BAR_H;



  const onPress = useCallback(

    (route: { key: string; name: string }, focused: boolean) => {

      const event = navigation.emit({

        type: "tabPress",

        target: route.key,

        canPreventDefault: true,

      });

      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);

    },

    [navigation],

  );



  const visibleRoutes = state.routes.filter((r) => r.name in TAB_CONFIG);

  const orderedRoutes = IS_RTL ? [...visibleRoutes].reverse() : visibleRoutes;



  const barBg = isDark ? kit.darkColor.surface : kit.color.surface;

  const lineColor = isDark ? kit.darkColor.line : kit.color.line;



  return (

    <View style={[styles.barOuter, { backgroundColor: barBg, paddingBottom: Math.max(insets.bottom, isTablet ? 8 : 6) }, kit.shadow.raised]}>

      <View style={[styles.topHairline, { backgroundColor: lineColor }]} />

      <View style={[styles.barInner, { height: barH, paddingHorizontal: isTablet ? 24 : 8 }]}>

        {orderedRoutes.map((route) => {

          const realIdx = state.routes.findIndex((r) => r.key === route.key);

          const focused = state.index === realIdx;



          if (route.name === "cart") {
            return (
              <TabItem
                key={route.key}
                name={route.name}
                focused={focused}
                badge={cartItemCount || undefined}
                onPress={() => onPress(route, focused)}
                isDark={isDark}
              />
            );
          }



          return (

            <TabItem

              key={route.key}

              name={route.name}

              focused={focused}

              badge={route.name === "profile" ? (unreadNotifs || undefined) : undefined}

              onPress={() => onPress(route, focused)}

              isDark={isDark}

            />

          );

        })}

      </View>

    </View>

  );

}



export default function TabLayout() {

  const { user } = useAuth();

  const insets = useSafeAreaInsets();

  const [showArrival, setShowArrival] = useState(!arrivalComplete);



  const handleArrivalComplete = useCallback(() => {

    arrivalComplete = true;

    setShowArrival(false);

  }, []);



  if (user?.role === "driver") return <Redirect href={"/(driver)" as never} />;

  if (user?.role === "pharmacist") return <Redirect href={"/(pharmacist)" as never} />;



  return (

    <View style={{ flex: 1 }}>

      <Tabs tabBar={(props) => <BottomTabBar {...props} />} screenOptions={{ headerShown: false }}>

        <Tabs.Screen name="index" />

        <Tabs.Screen name="products" />

        <Tabs.Screen name="cart" />

        <Tabs.Screen name="orders" />

        <Tabs.Screen name="profile" />

        {/* Unmounted routes */}

        <Tabs.Screen name="map" options={{ href: null }} />

        <Tabs.Screen name="meds" options={{ href: null }} />

        <Tabs.Screen name="search" options={{ href: null }} />

      </Tabs>

      {showArrival && <ArrivalOverlay topInset={insets.top} onComplete={handleArrivalComplete} />}

    </View>

  );

}



const BAR_H = 64;



const styles = StyleSheet.create({

  barOuter: { width: "100%" },

  topHairline: { height: 1 },

  barInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },

  tabItem: { flex: 1, minWidth: 44, maxWidth: 120, height: BAR_H, alignItems: "center", justifyContent: "center", gap: 4, position: "relative", paddingTop: 2 },

  label: { fontSize: 11, lineHeight: 16, letterSpacing: 0.1, textAlign: "center", includeFontPadding: false },

  activeDot: { position: "absolute", bottom: 6, width: 20, height: 3, borderRadius: 2 },

  badge: { position: "absolute", top: 8, end: "15%", minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 2, borderColor: "#FFFFFF" },

  badgeText: { color: "#FFFFFF", fontSize: 9, lineHeight: 11, fontFamily: theme.fonts.black, includeFontPadding: false, textAlign: "center" },

  fabContainer: { flex: 1, minWidth: 44, maxWidth: 120, height: BAR_H, alignItems: "center", justifyContent: "center", position: "relative" },

  fab: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 12 },

  fabBadge: { position: "absolute", top: -2, right: "15%", minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#FFFFFF" },

  fabBadgeText: { color: "#FFFFFF", fontSize: 10, lineHeight: 12, fontFamily: kit.font.black, includeFontPadding: false, textAlign: "center" },

});

