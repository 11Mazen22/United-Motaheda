/**
 * Tracking Floating Action Buttons
 * 
 * Overlay buttons that appear on the tracking screen for:
 * - Calling the driver
 * - Contacting support
 * - Toggling route visibility
 * - Viewing driver details
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface TrackingFABsProps {
  /** Call driver callback */
  onPressCall: () => void;
  /** Support callback */
  onPressSupport: () => void;
  /** Toggle route callback */
  onPressRouteToggle: () => void;
  /** Driver info callback */
  onPressDriverInfo: () => void;
  /** Whether route is currently shown */
  showRoute: boolean;
  /** Whether tracking is active */
  isTracking: boolean;
}

export const TrackingFABs: React.FC<TrackingFABsProps> = ({
  onPressCall,
  onPressSupport,
  onPressRouteToggle,
  onPressDriverInfo,
  showRoute,
  isTracking,
}) => {
  // Animation values
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  // Animate FABs in
  useEffect(() => {
    if (isTracking) {
      scale.value = withSpring(1, {
        damping: 12,
        stiffness: 100,
      });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      scale.value = withSpring(0, {
        damping: 15,
        stiffness: 120,
      });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isTracking]);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  // Toggle route with animation
  const handleRouteToggle = () => {
    rotate.value = withSequence(
      withTiming(180, { duration: 300 }),
      withTiming(0, { duration: 300 })
    );
    onPressRouteToggle();
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Top FABs - Driver Info & Route Toggle */}
      <View style={styles.topRow}>
        {/* Driver Info FAB */}
        <TouchableOpacity
          style={[styles.fab, styles.fabDriver]}
          onPress={onPressDriverInfo}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle-outline" size={24} color="#8B5CF6" />
          <Text style={styles.fabLabel}>السائق</Text>
        </TouchableOpacity>

        {/* Route Toggle FAB */}
        <TouchableOpacity
          style={[styles.fab, styles.fabRoute, showRoute && styles.fabRouteActive]}
          onPress={handleRouteToggle}
          activeOpacity={0.8}
        >
          <Animated.View style={rotateStyle}>
            <Ionicons 
              name={showRoute ? "map-outline" : "map"} 
              size={24} 
              color={showRoute ? "#FFFFFF" : "#8B5CF6"} 
            />
          </Animated.View>
          <Text style={[styles.fabLabel, showRoute && styles.fabLabelActive]}>
            {showRoute ? 'إخفاء' : 'إظهار'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom FABs - Call & Support */}
      <View style={styles.bottomRow}>
        {/* Support FAB */}
        <TouchableOpacity
          style={[styles.fab, styles.fabSupport]}
          onPress={onPressSupport}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#6B7280" />
          <Text style={styles.fabLabel}>الدعم</Text>
        </TouchableOpacity>

        {/* Call Driver FAB (Main Action) */}
        <TouchableOpacity
          style={[styles.fab, styles.fabCall]}
          onPress={onPressCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call-outline" size={28} color="#FFFFFF" />
          <Text style={[styles.fabLabel, styles.fabLabelCall]}>اتصل</Text>
        </TouchableOpacity>
      </View>

      {/* Indicator dots */}
      <View style={styles.indicator}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 180 : 160,
    right: 16,
    alignItems: 'center',
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  fabDriver: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EDE9FE',
  },
  fabRoute: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
  },
  fabRouteActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  fabSupport: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
  },
  fabCall: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
    width: 72,
    height: 72,
    borderRadius: 36,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  fabLabelActive: {
    color: '#FFFFFF',
  },
  fabLabelCall: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  indicator: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: '#8B5CF6',
    width: 16,
  },
});

export default TrackingFABs;