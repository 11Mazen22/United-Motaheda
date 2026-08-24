import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { CourierUI, useCourierTheme, showToast } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useOrdersStore, type AvailableOrder } from '@/stores/orders.store';
import { haversineMeters } from '@/lib/gps/KalmanFilter';

const ORDER_STATUS_KEYS = new Set([
  'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PHARMACY', 'PICKED_UP',
  'EN_ROUTE_TO_CUSTOMER', 'ARRIVED_AT_CUSTOMER', 'DELIVERED',
]);

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
  const { theme, colors } = useCourierTheme();
  const { t } = useTranslation();
  const busy = isAccepting || isSkipping;

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: colors.border.default }]}>
      <View style={s.cardTopRow}>
        <View style={[s.distanceChip, { backgroundColor: colors.brand.primaryLight }]}>
          <Ionicons name="navigate" size={14} color={colors.brand.primary} />
          <CourierUI.Typography scale="caption" color="brand">
            {formatDistance(order.distanceToCustomerMeters)}
          </CourierUI.Typography>
        </View>
        <View style={[s.earningsBadge, { backgroundColor: colors.brand.primary }]}>
          <CourierUI.Typography scale="priceMd" color="inverse">
            {order.estimatedEarnings.toFixed(0)}{' '}
            <CourierUI.Typography scale="badge" color="inverse">EGP</CourierUI.Typography>
          </CourierUI.Typography>
        </View>
      </View>

      <View style={s.routeRow}>
        <View style={[s.routeDot, { backgroundColor: colors.brand.primary }]} />
        <View style={[s.routeLine, { backgroundColor: colors.border.default }]} />
        <View style={[s.routeDot, { backgroundColor: colors.status.error }]} />
      </View>

      <View style={s.addressBlock}>
        <View style={s.addressRow}>
          <CourierUI.Typography scale="badge" color="brand">{t('dashboard.pickup')}</CourierUI.Typography>
          <CourierUI.Typography scale="bodySm" color="primary" style={{ flex: 1 }} numberOfLines={1}>
            {order.pharmacy.name}
          </CourierUI.Typography>
        </View>
        <View style={s.addressRow}>
          <CourierUI.Typography scale="badge" color="danger">{t('dashboard.drop')}</CourierUI.Typography>
          <CourierUI.Typography scale="bodySm" color="primary" style={{ flex: 1 }} numberOfLines={2}>
            {order.customerAddress}
          </CourierUI.Typography>
        </View>
      </View>

      <View style={s.cardMetaRow}>
        <View style={[s.metaChip, { backgroundColor: colors.canvas.surfaceMuted }]}>
          <Ionicons name="cube-outline" size={13} color={colors.text.muted} />
          <CourierUI.Typography scale="caption" color="secondary">
            {t('dashboard.itemCount', { count: order.itemCount })}
          </CourierUI.Typography>
        </View>
        <View style={[s.metaChip, { backgroundColor: colors.canvas.surfaceMuted }]}>
          <Ionicons name="cash-outline" size={13} color={colors.text.muted} />
          <CourierUI.Typography scale="caption" color="secondary">
            {order.paymentMethod}
          </CourierUI.Typography>
        </View>
      </View>

      <View style={s.actionRow}>
        <Pressable
          style={[s.declineBtn, busy && s.disabledBtn, { backgroundColor: colors.canvas.surface, borderColor: colors.border.default }]}
          onPress={() => onSkip(order.id)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          accessibilityLabel={t('dashboard.declineOrder')}
        >
          <CourierUI.Typography scale="buttonSm" color="secondary">
            {t('dashboard.decline')}
          </CourierUI.Typography>
        </Pressable>
        <Pressable
          style={[s.acceptBtn, busy && s.disabledBtn]}
          onPress={() => onAccept(order.id)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          accessibilityLabel={t('dashboard.acceptOrderA11y')}
        >
          <LinearGradient
            colors={[colors.brand.primary, colors.brand.primaryDark]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <CourierUI.Typography scale="buttonMd" color="inverse">
            {isAccepting ? t('dashboard.accepting') : t('dashboard.acceptOrder')}
          </CourierUI.Typography>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function DriverDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useCourierTheme();
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
    onError: () => showToast(t('dashboard.statusChangeFailed'), 'error'),
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => driverApi.acceptOrder(id),
    onSuccess: (res) => {
      useOrdersStore.getState().setActiveDelivery(res);
      router.push('/(tabs)/delivery');
    },
    onError: () => showToast(t('dashboard.orderUnavailable'), 'error'),
  });

  const skipMutation = useMutation({
    mutationFn: async (id: string) => driverApi.rejectOrder(id, 'Skipped by driver'),
    onSuccess: () => refetch(),
  });

  const animStatus = useSharedValue(isOnline ? 1 : 0);
  useEffect(() => {
    animStatus.value = withSpring(isOnline ? 1 : 0, { damping: 15 });
  }, [isOnline, animStatus]);

  const headerBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animStatus.value,
      [0, 1],
      [colors.canvas.surface, colors.brand.primaryDark]
    ),
  }));

  const earningsTotal = parseFloat(user?.driverProfile?.totalEarnings ?? '0');

  return (
    <View style={[s.root, { backgroundColor: colors.canvas.screen }]}>
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
                ? (ORDER_STATUS_KEYS.has(activeDelivery.status)
                    ? t(`orderStatus.${activeDelivery.status}`)
                    : t('orderStatus.inProgress'))
                : isOnline
                  ? t('dashboard.onlineSearching')
                  : t('dashboard.offline')}
            </CourierUI.Typography>
            <View style={s.earningsRow}>
              <Ionicons name="wallet" size={20} color={colors.brand.accent} />
              <CourierUI.Typography scale="screenTitle" color="inverse">
                {earningsTotal.toFixed(0)}
              </CourierUI.Typography>
              <CourierUI.Typography scale="body" color="inverse">
                {t('dashboard.egpTotal')}
              </CourierUI.Typography>
            </View>
          </View>

          <Pressable
            style={s.toggleWrap}
            onPress={() => toggleMutation.mutate(!isOnline)}
            disabled={toggleMutation.isPending || activeDelivery != null}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOnline, disabled: toggleMutation.isPending || activeDelivery != null }}
            accessibilityLabel={isOnline ? t('dashboard.goOffline') : t('dashboard.goOnline')}
          >
            <Animated.View
              style={[
                s.toggleTrack,
                {
                  backgroundColor: isOnline
                    ? colors.brand.primary
                    : colors.text.muted,
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
            <View style={[s.statusDot, { backgroundColor: isOnline ? colors.brand.primary : colors.text.muted }]} />
          </Pressable>
        </View>

        {activeDelivery && (
          <Pressable
            style={[s.activeBanner, { backgroundColor: colors.canvas.overlay, borderColor: colors.brand.primaryLight }]}
            onPress={() => router.push('/(tabs)/delivery')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.viewActiveDelivery')}
          >
            <View style={[s.pulseRing, { backgroundColor: colors.brand.primaryLight }]}>
              <View style={[s.pulseDot, { backgroundColor: colors.brand.primary }]} />
            </View>
            <View style={{ flex: 1 }}>
              <CourierUI.Typography scale="buttonMd" color="inverse" style={{ fontWeight: '700' }}>
                {t('dashboard.activeDelivery')}
              </CourierUI.Typography>
              <CourierUI.Typography scale="caption" color="inverse">
                {t('dashboard.itemCount', { count: activeDelivery.order.items?.length ?? 0 })} ·{' '}
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
            <Ionicons name="arrow-forward" size={20} color={colors.brand.primary} />
          </Pressable>
        )}
      </Animated.View>

      <View style={s.feed}>
        {!isOnline ? (
          <CourierUI.EmptyState
            icon="power-outline"
            title={t('dashboard.youreOffline')}
            subtitle={t('dashboard.goOnlineHint')}
            actionLabel={t('dashboard.goOnline')}
            onAction={() => toggleMutation.mutate(true)}
          />
        ) : activeDelivery ? (
          <CourierUI.EmptyState
            icon="bicycle-outline"
            title={t('dashboard.deliveryInProgress')}
            subtitle={t('dashboard.finishRouteHint')}
            actionLabel={t('dashboard.viewDelivery')}
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
                tintColor={colors.brand.primary}
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
                  <CourierUI.Skeleton height={180} />
                  <CourierUI.Skeleton height={180} />
                  <CourierUI.Skeleton height={180} />
                </View>
              ) : (
                <CourierUI.EmptyState
                  icon="radio-outline"
                  title={t('dashboard.scanningArea')}
                  subtitle={t('dashboard.noOrdersNearby')}
                />
              )
            }
          />
        )}
      </View>
    </View>
  );
}


const s = StyleSheet.create({
  root: {
    flex: 1,
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
    borderWidth: 1,
  },
  pulseRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  earningsBadge: {
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
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
