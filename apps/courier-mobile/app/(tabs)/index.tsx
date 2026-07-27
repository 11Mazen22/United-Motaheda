import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Switch,
  TouchableOpacity,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '@/theme/tokens';
import { Card, Badge, SkeletonCard, showToast } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useOrdersStore, AvailableOrder } from '@/stores/orders.store';

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onAccept,
  accepting,
}: {
  order: AvailableOrder;
  onAccept: (id: string) => void;
  accepting: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Card style={s.orderCard} elevation="md">
      {/* Header row */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
        style={s.orderHeader}
      >
        <View style={s.orderHeaderLeft}>
          <View style={s.orderIconBox}>
            <Ionicons name="cube-outline" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={s.orderCustomer} numberOfLines={1}>
              {order.customerName}
            </Text>
            <Text style={s.orderAddress} numberOfLines={1}>
              {order.customerAddress}
            </Text>
          </View>
        </View>
        <View style={s.orderEarnings}>
          <Text style={s.earningsAmount}>
            {order.estimatedEarnings.toFixed(0)} EGP
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.inkFaint}
          />
        </View>
      </TouchableOpacity>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Ionicons name="location-outline" size={14} color={colors.inkMuted} />
          <Text style={s.statText}>
            {order.distanceToPickupMeters != null
              ? `${(order.distanceToPickupMeters / 1000).toFixed(1)} km`
              : '—'}
          </Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Ionicons name="time-outline" size={14} color={colors.inkMuted} />
          <Text style={s.statText}>
            ~{order.estimatedMinutes ?? '?'} min
          </Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Ionicons name="bag-handle-outline" size={14} color={colors.inkMuted} />
          <Text style={s.statText}>{order.itemCount} items</Text>
        </View>
        <View style={s.statDivider} />
        <Badge
          label={order.paymentMethod === 'cash' ? 'Cash' : 'Card'}
          variant={order.paymentMethod === 'cash' ? 'warning' : 'info'}
        />
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={s.expandedSection}>
          <View style={s.separator} />

          <View style={s.detailRow}>
            <Ionicons name="storefront-outline" size={16} color={colors.inkMuted} />
            <View style={s.detailText}>
              <Text style={s.detailLabel}>Pickup from</Text>
              <Text style={s.detailValue}>{order.pharmacy.name}</Text>
              <Text style={s.detailSub}>{order.pharmacy.address}</Text>
            </View>
          </View>

          <View style={s.detailRow}>
            <Ionicons name="navigate-outline" size={16} color={colors.inkMuted} />
            <View style={s.detailText}>
              <Text style={s.detailLabel}>Deliver to</Text>
              <Text style={s.detailValue}>{order.customerName}</Text>
              <Text style={s.detailSub}>{order.customerAddress}</Text>
            </View>
          </View>

          {order.note && (
            <View style={s.noteBox}>
              <Ionicons name="information-circle-outline" size={14} color={colors.info} />
              <Text style={s.noteText}>{order.note}</Text>
            </View>
          )}

          <View style={s.orderTotal}>
            <Text style={s.orderTotalLabel}>Order Total</Text>
            <Text style={s.orderTotalValue}>{parseFloat(order.total).toFixed(2)} EGP</Text>
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.skipBtn}
          onPress={() => {/* dismiss locally */}}
          activeOpacity={0.7}
        >
          <Ionicons name="close-outline" size={20} color={colors.inkMuted} />
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.acceptBtn, accepting && s.acceptBtnDisabled]}
          onPress={() => onAccept(order.id)}
          disabled={accepting}
          activeOpacity={0.8}
        >
          {accepting ? (
            <Text style={s.acceptText}>Accepting…</Text>
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
              <Text style={s.acceptText}>Accept Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ─── Active delivery banner ───────────────────────────────────────────────────

function ActiveDeliveryBanner() {
  const router = useRouter();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  if (!activeDelivery) return null;

  const statusLabels: Record<string, string> = {
    ACCEPTED: 'Order Accepted',
    EN_ROUTE_TO_PICKUP: 'Heading to Pharmacy',
    ARRIVED_AT_PHARMACY: 'At Pharmacy',
    PICKED_UP: 'Order Picked Up',
    EN_ROUTE_TO_CUSTOMER: 'Heading to Customer',
    ARRIVED_AT_CUSTOMER: 'At Customer Location',
  };

  return (
    <TouchableOpacity
      style={s.activeBanner}
      onPress={() => router.push('/(tabs)/delivery')}
      activeOpacity={0.9}
    >
      <View style={s.activeDot} />
      <View style={s.activeBannerText}>
        <Text style={s.activeBannerTitle}>Active Delivery</Text>
        <Text style={s.activeBannerStatus}>
          {statusLabels[activeDelivery.status] ?? activeDelivery.status}
        </Text>
      </View>
      <View style={s.activeBannerRight}>
        <Text style={s.activeBannerCustomer} numberOfLines={1}>
          → {activeDelivery.order.customerName}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ isOnline }: { isOnline: boolean }) {
  const pulseAnim = React.useRef(new RNAnimated.Value(1)).current;

  React.useEffect(() => {
    if (!isOnline) return;
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isOnline]);

  return (
    <View style={s.emptyState}>
      {isOnline ? (
        <>
          <RNAnimated.View
            style={[s.emptyIconBg, { transform: [{ scale: pulseAnim }] }]}
          >
            <Ionicons name="radio-outline" size={40} color={colors.primary} />
          </RNAnimated.View>
          <Text style={s.emptyTitle}>Looking for orders…</Text>
          <Text style={s.emptyDesc}>
            You'll be notified when a new order is available nearby.
          </Text>
        </>
      ) : (
        <>
          <View style={[s.emptyIconBg, { backgroundColor: colors.well }]}>
            <Ionicons name="power-outline" size={40} color={colors.inkMuted} />
          </View>
          <Text style={s.emptyTitle}>You're Offline</Text>
          <Text style={s.emptyDesc}>
            Toggle online to start receiving delivery requests.
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isOnline = user?.driverProfile?.isOnline ?? false;
  const setOnlineStatus = useAuthStore((s) => s.setOnlineStatus);
  const setAvailableOrders = useOrdersStore((s) => s.setAvailableOrders);
  const setActiveDelivery = useOrdersStore((s) => s.setActiveDelivery);
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);

  // Fetch available orders
  const { data: ordersData, isFetching: fetchingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', 'available'],
    queryFn: driverApi.getAvailableOrders,
    enabled: isOnline,
    refetchInterval: 15_000,
  });

  // Sync available orders to store
  useEffect(() => {
    if (ordersData) setAvailableOrders((ordersData as any).orders ?? []);
  }, [ordersData]);

  // Fetch active delivery
  const { data: activeData, refetch: refetchActive } = useQuery({
    queryKey: ['delivery', 'active'],
    queryFn: driverApi.getActiveDelivery,
    refetchInterval: 30_000,
  });

  // Sync active delivery to store
  useEffect(() => {
    if (activeData !== undefined) setActiveDelivery((activeData as any).activeDelivery ?? null);
  }, [activeData]);

  // Online/offline toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (online: boolean) =>
      online ? driverApi.goOnline() : driverApi.goOffline(),
    onSuccess: (_, online) => {
      setOnlineStatus(online);
      if (online) {
        showToast('You are now online', 'success');
        refetchOrders();
      } else {
        showToast('You are now offline', 'info');
      }
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Failed to update status';
      showToast(message, 'error');
    },
  });

  const handleToggleOnline = useCallback(() => {
    if (!isOnline && activeDelivery) {
      showToast('Cannot go offline during an active delivery', 'warning');
      return;
    }
    toggleMutation.mutate(!isOnline);
  }, [isOnline, activeDelivery, toggleMutation]);

  // Accept order mutation
  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => driverApi.acceptOrder(orderId),
    onSuccess: (data: any) => {
      setActiveDelivery(null); // will be set by refetch
      queryClient.invalidateQueries({ queryKey: ['delivery', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'available'] });
      refetchActive();
      showToast('Order accepted!', 'success');
      router.push('/(tabs)/delivery');
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Failed to accept order';
      showToast(message, 'error');
    },
  });

  const orders: AvailableOrder[] = (ordersData as any)?.orders ?? [];

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchOrders(), refetchActive()]);
  }, [refetchOrders, refetchActive]);

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>
              Hello, {user?.fullName?.split(' ')[0] ?? 'Driver'} 👋
            </Text>
            <Text style={s.headerSub}>
              {isOnline
                ? `${orders.length} order${orders.length !== 1 ? 's' : ''} available`
                : 'Go online to receive orders'}
            </Text>
          </View>

          {/* Online toggle */}
          <View style={s.toggleRow}>
            <Text style={[s.toggleLabel, isOnline && s.toggleLabelOn]}>
              {toggleMutation.isPending ? 'Updating…' : isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              disabled={toggleMutation.isPending}
              trackColor={{ false: colors.border, true: `${colors.primary}60` }}
              thumbColor={isOnline ? colors.primary : colors.inkFaint}
              ios_backgroundColor={colors.border}
            />
          </View>
        </View>

        {/* Active delivery banner */}
        <ActiveDeliveryBanner />

        {/* Orders list */}
        {isOnline && fetchingOrders && orders.length === 0 ? (
          <View style={s.skeletonContainer}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} lines={4} style={{ marginBottom: spacing[3] }} />
            ))}
          </View>
        ) : (
          <FlatList
            data={isOnline ? orders : []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <OrderCard
                order={item}
                onAccept={(id) => acceptMutation.mutate(id)}
                accepting={acceptMutation.isPending && acceptMutation.variables === item.id}
              />
            )}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState isOnline={isOnline} />}
            refreshControl={
              <RefreshControl
                refreshing={fetchingOrders}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
          />
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceAlt },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  greeting: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.ink },
  headerSub: { fontSize: typography.sm, color: colors.inkMuted, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  toggleLabel: { fontSize: typography.sm, fontWeight: typography.medium, color: colors.inkMuted },
  toggleLabelOn: { color: colors.success },

  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  activeBannerText: { flex: 1 },
  activeBannerTitle: { fontSize: typography.xs, color: 'rgba(255,255,255,0.8)', fontWeight: typography.medium },
  activeBannerStatus: { fontSize: typography.sm, color: colors.white, fontWeight: typography.bold },
  activeBannerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  activeBannerCustomer: { fontSize: typography.xs, color: 'rgba(255,255,255,0.9)', maxWidth: 100 },

  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  skeletonContainer: { padding: spacing[4] },

  // Order card
  orderCard: { padding: 0, overflow: 'hidden' },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  orderHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1, marginRight: spacing[3] },
  orderIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCustomer: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.ink },
  orderAddress: { fontSize: typography.xs, color: colors.inkMuted, marginTop: 2 },
  orderEarnings: { alignItems: 'flex-end', gap: 4 },
  earningsAmount: { fontSize: typography.md, fontWeight: typography.extrabold, color: colors.primary },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[3],
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: typography.xs, color: colors.inkMuted },
  statDivider: { width: 1, height: 14, backgroundColor: colors.border },

  expandedSection: { paddingHorizontal: spacing[4], paddingBottom: spacing[3], gap: spacing[3] },
  separator: { height: 1, backgroundColor: colors.borderSoft, marginBottom: spacing[1] },
  detailRow: { flexDirection: 'row', gap: spacing[3] },
  detailText: { flex: 1 },
  detailLabel: { fontSize: typography.xs, color: colors.inkMuted, fontWeight: typography.medium },
  detailValue: { fontSize: typography.sm, color: colors.ink, fontWeight: typography.semibold, marginTop: 2 },
  detailSub: { fontSize: typography.xs, color: colors.inkMuted },
  noteBox: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: '#EFF6FF',
    padding: spacing[3],
    borderRadius: radii.md,
  },
  noteText: { flex: 1, fontSize: typography.xs, color: colors.info },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
  },
  orderTotalLabel: { fontSize: typography.sm, color: colors.inkMuted, fontWeight: typography.medium },
  orderTotalValue: { fontSize: typography.base, color: colors.ink, fontWeight: typography.bold },

  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  skipBtn: {
    flex: 0.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[3],
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
  },
  skipText: { fontSize: typography.sm, color: colors.inkMuted, fontWeight: typography.medium },
  acceptBtn: {
    flex: 0.65,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    paddingVertical: spacing[3],
  },
  acceptBtnDisabled: { backgroundColor: colors.primaryDark },
  acceptText: { fontSize: typography.sm, color: colors.white, fontWeight: typography.bold },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: spacing[16], paddingHorizontal: spacing[8], gap: spacing[4] },
  emptyIconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.ink, textAlign: 'center' },
  emptyDesc: { fontSize: typography.base, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },
});
