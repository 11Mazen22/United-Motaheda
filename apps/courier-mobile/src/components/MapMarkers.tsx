import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeTheme } from '@pharmacy/ui-native';

/**
 * Shared map marker visuals, used by both the live tracking map (map.tsx)
 * and the active-delivery map (delivery.tsx) so "your position" and the
 * pickup/dropoff pins read as the same design language on both screens.
 */

type Colors = NativeTheme['colors'];

export function DriverMarker({ isDark, colors }: { isDark: boolean; colors: Colors }) {
  return (
    <View style={[s.driverMarker, { backgroundColor: isDark ? colors.canvas.surface : colors.white, borderColor: colors.brand.primary }]}>
      <View style={s.driverInner}>
        <Ionicons name="navigate" size={18} color={colors.brand.primary} />
      </View>
      <View style={[s.driverPulse, { backgroundColor: colors.brand.primaryLight }]} />
    </View>
  );
}

export function PharmacyMarker({ colors }: { colors: Colors }) {
  return (
    <View style={[s.marker, { backgroundColor: colors.delivery.pickup, borderColor: colors.white }]}>
      <Ionicons name="medical" size={16} color={colors.text.inverse} />
    </View>
  );
}

export function CustomerMarker({ colors }: { colors: Colors }) {
  return (
    <View style={[s.marker, { backgroundColor: colors.delivery.dropoff, borderColor: colors.white }]}>
      <Ionicons name="home" size={16} color={colors.text.inverse} />
    </View>
  );
}

const s = StyleSheet.create({
  driverMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  driverInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
