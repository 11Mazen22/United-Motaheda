import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { useUnreadCount } from "@/features/notifications";
import { useAuth } from "@/features/auth";
import { AnimatedTabBar, type TabBarItemConfig } from "@pharmacy/ui-native";
import { ArrivalOverlay } from "@/features/home/components/ArrivalOverlay";
import { useCartStore } from "@/stores/cart";

let arrivalComplete = false;
type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index: { active: "home", inactive: "home-outline" },
  products: { active: "grid", inactive: "grid-outline" },
  cart: { active: "cart", inactive: "cart-outline" },
  orders: { active: "cube", inactive: "cube-outline" },
  profile: { active: "person-circle", inactive: "person-circle-outline" },
};

const TAB_LABEL_KEY: Record<string, string> = {
  index: "tabs.home",
  products: "tabs.shop",
  cart: "tabs.cart",
  orders: "tabs.orders",
  profile: "tabs.profile",
};

function CustomerTabBar(props: BottomTabBarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const unreadNotifs = useUnreadCount(user?.id);
  const cartItemCount = useCartStore((s) => s.itemCount());

  const items: TabBarItemConfig[] = Object.keys(TAB_ICONS).map((name) => ({
    name,
    icon: TAB_ICONS[name],
    label: t(TAB_LABEL_KEY[name] ?? "tabs.home"),
    badge: name === "cart" ? cartItemCount : name === "profile" ? unreadNotifs : undefined,
  }));

  return <AnimatedTabBar {...props} items={items} />;
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
      <Tabs tabBar={(props) => <CustomerTabBar {...props} />} screenOptions={{ headerShown: false }}>
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
