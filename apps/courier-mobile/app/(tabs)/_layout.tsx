import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AnimatedTabBar, type TabBarItemConfig } from '@pharmacy/ui-native';
import { useOrdersStore } from '@/stores/orders.store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'receipt', inactive: 'receipt-outline' },
  map: { active: 'map', inactive: 'map-outline' },
  delivery: { active: 'cube', inactive: 'cube-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

const TAB_LABEL_KEY: Record<string, string> = {
  index: 'tabs.orders',
  map: 'tabs.map',
  delivery: 'tabs.delivery',
  profile: 'tabs.profile',
};

function DriverTabBar(props: BottomTabBarProps) {
  const { t } = useTranslation();
  const hasActiveDelivery = useOrdersStore((s) => s.activeDelivery !== null);

  const items: TabBarItemConfig[] = Object.keys(TAB_ICONS).map((name) => ({
    name,
    icon: TAB_ICONS[name],
    label: t(TAB_LABEL_KEY[name] ?? 'tabs.orders'),
    badge: name === 'delivery' ? hasActiveDelivery : undefined,
  }));

  return <AnimatedTabBar {...props} items={items} />;
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <DriverTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="delivery" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
