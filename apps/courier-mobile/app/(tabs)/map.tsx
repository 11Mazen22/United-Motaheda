import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '@/theme/tokens';
import { Card } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLocationStore } from '@/stores/location.store';
import { useOrdersStore } from '@/stores/orders.store';
import { haversineMeters } from '@/lib/gps/KalmanFilter';

// Decode Google Maps encoded polyline
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

// Fetch route from Google Directions API
async function fetchRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string,
): Promise<{ polyline: { latitude: number; longitude: number }[]; durationMin: number; distanceKm: number } | null> {
  try {
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

function getGoogleMapsApiKey(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    return Constants.expoConfig?.extra?.googleMapsApiKey ?? '';
  } catch {
    return '';
  }
}

// Accuracy indicator dot
function AccuracyDot({ accuracy }: { accuracy: number | null }) {
  const level =
    accuracy == null ? 'poor' : accuracy <= 15 ? 'good' : accuracy <= 50 ? 'fair' : 'poor';
  const colorMap = { good: colors.success, fair: colors.warning, poor: colors.error };
  const labelMap = { good: `${Math.round(accuracy ?? 99)}m`, fair: `${Math.round(accuracy ?? 99)}m`, poor: 'Poor GPS' };

  return (
    <View style={ad.container}>
      <View style={[ad.dot, { backgroundColor: colorMap[level] }]} />
      <Text style={ad.label}>{labelMap[level]}</Text>
    </View>
  );
}

const ad = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: typography.xs, color: '#fff', fontWeight: typography.medium },
});

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

function BottomSheet({
  delivery,
  onNavigate,
}: {
  delivery: ReturnType<typeof useOrdersStore>['activeDelivery'];
  onNavigate: () => void;
}) {
  if (!delivery) return null;

  const statusLabels: Record<string, string> = {
    ACCEPTED: 'Head to pharmacy',
    EN_ROUTE_TO_PICKUP: 'Navigating to pharmacy',
    ARRIVED_AT_PHARMACY: 'At pharmacy — awaiting pickup',
    PICKED_UP: 'Order picked up',
    EN_ROUTE_TO_CUSTOMER: 'Navigating to customer',
    ARRIVED_AT_CUSTOMER: 'At customer location',
  };

  const isHeadingToPharmacy =
    delivery.status === 'ACCEPTED' || delivery.status === 'EN_ROUTE_TO_PICKUP' || delivery.status === 'ARRIVED_AT_PHARMACY';

  const destination = isHeadingToPharmacy
    ? { name: delivery.pharmacyName, address: delivery.pharmacyAddress }
    : { name: delivery.order.customerName, address: delivery.order.customerAddress };

  return (
    <View style={bs.sheet}>
      <View style={bs.handle} />
      <View style={bs.content}>
        <View style={bs.row}>
          <View style={bs.dot} />
          <View style={bs.info}>
            <Text style={bs.statusText}>{statusLabels[delivery.status] ?? delivery.status}</Text>
            <Text style={bs.destName}>{destination.name}</Text>
            <Text style={bs.destAddr} numberOfLines={1}>{destination.address}</Text>
          </View>
          <TouchableOpacity style={bs.navBtn} onPress={onNavigate} activeOpacity={0.8}>
            <Ionicons name="navigate" size={20} color={colors.white} />
            <Text style={bs.navText}>Go</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const bs = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    ...shadows.xl,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  content: { padding: spacing[5], paddingTop: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  info: { flex: 1 },
  statusText: { fontSize: typography.xs, color: colors.inkMuted, fontWeight: typography.medium },
  destName: { fontSize: typography.base, fontWeight: typography.bold, color: colors.ink, marginTop: 2 },
  destAddr: { fontSize: typography.xs, color: colors.inkMuted, marginTop: 1 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
  },
  navText: { color: colors.white, fontWeight: typography.bold, fontSize: typography.sm },
});

// ─── Main map screen ──────────────────────────────────────────────────────────

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const location = useLocationStore();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);

  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [eta, setEta] = useState<{ durationMin: number; distanceKm: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [lastRouteFetchCoords, setLastRouteFetchCoords] = useState<{ lat: number; lng: number } | null>(null);

  const apiKey = getGoogleMapsApiKey();

  // Destination based on delivery status — with coordinate validation
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
      // Validate coordinates are real numbers in plausible range
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

    // Fallback: try to geocode from address string if coords are invalid
    return null;
  }, [activeDelivery]);

  // Fetch route when driver/destination changes significantly
  useEffect(() => {
    if (!location.latitude || !location.longitude) return;

    const dest = getDestination();
    if (!dest) {
      setRoute([]);
      setEta(null);
      return;
    }

    // Only re-fetch if driver moved >100m from last fetch point
    if (lastRouteFetchCoords) {
      const dist = haversineMeters(
        lastRouteFetchCoords.lat,
        lastRouteFetchCoords.lng,
        location.latitude,
        location.longitude,
      );
      if (dist < 100) return;
    }

    const driverLat = location.latitude;
    const driverLng = location.longitude;

    setLoadingRoute(true);
    setLastRouteFetchCoords({ lat: driverLat, lng: driverLng });

    fetchRoute(driverLat, driverLng, dest.lat, dest.lng, apiKey)
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
    activeDelivery?.status,
    activeDelivery?.assignmentId,
  ]);

  // Re-center on driver
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

  // Open Google Maps navigation with validated coordinates
  const openNavigation = useCallback(() => {
    const dest = getDestination();
    if (!dest) {
      // If no valid coordinates, fall back to address-based search
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

    // Prefer native Google Maps app for turn-by-turn; fall back to web
    const iosUrl      = `comgooglemaps://?daddr=${dest.lat},${dest.lng}&directionsmode=driving`;
    const androidUrl  = `google.navigation:q=${dest.lat},${dest.lng}&mode=d`;
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

  const initialRegion: Region = hasLocation
    ? {
        latitude: location.latitude!,
        longitude: location.longitude!,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 30.0444,    // Cairo fallback
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
          initialRegion={initialRegion}
          showsUserLocation={false}  // We show a custom marker
          showsMyLocationButton={false}
          showsTraffic={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {/* Driver marker */}
          {hasLocation && (
            <Marker
              coordinate={{ latitude: location.latitude!, longitude: location.longitude! }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              rotation={location.heading ?? 0}
            >
              <View style={s.driverMarker}>
                <Ionicons name="navigate" size={20} color={colors.white} />
              </View>
            </Marker>
          )}

          {/* Pharmacy marker */}
          {dest?.type === 'pharmacy' && (
            <Marker
              coordinate={{ latitude: dest.lat, longitude: dest.lng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={s.pharmacyMarker}>
                <Ionicons name="medical" size={18} color={colors.white} />
              </View>
            </Marker>
          )}

          {/* Customer marker */}
          {dest?.type === 'customer' && (
            <Marker
              coordinate={{ latitude: dest.lat, longitude: dest.lng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={s.customerMarker}>
                <Ionicons name="home" size={18} color={colors.white} />
              </View>
            </Marker>
          )}

          {/* Route polyline */}
          {route.length > 1 && (
            <Polyline
              coordinates={route}
              strokeColor={colors.primary}
              strokeWidth={4}
              lineDashPattern={undefined}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {/* Top overlay */}
        <SafeAreaView edges={['top']} style={s.topOverlay} pointerEvents="box-none">
          <View style={s.topRow} pointerEvents="box-none">
            {/* ETA chip */}
            {eta && (
              <View style={s.etaChip}>
                {loadingRoute ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="time-outline" size={14} color={colors.primary} />
                    <Text style={s.etaText}>
                      ~{eta.durationMin} min · {eta.distanceKm} km
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Accuracy indicator */}
            <AccuracyDot accuracy={location.accuracy} />
          </View>
        </SafeAreaView>

        {/* Re-center FAB */}
        <TouchableOpacity
          style={[s.recenterBtn, { bottom: activeDelivery ? 180 : spacing[10] + insets.bottom }]}
          onPress={centerOnDriver}
          activeOpacity={0.85}
        >
          <Ionicons name="locate-outline" size={22} color={colors.primary} />
        </TouchableOpacity>

        {/* No location message */}
        {!hasLocation && (
          <View style={s.noLocationBanner}>
            <Ionicons name="location-outline" size={16} color={colors.white} />
            <Text style={s.noLocationText}>Acquiring GPS signal…</Text>
          </View>
        )}

        {/* No active delivery message */}
        {!activeDelivery && hasLocation && (
          <View style={[s.noDeliveryChip, { bottom: spacing[10] + insets.bottom }]}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.inkMuted} />
            <Text style={s.noDeliveryText}>No active delivery</Text>
          </View>
        )}

        {/* Bottom sheet */}
        {activeDelivery && (
          <View style={{ position: 'absolute', bottom: insets.bottom, left: 0, right: 0 }}>
            <BottomSheet delivery={activeDelivery} onNavigate={openNavigation} />
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
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[3],
  },

  etaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    ...shadows.md,
  },
  etaText: { fontSize: typography.sm, fontWeight: typography.bold, color: colors.ink },

  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    ...shadows.lg,
  },
  pharmacyMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.md,
  },
  customerMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.md,
  },

  recenterBtn: {
    position: 'absolute',
    right: spacing[4],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },

  noLocationBanner: {
    position: 'absolute',
    bottom: spacing[10],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
  },
  noLocationText: { color: colors.white, fontSize: typography.sm },

  noDeliveryChip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    ...shadows.md,
  },
  noDeliveryText: { fontSize: typography.xs, color: colors.inkMuted },
});
