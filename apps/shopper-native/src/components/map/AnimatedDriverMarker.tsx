/**
 * Animated Driver Marker Component
 * 
 * A custom marker that smoothly animates the driver's position on the map
 * when new location coordinates arrive via Supabase Realtime.
 * Uses React Native Reanimated for smooth interpolation.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface AnimatedDriverMarkerProps {
  /** Current driver coordinates */
  coordinate: {
    latitude: number;
    longitude: number;
  };
  /** Driver name (shown in tooltip) */
  driverName?: string;
  /** Driver photo URL (optional) */
  driverPhoto?: string;
  /** Whether to show the pulse animation */
  showPulse?: boolean;
}

export const AnimatedDriverMarker: React.FC<AnimatedDriverMarkerProps> = ({
  coordinate,
  driverName = 'السائق',
  driverPhoto,
  showPulse = true,
}) => {
  // Animated values
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);
  const glowOpacity = useSharedValue(0);

  // Track previous coordinates for smooth transitions
  const prevCoords = useRef(coordinate);

  // Animated styles
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Animate marker when coordinates change
  useEffect(() => {
    // Bounce animation when location updates
    scale.value = withSequence(
      withSpring(1.3, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 150 })
    );

    // Subtle rotation for movement effect
    rotation.value = withSequence(
      withTiming(-5, { duration: 100 }),
      withTiming(5, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );

    // Update previous coordinates
    prevCoords.current = coordinate;
  }, [coordinate]);

  // Pulse animation (continuous)
  useEffect(() => {
    if (showPulse) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );

      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1,
        true
      );

      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1500 }),
          withTiming(0.1, { duration: 1500 })
        ),
        -1,
        true
      );
    }
  }, [showPulse]);

  return (
    <Marker
      coordinate={coordinate}
      title={driverName}
      description="السائق في طريقه إليك"
      tracksViewChanges={false}
    >
      <View style={styles.container}>
        {/* Pulse ring */}
        {showPulse && (
          <Animated.View style={[styles.pulseRing, pulseStyle]} />
        )}

        {/* Glow effect */}
        {showPulse && (
          <Animated.View style={[styles.glowRing, glowStyle]} />
        )}

        {/* Main marker with animation */}
        <Animated.View style={[styles.marker, markerStyle]}>
          <View style={styles.markerInner}>
            {driverPhoto ? (
              <Image source={{ uri: driverPhoto }} style={styles.driverImage} />
            ) : (
              <View style={styles.driverImagePlaceholder}>
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Small car indicator */}
        <View style={styles.carIndicator}>
          <Ionicons name="car" size={10} color="#8B5CF6" />
        </View>

        {/* Driver name tooltip */}
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText} numberOfLines={1}>
            {driverName}
          </Text>
        </View>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  markerInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  driverImagePlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#8B5CF6',
    zIndex: 0,
  },
  glowRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#8B5CF6',
    zIndex: -1,
  },
  carIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    zIndex: 11,
  },
  tooltip: {
    position: 'absolute',
    top: -32,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 80,
    zIndex: 5,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default AnimatedDriverMarker;