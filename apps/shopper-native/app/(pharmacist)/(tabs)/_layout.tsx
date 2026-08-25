/**
 * Pharmacist tab bar — adopts the same AnimatedTabBar used by customer and
 * driver, closing the "pharmacist has no tab bar" inconsistency flagged in
 * the navigation audit. 5 visible destinations, matching customer's tab
 * count: Workbench (dashboard/queue), Prescriptions, Inventory, Analytics,
 * Profile. "search" stays mounted but hidden (href: null) — it currently
 * renders the exact same screen as Inventory (a shared full-text/barcode
 * search surface), so showing it as a 6th visible tab would look like a
 * duplicate of Inventory rather than a distinct destination.
 */
import React from "react";
import { Tabs } from "expo-router";
import type { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { AnimatedTabBar, type TabBarItemConfig } from "@pharmacy/ui-native";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index: { active: "grid", inactive: "grid-outline" },
  prescriptions: { active: "medkit", inactive: "medkit-outline" },
  inventory: { active: "cube", inactive: "cube-outline" },
  analytics: { active: "bar-chart", inactive: "bar-chart-outline" },
  profile: { active: "person-circle", inactive: "person-circle-outline" },
};

const TAB_LABEL_KEY: Record<string, string> = {
  index: "tabs.pharmacistWorkbench",
  prescriptions: "tabs.pharmacistQueue",
  inventory: "tabs.pharmacistInventory",
  analytics: "tabs.pharmacistAnalytics",
  profile: "tabs.pharmacistProfile",
};

function PharmacistTabBar(props: BottomTabBarProps) {
  const { t } = useTranslation();

  const items: TabBarItemConfig[] = Object.keys(TAB_ICONS).map((name) => ({
    name,
    icon: TAB_ICONS[name],
    label: t(TAB_LABEL_KEY[name] ?? "tabs.pharmacistWorkbench"),
  }));

  return <AnimatedTabBar {...props} items={items} />;
}

export default function PharmacistTabLayout() {
  return (
    <Tabs tabBar={(props) => <PharmacistTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="prescriptions" />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="profile" />
      {/* Unmounted from the tab bar — reachable, but not a bar destination */}
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}
