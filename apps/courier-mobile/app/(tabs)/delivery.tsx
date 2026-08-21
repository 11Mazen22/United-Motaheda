import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Linking } from 'react-native';
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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { CourierUI, useCourierTheme, showToast } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useOrdersStore, type DeliveryStatus } from '@/stores/orders.store';
import { useLocationStore } from '@/stores/location.store';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#020617' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#020617' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
];

const LIGHT_MAP_STYLE = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cce4f0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
  { featureType: 'landscape.man_made', stylers: [{ color: '#f1f5f9' }] },
];

const STATUS_CONFIG: Record<string, { label: string; colorKey: string; next: string; icon: string }> = {
  ACCEPTED: { label: 'Start Pickup', colorKey: 'statusInfo', next: 'EN_ROUTE_TO_PICKUP', icon: 'navigate' },
  EN_ROUTE_TO_PICKUP: { label: 'Confirm Arrival', colorKey: 'statusWarning', next: 'ARRIVED_AT_PHARMACY', icon: 'flag' },
  ARRIVED_AT_PHARMACY: { label: 'Confirm Pickup', colorKey: 'statusWarning', next: 'PICKED_UP', icon: 'cube' },
  PICKED_UP: { label: 'Start Delivery', colorKey: 'statusInfo', next: 'EN_ROUTE_TO_CUSTOMER', icon: 'navigate' },
  EN_ROUTE_TO_CUSTOMER: { label: 'Confirm Arrival', colorKey: 'statusWarning', next: 'ARRIVED_AT_CUSTOMER', icon: 'flag' },
  ARRIVED_AT_CUSTOMER: { label: 'Confirm Delivery', colorKey: 'statusSuccess', next: 'DELIVERED', icon: 'checkmark-circle' },
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

function DriverMarker({ isDark, colors }: { isDark: boolean, colors: any }) {
  return (
    <View style={[s.driverMarker, { backgroundColor: isDark ? colors.canvas.surface : colors.white, borderColor: colors.brand.primary }]}>
      <View style={s.driverInner}>
        <Ionicons name="navigate" size={18} color={colors.brand.primary} />
      </View>
      <View style={[s.driverPulse, { backgroundColor: colors.brand.primaryLight }]} />
    </View>
  );
}

function PharmacyMarker({ colors }: { colors: any }) {
  return (
    <View style={[s.marker, { backgroundColor: colors.delivery.pickup, borderColor: colors.white }]}>
      <Ionicons name="medical" size={16} color={colors.text.inverse} />
    </View>
  );
}

function CustomerMarker({ colors }: { colors: any }) {
  return (
    <View style={[s.marker, { backgroundColor: colors.delivery.dropoff, borderColor: colors.white }]}>
      <Ionicons name="home" size={16} color={colors.text.inverse} />
    </View>
  );
}

function SuccessState({ theme }: { theme: any }) {
  return (
    <Animated.View entering={FadeIn.springify()} style={[s.successWrap, { backgroundColor: theme.colors.canvas.screen }]}>
      <View style={[s.successIcon, { backgroundColor: theme.colors.status.success + '20' }]}>
        <Ionicons name="checkmark-circle" size={64} color={theme.colors.status.success} />
      </View>
      <CourierUI.Typography scale="sectionHead" align="center">
        Delivery Complete!
      </CourierUI.Typography>
      <CourierUI.Typography scale="bodySm" color="secondary" align="center">
        Great job! Returning to dashboard…
      </CourierUI.Typography>
      <ActivityIndicator size="small" color={theme.colors.brand.primary} style={{ marginTop: 16 }} />
    </Animated.View>
  );
}

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { theme, isDark, colors } = useCourierTheme();
  const order = useOrdersStore((s) => s.activeDelivery);
  const clearDelivery = useOrdersStore((s) => s.clearActive);
  const location = useLocationStore();
  const mapRef = useRef<MapView>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const gpsWarning = location.warning;
  const isPermissionDenied = gpsWarning?.toLowerCase().includes('permission denied');
  const isServicesDisabled = gpsWarning?.toLowerCase().includes('location services disabled');
  const isPoorAccuracy = gpsWarning?.toLowerCase().includes('accuracy') && !isPermissionDenied && !isServicesDisabled;
  const hasLocation = location.latitude != null && location.longitude != null;

  const gpsBannerConfig = (() => {
    if (isPermissionDenied) {
      return {
        icon: 'location-outline' as const,
        text: 'Location permission denied. Enable it in settings to continue.',
        color: colors.status.warning,
      };
    }
    if (isServicesDisabled) {
      return {
        icon: 'settings-outline' as const,
        text: 'Location services are disabled. Please enable them in your device settings.',
        color: colors.status.error,
      };
    }
    if (isPoorAccuracy) {
      return {
        icon: 'warning-outline' as const,
        text: gpsWarning ?? 'Poor GPS accuracy. Move to an open area.',
        color: colors.status.warning,
      };
    }
    if (!hasLocation) {
      return {
        icon: 'location-outline' as const,
        text: 'Acquiring GPS signal…',
        color: colors.text.primary,
      };
    }
    return null;
  })();

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.4, { duration: 1200 }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1 - (pulse.value - 1) * 1.2,
  }));

  const mapStyle = isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;

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
        setShowSuccess(true);
        showToast('Delivery completed! Great job.', 'success');
        qc.invalidateQueries({ queryKey: ['driverProfile'] });
        setTimeout(() => {
          clearDelivery();
          router.replace('/(tabs)');
        }, 2000);
      } else {
        showToast(`Status updated: ${STEP_LABELS[vars] ?? vars}`, 'success');
        useOrdersStore.setState((s) => ({
          ...s,
          activeDelivery: s.activeDelivery
            ? { ...s.activeDelivery, status: vars as DeliveryStatus }
            : null,
        }));
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update status. Please try again.';
      showToast(message, 'error');
    },
  });

  if (showSuccess) {
    return <SuccessState theme={theme} />;
  }

  if (!order) {
    return (
      <View style={[s.empty, { backgroundColor: theme.colors.canvas.screen }]}>
        <CourierUI.EmptyState
          title="No Active Delivery"
          subtitle="You don't have an delivery in progress right now."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const currentStatus = order.status;
  const currentStepIndex = ALL_STATUSES.indexOf(currentStatus as any);
  const conf = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG['ACCEPTED'];

  const statusColorMap: Record<string, string> = {
    statusInfo: colors.status.info,
    statusWarning: colors.status.warning,
    statusSuccess: colors.status.success,
    statusError: colors.status.error,
  };
  const statusColor = statusColorMap[conf.colorKey] ?? colors.status.info;

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
    <View style={[s.root, { backgroundColor: theme.colors.canvas.screen }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
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
        accessibilityLabel="Delivery route map"
      >
        <Polyline
          coordinates={routeCoords}
          strokeColor={colors.brand.primary}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />

        <Marker coordinate={{ latitude: pharmLat, longitude: pharmLng }}>
          <PharmacyMarker colors={colors} />
        </Marker>

        <Marker coordinate={{ latitude: custLat, longitude: custLng }}>
          <CustomerMarker colors={colors} />
        </Marker>

        {location.latitude != null && location.longitude != null && (
          <Marker
            coordinate={{ latitude: driverLat, longitude: driverLng }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={location.heading ?? 0}
          >
            <DriverMarker isDark={isDark} colors={colors} />
          </Marker>
        )}
      </MapView>

      <SafeAreaView edges={['top']} style={s.topBar}>
        <TouchableOpacity
          style={[
            s.backBtnTop,
            {
              backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.92)',
              borderColor: colors.border.default,
            },
          ]}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View
          style={[
            s.gpsChip,
            {
              backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.92)',
              borderColor: colors.border.default,
            },
          ]}
          accessibilityLabel="GPS tracking active"
        >
          <View style={[s.gpsDot, { backgroundColor: colors.brand.primary }]} />
          <CourierUI.Typography scale="badge" color="brand">GPS TRACKING</CourierUI.Typography>
        </View>

        {gpsBannerConfig && (
          <TouchableOpacity
            style={[s.gpsWarningBanner, { backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)', borderColor: colors.border.default }]}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel={`${gpsBannerConfig.text} Tap to open settings`}
            accessibilityLiveRegion="polite"
          >
            <Ionicons name={gpsBannerConfig.icon} size={16} color={gpsBannerConfig.color} />
            <CourierUI.Typography scale="badge" style={{ color: gpsBannerConfig.color, flex: 1 }}>
              {gpsBannerConfig.text}
            </CourierUI.Typography>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <Animated.View entering={FadeInDown.springify().damping(18)} style={s.bottomSheet}>
        <View
          style={[
            s.sheetContent,
            {
              backgroundColor: theme.colors.canvas.surface,
              borderColor: colors.border.default,
            },
          ]}
        >
          <View style={[s.sheetHandle, { backgroundColor: colors.border.default }]} />

          <View style={s.sheetHeader}>
            <View style={s.etaBlock}>
              <Ionicons name="time-outline" size={16} color={colors.brand.primary} />
              <CourierUI.Typography scale="bodySm" color="secondary">
                Est. {order.estimatedEarnings} EGP · {order.order.itemCount} items
              </CourierUI.Typography>
            </View>
            <CourierUI.Typography scale="priceLg" style={{ color: colors.brand.primary }}>
              {parseFloat(order.estimatedEarnings).toFixed(0)} EGP
            </CourierUI.Typography>
          </View>

          <View style={s.timelineBlock}>
            {ALL_STATUSES.slice(0, -1).map((status, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              const isCurrent = status === currentStatus;
              const dotColor = isPast
                ? colors.status.success
                : isCurrent
                  ? statusColor
                  : colors.text.disabled;

              return (
                <React.Fragment key={status}>
                  <View style={s.timelineItem}>
                    <View
                      style={[
                        s.tDot,
                        {
                          backgroundColor: dotColor,
                          borderColor: isCurrent ? statusColor : 'transparent',
                          borderWidth: isCurrent ? 2 : 0,
                        },
                      ]}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <CourierUI.Typography
                        scale="caption"
                        color={isActive ? 'primary' : 'secondary'}
                      >
                        {STEP_LABELS[status]}
                      </CourierUI.Typography>
                    </View>
                  </View>
                  {idx < ALL_STATUSES.length - 2 && (
                    <View
                      style={[
                        s.tLine,
                        { backgroundColor: isPast ? colors.status.success : colors.border.default },
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          <View style={s.addressBlock}>
            <View style={s.addressRow}>
              <View style={[s.addrIcon, { backgroundColor: colors.delivery.pickup + '25' }]}>
                <Ionicons name="medical" size={16} color={colors.delivery.pickup} />
              </View>
              <View style={{ flex: 1 }}>
                <CourierUI.Typography scale="caption" color="brand">Pickup</CourierUI.Typography>
                <CourierUI.Typography scale="bodySm" color="primary" numberOfLines={1}>
                  {order.pharmacyAddress}
                </CourierUI.Typography>
              </View>
            </View>
            <View style={s.addressRow}>
              <View style={[s.addrIcon, { backgroundColor: colors.delivery.dropoff + '25' }]}>
                <Ionicons name="home" size={16} color={colors.delivery.dropoff} />
              </View>
              <View style={{ flex: 1 }}>
                <CourierUI.Typography scale="caption" color="danger">Dropoff</CourierUI.Typography>
                <CourierUI.Typography scale="bodySm" color="primary" numberOfLines={2}>
                  {order.order.customerAddress}
                </CourierUI.Typography>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              s.actionBtn,
              {
                backgroundColor: statusColor,
                minHeight: 48,
              },
            ]}
            onPress={() => updateMutation.mutate(conf.next as DeliveryStatus)}
            disabled={updateMutation.isPending}
            activeOpacity={0.85}
            accessibilityLabel={conf.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: updateMutation.isPending }}
          >
            <View style={s.actionBtnInner}>
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.colors.text.inverse} />
              ) : (
                <Ionicons name={conf.icon as any} size={22} color={theme.colors.text.inverse} />
              )}
              <CourierUI.Typography scale="buttonMd" color="inverse" style={{ fontWeight: '800' }}>
                {updateMutation.isPending ? 'Updating…' : conf.label}
              </CourierUI.Typography>
            </View>
            {!updateMutation.isPending && (
              <Ionicons name="chevron-forward" size={22} color={theme.colors.text.inverse} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
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
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
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
  gpsWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    marginTop: 8,
    alignSelf: 'center',
  },
});
