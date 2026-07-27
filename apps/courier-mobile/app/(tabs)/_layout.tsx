import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, shadows } from '@/theme/tokens';
import { useOrdersStore } from '@/stores/orders.store';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabBarIcon({
  name,
  focused,
  badge,
}: {
  name: IoniconsName;
  focused: boolean;
  badge?: boolean;
}) {
  return (
    <View style={s.iconWrapper}>
      <Ionicons
        name={name}
        size={24}
        color={focused ? colors.primary : colors.inkFaint}
      />
      {badge && <View style={s.badge} />}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  const hasActiveDelivery = activeDelivery !== null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: [
          s.tabBar,
          { paddingBottom: Math.max(insets.bottom, spacing[2]) },
        ],
        tabBarLabelStyle: s.tabLabel,
        tabBarItemStyle: s.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'receipt' : 'receipt-outline'}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'map' : 'map-outline'}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="delivery"
        options={{
          title: 'Delivery',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'cube' : 'cube-outline'}
              focused={focused}
              badge={hasActiveDelivery}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              name={focused ? 'person' : 'person-outline'}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingTop: spacing[2],
    ...shadows.md,
  },
  tabLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    marginTop: 2,
  },
  tabItem: {
    paddingTop: spacing[1],
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
