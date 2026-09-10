/**
 * Order Tracking Screen
 * 
 * Uses LeafletMap (MapTiler) instead of react-native-maps
 * to avoid requiring Google Maps API keys.
 * 
 * Features:
 * - Real-time driver tracking with animated marker
 * - Origin and destination markers
 * - Route polyline
 * - Driver details bottom sheet
 * - Floating action buttons
 * - Offline/Reconnecting states
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  AppState,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useOrderStore, normalizeOrderStatus, type ActiveOrder } from '@/stores/orders';
import { orderTrackingService } from '@/services/orderTrackingService';
import { supabase } from '@/lib/supabase';
import { fetchOrderById } from '@/features/orders/api';
import { fetchBranches } from '@/features/delivery';
import { mapOrderStatus } from '@/features/orders/lib/statusMap';
import { useTranslation } from 'react-i18next';

// Correct imports for the project's LeafletMap architecture
import { LeafletMap } from '@/shared/leafletMap/LeafletMap';
import { pinMarkerHtml } from '@/shared/leafletMap/html';
import type { LeafletMapRef, MapMarkerSpec, MapPolyline } from '@/shared/leafletMap/types';

import DriverDetailsSheet from '@/components/order/DriverDetailsSheet';
import TrackingFABs from '@/components/order/TrackingFABs';

const { width, height } = Dimensions.get('window');

// Connection states
type ConnectionState = 'connected' | 'reconnecting' | 'offline' | 'stale';

// Custom Advanced Driver HTML Marker (utilizes MapLibre CSS transitions natively)
const driverMarkerHtml = (photoUrl?: string | null) => {
  const bgImage = photoUrl 
    ? `background-image:url(${photoUrl});background-size:cover;background-position:center;` 
    : `background-color:#8B5CF6;`;
  const fallbackIcon = photoUrl ? '' : '<span style="color:#fff;font-size:20px;">🛵</span>';

  return `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:48px;height:48px;border-radius:24px;border:3px solid #8B5CF6;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;${bgImage}">
        ${fallbackIcon}
      </div>
    </div>`;
};

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<LeafletMapRef>(null);
  const { t } = useTranslation();
  
  const { 
    activeOrder, 
    driverLocation, 
    isTracking,
    setActiveOrder,
  } = useOrderStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [showRoute, setShowRoute] = useState(true);

  // Connection states
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [offlineData, setOfflineData] = useState<typeof activeOrder>(null);

  // Animation values for reconnecting
  const pulseAnim = useSharedValue(1);
  const rotationAnim = useSharedValue(0);

  // Animated styles for reconnecting indicator
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationAnim.value}deg` }],
  }));

  // Animation for reconnecting
  useEffect(() => {
    if (connectionState === 'reconnecting') {
      pulseAnim.value = withRepeat(
        withSpring(1.2, { damping: 10, stiffness: 100 }),
        -1,
        true
      );
      rotationAnim.value = withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1
      );
    } else {
      pulseAnim.value = withSpring(1);
      rotationAnim.value = withTiming(0);
    }
  }, [connectionState, pulseAnim, rotationAnim]);

  // Monitor app state for connection changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkConnectionAndRetry();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Monitor driver location updates for staleness
  useEffect(() => {
    if (driverLocation) {
      setLastUpdateTime(new Date());
      if (connectionState === 'offline' || connectionState === 'stale') {
        setConnectionState('connected');
        setRetryCount(0);
      }
    }
  }, [driverLocation, connectionState]);

  // Check for stale data (no update for 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastUpdateTime && connectionState === 'connected') {
        const secondsSinceUpdate = (Date.now() - lastUpdateTime.getTime()) / 1000;
        if (secondsSinceUpdate > 30) {
          setConnectionState('stale');
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [lastUpdateTime, connectionState]);

  // Check connection and retry
  const checkConnectionAndRetry = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('orders')
        .select('id')
        .eq('id', id)
        .limit(1);

      if (error) throw error;

      if (connectionState === 'offline' || connectionState === 'stale') {
        setConnectionState('reconnecting');
        await fetchOrderDetails(id);
        if (activeOrder) {
          orderTrackingService.initialize(supabase);
          orderTrackingService.startTracking(activeOrder);
        }
        setConnectionState('connected');
        setRetryCount(0);
      }
    } catch (err) {
      if (retryCount < 3) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => checkConnectionAndRetry(), 5000 * (retryCount + 1));
      } else {
        setConnectionState('offline');
      }
    }
  };

  const handleRetry = () => {
    setRetryCount(0);
    setConnectionState('reconnecting');
    checkConnectionAndRetry();
  };

  // Save offline data when connection is lost
  useEffect(() => {
    if (connectionState === 'offline' && activeOrder) {
      setOfflineData(activeOrder);
    }
  }, [connectionState, activeOrder]);

  // Fetch order details on mount
  useEffect(() => {
    if (id) {
      fetchOrderDetails(id);
    }
    return () => {
      orderTrackingService.stopTracking();
    };
  }, [id]);

  // Initialize tracking when order is loaded
  useEffect(() => {
    if (activeOrder && !isTracking) {
      orderTrackingService.initialize(supabase);
      orderTrackingService.startTracking(activeOrder);
      
      const fitPoints = [activeOrder.origin, activeOrder.destination]
        .filter((p): p is { lat: number; lng: number } => !!p)
        .map((p) => ({ latitude: p.lat, longitude: p.lng }));
      if (mapRef.current && fitPoints.length > 0) {
        mapRef.current.fitToCoordinates(fitPoints);
      }
      
      setConnectionState('connected');
      setLastUpdateTime(new Date());
    }
  }, [activeOrder, isTracking]);

  // Handle smooth camera movement when driver updates
  useEffect(() => {
    if (driverLocation && mapRef.current && connectionState === 'connected') {
      mapRef.current.animateToRegion({
        latitude: driverLocation.lat,
        longitude: driverLocation.lng,
        zoom: 15.5,
      });
    }
  }, [driverLocation, connectionState]);

  /** Best-effort — a driver name/phone is nice-to-have; the tracking screen
   *  still works without it (matches orderTrackingService's own realtime
   *  resolution, used here for the initial synchronous load). */
  const fetchDriverContact = async (driverId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', driverId)
        .maybeSingle();
      return data
        ? { name: (data as any).full_name ?? null, phone: (data as any).phone ?? null }
        : null;
    } catch {
      return null;
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      setLoading(true);

      if (connectionState === 'offline' && offlineData) {
        setActiveOrder(offlineData);
        setLoading(false);
        return;
      }

      const order = await fetchOrderById(orderId);
      if (!order) throw new Error('Order not found');

      // Origin = the fulfilling branch's real location (fetchBranches is
      // fail-open: Supabase-unreachable falls back to the curated static
      // seed, so this never blocks the screen). Destination = the
      // customer's own stored coordinates. Neither falls back to a
      // hardcoded, unrelated point — if either is genuinely unresolvable,
      // origin/destination stay null and the map simply doesn't render
      // that marker/polyline, rather than showing a fabricated location.
      const branches = order.branchId ? await fetchBranches() : [];
      const branch = branches.find((b) => b.id === order.branchId) ?? null;

      let driverContact: { name: string | null; phone: string | null } | null = null;
      if (order.assignedDriverId) {
        driverContact = await fetchDriverContact(order.assignedDriverId);
      }

      const activeOrderData: ActiveOrder = {
        id: order.id,
        status: normalizeOrderStatus(order.status),
        origin: branch ? { lat: branch.lat, lng: branch.lng } : null,
        destination:
          typeof order.customerLat === 'number' && typeof order.customerLng === 'number'
            ? { lat: order.customerLat, lng: order.customerLng }
            : null,
        driverId: order.assignedDriverId ?? null,
        driverName: driverContact?.name ?? null,
        driverPhone: driverContact?.phone ?? null,
        createdAt: order.createdAt,
        updatedAt: order.createdAt,
      };

      setActiveOrder(activeOrderData);
      setOfflineData(activeOrderData);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');

      if (offlineData) {
        setActiveOrder(offlineData);
        setError(null);
        setConnectionState('stale');
      } else {
        setConnectionState('offline');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleRefresh = () => {
    if (id) {
      fetchOrderDetails(id);
    }
  };

  // ============================================================
  // Advanced Map Memoization (Markers & Polyline)
  // ============================================================

  const mapMarkers = useMemo(() => {
    if (!activeOrder) return [];

    const markers: MapMarkerSpec[] = [];
    if (activeOrder.origin) {
      markers.push({
        id: 'origin',
        coordinate: { latitude: activeOrder.origin.lat, longitude: activeOrder.origin.lng },
        html: pinMarkerHtml('#10B981', '•'), // Green dot
        width: 40,
        height: 48,
        anchorX: 0.5,
        anchorY: 1,
      });
    }
    if (activeOrder.destination) {
      markers.push({
        id: 'destination',
        coordinate: { latitude: activeOrder.destination.lat, longitude: activeOrder.destination.lng },
        html: pinMarkerHtml('#EF4444', '★'), // Red star
        width: 40,
        height: 48,
        anchorX: 0.5,
        anchorY: 1,
      });
    }

    if (driverLocation && connectionState !== 'offline') {
      markers.push({
        id: 'driver',
        coordinate: { latitude: driverLocation.lat, longitude: driverLocation.lng },
        html: driverMarkerHtml(activeOrder.driverPhoto),
        width: 48,
        height: 48,
        anchorX: 0.5,
        anchorY: 0.5,
        zIndexOffset: 100, // Make sure driver is always on top
      });
    }

    return markers;
  }, [activeOrder, driverLocation, connectionState]);

  const routePolyline = useMemo<MapPolyline | null>(() => {
    if (!activeOrder || !showRoute || !activeOrder.origin || !activeOrder.destination) return null;
    return {
      coordinates: [
        { latitude: activeOrder.origin.lat, longitude: activeOrder.origin.lng },
        { latitude: activeOrder.destination.lat, longitude: activeOrder.destination.lng },
      ],
      color: connectionState === 'stale' ? '#F59E0B' : '#8B5CF6',
      width: 4,
      dashed: connectionState === 'stale',
    };
  }, [activeOrder, showRoute, connectionState]);

  // ============================================================
  // Render Connection Status
  // ============================================================

  const renderConnectionStatus = () => {
    if (connectionState === 'connected') return null;

    const statusConfig = {
      reconnecting: {
        icon: 'sync-outline',
        text: 'جاري إعادة الاتصال...',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.1)',
      },
      offline: {
        icon: 'wifi-outline',
        text: 'لا يوجد اتصال بالإنترنت',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
        action: 'إعادة المحاولة',
      },
      stale: {
        icon: 'time-outline',
        text: 'بيانات غير محدثة - انتظر...',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.1)',
        action: 'تحديث',
      },
    };

    const config = statusConfig[connectionState];

    return (
      <Animated.View 
        style={[
          styles.connectionStatus,
          { backgroundColor: config.bgColor },
          connectionState === 'reconnecting' && pulseStyle,
        ]}
      >
        <Animated.View style={connectionState === 'reconnecting' ? rotateStyle : undefined}>
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </Animated.View>
        <Text style={[styles.connectionText, { color: config.color }]}>
          {config.text}
        </Text>
        {'action' in config && config.action && (
          <TouchableOpacity style={styles.retryButtonSmall} onPress={handleRetry}>
            <Text style={styles.retryButtonSmallText}>{config.action}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  // ============================================================
  // Loading / Error States
  // ============================================================

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>جاري تحميل الطلب...</Text>
      </View>
    );
  }

  if (error || !activeOrder) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>{error || 'Order not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
        <Ionicons name="arrow-back" size={24} color="#1F2937" />
      </TouchableOpacity>

      {/* Connection Status */}
      {renderConnectionStatus()}

      {/* Leaflet Map */}
      <LeafletMap
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: (activeOrder.origin ?? activeOrder.destination)?.lat ?? 30.0444,
          longitude: (activeOrder.origin ?? activeOrder.destination)?.lng ?? 31.2357,
          zoom: 14,
        }}
        interactive={true}
        markers={mapMarkers}
        polyline={routePolyline}
        onMarkerPress={(markerId) => {
          if (markerId === 'driver' && driverLocation) {
            mapRef.current?.animateToRegion({
              latitude: driverLocation.lat,
              longitude: driverLocation.lng,
              zoom: 16,
            });
          }
        }}
      />

      {/* Driver Details Bottom Sheet */}
      <DriverDetailsSheet
        isVisible={isSheetVisible}
        onClose={() => setIsSheetVisible(false)}
        driverName={activeOrder.driverName ?? undefined}
        driverPhone={activeOrder.driverPhone ?? undefined}
        driverPhoto={activeOrder.driverPhoto}
        orderStatus={activeOrder.status}
      />

      {/* Floating Action Buttons */}
      <TrackingFABs
        onPressCall={() => {
          if (activeOrder.driverPhone) {
            Linking.openURL(`tel:${activeOrder.driverPhone}`);
          } else {
            Alert.alert('رقم السائق غير متوفر');
          }
        }}
        onPressSupport={() => {
          Alert.alert('دعم العملاء', 'سيتم توجيهك لفريق الدعم');
        }}
        onPressRouteToggle={() => setShowRoute(!showRoute)}
        onPressDriverInfo={() => setIsSheetVisible(true)}
        showRoute={showRoute}
        isTracking={isTracking && connectionState !== 'offline'}
      />

      {/* Status Badge */}
      <View style={[
        styles.statusBadge,
        connectionState === 'offline' && styles.statusBadgeOffline,
        connectionState === 'stale' && styles.statusBadgeStale,
      ]}>
        <Text style={styles.statusBadgeText}>
          {connectionState === 'offline' && '📡 غير متصل'}
          {connectionState === 'stale' && '⏳ تحديث البيانات...'}
          {connectionState === 'reconnecting' && '🔄 جاري الاتصال...'}
          {connectionState === 'connected' && mapOrderStatus(activeOrder.status, t).label}
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    flex: 1,
    width: width,
    height: height - 100,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 16,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  connectionStatus: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 90,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  connectionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  retryButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#8B5CF6',
    borderRadius: 6,
  },
  retryButtonSmallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusBadgeOffline: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statusBadgeStale: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
});