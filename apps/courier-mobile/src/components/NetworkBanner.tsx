import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@pharmacy/ui-native/courier-tokens';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function NetworkBanner() {
  const { isConnected } = useNetworkStatus();
  const translateY = useSharedValue(-48);

  useEffect(() => {
    translateY.value = withTiming(isConnected ? -48 : 0, { duration: 300 });
  }, [isConnected]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[s.banner, animStyle]} pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
      <Text style={s.text}>No internet connection</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: colors.error,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing[2],
    paddingBottom: spacing[1],
    zIndex: 9998,
  },
  text: { color: colors.white, fontSize: typography.sm, fontFamily: typography.medium },
});
