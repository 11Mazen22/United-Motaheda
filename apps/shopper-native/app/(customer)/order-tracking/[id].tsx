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

import React, { useEffect, useState, useRef } from 'react';
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
import { useOrderStore } from '@/stores/orders';
import { orderTrackingService } from '@/services/orderTrackingService';
import { supabase } from '@/lib/supabase';
import LeafletMap from '@/shared/leafletMap/LeafletMap';
import { MapMarkerSpec, MapPolylineSpec } from '@/shared/leafletMap/types';
import DriverDetailsSheet from '@/components/order/DriverDetailsSheet';
import TrackingFABs from '@/components/order/TrackingFABs';

const { width, height } = Dimensions.get('window');

// Connection states
type ConnectionState = 'connected' | 'reconnecting' | 'offline' | 'stale';

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<any>(null);
  
  const { 
    activeOrder, 
    driverLocation, 
    isTracking,
    setActiveOrder,
    clearActiveOrder 
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

  // Map markers and polylines
  const [markers, setMarkers] = useState<MapMarkerSpec[]>([]);
  const [polylines, setPolylines] = useState<MapPolylineSpec[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([30.0444, 31.2357]);

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
  }, [connectionState]);

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
  }, [driverLocation]);

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

  // Update map markers when order or driver location changes
  useEffect(() => {
    if (activeOrder) {
      updateMapMarkers();
      updateMapPolylines();
      updateMapCenter();
    }
  }, [activeOrder, driverLocation, showRoute, connectionState]);

  // Check connection and retry
  const checkConnectionAndRetry = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
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
      console.error('Connection check failed:', err);
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
      setConnectionState('connected');
      setLastUpdateTime(new Date());
    }
  }, [activeOrder]);

  // ============================================================
  // Map Update Functions
  // ============================================================

  const updateMapMarkers = () => {
    if (!activeOrder) return;

    const newMarkers: MapMarkerSpec[] = [];

    // Origin marker (pickup)
    newMarkers.push({
      id: 'origin',
      position: [activeOrder.origin.lat, activeOrder.origin.lng],
      icon: '📍',
      size: [32, 32],
      popup: 'نقطة البداية',
      color: '#10B981',
    });

    // Destination marker (dropoff)
    newMarkers.push({
      id: 'destination',
      position: [activeOrder.destination.lat, activeOrder.destination.lng],
      icon: '🏁',
      size: [32, 32],
      popup: 'نقطة الوصول',
      color: '#EF4444',
    });

    // Driver marker (animated)
    if (driverLocation && connectionState !== 'offline') {
      newMarkers.push({
        id: 'driver',
        position: [driverLocation.lat, driverLocation.lng],
        icon: '🚗',
        size: [40, 40],
        popup: activeOrder.driverName || 'السائق',
        color: '#8B5CF6',
        className: 'driver-marker animated-pulse',
      });
    }

    setMarkers(newMarkers);
  };

  const updateMapPolylines = () => {
    if (!activeOrder || !showRoute) {
      setPolylines([]);
      return;
    }

    const isStale = connectionState === 'stale';
    
    setPolylines([
      {
        id: 'route',
        positions: [
          [activeOrder.origin.lat, activeOrder.origin.lng],
          [activeOrder.destination.lat, activeOrder.destination.lng],
        ],
        color: isStale ? '#F59E0B' : '#8B5CF6',
        weight: 4,
        opacity: 0.8,
        dashArray: isStale ? '10, 10' : '5, 10',
      },
    ]);
  };

  const updateMapCenter = () => {
    if (driverLocation && connectionState !== 'offline') {
      setMapCenter([driverLocation.lat, driverLocation.lng]);
    } else if (activeOrder) {
      // Center between origin and destination
      const centerLat = (activeOrder.origin.lat + activeOrder.destination.lat) / 2;
      const centerLng = (activeOrder.origin.lng + activeOrder.destination.lng) / 2;
      setMapCenter([centerLat, centerLng]);
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

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      if (data) {
        const activeOrderData = {
          id: data.id,
          status: data.status || 'pending',
          origin: {
            lat: data.origin_lat || data.customerLat || 30.0444,
            lng: data.origin_lng || data.customerLng || 31.2357,
          },
          destination: {
            lat: data.destination_lat || data.customerLat || 30.0444,
            lng: data.destination_lng || data.customerLng || 31.2357,
          },
          driverId: data.driver_id,
          driverName: data.driver_name,
          driverPhone: data.driver_phone,
          driverPhoto: data.driver_photo,
          estimatedArrival: data.estimated_arrival,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };

        setActiveOrder(activeOrderData);
        setOfflineData(activeOrderData);
      }
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
        {config.action && (
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
        center={mapCenter}
        zoom={15}
        markers={markers}
        polylines={polylines}
        tileLayer={{
          url: `https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=${process.env.EXPO_PUBLIC_MAPTILER_KEY}`,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }}
        onMapClick={(e) => {
          // Optional: handle map click
        }}
        onMarkerClick={(markerId) => {
          if (markerId === 'driver' && driverLocation) {
            // Center on driver
            setMapCenter([driverLocation.lat, driverLocation.lng]);
          }
        }}
      />

      {/* Driver Details Bottom Sheet */}
      <DriverDetailsSheet
        isVisible={isSheetVisible}
        onClose={() => setIsSheetVisible(false)}
        driverName={activeOrder.driverName}
        driverPhone={activeOrder.driverPhone}
        driverPhoto={activeOrder.driverPhoto}
        estimatedArrival={activeOrder.estimatedArrival}
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
          {connectionState === 'connected' && (
            <>
              {activeOrder.status === 'pending' && '⏳ في انتظار السائق'}
              {activeOrder.status === 'accepted' && '✅ تم قبول الطلب'}
              {activeOrder.status === 'picked_up' && '🚚 في الطريق إليك'}
              {activeOrder.status === 'delivered' && '🎉 تم التوصيل'}
              {activeOrder.status === 'cancelled' && '❌ تم الإلغاء'}
            </>
          )}
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