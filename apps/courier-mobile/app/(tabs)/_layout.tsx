/**
 * Driver tab layout — premium teal active state with Cairo fonts.
 * Active tab: teal icon + label + animated underline dot.
 * Inactive tab: muted icon + label.
 */

import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  Extrapolation,
} from 'react-native-reanimated';
import { colors, typography, spacing, shadows, radii } from '@/theme/tokens';
import { useOrdersStore } from '@/stores/orders.store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SPRING = { damping: 20, stiffness: 300, mass: 0.6 } as const;

function TabIcon({
  name,
  focused,
  badge,
  label,
}: {
  name: IconName;
  focused: boolean;
  badge?: boolean;
  label: string;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, progress]);

  const iconAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.88, 1.06], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [0, -1.5], Extrapolation.CLAMP) },
    ],
  }));

  const dotAnim = useAnimatedStyle(() => ({
    opacity:   interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scaleX: interpolate(progress.value, [0, 0.5, 1], [0, 0.5, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={ti.wrap}>
      {badge && <View style={ti.badgeDot} />}
      <Animated.View style={iconAnim}>
        <Ionicons
          name={name}
          size={22}
          color={focused ? colors.primary : colors.inkFaint}
        />
      </Animated.View>
      <Animated.View style={[ti.activeDot, dotAnim]} />
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: {
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
    paddingTop:     2,
  },
  badgeDot: {
    position:        'absolute',
    top:             0,
    right:           -4,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.error,
    borderWidth:     1.5,
    borderColor:     colors.surface,
    zIndex:          1,
  },
  activeDot: {
    marginTop:       4,
    width:           20,
    height:          3,
    borderRadius:    2,
    backgroundColor: colors.primary,
  },
});

export default function TabsLayout() {
  const insets   = useSafeAreaInsets();
  const hasActive = useOrdersStore((s) => s.activeDelivery !== null);

  return (
    <Tabs
      screenOptions={{
        headerShown:           false,
        tabBarActiveTintColor:  colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: [
          styles.bar,
          { paddingBottom: Math.max(insets.bottom, spacing[2]) },
        ],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle:  styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الطلبات',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} label="الطلبات" />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'الخريطة',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'map' : 'map-outline'} focused={focused} label="الخريطة" />
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
              label="التوصيل"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} label="حسابي" />
          ),
        }}
      />
    </Tabs>
  );
}

const BAR_H = Platform.OS === 'ios' ? 82 : 64;

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth:  StyleSheet.hairlineWidth,
    borderTopColor:  colors.borderSoft,
    height:          BAR_H,
    paddingTop:      spacing[1],
    ...shadows.sm,
  },
  label: {
    fontFamily: typography.bold,
    fontSize:   11,
    marginTop:  0,
  },
  item: {
    paddingTop: spacing[1],
  },
});
