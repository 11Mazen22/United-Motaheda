import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { CourierUI, kit, showToast } from '@pharmacy/ui-native';
import { colors as courierColors } from '@pharmacy/ui-native/courier-tokens';
import { driverApi } from '@/lib/api';
import { useOrdersStore, type DeliveryStatus } from '@/stores/orders.store';
import { useLocationStore } from '@/stores/location.store';

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#020617' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#020617' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; next: string; icon: string }> = {
  ACCEPTED: { label: 'Start Pickup', color: courierColors.statusAccepted, next: 'EN_ROUTE_TO_PICKUP', icon: 'navigate' },
  EN_ROUTE_TO_PICKUP: { label: 'Confirm Arrival', color: courierColors.statusEnRoute, next: 'ARRIVED_AT_PHARMACY', icon: 'flag' },
  ARRIVED_AT_PHARMACY: { label: 'Confirm Pickup', color: courierColors.statusArrived, next: 'PICKED_UP', icon: 'cube' },
  PICKED_UP: { label: 'Start Delivery', color: courierColors.statusAccepted, next: 'EN_ROUTE_TO_CUSTOMER', icon: 'navigate' },
  EN_ROUTE_TO_CUSTOMER: { label: 'Confirm Arrival', color: courierColors.statusEnRoute, next: 'ARRIVED_AT_CUSTOMER', icon: 'flag' },
  ARRIVED_AT_CUSTOMER: { label: 'Confirm Delivery', color: courierColors.statusDelivered, next: 'DELIVERED', icon: 'checkmark-circle' },
};

const STEP_LABELS: Record<string, string> = {
  ACCEPTED: 'Order Accepted',
  EN_ROUTE_TO_PICKUP: 'En Route',
  ARRIVED_AT_PHARMACY: 'At Pharmacy',
  PICKED_UP: 'Picked Up',
  EN_ROUTE_TO_CUSTOMER: 'En Route',
  ARRIVED_AT_CUSTOMER: 'At Customer',
  DELIVERED: 'Delivered',
};

const ALL_STATUSES = [
  'ACCEPTED',
  'EN_ROUTE_TO_PICKUP',
  'ARRIVED_AT_PHARMACY',
  'PICKED_UP',
  'EN_ROUTE_TO_CUSTOMER',
  'ARRIVED_AT_CUSTOMER',
  'DELIVERED',
] as const;

function DriverMarker() {
  return (
    <View style={s.driverMarker}>
      <View style={s.driverInner}>
        <Ionicons name="navigate" size={18} color={kit.darkColor.accent} />
      </View>
      <View style={s.driverPulse} />
    </View>
  );
}

function PharmacyMarker() {
  return (
    <View style={[s.marker, { backgroundColor: courierColors.mapPickup }]}>
      <Ionicons name="medical" size={16} color="#fff" />
    </View>
  );
}

function CustomerMarker() {
  return (
    <View style={[s.marker, { backgroundColor: courierColors.mapDelivery }]}>
      <Ionicons name="home" size={16} color="#fff" />
    </View>
  );
}

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const order = useOrdersStore((s) => s.activeDelivery);
  const clearDelivery = useOrdersStore((s) => s.clearActive);
  const location = useLocationStore();
  const mapRef = useRef<MapView>(null);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.4, { duration: 1200 }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1 - (pulse.value - 1) * 1.2,
  }));

  const updateMutation = useMutation({
    mutationFn: async (newStatus: DeliveryStatus): Promise<any> => {
      if (!order?.order?.id) throw new Error('No active order ID');
      const orderId = order.order.id;
      switch (newStatus) {
        case 'EN_ROUTE_TO_PICKUP':
          return driverApi.enRouteToPickup(orderId);
        case 'ARRIVED_AT_PHARMACY':
          return driverApi.arrivedPharmacy(orderId, order.pharmacyLat, order.pharmacyLng);
        case 'PICKED_UP':
          return driverApi.pickedUp(orderId);
        case 'EN_ROUTE_TO_CUSTOMER':
          return driverApi.enRouteToCustomer(orderId);
        case 'ARRIVED_AT_CUSTOMER':
          return driverApi.arrivedCustomer(orderId, order.order.customerLat ?? 0, order.order.customerLng ?? 0);
        case 'DELIVERED':
          return driverApi.completeDelivery(orderId, {});
        default:
          throw new Error(`Unknown status: ${newStatus}`);
      }
    },
    onSuccess: (_, vars) => {
      if (vars === 'DELIVERED') {
        showToast('Delivery completed! Great job.', 'success');
        clearDelivery();
        qc.invalidateQueries({ queryKey: ['driverProfile'] });
        router.replace('/(tabs)');
      } else {
        showToast(`Status: ${STEP_LABELS[vars] ?? vars}`);
        useOrdersStore.setState((s) => ({
          ...s,
          activeDelivery: s.activeDelivery
            ? { ...s.activeDelivery, status: vars as DeliveryStatus }
            : null,
        }));
      }
    },
    onError: () => showToast('Failed to update status', 'error'),
  });

  if (!order) {
    return (
      <View style={s.empty}>
        <CourierUI.Typography scale="sectionHead" color="secondary">
          No active delivery
        </CourierUI.Typography>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <CourierUI.Typography scale="buttonMd" color="inverse">Go Back</CourierUI.Typography>
        </Pressable>
      </View>
    );
  }

  const currentStatus = order.status;
  const currentStepIndex = ALL_STATUSES.indexOf(currentStatus as any);
  const conf = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG['ACCEPTED'];

  const pharmLat = order.pharmacyLat ?? 30.0444;
  const pharmLng = order.pharmacyLng ?? 31.2357;
  const custLat = order.order.customerLat ?? 30.0544;
  const custLng = order.order.customerLng ?? 31.2457;

  const isPharmacyActive =
    currentStatus === 'ACCEPTED' ||
    currentStatus === 'EN_ROUTE_TO_PICKUP' ||
    currentStatus === 'ARRIVED_AT_PHARMACY' ||
    currentStatus === 'PICKED_UP';

  const destination = isPharmacyActive
    ? { lat: pharmLat, lng: pharmLng, name: order.pharmacyName }
    : { lat: custLat, lng: custLng, name: order.order.customerName };

  const driverLat = location.latitude ?? (pharmLat + custLat) / 2;
  const driverLng = location.longitude ?? (pharmLng + custLng) / 2;

  const routeCoords = [
    { latitude: driverLat, longitude: driverLng },
    { latitude: pharmLat, longitude: pharmLng },
    { latitude: custLat, longitude: custLng },
  ];

  return (
    <View style={s.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        initialRegion={{
          latitude: (driverLat + destination.lat) / 2,
          longitude: (driverLng + destination.lng) / 2,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsTraffic={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        <Polyline
          coordinates={routeCoords}
          strokeColor={courierColors.mapRoute}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />

        <Marker coordinate={{ latitude: pharmLat, longitude: pharmLng }}>
          <PharmacyMarker />
        </Marker>

        <Marker coordinate={{ latitude: custLat, longitude: custLng }}>
          <CustomerMarker />
        </Marker>

        {location.latitude != null && location.longitude != null && (
          <Marker
            coordinate={{ latitude: driverLat, longitude: driverLng }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={location.heading ?? 0}
          >
            <DriverMarker />
          </Marker>
        )}
      </MapView>

      <SafeAreaView edges={['top']} style={s.topBar}>
        <TouchableOpacity style={s.backBtnTop} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={kit.darkColor.ink} />
        </TouchableOpacity>
        <View style={s.gpsChip}>
          <View style={[s.gpsDot, { backgroundColor: kit.darkColor.accent }]} />
          <CourierUI.Typography scale="badge" color="brand">GPS TRACKING</CourierUI.Typography>
        </View>
      </SafeAreaView>

      <Animated.View entering={FadeInDown.springify().damping(18)} style={s.bottomSheet}>
        <LinearGradient
          colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.95)', '#020617']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={s.sheetContent}>
          <View style={s.sheetHandle} />

          <View style={s.sheetHeader}>
            <View style={s.etaBlock}>
              <Ionicons name="time-outline" size={16} color={kit.darkColor.accent} />
              <CourierUI.Typography scale="bodySm" color="secondary">
                Est. {order.estimatedEarnings} EGP · {order.order.itemCount} items
              </CourierUI.Typography>
            </View>
            <CourierUI.Typography scale="priceLg" style={{ color: kit.darkColor.accent }}>
              {parseFloat(order.estimatedEarnings).toFixed(0)} EGP
            </CourierUI.Typography>
          </View>

          <View style={s.timelineBlock}>
            {ALL_STATUSES.slice(0, -1).map((status, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              const isCurrent = status === currentStatus;
              const statusColor = isPast
                ? courierColors.online
                : isCurrent
                  ? conf.color
                  : kit.darkColor.inkFaint;

              return (
                <React.Fragment key={status}>
                  <View style={s.timelineItem}>
                    <View style={[s.tDot, { backgroundColor: statusColor, borderColor: isCurrent ? conf.color : 'transparent', borderWidth: isCurrent ? 2 : 0 }]} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <CourierUI.Typography
                        scale="caption"
                        color={isActive ? 'inverse' : 'secondary'}
                      >
                        {STEP_LABELS[status]}
                      </CourierUI.Typography>
                    </View>
                  </View>
                  {idx < ALL_STATUSES.length - 2 && (
                    <View style={[s.tLine, { backgroundColor: isPast ? courierColors.online : kit.darkColor.line }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          <View style={s.addressBlock}>
            <View style={s.addressRow}>
              <View style={[s.addrIcon, { backgroundColor: courierColors.mapPickup + '25' }]}>
                <Ionicons name="medical" size={16} color={courierColors.mapPickup} />
              </View>
              <View style={{ flex: 1 }}>
                <CourierUI.Typography scale="caption" color="brand">Pickup</CourierUI.Typography>
                <CourierUI.Typography scale="bodySm" color="inverse" numberOfLines={1}>
                  {order.pharmacyAddress}
                </CourierUI.Typography>
              </View>
            </View>
            <View style={s.addressRow}>
              <View style={[s.addrIcon, { backgroundColor: courierColors.mapDelivery + '25' }]}>
                <Ionicons name="home" size={16} color={courierColors.mapDelivery} />
              </View>
              <View style={{ flex: 1 }}>
                <CourierUI.Typography scale="caption" color="danger">Dropoff</CourierUI.Typography>
                <CourierUI.Typography scale="bodySm" color="inverse" numberOfLines={2}>
                  {order.order.customerAddress}
                </CourierUI.Typography>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: conf.color }]}
            onPress={() => updateMutation.mutate(conf.next as DeliveryStatus)}
            disabled={updateMutation.isPending}
            activeOpacity={0.85}
          >
            <View style={s.actionBtnInner}>
              <Ionicons name={conf.icon as any} size={22} color="#020617" />
              <CourierUI.Typography scale="buttonMd" color="inverse" style={{ fontWeight: '800' }}>
                {updateMutation.isPending ? 'Updating…' : conf.label}
              </CourierUI.Typography>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#020617" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: '#020617',
    padding: 24,
  },
  backBtn: {
    backgroundColor: kit.darkColor.surface,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    pointerEvents: 'box-none',
  },
  backBtnTop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(2,6,23,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: kit.darkColor.line,
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(2,6,23,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: kit.darkColor.line,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 72,
  },
  sheetContent: {
    backgroundColor: kit.darkColor.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: kit.darkColor.line,
    gap: 20,
  },
  sheetHandle: {
    position: 'absolute',
    top: 10,
    left: '50%',
    marginLeft: -18,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: kit.darkColor.line,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  etaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineBlock: {
    gap: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  tDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tLine: {
    width: 2,
    height: 16,
    marginLeft: 4,
  },
  addressBlock: {
    gap: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addrIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 16,
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: kit.darkColor.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: kit.darkColor.accent,
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
    backgroundColor: 'rgba(44,203,189,0.2)',
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
