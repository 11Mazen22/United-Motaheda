/**
 * Orders Screen — Driver home (2026 premium rebuild).
 *
 * Sections:
 *   • White header — greeting (Cairo Black) + online pill toggle
 *   • GPS accuracy strip when online
 *   • Active delivery banner with teal gradient
 *   • Skeleton loaders → order FlatList
 *   • Empty state (pulsing radar when online, power icon when offline)
 */

import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Switch,
  TouchableOpacity,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }    from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '@pharmacy/ui-native/courier-tokens';
import { Card, SkeletonCard, showToast } from '@pharmacy/ui-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi }    from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useOrdersStore, type AvailableOrder } from '@/stores/orders.store';

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onAccept,
  onSkip,
  accepting,
  skipping,
}: {
  order:    AvailableOrder;
  onAccept: (id: string) => void;
  onSkip:   (id: string) => void;
  accepting: boolean;
  skipping: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const skipScale = React.useRef(new RNAnimated.Value(1)).current;
  const acceptScale = React.useRef(new RNAnimated.Value(1)).current;
  const AnimatedTouchable = RNAnimated.createAnimatedComponent(TouchableOpacity);

  const paymentMethod = order.paymentMethod?.toLowerCase();
  const isCash = paymentMethod === 'cod' || paymentMethod === 'cash';
  const distance = order.distanceToCustomerMeters != null
    ? order.distanceToCustomerMeters > 1000
      ? `${(order.distanceToCustomerMeters / 1000).toFixed(1)} km`
      : `${Math.round(order.distanceToCustomerMeters)} m`
    : '—';

  const pressIn = (ref: RNAnimated.Value) => RNAnimated.spring(ref, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = (ref: RNAnimated.Value) => RNAnimated.spring(ref, { toValue: 1, useNativeDriver: true, friction: 8 }).start();

  return (
    <Card style={oc.card} elevation="sm">
      <TouchableOpacity
        onPress={() => setExpanded((value) => !value)}
        activeOpacity={0.85}
        style={oc.cardHeader}
      >
        <View style={oc.cardHeaderLeft}>
          <View style={oc.iconBox}>
            <Ionicons name="cube-outline" size={20} color={colors.primary} />
          </View>
          <View style={oc.orderDetails}>
            <View style={oc.orderMeta}>
              <Text style={oc.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
              <View style={[oc.paymentBadge, isCash ? oc.payBadgeCash : oc.payBadgeCard]}> 
                <Ionicons
                  name={isCash ? 'cash-outline' : 'card-outline'}
                  size={13}
                  color={isCash ? colors.warning : colors.info}
                />
                <Text style={[oc.paymentText, isCash ? oc.paymentTextCash : oc.paymentTextCard]}>
                  {isCash ? 'Cash' : 'Card'}
                </Text>
              </View>
            </View>
            <Text style={oc.customerName} numberOfLines={1}>{order.customerName}</Text>
            <Text style={oc.customerAddr} numberOfLines={1}>{order.customerAddress}</Text>
          </View>
        </View>

        <View style={oc.earningsCol}>
          <Text style={oc.earningsAmt}>{order.estimatedEarnings.toFixed(0)}</Text>
          <Text style={oc.earningsCur}>EGP</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkFaint} />
        </View>
      </TouchableOpacity>

      <View style={oc.stats}>
        <StatChip icon="navigate-outline" label={distance} />
        <StatChip icon="time-outline" label={`~${order.estimatedMinutes ?? '?'} min`} />
        <StatChip icon="bag-outline" label={`${order.itemCount} items`} />
        <StatChip icon="storefront-outline" label={order.pharmacy.name} />
      </View>

      {expanded && (
        <View style={oc.details}>
          <View style={oc.detailSep} />
          <DetailRow icon="storefront-outline" label="Pharmacy" title={order.pharmacy.name} sub={order.pharmacy.address} />
          <DetailRow icon="home-outline" label="Delivery" title={order.customerName} sub={order.customerAddress} />
          {order.note ? (
            <View style={oc.noteBox}>
              <Ionicons name="information-circle-outline" size={13} color={colors.info} />
              <Text style={oc.noteText}>{order.note}</Text>
            </View>
          ) : null}
          <View style={oc.totalRow}>
            <Text style={oc.totalLabel}>Order Total</Text>
            <Text style={oc.totalValue}>{parseFloat(order.total).toFixed(2)} EGP</Text>
          </View>
        </View>
      )}

      <View style={oc.actions}>
        <AnimatedTouchable
          style={[oc.actionButton, oc.skipBtn, skipping && oc.skipBtnPending, { transform: [{ scale: skipScale }] }]}
          onPress={() => onSkip(order.id)}
          disabled={skipping}
          activeOpacity={0.7}
          onPressIn={() => pressIn(skipScale)}
          onPressOut={() => pressOut(skipScale)}
        >
          <Ionicons name="close-outline" size={17} color={skipping ? colors.inkFaint : colors.inkMuted} />
          <Text style={oc.skipText}>{skipping ? 'Skipping…' : 'Skip'}</Text>
        </AnimatedTouchable>

        <AnimatedTouchable
          style={[oc.actionButton, oc.acceptBtn, accepting && oc.acceptBtnPending, { transform: [{ scale: acceptScale }] }]}
          onPress={() => onAccept(order.id)}
          disabled={accepting}
          activeOpacity={0.85}
          onPressIn={() => pressIn(acceptScale)}
          onPressOut={() => pressOut(acceptScale)}
        >
          {accepting ? (
            <Text style={oc.acceptText}>Accepting…</Text>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={oc.acceptText}>Accept · {order.estimatedEarnings.toFixed(0)} EGP</Text>
            </>
          )}
        </AnimatedTouchable>
      </View>
    </Card>
  );
}

function StatChip({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={oc.chip}>
      <Ionicons name={icon} size={11} color={colors.primary} />
      <Text style={oc.chipText}>{label}</Text>
    </View>
  );
}

function DetailRow({
  icon, label, title, sub,
}: {
  icon:  React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  title: string;
  sub:   string;
}) {
  return (
    <View style={oc.detailRow}>
      <View style={oc.detailIcon}>
        <Ionicons name={icon} size={15} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={oc.detailLabel}>{label}</Text>
        <Text style={oc.detailTitle}>{title}</Text>
        <Text style={oc.detailSub}>{sub}</Text>
      </View>
    </View>
  );
}

function MetricTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={{} as any}>
      <View style={[{} as any, { backgroundColor: color ?? colors.primaryLight }]}> 
        <Ionicons name={icon} size={18} color={color ?? colors.primary} />
      </View>
      <Text style={{} as any}>{value}</Text>
      <Text style={{} as any}>{label}</Text>
    </View>
  );
}

const oc = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radii['2xl'],
    overflow:        'hidden',
    ...shadows.md,
  },
  stripe: { height: 4, backgroundColor: colors.primary },

  cardHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        spacing[4],
    gap:            spacing[3],
  },
  cardHeaderLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    minWidth:      0,
  },
  orderDetails: {
    flex: 1,
    minWidth: 0,
  },
  orderId: {
    fontFamily: typography.semibold,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
    marginBottom: 2,
  },
  customerName: {
    fontFamily: typography.bold,
    fontSize:   typography.base,
    color:      colors.ink,
  },
  customerAddr: {
    fontFamily: typography.regular,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
    marginTop:  2,
  },
  iconBox: {
    width:           44,
    height:          44,
    borderRadius:    radii['2xl'],
    backgroundColor: colors.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  earningsCol: { alignItems: 'flex-end', flexShrink: 0, gap: spacing[1] },
  orderMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], marginBottom: spacing[2] },
  earningsAmt: {
    fontFamily: typography.black,
    fontSize:   typography.xl,
    color:      colors.primary,
    lineHeight: 26,
  },
  earningsCur: {
    fontFamily: typography.semibold,
    fontSize:   typography.xs,
    color:      colors.primary,
  },

  stats: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing[4],
    paddingBottom:     spacing[3],
    gap:               spacing[2],
    flexWrap:          'wrap',
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   8,
    borderRadius:      radii.full,
    backgroundColor:   colors.surfaceAlt,
    borderWidth:       1,
    borderColor:       colors.borderSoft,
  },
  chipText: {
    fontFamily: typography.medium,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
  },
  chipSep: { width: 1, height: 12, backgroundColor: colors.border },
  payBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      radii.full,
  },
  payBadgeCash: { backgroundColor: '#FEF9C3' },
  payBadgeCard: { backgroundColor: '#EFF6FF' },
  payBadgeText: {
    fontFamily: typography.bold,
    fontSize:   typography.xs,
  },

  details: {
    paddingHorizontal: spacing[4],
    paddingBottom:     spacing[3],
    gap:               spacing[3],
  },
  detailSep: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginBottom: spacing[3],
  },
  detailRow: { flexDirection: 'row', gap: spacing[3] },
  detailIcon: {
    width:           32,
    height:          32,
    borderRadius:    radii.md,
    backgroundColor: colors.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  detailLabel: { fontFamily: typography.medium, fontSize: typography.xs, color: colors.inkFaint },
  detailTitle: { fontFamily: typography.bold, fontSize: typography.sm, color: colors.ink, marginTop: 1 },
  detailSub:   { fontFamily: typography.regular, fontSize: typography.xs, color: colors.inkMuted },
  noteBox: {
    flexDirection:     'row',
    gap:               spacing[2],
    backgroundColor:   '#EFF6FF',
    padding:           spacing[3],
    borderRadius:      radii.lg,
  },
  noteText: {
    flex:       1,
    fontFamily: typography.regular,
    fontSize:   typography.xs,
    color:      colors.info,
  },
  totalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingTop:     spacing[2],
  },
  totalLabel: { fontFamily: typography.medium, fontSize: typography.sm, color: colors.inkMuted },
  totalValue: { fontFamily: typography.bold,   fontSize: typography.base, color: colors.ink },

  actionButton: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    paddingVertical: spacing[4],
  },
  actions: {
    flexDirection:  'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  skipBtn: {
    flex:           0.3,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[1],
    paddingVertical: spacing[4],
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderSoft,
  },
  skipText: { fontFamily: typography.medium, fontSize: typography.sm, color: colors.inkMuted },
  skipBtnPending: { opacity: 0.6 },
  acceptBtn: {
    flex:           0.7,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing[2],
    backgroundColor: colors.primary,
    paddingVertical: spacing[4],
  },
  acceptBtnPending: { backgroundColor: colors.primaryDark },
  acceptText: { fontFamily: typography.bold, fontSize: typography.sm, color: colors.white },
  paymentBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2],
    borderRadius:      radii.full,
    backgroundColor: colors.surface,
    borderWidth:       1,
    borderColor:       colors.borderSoft,
    marginTop:         spacing[2],
  },
  paymentText: {
    fontFamily: typography.semibold,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
  },
  paymentTextCash: { color: colors.warning },
  paymentTextCard: { color: colors.info },
});

// ─── Active delivery banner ───────────────────────────────────────────────────

function ActiveBanner() {
  const router         = useRouter();
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  if (!activeDelivery) return null;

  const STATUS_LABELS: Record<string, string> = {
    ACCEPTED:             'Order Accepted',
    EN_ROUTE_TO_PICKUP:   'Heading to Pharmacy',
    ARRIVED_AT_PHARMACY:  'At Pharmacy',
    PICKED_UP:            'Order Picked Up',
    EN_ROUTE_TO_CUSTOMER: 'Heading to Customer',
    ARRIVED_AT_CUSTOMER:  'At Customer Location',
  };

  return (
    <TouchableOpacity onPress={() => router.push('/(tabs)/delivery')} activeOpacity={0.9}>
      <Card style={ab.bannerCard} elevation="sm">
        <View style={ab.banner}>
          <View style={ab.pulse} />
          <View style={ab.textBlock}>
            <Text style={ab.title}>{STATUS_LABELS[activeDelivery.status] ?? 'Active Delivery'}</Text>
            <Text style={ab.sub} numberOfLines={1}>→ {activeDelivery.order.customerName}</Text>
          </View>
          <View style={ab.right}>
            <Text style={ab.earnings}>~{parseFloat(activeDelivery.estimatedEarnings).toFixed(0)} EGP</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const ab = StyleSheet.create({
  bannerCard: {
    marginHorizontal: spacing[4],
    marginBottom:     spacing[3],
    borderRadius:     radii['2xl'],
    overflow:         'hidden',
    ...shadows.sm,
  },
  banner: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[3],
    gap:               spacing[3],
    backgroundColor:   colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryDark,
  },
  pulse: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: colors.online,
    flexShrink:      0,
  },
  textBlock: { flex: 1 },
  title: { fontFamily: typography.bold,   fontSize: typography.sm,  color: colors.white },
  sub:   { fontFamily: typography.regular, fontSize: typography.xs, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
  earnings: { fontFamily: typography.black, fontSize: typography.sm, color: colors.white },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ isOnline }: { isOnline: boolean }) {
  const pulseAnim = React.useRef(new RNAnimated.Value(1)).current;
  React.useEffect(() => {
    if (!isOnline) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.16, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline]);

  return (
    <View style={em.wrap}>
      <RNAnimated.View style={[em.ring, { transform: [{ scale: pulseAnim }] }]}>
        <View style={em.inner}>
          <Ionicons
            name={isOnline ? 'radio-outline' : 'power-outline'}
            size={34}
            color={isOnline ? colors.primary : colors.inkFaint}
          />
        </View>
      </RNAnimated.View>
      <Text style={em.title}>{isOnline ? 'Looking for orders…' : 'You are Offline'}</Text>
      <Text style={em.desc}>
        {isOnline
          ? 'Stay nearby. Orders appear instantly when available.'
          : 'Toggle the switch above to start receiving orders.'}
      </Text>
    </View>
  );
}

const em = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: spacing[20], paddingHorizontal: spacing[8], gap: spacing[4] },
  ring: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  inner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: typography.black, fontSize: typography.xl, color: colors.ink, textAlign: 'center' },
  desc:  { fontFamily: typography.regular, fontSize: typography.base, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router      = useRouter();
  const qc          = useQueryClient();
  const user        = useAuthStore((s) => s.user);
  const isOnline    = user?.driverProfile?.isOnline ?? false;
  const setOnline   = useAuthStore((s) => s.setOnlineStatus);
  const setAvailable = useOrdersStore((s) => s.setAvailableOrders);
  const setActive   = useOrdersStore((s) => s.setActiveDelivery);
  const active      = useOrdersStore((s) => s.activeDelivery);

  const { data: ordersData, isFetching, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', 'available'],
    queryFn:  driverApi.getAvailableOrders,
    enabled:  isOnline,
    refetchInterval: 15_000,
  });

  const { data: activeData, refetch: refetchActive } = useQuery({
    queryKey: ['delivery', 'active'],
    queryFn:  driverApi.getActiveDelivery,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (ordersData) setAvailable((ordersData as any).orders ?? []);
  }, [ordersData]);

  useEffect(() => {
    if (activeData !== undefined) setActive((activeData as any).activeDelivery ?? null);
  }, [activeData]);

  const toggleMutation = useMutation({
    mutationFn: (online: boolean) => online ? driverApi.goOnline() : driverApi.goOffline(),
    onSuccess: (_, online) => {
      setOnline(online);
      showToast(online ? 'You are now online' : 'You are now offline', online ? 'success' : 'info');
      if (online) refetchOrders();
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to update status', 'error'),
  });

  const handleToggle = useCallback(() => {
    if (!isOnline && active) { showToast('Cannot go offline during an active delivery', 'warning'); return; }
    toggleMutation.mutate(!isOnline);
  }, [isOnline, active, toggleMutation]);

  const acceptMutation = useMutation({
    mutationFn: (id: string) => driverApi.acceptOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery', 'active'] });
      qc.invalidateQueries({ queryKey: ['orders', 'available'] });
      refetchActive();
      showToast('Order accepted!', 'success');
      router.push('/(tabs)/delivery');
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to accept', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => driverApi.rejectOrder(id, 'Driver declined'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'available'] });
      refetchOrders();
      showToast('Order skipped', 'info');
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? 'Failed to skip order', 'error'),
  });

  const orders: AvailableOrder[] = (ordersData as any)?.orders ?? [];
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  const availableCount = orders.length;
  const nextOrderEarnings = orders[0]?.estimatedEarnings ?? 0;
  const firstName = user?.fullName?.split(' ')[0] ?? 'Driver';

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchOrders(), refetchActive()]);
  }, [refetchOrders, refetchActive]);

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerText}>
            <Text style={s.greeting}>مرحباً، {firstName} 👋</Text>
            <Text style={s.subline}>
              {isOnline
                ? `${availableCount} ${availableCount === 1 ? 'طلب متاح' : 'طلبات متاحة'}`
                : 'قم بالتبديل لتلقي الطلبات'}
            </Text>
          </View>

          <View style={[s.togglePill, isOnline && s.togglePillOn]}>
            <View style={[s.dot, isOnline ? s.dotOn : s.dotOff]} />
            <Text style={[s.toggleLabel, isOnline && s.toggleLabelOn]}>
              {toggleMutation.isPending ? '…' : isOnline ? 'متصل' : 'غير متصل'}
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

        {isOnline && (
          <View style={s.heroCard}>
            <View style={s.heroInfo}>
              <Text style={s.heroLabel}>Live order feed</Text>
              <Text style={s.heroValue}>{availableCount} Available now</Text>
            </View>
            <View style={s.heroMeta}>
              <View style={s.heroMetaItem}>
                <Text style={s.heroMetaLabel}>Best fare</Text>
                <Text style={s.heroMetaValue}>{nextOrderEarnings.toFixed(0)} EGP</Text>
              </View>
              <View style={s.heroMetaItem}>
                <Text style={s.heroMetaLabel}>Next ETA</Text>
                <Text style={s.heroMetaValue}>~{orders[0]?.estimatedMinutes ?? '?'} min</Text>
              </View>
            </View>
            <View style={s.heroFooter}>
              <View style={s.heroProgressLabel}>
                <Text style={s.heroProgressTitle}>Fast matching</Text>
                <Text style={s.heroProgressSub}>Orders assigned in under 2 min</Text>
              </View>
              <View style={s.heroBadge}>
                <Text style={s.heroBadgeText}>Premium</Text>
              </View>
            </View>
          </View>
        )}

        {/* GPS strip */}
        {isOnline && (
          <View style={s.gpsStrip}>
            <View style={s.gpsDot} />
            <Text style={s.gpsText}>GPS نشط — تتبع مباشر مفعل</Text>
          </View>
        )}

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
                onSkip={(id) => rejectMutation.mutate(id)}
                accepting={acceptMutation.isPending && acceptMutation.variables === item.id}
                skipping={rejectMutation.isPending && rejectMutation.variables === item.id}
              />
            )}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState isOnline={isOnline} />}
            refreshControl={
              <RefreshControl
                refreshing={isFetching}
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
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[4],
    paddingBottom:     spacing[4],
    backgroundColor:   colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    gap:               spacing[3],
  },
  headerText: { flex: 1 },
  greeting: {
    fontFamily: typography.black,
    fontSize:   typography.lg,
    color:      colors.ink,
  },
  subline: {
    fontFamily: typography.regular,
    fontSize:   typography.sm,
    color:      colors.inkMuted,
    marginTop:  2,
  },
  togglePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2],
    borderRadius:      radii.full,
    backgroundColor:   colors.well,
    borderWidth:       1,
    borderColor:       colors.border,
    flexShrink:        0,
  },
  togglePillOn: {
    backgroundColor: `${colors.primary}12`,
    borderColor:     `${colors.primary}40`,
  },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  dotOn:  { backgroundColor: colors.online },
  dotOff: { backgroundColor: colors.inkFaint },
  toggleLabel: {
    fontFamily: typography.semibold,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
  },
  toggleLabelOn: { color: colors.primary },

  heroCard: {
    marginHorizontal: spacing[4],
    marginBottom:     spacing[4],
    padding:          spacing[4],
    borderRadius:     radii['2xl'],
    backgroundColor:  colors.surface,
    borderWidth:      1,
    borderColor:      colors.borderSoft,
    ...shadows.sm,
  },
  heroInfo: {
    marginBottom: spacing[3],
  },
  heroLabel: {
    fontFamily: typography.semibold,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroValue: {
    fontFamily: typography.black,
    fontSize:   typography['2xl'],
    color:      colors.ink,
    marginTop:  spacing[1],
  },
  heroMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap:           spacing[3],
  },
  heroMetaItem: {
    flex: 1,
    padding: spacing[3],
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.xl,
  },
  heroMetaLabel: {
    fontFamily: typography.medium,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
  },
  heroMetaValue: {
    fontFamily: typography.semibold,
    fontSize:   typography.base,
    color:      colors.ink,
    marginTop:  4,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  heroProgressLabel: {
    flex: 1,
  },
  heroProgressTitle: {
    fontFamily: typography.semibold,
    fontSize:   typography.sm,
    color:      colors.ink,
  },
  heroProgressSub: {
    fontFamily: typography.regular,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
    marginTop: 2,
  },
  heroBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1],
    borderRadius:      radii.full,
    backgroundColor:   colors.primary,
  },
  heroBadgeText: {
    fontFamily: typography.bold,
    fontSize:   typography.xs,
    color:      colors.white,
  },

  gpsStrip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[2],
    backgroundColor:   colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  gpsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.online },
  gpsText: {
    fontFamily: typography.regular,
    fontSize:   typography.xs,
    color:      colors.inkMuted,
  },

  list:     { padding: spacing[4], paddingBottom: spacing[12] },
  skeletons: { padding: spacing[4] },
});
