/**
 * Pharmacist tab bar — adopts the same AnimatedTabBar used by customer and
 * driver, closing the "pharmacist has no tab bar" inconsistency flagged in
 * the navigation audit. 6 destinations: Workbench (triage snapshot), Orders
 * (the full searchable/filterable order workspace — Workbench is deliberately
 * NOT this: it's a dashboard, not where you go to find a specific order),
 * Prescriptions, Inventory, Analytics, Profile. Inventory already contains
 * full-text + barcode search — a separate "search" tab/route used to exist
 * as a hidden duplicate of that exact screen with nothing ever navigating to
 * it; removed rather than kept as dead weight. Refills lives inside
 * Prescriptions (a header action) rather than as a 7th tab — it's a sibling
 * prescription-domain workflow, not a high-frequency destination on its own.
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
  orders: { active: "receipt", inactive: "receipt-outline" },
  prescriptions: { active: "medkit", inactive: "medkit-outline" },
  inventory: { active: "cube", inactive: "cube-outline" },
  analytics: { active: "bar-chart", inactive: "bar-chart-outline" },
  profile: { active: "person-circle", inactive: "person-circle-outline" },
};

const TAB_LABEL_KEY: Record<string, string> = {
  index: "tabs.pharmacistWorkbench",
  orders: "tabs.pharmacistOrders",
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
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="prescriptions" />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
