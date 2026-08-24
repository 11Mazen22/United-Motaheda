import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CourierUI, useCourierTheme } from '@pharmacy/ui-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLocationStore } from '@/stores/location.store';
import { useOrdersStore, type ActiveDelivery } from '@/stores/orders.store';
import { haversineMeters } from '@/lib/gps/KalmanFilter';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/lib/mapStyles';
import { DriverMarker, PharmacyMarker, CustomerMarker } from '@/components/MapMarkers';
import { useGpsBanner } from '@/hooks/useGpsBanner';

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

async function fetchRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<{ polyline: { latitude: number; longitude: number }[]; durationMin: number; distanceKm: number } | null> {
  try {
    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey ?? '';
    if (!apiKey) return null;

    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${originLat},${originLng}` +
      `&destination=${destLat},${destLng}` +
      `&mode=driving` +
      `&key=${apiKey}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== 'OK' || !json.routes[0]) return null;

    const route = json.routes[0];
    const leg = route.legs[0];

    return {
      polyline: decodePolyline(route.overview_polyline.points),
      durationMin: Math.ceil(leg.duration.value / 60),
      distanceKm: Math.round(leg.distance.value / 100) / 10,
    };
  } catch {
    return null;
  }
}

type MapColors = {
  canvas: { surface: string; surfaceMuted: string };
  brand: { primary: string };
  text: { primary: string; muted: string; inverse: string };
  status: { success: string; warning: string; error: string };
  border: { default: string };
  delivery: { pickup: string; dropoff: string };
  white: string;
};

function AccuracyDot({ accuracy, colors, t }: { accuracy: number | null, colors: MapColors, t: (key: string) => string }) {
  const level =
    accuracy == null ? 'poor' : accuracy <= 15 ? 'good' : accuracy <= 50 ? 'fair' : 'poor';
  const colorMap = { good: colors.status.success, fair: colors.status.warning, poor: colors.status.error };
  const labelMap = { good: `${Math.round(accuracy ?? 99)}m`, fair: `${Math.round(accuracy ?? 99)}m`, poor: t('map.poorGpsShort') };

  return (
    <View style={[ad.container, { backgroundColor: colors.canvas.surfaceMuted, borderColor: colors.border.default }]}>
      <View style={[ad.dot, { backgroundColor: colorMap[level] }]} />
      <CourierUI.Typography scale="badge" color="primary">{labelMap[level]}</CourierUI.Typography>
    </View>
  );
}

const ad = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

function BottomSheet({
  delivery,
  onNavigate,
  colors,
  t,
}: {
  delivery: ActiveDelivery | null;
  onNavigate: () => void;
  colors: MapColors;
  t: (key: string) => string;
}) {
  if (!delivery) return null;

  const statusLabels: Record<string, string> = {
    ACCEPTED: t('map.headToPharmacy'),
    EN_ROUTE_TO_PICKUP: t('map.navigatingToPharmacy'),
    ARRIVED_AT_PHARMACY: t('map.atPharmacyAwaitingPickup'),
    PICKED_UP: t('map.orderPickedUp'),
    EN_ROUTE_TO_CUSTOMER: t('map.navigatingToCustomer'),
    ARRIVED_AT_CUSTOMER: t('map.atCustomerLocation'),
  };

  const isPharmacyLeg =
    delivery.status === 'ACCEPTED' ||
    delivery.status === 'EN_ROUTE_TO_PICKUP' ||
    delivery.status === 'ARRIVED_AT_PHARMACY' ||
    delivery.status === 'PICKED_UP';

  const destination = isPharmacyLeg
    ? { name: delivery.pharmacyName, address: delivery.pharmacyAddress }
    : { name: delivery.order.customerName, address: delivery.order.customerAddress };

  return (
    <View style={[bs.sheet, { backgroundColor: colors.canvas.surface, borderColor: colors.border.default }]}>
      <View style={[bs.handle, { backgroundColor: colors.border.default }]} />
      <View style={bs.content}>
        <View style={bs.row}>
          <View style={[bs.dot, { backgroundColor: colors.brand.primary }]} />
          <View style={bs.info}>
            <CourierUI.Typography scale="caption" color="secondary">{statusLabels[delivery.status] ?? delivery.status}</CourierUI.Typography>
            <CourierUI.Typography scale="bodySm" color="primary">{destination.name}</CourierUI.Typography>
            <CourierUI.Typography scale="badge" color="secondary" numberOfLines={1}>{destination.address}</CourierUI.Typography>
          </View>
          <TouchableOpacity style={[bs.navBtn, { backgroundColor: colors.brand.primary }]} onPress={onNavigate} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('map.openNavigationA11y')}>
            <Ionicons name="navigate" size={18} color={colors.text.inverse} />
            <CourierUI.Typography scale="badge" color="inverse" style={{ fontWeight: '700' }}>{t('map.go')}</CourierUI.Typography>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const bs = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  info: { flex: 1 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
});

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { t } = useTranslation();
  const { colors, isDark } = useCourierTheme();

  const location = useLocationStore();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);

  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [eta, setEta] = useState<{ durationMin: number; distanceKm: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [lastRouteFetchCoords, setLastRouteFetchCoords] = useState<{ lat: number; lng: number } | null>(null);

  const mapStyle = isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;

  const getDestination = useCallback(() => {
    if (!activeDelivery) return null;
    const isPharmacyLeg =
      activeDelivery.status === 'ACCEPTED' ||
      activeDelivery.status === 'EN_ROUTE_TO_PICKUP' ||
      activeDelivery.status === 'ARRIVED_AT_PHARMACY' ||
      activeDelivery.status === 'PICKED_UP';

    if (isPharmacyLeg) {
      const lat = activeDelivery.pharmacyLat;
      const lng = activeDelivery.pharmacyLng;
      if (
        typeof lat === 'number' && typeof lng === 'number' &&
        lat !== 0 && lng !== 0 &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180
      ) {
        return { lat, lng, type: 'pharmacy' as const };
      }
      return null;
    }

    const cLat = activeDelivery.order.customerLat;
    const cLng = activeDelivery.order.customerLng;
    if (
      cLat && cLng &&
      typeof cLat === 'number' && typeof cLng === 'number' &&
      cLat !== 0 && cLng !== 0 &&
      cLat >= -90 && cLat <= 90 &&
      cLng >= -180 && cLng <= 180
    ) {
      return { lat: cLat, lng: cLng, type: 'customer' as const };
    }

    return null;
  }, [activeDelivery]);

  useEffect(() => {
    if (!location.latitude || !location.longitude) return;

    const dest = getDestination();
    if (!dest) {
      setRoute([]);
      setEta(null);
      return;
    }

    if (lastRouteFetchCoords) {
      const dist = haversineMeters(
        lastRouteFetchCoords.lat,
        lastRouteFetchCoords.lng,
        location.latitude,
        location.longitude,
      );
      if (dist !== null && dist < 100) return;
    }

    const driverLat = location.latitude;
    const driverLng = location.longitude;

    setLoadingRoute(true);
    setLastRouteFetchCoords({ lat: driverLat, lng: driverLng });

    fetchRoute(driverLat, driverLng, dest.lat, dest.lng)
      .then((result) => {
        if (result) {
          setRoute(result.polyline);
          setEta({ durationMin: result.durationMin, distanceKm: result.distanceKm });
        }
      })
      .finally(() => setLoadingRoute(false));
  }, [
    location.latitude,
    location.longitude,
    getDestination,
    lastRouteFetchCoords,
    activeDelivery?.status,
    activeDelivery?.assignmentId,
  ]);

  const centerOnDriver = useCallback(() => {
    if (!location.latitude || !location.longitude) return;
    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      400,
    );
  }, [location.latitude, location.longitude]);

  const openNavigation = useCallback(() => {
    const dest = getDestination();
    if (!dest) {
      const address = activeDelivery
        ? (
            activeDelivery.status === 'EN_ROUTE_TO_CUSTOMER' ||
            activeDelivery.status === 'ARRIVED_AT_CUSTOMER'
              ? activeDelivery.order.customerAddress
              : activeDelivery.pharmacyAddress
          )
        : null;

      if (address) {
        const encoded = encodeURIComponent(address);
        const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
        Linking.openURL(url).catch(() => {});
      }
      return;
    }

    const iosUrl = `comgooglemaps://?daddr=${dest.lat},${dest.lng}&directionsmode=driving`;
    const androidUrl = `google.navigation:q=${dest.lat},${dest.lng}&mode=d`;
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`;

    const nativeUrl = Platform.select({ ios: iosUrl, android: androidUrl });

    if (nativeUrl) {
      Linking.canOpenURL(nativeUrl)
        .then((canOpen) => Linking.openURL(canOpen ? nativeUrl : fallbackUrl))
        .catch(() => Linking.openURL(fallbackUrl).catch(() => {}));
    } else {
      Linking.openURL(fallbackUrl).catch(() => {});
    }
  }, [getDestination, activeDelivery]);

  const hasLocation = location.latitude != null && location.longitude != null;
  const dest = getDestination();

  const gpsWarning = location.warning;
  const gpsBannerConfig = useGpsBanner(gpsWarning, hasLocation, colors, t);

  const initialRegion: Region = hasLocation
    ? {
        latitude: location.latitude!,
        longitude: location.longitude!,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 30.0444,
        longitude: 31.2357,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <ErrorBoundary>
      <View style={s.container}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          customMapStyle={mapStyle}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsTraffic={false}
          showsCompass={false}
          toolbarEnabled={false}
          accessibilityLabel={t('map.routeMapA11y')}
        >
          {hasLocation && (
            <Marker
              coordinate={{ latitude: location.latitude!, longitude: location.longitude! }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              rotation={location.heading ?? 0}
            >
              <DriverMarker isDark={isDark} colors={colors} />
            </Marker>
          )}

          {dest?.type === 'pharmacy' && (
            <Marker
              coordinate={{ latitude: dest.lat, longitude: dest.lng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <PharmacyMarker colors={colors} />
            </Marker>
          )}

          {dest?.type === 'customer' && (
            <Marker
              coordinate={{ latitude: dest.lat, longitude: dest.lng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <CustomerMarker colors={colors} />
            </Marker>
          )}

          {route.length > 1 && (
            <Polyline
              coordinates={route}
              strokeColor={colors.brand.primary}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        <SafeAreaView edges={['top']} style={s.topOverlay} pointerEvents="box-none">
          <View style={s.topRow} pointerEvents="box-none">
            {eta && (
              <View style={[s.etaChip, { backgroundColor: colors.canvas.surface, borderColor: colors.border.default }]}>
                {loadingRoute ? (
                  <ActivityIndicator size="small" color={colors.brand.primary} />
                ) : (
                  <>
                    <Ionicons name="time-outline" size={14} color={colors.brand.primary} />
                    <CourierUI.Typography scale="bodySm" style={{ color: colors.brand.primary, fontWeight: '600' }}>
                      {t('map.etaText', { minutes: eta.durationMin, km: eta.distanceKm })}
                    </CourierUI.Typography>
                  </>
                )}
              </View>
            )}

            <AccuracyDot accuracy={location.accuracy} colors={colors} t={t} />
          </View>
        </SafeAreaView>

        <TouchableOpacity
          style={[
            s.recenterBtn,
            { bottom: activeDelivery ? 180 : 100 + insets.bottom, backgroundColor: colors.canvas.surface, borderColor: colors.border.default },
          ]}
          onPress={centerOnDriver}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('map.recenterA11y')}
        >
          <Ionicons name="locate-outline" size={22} color={colors.brand.primary} />
        </TouchableOpacity>

        {gpsBannerConfig && (
          <TouchableOpacity
            style={[s.noLocationBanner, { backgroundColor: colors.canvas.surface, borderColor: colors.border.default }]}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel={t('delivery.tapToOpenSettings', { text: gpsBannerConfig.text })}
            accessibilityLiveRegion="polite"
          >
            <Ionicons name={gpsBannerConfig.icon} size={16} color={gpsBannerConfig.color} />
            <CourierUI.Typography scale="badge" color="primary" style={{ color: gpsBannerConfig.color, flex: 1 }}>
              {gpsBannerConfig.text}
            </CourierUI.Typography>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </TouchableOpacity>
        )}

        {!activeDelivery && hasLocation && (
          <View style={[s.noDeliveryChip, { bottom: 100 + insets.bottom, backgroundColor: colors.canvas.surface, borderColor: colors.border.default }]}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.text.muted} />
            <CourierUI.Typography scale="badge" color="secondary">{t('map.noActiveDelivery')}</CourierUI.Typography>
          </View>
        )}

        {activeDelivery && (
          <View style={{ position: 'absolute', bottom: insets.bottom, left: 0, right: 0 }}>
            <BottomSheet delivery={activeDelivery} onNavigate={openNavigation} colors={colors} t={t} />
          </View>
        )}
      </View>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },

  etaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  noLocationBanner: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
  },
  noDeliveryChip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
});
