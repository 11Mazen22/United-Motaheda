import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withSpring, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors } from '@pharmacy/ui-native/courier-tokens';
import { driverApi } from '@/lib/api';
import { useOrdersStore, type DeliveryStatus } from '@/stores/orders.store';
import { Text as UIText, showToast } from '@pharmacy/ui-native';

const { width, height } = Dimensions.get('window');

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#020617" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#020617" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
];

const STATUS_CONFIG: Record<string, { label: string, color: string, next: string }> = {
  ACCEPTED: { label: "Head to Pharmacy", color: "#3b82f6", next: "EN_ROUTE_TO_PICKUP" },
  EN_ROUTE_TO_PICKUP: { label: "Arrived at Pharmacy", color: "#3b82f6", next: "ARRIVED_AT_PHARMACY" },
  ARRIVED_AT_PHARMACY: { label: "Confirm Pickup", color: "#eab308", next: "PICKED_UP" },
  PICKED_UP: { label: "Head to Customer", color: "#00ffcc", next: "EN_ROUTE_TO_CUSTOMER" },
  EN_ROUTE_TO_CUSTOMER: { label: "Arrived at Customer", color: "#00ffcc", next: "ARRIVED_AT_CUSTOMER" },
  ARRIVED_AT_CUSTOMER: { label: "Complete Delivery", color: "#22c55e", next: "DELIVERED" }
};

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const order = useOrdersStore((s) => s.activeDelivery);
  const clearDelivery = useOrdersStore((s) => s.clearActiveDelivery);
  const mapRef = useRef<MapView>(null);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.5, { duration: 1000 }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1 - (pulse.value - 1),
  }));

  const updateMutation = useMutation({
    mutationFn: async (newStatus: DeliveryStatus): Promise<any> => {
      if (!order?.orderId) throw new Error('No active order ID');
      return driverApi.updateDeliveryStatus(order.orderId, newStatus);
    },
    onSuccess: (_, vars) => {
      if (vars === 'DELIVERED') {
        showToast('Delivery completed! Great job.', 'success');
        clearDelivery();
        qc.invalidateQueries({ queryKey: ['driverProfile'] });
        router.replace('/(tabs)');
      } else {
        showToast(Status updated to );
        useOrdersStore.setState(s => {
          if (s.activeDelivery) s.activeDelivery.status = vars as DeliveryStatus;
        });
      }
    },
  });

  if (!order) return null;

  // Fallback coordinates if customer GPS is missing
  const custLat = order.shippingAddress?.lat ?? 30.0444;
  const custLng = order.shippingAddress?.lng ?? 31.2357;
  
  const pharmLat = order.pharmacyLocation?.lat ?? custLat - 0.01;
  const pharmLng = order.pharmacyLocation?.lng ?? custLng - 0.01;

  const currentConf = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['ACCEPTED'];

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        customMapStyle={MAP_STYLE}
        initialRegion={{
          latitude: (custLat + pharmLat) / 2,
          longitude: (custLng + pharmLng) / 2,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
      >
        <Polyline coordinates={[{ latitude: pharmLat, longitude: pharmLng }, { latitude: custLat, longitude: custLng }]} strokeColor="#1e293b" strokeWidth={3} lineDashPattern={[5, 5]} />
        
        {/* Pharmacy Marker */}
        <Marker coordinate={{ latitude: pharmLat, longitude: pharmLng }}>
          <View style={[s.markerWrap, { backgroundColor: '#3b82f6' }]}>
            <Ionicons name="medical" size={16} color="white" />
          </View>
        </Marker>

        {/* Precise Customer GPS Marker */}
        <Marker coordinate={{ latitude: custLat, longitude: custLng }}>
          <View style={s.customerMarker}>
            <Animated.View style={[s.pulseRing, pulseStyle]} />
            <View style={s.markerWrap}>
              <Ionicons name="home" size={16} color="white" />
            </View>
          </View>
        </Marker>
      </MapView>

      <SafeAreaView style={s.topNav} edges={['top']}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={s.gpsBadge}>
          <View style={s.gpsDot} />
          <UIText style={{ color: '#00ffcc', fontFamily: 'Cairo_700Bold', fontSize: 12 }}>GPS ACTIVE</UIText>
        </View>
      </SafeAreaView>

      <Animated.View entering={FadeInDown.springify().damping(18)} style={s.bottomSheet}>
        <LinearGradient colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.9)', '#020617']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
        
        <View style={s.sheetContent}>
          <View style={s.sheetHeader}>
            <View style={s.timerBadge}>
              <Ionicons name="time" size={14} color="white" />
              <UIText style={{ color: 'white', marginLeft: 4, fontFamily: 'Cairo_700Bold' }}>12 MIN EST</UIText>
            </View>
            <UIText style={{ color: '#00ffcc', fontFamily: 'Cairo_800ExtraBold', fontSize: 24 }}>{order.earningsFormatted}</UIText>
          </View>

          <View style={s.addressBlock}>
            <View style={s.timeline}>
              <View style={[s.tDot, { backgroundColor: '#3b82f6' }]} />
              <View style={s.tLine} />
              <View style={[s.tDot, { backgroundColor: '#ef4444' }]} />
            </View>
            <View style={s.addressInfo}>
              <View style={s.aRow}>
                <UIText style={s.aTitle}>Pickup</UIText>
                <UIText style={s.aSub} numberOfLines={1}>{order.pharmacyName}</UIText>
              </View>
              <View style={[s.aRow, { marginTop: 24 }]}>
                <UIText style={s.aTitle}>Precise Dropoff</UIText>
                <UIText style={s.aSub} numberOfLines={2}>{order.shippingAddress?.street}</UIText>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={s.actionBtn}
            disabled={updateMutation.isPending}
            onPress={() => updateMutation.mutate(currentConf.next as DeliveryStatus)}
          >
            <LinearGradient colors={[currentConf.color, currentConf.color + 'aa']} style={StyleSheet.absoluteFillObject} borderRadius={16} />
            <UIText style={s.actionText}>{updateMutation.isPending ? 'Updating...' : currentConf.label}</UIText>
            <Ionicons name="chevron-forward" size={24} color="#020617" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  markerWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#00ffcc', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#020617' },
  customerMarker: { alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,255,204,0.3)' },
  topNav: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16 },
  backBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(2,6,23,0.8)', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(2,6,23,0.8)', paddingHorizontal: 12, borderRadius: 100 },
  gpsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00ffcc', marginRight: 8 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 24, paddingTop: 60 },
  sheetContent: { backgroundColor: '#0f172a', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: '#1e293b', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addressBlock: { flexDirection: 'row', marginBottom: 32 },
  timeline: { width: 24, alignItems: 'center', marginRight: 12 },
  tDot: { width: 12, height: 12, borderRadius: 6 },
  tLine: { width: 2, height: 40, backgroundColor: '#1e293b', marginVertical: 4 },
  addressInfo: { flex: 1 },
  aRow: { flex: 1 },
  aTitle: { color: '#64748b', fontSize: 12, fontFamily: 'Cairo_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  aSub: { color: 'white', fontSize: 16, fontFamily: 'Cairo_600SemiBold', marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 18, borderRadius: 16 },
  actionText: { color: '#020617', fontSize: 18, fontFamily: 'Cairo_900Black', textTransform: 'uppercase', letterSpacing: 1 }
});
