import React, { useCallback, useRef, useState } from "react";
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
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const [showArrival, setShowArrival] = useState(!arrivalComplete);

  const handleArrivalComplete = useCallback(() => {
    arrivalComplete = true;
    setShowArrival(false);
  }, []);

  // Locks the redirect decision the first time this layout mounts. Without
  // this, the target is recomputed live from `user?.role` on every render —
  // and on a churning connection `user` can flip role a few times a second
  // as onAuthStateChange keeps refiring (each event re-runs attachRole,
  // which falls back to a stale/incorrect role on its own timeout — see
  // features/auth/context.tsx). Each flip toggled this Redirect, bouncing
  // between here and (driver)/(pharmacist) in a tight loop and crashing with
  // "Maximum update depth exceeded" — the exact bug (driver)/_layout.tsx's
  // own decidedAccessRef already exists to prevent on that side; this ports
  // the same lock here since a role can't legitimately change mid-session
  // without a fresh sign-in remounting this whole tree anyway.
  //
  // Locking is still right, but *when* it locked was not. `user.role` is
  // fetched separately from the session (see features/auth/api.ts, which
  // warns in as many words: "never assume a customer default here, since
  // callers gating on 'driver' must wait for a real value"), so on the very
  // first render it is almost always still undefined. Locking then pinned
  // every driver and pharmacist to "none" and stranded them in the customer
  // app for the entire session -- a driver signing in landed on the customer
  // home and could never reach their own tabs.
  //
  // So: only lock once auth has actually settled and a role is available.
  // Until then render nothing rather than the customer tabs, which also
  // avoids mounting the whole customer tree just to unmount it one render
  // later (that mount/unmount churn is what stranded the splash-exit event
  // and left ArrivalOverlay covering the app -- see ArrivalOverlay's
  // watchdog).
  const redirectRef = useRef<"driver" | "pharmacist" | "none" | null>(null);
  if (redirectRef.current === null && !loading && (!user || user.role !== undefined)) {
    redirectRef.current =
      user?.role === "driver" ? "driver" :
      user?.role === "pharmacist" ? "pharmacist" :
      "none";
  }

  if (redirectRef.current === null) return <View style={{ flex: 1 }} />;
  if (redirectRef.current === "driver") return <Redirect href={"/(driver)" as never} />;
  if (redirectRef.current === "pharmacist") return <Redirect href={"/(pharmacist)" as never} />;

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
