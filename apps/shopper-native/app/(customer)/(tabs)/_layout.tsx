import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Tabs, useRouter } from "expo-router";
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
  const router = useRouter();
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

  // Guards the imperative redirect below. expo-router's <Redirect> fires
  // router.replace() from a useFocusEffect whose dependency is a fresh
  // inline callback on every render of <Redirect> -- so it re-fires on
  // every re-render where this screen is still focused, not just once.
  // Once the real navigation is at all slow to take over focus (which a
  // throttled one is, by definition), every re-render in between re-issues
  // the same replace() call, and the resulting burst is what trips the
  // browser's own rapid-navigation throttle -- which delays the transition
  // further, feeding the same loop (see (driver)/_layout.tsx's matching
  // hasLeftRef for the full incident). Calling router.replace() ourselves,
  // gated by this ref, is the only way to guarantee it fires at most once.
  const hasLeftRef = useRef(false);
  // The replace() call is deferred one macrotask via setTimeout rather than
  // called synchronously. Reproduced live on (driver)/_layout.tsx's matching
  // guard: this layout's Tabs contains several screens -- calling replace()
  // synchronously here unmounts that whole subtree within the same React
  // commit that's still flushing other pending updates, and each unmounting
  // screen's cleanup (@react-navigation/core's SceneView clears the options
  // it registered on its parent navigator on unmount) triggers a parent
  // state update. Enough of those cascading synchronously in one commit
  // trips React's own "Maximum update depth exceeded" (error #185) —
  // confirmed via the captured stack, which is entirely inside
  // react-navigation's clearOptions/options-getter machinery, no
  // application code in it at all. Deferring by one tick lets React fully
  // settle the current commit before the heavy nested-unmount transition
  // begins, without changing what navigates or how many times (still
  // guarded to exactly once).
  useEffect(() => {
    if (redirectRef.current === "driver" || redirectRef.current === "pharmacist") {
      if (!hasLeftRef.current) {
        hasLeftRef.current = true;
        const target = redirectRef.current === "driver" ? "/(driver)" : "/(pharmacist)";
        setTimeout(() => router.replace(target as never), 0);
      }
    }
  });

  if (redirectRef.current === null) return <View style={{ flex: 1 }} />;
  if (redirectRef.current === "driver" || redirectRef.current === "pharmacist") {
    return <View style={{ flex: 1 }} />;
  }

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
