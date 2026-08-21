import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CourierUI, kit, showToast } from '@pharmacy/ui-native';
import { colors as courierColors } from '@pharmacy/ui-native/courier-tokens';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useOrdersStore, type AvailableOrder } from '@/stores/orders.store';

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'Accepted',
  EN_ROUTE_TO_PICKUP: 'Heading to Pharmacy',
  ARRIVED_AT_PHARMACY: 'At Pharmacy',
  PICKED_UP: 'Picked Up',
  EN_ROUTE_TO_CUSTOMER: 'Heading to Customer',
  ARRIVED_AT_CUSTOMER: 'At Customer',
  DELIVERED: 'Delivered',
};

function formatDistance(meters: number | null): string {
  if (meters == null) return '—';
  if (meters > 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function OrderCard({
  order,
  onAccept,
  onSkip,
  isAccepting,
  isSkipping,
}: {
  order: AvailableOrder;
  onAccept: (id: string) => void;
  onSkip: (id: string) => void;
  isAccepting: boolean;
  isSkipping: boolean;
}) {
  const busy = isAccepting || isSkipping;

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={s.card}>
      <View style={s.cardTopRow}>
        <View style={s.distanceChip}>
          <Ionicons name="navigate" size={14} color={kit.darkColor.accent} />
          <CourierUI.Typography scale="caption" color="brand">
            {formatDistance(order.distanceToCustomerMeters)}
          </CourierUI.Typography>
        </View>
        <View style={s.earningsBadge}>
          <CourierUI.Typography scale="priceMd" color="inverse">
            {order.estimatedEarnings.toFixed(0)}{' '}
            <CourierUI.Typography scale="badge" color="inverse">EGP</CourierUI.Typography>
          </CourierUI.Typography>
        </View>
      </View>

      <View style={s.routeRow}>
        <View style={[s.routeDot, { backgroundColor: kit.darkColor.accent }]} />
        <View style={s.routeLine} />
        <View style={[s.routeDot, { backgroundColor: kit.darkColor.danger }]} />
      </View>

      <View style={s.addressBlock}>
        <View style={s.addressRow}>
          <CourierUI.Typography scale="badge" color="brand">PICKUP</CourierUI.Typography>
          <CourierUI.Typography scale="bodySm" color="secondary" style={{ flex: 1 }} numberOfLines={1}>
            {order.pharmacy.name}
          </CourierUI.Typography>
        </View>
        <View style={s.addressRow}>
          <CourierUI.Typography scale="badge" color="danger">DROP</CourierUI.Typography>
          <CourierUI.Typography scale="bodySm" color="inverse" style={{ flex: 1 }} numberOfLines={2}>
            {order.customerAddress}
          </CourierUI.Typography>
        </View>
      </View>

      <View style={s.cardMetaRow}>
        <View style={s.metaChip}>
          <Ionicons name="cube-outline" size={13} color={kit.darkColor.inkFaint} />
          <CourierUI.Typography scale="caption" color="secondary">
            {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
          </CourierUI.Typography>
        </View>
        <View style={s.metaChip}>
          <Ionicons name="cash-outline" size={13} color={kit.darkColor.inkFaint} />
          <CourierUI.Typography scale="caption" color="secondary">
            {order.paymentMethod}
          </CourierUI.Typography>
        </View>
      </View>

      <View style={s.actionRow}>
        <Pressable
          style={[s.declineBtn, busy && s.disabledBtn]}
          onPress={() => onSkip(order.id)}
          disabled={busy}
        >
          <CourierUI.Typography scale="buttonSm" color="secondary">
            Decline
          </CourierUI.Typography>
        </Pressable>
        <Pressable
          style={[s.acceptBtn, busy && s.disabledBtn]}
          onPress={() => onAccept(order.id)}
          disabled={busy}
        >
          <LinearGradient
            colors={[kit.darkColor.accent, '#1a9e93']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <CourierUI.Typography scale="buttonMd" color="inverse">
            {isAccepting ? 'Accepting…' : 'Accept Order'}
          </CourierUI.Typography>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function DriverDashboard() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, setOnlineStatus } = useAuthStore();
  const isOnline = user?.driverProfile?.isOnline ?? false;

  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  const availableOrders = useOrdersStore((s) => s.availableOrders);

  const fetchAvailableOrders = useCallback(async () => {
    const data = await driverApi.getAvailableOrders();
    useOrdersStore.getState().setAvailableOrders(data);
    return data;
  }, []);

  const { isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['availableOrders'],
    queryFn: fetchAvailableOrders,
    enabled: isOnline && !activeDelivery,
    refetchInterval: isOnline && !activeDelivery ? 10000 : false,
  });

  const toggleMutation = useMutation({
    mutationFn: async (online: boolean) =>
      online ? driverApi.goOnline() : driverApi.goOffline(),
    onSuccess: (_, vars) => setOnlineStatus(vars),
    onError: () => showToast('Failed to change status', 'error'),
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => driverApi.acceptOrder(id),
    onSuccess: (res) => {
      useOrdersStore.getState().setActiveDelivery(res);
      router.push('/(tabs)/delivery');
    },
    onError: () => showToast('Order no longer available', 'error'),
  });

  const skipMutation = useMutation({
    mutationFn: async (id: string) => driverApi.rejectOrder(id, 'Skipped by driver'),
    onSuccess: () => refetch(),
  });

  const animStatus = useSharedValue(isOnline ? 1 : 0);
  useEffect(() => {
    animStatus.value = withSpring(isOnline ? 1 : 0, { damping: 15 });
  }, [isOnline]);

  const headerBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animStatus.value,
      [0, 1],
      [kit.darkColor.surface, kit.darkColor.accentDeep]
    ),
  }));

  const earningsTotal = parseFloat(user?.driverProfile?.totalEarnings ?? '0');

  return (
    <View style={s.root}>
      <Animated.View style={[s.header, headerBg]}>
        <SafeAreaView edges={['top']} />
        <View style={s.headerRow}>
          <View style={s.headerInfo}>
            <CourierUI.Typography
              scale="caption"
              color="inverse"
              style={{ letterSpacing: 1.5 }}
            >
              {activeDelivery
                ? STATUS_LABEL[activeDelivery.status] ?? 'In Progress'
                : isOnline
                  ? 'ONLINE — Searching'
                  : 'OFFLINE'}
            </CourierUI.Typography>
            <View style={s.earningsRow}>
              <Ionicons name="wallet" size={20} color={kit.darkColor.accent} />
              <CourierUI.Typography scale="screenTitle" color="inverse">
                {earningsTotal.toFixed(0)}
              </CourierUI.Typography>
              <CourierUI.Typography scale="body" color="inverse">
                EGP total
              </CourierUI.Typography>
            </View>
          </View>

          <Pressable
            style={s.toggleWrap}
            onPress={() => toggleMutation.mutate(!isOnline)}
            disabled={toggleMutation.isPending || activeDelivery != null}
          >
            <Animated.View
              style={[
                s.toggleTrack,
                {
                  backgroundColor: isOnline
                    ? kit.darkColor.accent
                    : kit.darkColor.inkFaint,
                },
              ]}
            >
              <Animated.View
                style={[
                  s.toggleThumb,
                  isOnline
                    ? { transform: [{ translateX: 28 }] }
                    : { transform: [{ translateX: 2 }] },
                ]}
              />
            </Animated.View>
            <View style={[s.statusDot, { backgroundColor: isOnline ? kit.darkColor.accent : kit.darkColor.inkFaint }]} />
          </Pressable>
        </View>

        {activeDelivery && (
          <Pressable
            style={s.activeBanner}
            onPress={() => router.push('/(tabs)/delivery')}
          >
            <View style={s.pulseRing}>
              <View style={[s.pulseDot, { backgroundColor: kit.darkColor.accent }]} />
            </View>
            <View style={{ flex: 1 }}>
              <CourierUI.Typography scale="buttonMd" color="inverse" style={{ fontWeight: '700' }}>
                Active Delivery
              </CourierUI.Typography>
              <CourierUI.Typography scale="caption" color="inverse">
                {orderCount(activeDelivery.order.items?.length)} ·{' '}
                {formatDistance(
                  activeDelivery.order.customerLat && activeDelivery.order.customerLng
                    ? haversineMeters(
                        activeDelivery.pharmacyLat,
                        activeDelivery.pharmacyLng,
                        activeDelivery.order.customerLat,
                        activeDelivery.order.customerLng
                      )
                    : null
                )}
              </CourierUI.Typography>
            </View>
            <Ionicons name="arrow-forward" size={20} color={kit.darkColor.accent} />
          </Pressable>
        )}
      </Animated.View>

      <View style={s.feed}>
        {!isOnline ? (
          <CourierUI.EmptyState
            title="You're Offline"
            subtitle="Go online to start receiving delivery orders in your area."
            actionLabel="Go Online"
            onAction={() => toggleMutation.mutate(true)}
          />
        ) : activeDelivery ? (
          <CourierUI.EmptyState
            title="Delivery in Progress"
            subtitle="Complete your current route before accepting new orders."
            actionLabel="View Delivery"
            onAction={() => router.push('/(tabs)/delivery')}
          />
        ) : (
          <FlatList
            data={availableOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={kit.darkColor.accent}
              />
            }
            renderItem={({ item }) => (
              <OrderCard
                order={item}
                onAccept={(id) => acceptMutation.mutate(id)}
                onSkip={(id) => skipMutation.mutate(id)}
                isAccepting={acceptMutation.isPending && acceptMutation.variables === item.id}
                isSkipping={skipMutation.isPending && skipMutation.variables === item.id}
              />
            )}
            ListEmptyComponent={
              isLoading ? (
                <View style={{ gap: 16 }}>
                  <CourierUI.Skeleton height={160} />
                  <CourierUI.Skeleton height={160} />
                  <CourierUI.Skeleton height={160} />
                </View>
              ) : (
                <CourierUI.EmptyState
                  title="Scanning Area"
                  subtitle="No orders nearby right now. We'll notify you when one matches your route."
                />
              )
            }
          />
        )}
      </View>
    </View>
  );
}

function orderCount(itemsLength: number | undefined): string {
  const count = itemsLength ?? 0;
  return `${count} item${count !== 1 ? 's' : ''}`;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number | null {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: kit.darkColor.canvas,
  },
  header: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  toggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleTrack: {
    width: 56,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 24,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(44,203,189,0.25)',
  },
  pulseRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(44,203,189,0.15)',
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  feed: {
    flex: 1,
    paddingTop: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 16,
  },
  card: {
    backgroundColor: kit.darkColor.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: kit.darkColor.line,
    gap: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: kit.darkColor.accentTint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  earningsBadge: {
    backgroundColor: kit.darkColor.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: kit.darkColor.line,
    marginHorizontal: 8,
  },
  addressBlock: {
    gap: 10,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: kit.darkColor.well,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: kit.darkColor.surface,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: kit.darkColor.line,
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabledBtn: {
    opacity: 0.38,
  },
});
