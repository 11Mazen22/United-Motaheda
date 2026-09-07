/**
 * Active Order Banner Component
 * 
 * A persistent banner that appears at the top of the screen when there's an active order.
 * Displays order status, driver info, and estimated arrival time.
 * Tapping the banner navigates to the order tracking screen.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '@/stores/orders';

interface ActiveOrderBannerProps {
  /** Optional custom styles */
  style?: any;
}

export const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({ style }) => {
  const { activeOrder, isTracking } = useOrderStore();
  
  // Animation values
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const pulse = useSharedValue(1);
  const progress = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // 🆕 Progress bar animation (for tracking duration)
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // 🆕 Glow animation for the banner border
  const glowStyle = useAnimatedStyle(() => ({
    borderColor: glowOpacity.value > 0.5 ? '#8B5CF6' : '#E5E7EB',
    shadowOpacity: glowOpacity.value * 0.3,
    shadowRadius: glowOpacity.value * 12,
    borderWidth: glowOpacity.value > 0.5 ? 2 : 1,
  }));

  // Show/hide banner based on active order
  useEffect(() => {
    if (activeOrder && isTracking) {
      // Slide in with spring animation
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 100,
        mass: 1,
      });
      opacity.value = withTiming(1, { duration: 300 });

      // Start pulse animation for the indicator
      pulse.value = withSequence(
        withDelay(1000, withSpring(1.3)),
        withSpring(1)
      );

      // 🆕 Animated progress (simulated ETA progress)
      progress.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.7, { duration: 5000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      // 🆕 Glow animation
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000 }),
          withTiming(0.3, { duration: 2000 })
        ),
        -1,
        true
      );

    } else {
      // Slide out with different spring
      translateY.value = withSpring(-120, {
        damping: 20,
        stiffness: 150,
        mass: 0.8,
      });
      opacity.value = withTiming(0, { duration: 250 });
      
      // Reset animations
      progress.value = 0;
      glowOpacity.value = 0;
    }
  }, [activeOrder, isTracking]);

  // Handle banner press - navigate to tracking screen
  const handlePress = () => {
    if (activeOrder) {
      // 🆕 Press animation
      translateY.value = withSequence(
        withSpring(10, { damping: 10, stiffness: 200 }),
        withSpring(0, { damping: 15, stiffness: 100 })
      );
      
      router.push(`/(customer)/order-tracking/${activeOrder.id}` as import('expo-router').Href);
    }
  };

  // Don't render anything if no active order
  if (!activeOrder || !isTracking) {
    return null;
  }

  // Determine status text and color
  const getStatusInfo = () => {
    const statusMap = {
      pending: { text: '⏳ انتظار', color: '#F59E0B', icon: 'time-outline', bgColor: '#FEF3C7' },
      accepted: { text: '✅ تم القبول', color: '#3B82F6', icon: 'checkmark-circle-outline', bgColor: '#DBEAFE' },
      picked_up: { text: '🚚 في الطريق', color: '#8B5CF6', icon: 'car-outline', bgColor: '#EDE9FE' },
      delivered: { text: '🎉 تم التوصيل', color: '#10B981', icon: 'checkmark-done-circle-outline', bgColor: '#D1FAE5' },
      cancelled: { text: '❌ ملغي', color: '#EF4444', icon: 'close-circle-outline', bgColor: '#FEE2E2' },
    };
    return statusMap[activeOrder.status] || statusMap.pending;
  };

  const statusInfo = getStatusInfo();

  // Format estimated arrival
  const getEtaText = () => {
    if (!activeOrder.estimatedArrival) return 'جاري الحساب...';
    if (activeOrder.status === 'delivered') return 'تم التوصيل ✅';
    if (activeOrder.status === 'cancelled') return 'تم الإلغاء ❌';
    return `⏱ ${activeOrder.estimatedArrival} دقيقة`;
  };

  // Get driver name or fallback
  const driverDisplayName = activeOrder.driverName || 'السائق';

  // 🆕 Check if order is in progress
  const isInProgress = ['pending', 'accepted', 'picked_up'].includes(activeOrder.status);

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      <Animated.View style={[styles.glowContainer, glowStyle]}>
        <TouchableOpacity 
          activeOpacity={0.9}
          style={styles.touchable}
          onPress={handlePress}
        >
          <View style={styles.content}>
            {/* Left side - Status indicator with pulse */}
            <View style={styles.leftSection}>
              <Animated.View style={[styles.indicator, pulseStyle]}>
                <View style={[styles.indicatorDot, { backgroundColor: statusInfo.color }]} />
              </Animated.View>
              
              <View style={styles.statusContainer}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusText}>
                    {statusInfo.text}
                  </Text>
                  {isInProgress && (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.driverText}>
                  {driverDisplayName}
                </Text>
              </View>
            </View>

            {/* Right side - ETA and Arrow */}
            <View style={styles.rightSection}>
              <View style={[styles.etaContainer, { backgroundColor: statusInfo.bgColor || '#F3F4F6' }]}>
                <Ionicons name="time-outline" size={16} color={statusInfo.color} />
                <Text style={[styles.etaText, { color: statusInfo.color }]}>
                  {getEtaText()}
                </Text>
              </View>
              
              <Ionicons 
                name="chevron-forward-outline" 
                size={20} 
                color="#9CA3AF" 
                style={styles.arrowIcon}
              />
            </View>
          </View>

          {/* 🆕 Progress bar at bottom */}
          {isInProgress && (
            <Animated.View style={[styles.progressContainer]}>
              <Animated.View 
                style={[
                  styles.progressBar, 
                  progressStyle, 
                  { backgroundColor: statusInfo.color }
                ]} 
              />
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingTop: 8,
    elevation: 10,
  },
  glowContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  touchable: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  indicator: {
    marginRight: 12,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  statusContainer: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  driverText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  etaText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    color: '#4B5563',
  },
  arrowIcon: {
    marginLeft: 4,
  },
  // 🆕 Progress bar styles
  progressContainer: {
    width: '100%',
    height: 3,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#8B5CF6',
  },
  // 🆕 Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  liveText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default ActiveOrderBanner;