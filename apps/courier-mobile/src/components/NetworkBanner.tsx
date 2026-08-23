import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing } from '@pharmacy/ui-native/courier-tokens';
import { useCourierTheme } from '@pharmacy/ui-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function NetworkBanner() {
  const { colors } = useCourierTheme();
  const { isConnected } = useNetworkStatus();
  const translateY = useSharedValue(-48);

  useEffect(() => {
    translateY.value = withTiming(isConnected ? -48 : 0, { duration: 300 });
  }, [isConnected, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View 
      style={[s.banner, animStyle, { backgroundColor: colors.status.error }]} 
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={isConnected ? 'Internet connection restored' : 'No internet connection'}
    >
      <Ionicons name={isConnected ? 'cloud-done-outline' : 'cloud-offline-outline'} size={16} color={colors.text.inverse} />
      <Text style={[s.text, { color: colors.text.inverse }]}>
        {isConnected ? 'Back online' : 'No internet connection'}
      </Text>
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing[2],
    paddingBottom: spacing[1],
    zIndex: 9998,
  },
  text: { fontSize: typography.sm, fontFamily: typography.medium },
});
