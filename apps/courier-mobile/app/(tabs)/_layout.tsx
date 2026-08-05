/**
 * Driver tab layout — 2026 redesign.
 * White bar, teal active state, delivery badge dot, proper icons.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, shadows, radii } from '@/theme/tokens';
import { useOrdersStore } from '@/stores/orders.store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, badge }: { name: IconName; focused: boolean; badge?: boolean }) {
  return (
    <View style={ti.wrap}>
      <Ionicons name={name} size={22} color={focused ? colors.primary : colors.inkFaint} />
      {badge && (
        <View style={ti.badge} />
      )}
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: {
    position: 'absolute', top: 0, right: -4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5, borderColor: colors.surface,
  },
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const hasActive = useOrdersStore((s) => s.activeDelivery !== null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: [
          styles.bar,
          { paddingBottom: Math.max(insets.bottom, spacing[2]) },
        ],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الطلبات',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'الخريطة',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'map' : 'map-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="delivery"
        options={{
          title: 'التوصيل',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'cube' : 'cube-outline'}
              focused={focused}
              badge={hasActive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingTop: spacing[2],
    ...shadows.md,
  },
  label: {
    fontSize: 11,
    fontWeight: typography.semibold,
    marginTop: 2,
  },
  item: {
    paddingTop: spacing[1],
  },
});
