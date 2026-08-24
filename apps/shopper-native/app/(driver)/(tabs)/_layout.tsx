import React from "react";
import { Tabs } from "expo-router";
import type { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import { AnimatedTabBar, type TabBarItemConfig } from "@pharmacy/ui-native";
import { useDriverOffers } from "@/features/driver";
import { useAuth } from "@/features/auth";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index: { active: "list", inactive: "list-outline" },
  map: { active: "map", inactive: "map-outline" },
  offers: { active: "flash", inactive: "flash-outline" },
};

const TAB_LABEL_KEY: Record<string, string> = {
  index: "tabs.driverHome",
  map: "tabs.driverMap",
  offers: "tabs.driverOffers",
};

function DriverTabBar(props: BottomTabBarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: offers } = useDriverOffers(user?.id);
  const offerCount = offers?.length ?? 0;

  const items: TabBarItemConfig[] = Object.keys(TAB_ICONS).map((name) => ({
    name,
    icon: TAB_ICONS[name],
    label: t(TAB_LABEL_KEY[name] ?? "tabs.driverHome"),
    badge: name === "offers" ? offerCount : undefined,
  }));

  return <AnimatedTabBar {...props} items={items} />;
}

export default function DriverTabLayout() {
  return (
    <Tabs tabBar={(props) => <DriverTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="offers" />
    </Tabs>
  );
}
