import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { CourierUI, useCourierTheme, showToast } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useOrdersStore, type DeliveryStatus } from '@/stores/orders.store';
import { useLocationStore } from '@/stores/location.store';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/lib/mapStyles';
import { useGpsBanner } from '@/hooks/useGpsBanner';
import { DriverMarker, PharmacyMarker, CustomerMarker } from '@/components/MapMarkers';

type DeliveryColors = {
  canvas: { screen: string; surface: string; surfaceMuted: string; overlay: string };
  brand: { primary: string; primaryLight: string; primaryDark: string; accent: string };
  text: { primary: string; secondary: string; inverse: string; muted: string; disabled: string };
  status: { success: string; warning: string; error: string; info: string };
  delivery: { pickup: string; dropoff: string };
  white: string;
  border: { default: string };
};

type DeliveryTheme = { colors: DeliveryColors };

const STATUS_CONFIG: Record<string, { labelKey: string; colorKey: string; next: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  ACCEPTED: { labelKey: 'delivery.actionStartPickup', colorKey: 'statusInfo', next: 'EN_ROUTE_TO_PICKUP', icon: 'navigate' },
  EN_ROUTE_TO_PICKUP: { labelKey: 'delivery.actionConfirmArrival', colorKey: 'statusWarning', next: 'ARRIVED_AT_PHARMACY', icon: 'flag' },
  ARRIVED_AT_PHARMACY: { labelKey: 'delivery.actionConfirmPickup', colorKey: 'statusWarning', next: 'PICKED_UP', icon: 'cube' },
  PICKED_UP: { labelKey: 'delivery.actionStartDelivery', colorKey: 'statusInfo', next: 'EN_ROUTE_TO_CUSTOMER', icon: 'navigate' },
  EN_ROUTE_TO_CUSTOMER: { labelKey: 'delivery.actionConfirmArrival', colorKey: 'statusWarning', next: 'ARRIVED_AT_CUSTOMER', icon: 'flag' },
  ARRIVED_AT_CUSTOMER: { labelKey: 'delivery.actionConfirmDelivery', colorKey: 'statusSuccess', next: 'DELIVERED', icon: 'checkmark-circle' },
};

const STEP_LABEL_KEYS: Record<string, string> = {
  ACCEPTED: 'delivery.stepAccepted',
  EN_ROUTE_TO_PICKUP: 'delivery.stepEnRoute',
  ARRIVED_AT_PHARMACY: 'delivery.stepAtPharmacy',
  PICKED_UP: 'delivery.stepPickedUp',
  EN_ROUTE_TO_CUSTOMER: 'delivery.stepEnRoute',
  ARRIVED_AT_CUSTOMER: 'delivery.stepAtCustomer',
  DELIVERED: 'delivery.stepDelivered',
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

function SuccessState({ theme }: { theme: DeliveryTheme }) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeIn.springify()} style={[s.successWrap, { backgroundColor: theme.colors.canvas.screen }]}>
      <View style={[s.successIcon, { backgroundColor: theme.colors.status.success + '20' }]}>
        <Ionicons name="checkmark-circle" size={64} color={theme.colors.status.success} />
      </View>
      <CourierUI.Typography scale="sectionHead" align="center">
        {t('delivery.complete')}
      </CourierUI.Typography>
      <CourierUI.Typography scale="bodySm" color="secondary" align="center">
        {t('delivery.completeSubtitle')}
      </CourierUI.Typography>
      <ActivityIndicator size="small" color={theme.colors.brand.primary} style={{ marginTop: 16 }} />
    </Animated.View>
  );
}

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { theme, isDark, colors } = useCourierTheme();
  const order = useOrdersStore((s) => s.activeDelivery);
  const clearDelivery = useOrdersStore((s) => s.clearActive);
  const location = useLocationStore();
  const mapRef = useRef<MapView>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const gpsWarning = location.warning;
  const hasLocation = location.latitude != null && location.longitude != null;
  const gpsBannerConfig = useGpsBanner(gpsWarning, hasLocation, colors, t);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.4, { duration: 1200 }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapStyle = isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;

  const updateMutation = useMutation({
    mutationFn: async (newStatus: DeliveryStatus): Promise<unknown> => {
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
        showToast(t('delivery.completedToast'), 'success');
        qc.invalidateQueries({ queryKey: ['driverProfile'] });
        setTimeout(() => {
          clearDelivery();
          router.replace('/(tabs)');
        }, 2000);
      } else {
        showToast(t('delivery.statusUpdated', { status: t(STEP_LABEL_KEYS[vars] ?? vars) }), 'success');
        useOrdersStore.setState((s) => ({
          ...s,
          activeDelivery: s.activeDelivery
            ? { ...s.activeDelivery, status: vars as DeliveryStatus }
            : null,
        }));
      }
    },
    onError: (error: unknown) => {
      const fallback = t('delivery.updateFailed');
      const message =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response: { data?: { message?: string } } }).response?.data?.message || fallback
          : typeof error === 'object' && error !== null && 'message' in error
            ? (error as Error).message || fallback
            : fallback;
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
          icon="bicycle-outline"
          title={t('delivery.noActiveTitle')}
          subtitle={t('delivery.noActiveSubtitle')}
          actionLabel={t('delivery.goBack')}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const currentStatus = order.status;
  const currentStepIndex = ALL_STATUSES.indexOf(currentStatus as typeof ALL_STATUSES[number]);
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
        accessibilityLabel={t('delivery.routeMapA11y')}
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
          style={[s.backBtnTop, { borderColor: colors.border.default }]}
          onPress={() => router.back()}
          accessibilityLabel={t('delivery.backA11y')}
          accessibilityRole="button"
        >
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.55)' }]} />
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View
          style={[s.gpsChip, { borderColor: colors.border.default }]}
          accessibilityLabel={t('delivery.gpsActiveA11y')}
        >
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.55)' }]} />
          <View style={[s.gpsDot, { backgroundColor: colors.brand.primary }]} />
          <CourierUI.Typography scale="badge" color="brand">{t('delivery.gpsTracking')}</CourierUI.Typography>
        </View>

        {gpsBannerConfig && (
          <TouchableOpacity
            style={[s.gpsWarningBanner, { borderColor: colors.border.default }]}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel={t('delivery.tapToOpenSettings', { text: gpsBannerConfig.text })}
            accessibilityLiveRegion="polite"
          >
            <BlurView intensity={45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.6)' }]} />
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
                {t('delivery.estimate', { amount: order.estimatedEarnings, count: order.order.itemCount })}
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
                        {t(STEP_LABEL_KEYS[status])}
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
                <CourierUI.Typography scale="caption" color="brand">{t('delivery.pickup')}</CourierUI.Typography>
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
                <CourierUI.Typography scale="caption" color="danger">{t('delivery.dropoff')}</CourierUI.Typography>
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
            accessibilityLabel={t(conf.labelKey)}
            accessibilityRole="button"
            accessibilityState={{ disabled: updateMutation.isPending }}
          >
            <View style={s.actionBtnInner}>
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.colors.text.inverse} />
              ) : (
                <Ionicons name={conf.icon} size={22} color={theme.colors.text.inverse} />
              )}
              <CourierUI.Typography scale="buttonMd" color="inverse" style={{ fontWeight: '800' }}>
                {updateMutation.isPending ? t('delivery.updating') : t(conf.labelKey)}
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
    overflow: 'hidden',
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    overflow: 'hidden',
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
    overflow: 'hidden',
  },
});
