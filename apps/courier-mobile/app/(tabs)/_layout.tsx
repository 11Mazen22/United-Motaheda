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
import { typography, spacing, shadows } from '@pharmacy/ui-native/courier-tokens';
import { useCourierTheme } from '@pharmacy/ui-native';
import { useOrdersStore } from '@/stores/orders.store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SPRING = { damping: 20, stiffness: 300, mass: 0.6 } as const;

function TabIcon({
  name,
  focused,
  badge,
  activeColor,
  inactiveColor,
  surfaceColor,
}: {
  name: IconName;
  focused: boolean;
  badge?: boolean;
  activeColor: string;
  inactiveColor: string;
  surfaceColor: string;
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
      {badge && <View style={[ti.badgeDot, { backgroundColor: activeColor, borderColor: surfaceColor }]} />}
      <Animated.View style={iconAnim}>
        <Ionicons
          name={name}
          size={22}
          color={focused ? activeColor : inactiveColor}
        />
      </Animated.View>
      <Animated.View style={[ti.activeDot, dotAnim, { backgroundColor: activeColor }]} />
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
    start:           0,
    width:           8,
    height:          8,
    borderRadius:    4,
    borderWidth:     1.5,
    zIndex:          1,
  },
  activeDot: {
    marginTop:       4,
    width:           20,
    height:          3,
    borderRadius:    2,
  },
});

export default function TabsLayout() {
  const insets   = useSafeAreaInsets();
  const hasActive = useOrdersStore((s) => s.activeDelivery !== null);
  const { colors } = useCourierTheme();

  const activeColor = colors.brand.primary;
  const inactiveColor = colors.text.muted;

  return (
    <Tabs
      screenOptions={{
        headerShown:           false,
        tabBarActiveTintColor:  activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: [
          {
            backgroundColor: colors.canvas.surface,
            borderTopColor: colors.border.default,
            height: BAR_H,
            paddingTop: spacing[1],
            ...shadows.sm,
          },
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
            <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} activeColor={activeColor} inactiveColor={inactiveColor} surfaceColor={colors.canvas.surface} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'الخريطة',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'map' : 'map-outline'} focused={focused} activeColor={activeColor} inactiveColor={inactiveColor} surfaceColor={colors.canvas.surface} />
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
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              surfaceColor={colors.canvas.surface}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} activeColor={activeColor} inactiveColor={inactiveColor} surfaceColor={colors.canvas.surface} />
          ),
        }}
      />
    </Tabs>
  );
}

const BAR_H = Platform.OS === 'ios' ? 82 : 64;

const styles = StyleSheet.create({
  label: {
    fontFamily: typography.bold,
    fontSize:   11,
    marginTop:  0,
  },
  item: {
    paddingTop: spacing[1],
  },
});
