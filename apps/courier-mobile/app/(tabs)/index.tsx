/**
 * Orders Screen — Driver app home screen (2026 redesign).
 *
 * Layout:
 *  • Hero header: greeting + online/offline toggle
 *  • Active delivery banner (taps to delivery tab)
 *  • Available orders FlatList with expandable cards
 *  • Empty state for online/offline
 *
 * Design: teal/white, premium cards, clear hierarchy, large touch targets.
 */

import React, { useCallback, useEffect } from 'react';
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
import { SkeletonCard, showToast } from '@/components/ui';
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
    <View style={oc.card}>
      {/* Accent stripe */}
      <View style={oc.stripe} />

      {/* Header — tap to expand */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
        style={oc.header}
      >
        <View style={oc.headerLeft}>
          <View style={oc.iconBox}>
            <Ionicons name="cube-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={oc.customerName} numberOfLines={1}>
              {order.customerName}
            </Text>
            <Text style={oc.customerAddr} numberOfLines={1}>
              {order.customerAddress}
            </Text>
          </View>
        </View>
        <View style={oc.earningsCol}>
          <Text style={oc.earningsAmount}>
            {order.estimatedEarnings.toFixed(0)}
          </Text>
          <Text style={oc.earningsCurrency}>EGP</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.inkFaint}
            style={{ marginTop: 2 }}
          />
        </View>
      </TouchableOpacity>

      {/* Stats chips */}
      <View style={oc.chips}>
        <View style={oc.chip}>
          <Ionicons name="navigate-outline" size={12} color={colors.primary} />
          <Text style={oc.chipText}>
            {order.distanceToPickupMeters != null
              ? `${(order.distanceToPickupMeters / 1000).toFixed(1)} km`
              : '—'}
          </Text>
        </View>
        <View style={oc.chipDivider} />
        <View style={oc.chip}>
          <Ionicons name="time-outline" size={12} color={colors.primary} />
          <Text style={oc.chipText}>~{order.estimatedMinutes ?? '?'} min</Text>
        </View>
        <View style={oc.chipDivider} />
        <View style={oc.chip}>
          <Ionicons name="bag-outline" size={12} color={colors.primary} />
          <Text style={oc.chipText}>{order.itemCount} items</Text>
        </View>
        <View style={oc.chipDivider} />
        <View
          style={[
            oc.chip,
            oc.payChip,
            order.paymentMethod === 'cash' ? oc.payChipCash : oc.payChipCard,
          ]}
        >
          <Ionicons
            name={order.paymentMethod === 'cash' ? 'cash-outline' : 'card-outline'}
            size={12}
            color={order.paymentMethod === 'cash' ? '#B45309' : colors.info}
          />
          <Text
            style={[
              oc.chipText,
              { color: order.paymentMethod === 'cash' ? '#B45309' : colors.info },
            ]}
          >
            {order.paymentMethod === 'cash' ? 'Cash' : 'Card'}
          </Text>
        </View>
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={oc.details}>
          <View style={oc.detailSep} />
          <View style={oc.detailRow}>
            <View style={oc.detailIcon}>
              <Ionicons name="storefront-outline" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={oc.detailLabel}>Pickup</Text>
              <Text style={oc.detailValue}>{order.pharmacy.name}</Text>
              <Text style={oc.detailSub}>{order.pharmacy.address}</Text>
            </View>
          </View>
          <View style={oc.detailRow}>
            <View style={oc.detailIcon}>
              <Ionicons name="home-outline" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={oc.detailLabel}>Deliver to</Text>
              <Text style={oc.detailValue}>{order.customerName}</Text>
              <Text style={oc.detailSub}>{order.customerAddress}</Text>
            </View>
          </View>
          {order.note ? (
            <View style={oc.noteBox}>
              <Ionicons name="information-circle-outline" size={14} color={colors.info} />
              <Text style={oc.noteText}>{order.note}</Text>
            </View>
          ) : null}
          <View style={oc.totalRow}>
            <Text style={oc.totalLabel}>Order Total</Text>
            <Text style={oc.totalValue}>{parseFloat(order.total).toFixed(2)} EGP</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={oc.actions}>
        <TouchableOpacity
          style={oc.skipBtn}
          onPress={() => {/* local dismiss */}}
          activeOpacity={0.7}
        >
          <Ionicons name="close-outline" size={18} color={colors.inkMuted} />
          <Text style={oc.skipText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[oc.acceptBtn, accepting && oc.acceptBtnPending]}
          onPress={() => onAccept(order.id)}
          disabled={accepting}
          activeOpacity={0.85}
        >
          {accepting ? (
            <Text style={oc.acceptText}>Accepting…</Text>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={oc.acceptText}>Accept  •  {order.estimatedEarnings.toFixed(0)} EGP</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const oc = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    ...shadows.md,
  },
  stripe: {
    height: 4,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[3],
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minWidth: 0,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  customerName: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  customerAddr: {
    fontSize: typography.xs,
    color: colors.inkMuted,
    marginTop: 2,
  },
  earningsCol: {
    alignItems: 'center',
    flexShrink: 0,
  },
  earningsAmount: {
    fontSize: typography.xl,
    fontWeight: typography.extrabold,
    color: colors.primary,
    lineHeight: 26,
  },
  earningsCurrency: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: typography.semibold,
  },

  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: {
    fontSize: typography.xs,
    color: colors.inkMuted,
    fontWeight: typography.medium,
  },
  chipDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
  },
  payChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  payChipCash: { backgroundColor: '#FEF9C3' },
  payChipCard: { backgroundColor: '#EFF6FF' },

  details: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[3],
  },
  detailSep: {
    height: 1,
    backgroundColor: colors.borderSoft,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: typography.xs,
    color: colors.inkFaint,
    fontWeight: typography.medium,
  },
  detailValue: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.ink,
    marginTop: 1,
  },
  detailSub: {
    fontSize: typography.xs,
    color: colors.inkMuted,
  },
  noteBox: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: '#EFF6FF',
    padding: spacing[3],
    borderRadius: radii.lg,
  },
  noteText: {
    flex: 1,
    fontSize: typography.xs,
    color: colors.info,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
  },
  totalLabel: {
    fontSize: typography.sm,
    color: colors.inkMuted,
    fontWeight: typography.medium,
  },
  totalValue: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.ink,
  },

  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  skipBtn: {
    flex: 0.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[4],
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
  },
  skipText: {
    fontSize: typography.sm,
    color: colors.inkMuted,
    fontWeight: typography.medium,
  },
  acceptBtn: {
    flex: 0.7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    paddingVertical: spacing[4],
  },
  acceptBtnPending: {
    backgroundColor: colors.primaryDark,
  },
  acceptText: {
    fontSize: typography.sm,
    color: colors.white,
    fontWeight: typography.bold,
  },
});

// ─── Active delivery banner ───────────────────────────────────────────────────

function ActiveBanner() {
  const router = useRouter();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  if (!activeDelivery) return null;

  const statusLabels: Record<string, string> = {
    ACCEPTED: 'Order Accepted',
    EN_ROUTE_TO_PICKUP: 'Heading to Pharmacy',
    ARRIVED_AT_PHARMACY: 'At Pharmacy',
    PICKED_UP: 'Order Picked Up',
    EN_ROUTE_TO_CUSTOMER: 'Heading to Customer',
    ARRIVED_AT_CUSTOMER: 'At Customer',
  };

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/delivery')}
      activeOpacity={0.9}
    >
      <View style={ab.banner}>
        <View style={ab.pulse} />
        <View style={ab.textBlock}>
          <Text style={ab.title}>
            {statusLabels[activeDelivery.status] ?? 'Active Delivery'}
          </Text>
          <Text style={ab.sub} numberOfLines={1}>
            → {activeDelivery.order.customerName}
          </Text>
        </View>
        <View style={ab.rightBlock}>
          <Text style={ab.earnings}>
            ~{parseFloat(activeDelivery.estimatedEarnings).toFixed(0)} EGP
          </Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const ab = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    gap: spacing[3],
    backgroundColor: colors.primary,
  },
  pulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.online,
    flexShrink: 0,
  },
  textBlock: { flex: 1 },
  title: {
    fontSize: typography.sm,
    color: colors.white,
    fontWeight: typography.bold,
  },
  sub: {
    fontSize: typography.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  rightBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  earnings: {
    fontSize: typography.sm,
    color: colors.white,
    fontWeight: typography.extrabold,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ isOnline }: { isOnline: boolean }) {
  const pulseAnim = React.useRef(new RNAnimated.Value(1)).current;

  React.useEffect(() => {
    if (!isOnline) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline]);

  return (
    <View style={em.wrap}>
      <RNAnimated.View
        style={[em.iconRing, { transform: [{ scale: pulseAnim }] }]}
      >
        <View style={em.iconInner}>
          <Ionicons
            name={isOnline ? 'radio-outline' : 'power-outline'}
            size={36}
            color={isOnline ? colors.primary : colors.inkFaint}
          />
        </View>
      </RNAnimated.View>
      <Text style={em.title}>
        {isOnline ? 'Looking for orders…' : 'You are Offline'}
      </Text>
      <Text style={em.desc}>
        {isOnline
          ? 'Stay close to your phone. New orders appear instantly.'
          : 'Toggle the switch above to start receiving delivery requests.'}
      </Text>
    </View>
  );
}

const em = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: spacing[16],
    paddingHorizontal: spacing[8],
    gap: spacing[4],
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.ink,
    textAlign: 'center',
  },
  desc: {
    fontSize: typography.base,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const user         = useAuthStore((s) => s.user);
  const isOnline     = user?.driverProfile?.isOnline ?? false;
  const setOnline    = useAuthStore((s) => s.setOnlineStatus);
  const setAvailable = useOrdersStore((s) => s.setAvailableOrders);
  const setActive    = useOrdersStore((s) => s.setActiveDelivery);
  const active       = useOrdersStore((s) => s.activeDelivery);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: ordersData, isFetching, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', 'available'],
    queryFn: driverApi.getAvailableOrders,
    enabled: isOnline,
    refetchInterval: 15_000,
  });

  const { data: activeData, refetch: refetchActive } = useQuery({
    queryKey: ['delivery', 'active'],
    queryFn: driverApi.getActiveDelivery,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (ordersData) setAvailable((ordersData as any).orders ?? []);
  }, [ordersData]);

  useEffect(() => {
    if (activeData !== undefined) setActive((activeData as any).activeDelivery ?? null);
  }, [activeData]);

  // ── Toggle online ─────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: (online: boolean) => online ? driverApi.goOnline() : driverApi.goOffline(),
    onSuccess: (_, online) => {
      setOnline(online);
      showToast(online ? 'You are now online' : 'You are now offline', online ? 'success' : 'info');
      if (online) refetchOrders();
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message ?? 'Failed to update status', 'error');
    },
  });

  const handleToggle = useCallback(() => {
    if (!isOnline && active) {
      showToast('Cannot go offline during an active delivery', 'warning');
      return;
    }
    toggleMutation.mutate(!isOnline);
  }, [isOnline, active, toggleMutation]);

  // ── Accept order ──────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: (id: string) => driverApi.acceptOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'available'] });
      refetchActive();
      showToast('Order accepted!', 'success');
      router.push('/(tabs)/delivery');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message ?? 'Failed to accept', 'error');
    },
  });

  const orders: AvailableOrder[] = (ordersData as any)?.orders ?? [];

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchOrders(), refetchActive()]);
  }, [refetchOrders, refetchActive]);

  const firstName = user?.fullName?.split(' ')[0] ?? 'Driver';

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ── Hero header ─── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.greeting}>Hello, {firstName} 👋</Text>
              <Text style={s.subline}>
                {isOnline
                  ? `${orders.length} order${orders.length !== 1 ? 's' : ''} available`
                  : 'Go online to receive orders'}
              </Text>
            </View>

            {/* Online toggle */}
            <View style={[s.togglePill, isOnline && s.togglePillOn]}>
              <View style={[s.statusDot, isOnline ? s.statusDotOn : s.statusDotOff]} />
              <Text style={[s.toggleLabel, isOnline && s.toggleLabelOn]}>
                {toggleMutation.isPending ? '…' : isOnline ? 'Online' : 'Offline'}
              </Text>
              <Switch
                value={isOnline}
                onValueChange={handleToggle}
                disabled={toggleMutation.isPending}
                trackColor={{ false: colors.border, true: `${colors.primary}50` }}
                thumbColor={isOnline ? colors.primary : colors.inkFaint}
                ios_backgroundColor={colors.border}
              />
            </View>
          </View>

          {/* GPS accuracy mini-strip — only when online */}
          {isOnline && (
            <View style={s.accuracyStrip}>
              <View style={s.accuracyDot} />
              <Text style={s.accuracyText}>GPS active — updating every few seconds</Text>
            </View>
          )}
        </View>

        {/* Active delivery banner */}
        <ActiveBanner />

        {/* Orders list */}
        {isOnline && isFetching && orders.length === 0 ? (
          <View style={s.skeletons}>
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
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState isOnline={isOnline} />}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && orders.length > 0}
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceAlt },

  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  greeting: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  subline: {
    fontSize: typography.sm,
    color: colors.inkMuted,
    marginTop: 2,
  },

  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.well,
    borderWidth: 1,
    borderColor: colors.border,
  },
  togglePillOn: {
    backgroundColor: `${colors.primary}12`,
    borderColor: `${colors.primary}40`,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOn: { backgroundColor: colors.online },
  statusDotOff: { backgroundColor: colors.inkFaint },
  toggleLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.inkMuted,
  },
  toggleLabelOn: { color: colors.primary },

  accuracyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing[3],
    paddingHorizontal: spacing[1],
  },
  accuracyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.online,
  },
  accuracyText: {
    fontSize: typography.xs,
    color: colors.inkMuted,
  },

  list: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  skeletons: {
    padding: spacing[4],
  },
});
