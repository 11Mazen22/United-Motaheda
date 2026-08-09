import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { colors, typography, fontWeight, spacing, radii, shadows } from '@pharmacy/ui-native/courier-tokens';
import { Card, Badge, SkeletonCard, showToast } from '@pharmacy/ui-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { socketManager } from '@/lib/socket';

type ProfileTab = 'profile' | 'earnings' | 'history';

// ─── Stars component ──────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(rating) ? colors.accent : colors.border}
        />
      ))}
    </View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color = colors.primary,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
}) {
  return (
    <Card style={sc.card} elevation="sm">
      <View style={[sc.iconBox, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
      {sub && <Text style={sc.sub}>{sub}</Text>}
    </Card>
  );
}

const sc = StyleSheet.create({
  card: { flex: 1, padding: spacing[4], alignItems: 'center', gap: spacing[1] },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  value: { fontFamily: typography.black,   fontSize: typography.xl, color: colors.ink },
  label: { fontFamily: typography.regular, fontSize: typography.xs, color: colors.inkMuted, textAlign: 'center' },
  sub:   { fontFamily: typography.semibold, fontSize: typography.xs, color: colors.success },
});

// ─── Earnings tab ─────────────────────────────────────────────────────────────

function EarningsTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver', 'statistics'],
    queryFn: driverApi.getStatistics,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </View>
    );
  }

  const stats = data ?? { today: { earnings: '0', deliveries: 0 }, thisWeek: { earnings: '0', deliveries: 0 }, thisMonth: { earnings: '0', deliveries: 0 } };

  return (
    <ScrollView
      contentContainerStyle={et.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <Text style={et.sectionTitle}>Earnings Overview</Text>

      <View style={et.row}>
        <StatCard
          label="Today"
          value={`${parseFloat(stats.today.earnings).toFixed(0)} EGP`}
          sub={`${stats.today.deliveries} deliveries`}
          icon="today-outline"
          color={colors.primary}
        />
        <StatCard
          label="This Week"
          value={`${parseFloat(stats.thisWeek.earnings).toFixed(0)} EGP`}
          sub={`${stats.thisWeek.deliveries} deliveries`}
          icon="calendar-outline"
          color={colors.info}
        />
        <StatCard
          label="This Month"
          value={`${parseFloat(stats.thisMonth.earnings).toFixed(0)} EGP`}
          sub={`${stats.thisMonth.deliveries} deliveries`}
          icon="bar-chart-outline"
          color={colors.success}
        />
      </View>

      <Text style={et.sectionTitle}>Performance</Text>
      <View style={et.row}>
        <StatCard
          label="Rating"
          value={parseFloat(data?.rating ?? '0').toFixed(1)}
          sub="⭐ out of 5"
          icon="star-outline"
          color={colors.accent}
        />
        <StatCard
          label="Total Deliveries"
          value={String(data?.totalDeliveries ?? 0)}
          icon="cube-outline"
          color={colors.primary}
        />
        <StatCard
          label="Completion"
          value={`${parseFloat(data?.completionRate ?? '0').toFixed(0)}%`}
          icon="checkmark-circle-outline"
          color={colors.success}
        />
      </View>
    </ScrollView>
  );
}

const et = StyleSheet.create({
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[10] },
  sectionTitle: { fontSize: typography.base, fontFamily: typography.bold, color: colors.ink, marginBottom: spacing[1] },
  row: { flexDirection: 'row', gap: spacing[3] },
});

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['delivery', 'history'],
    queryFn: ({ pageParam = 1 }) => driverApi.getDeliveryHistory(pageParam as number, 20),
    getNextPageParam: (lastPage: any) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const allDeliveries = data?.pages.flatMap((p: any) => p.deliveries) ?? [];

  if (isLoading) {
    return (
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={3} />)}
      </View>
    );
  }

  if (allDeliveries.length === 0) {
    return (
      <View style={ht.empty}>
        <Ionicons name="cube-outline" size={48} color={colors.border} />
        <Text style={ht.emptyText}>No delivery history yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={allDeliveries}
      keyExtractor={(item: any) => item.id}
      contentContainerStyle={ht.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={refetch} tintColor={colors.primary} />
      }
      onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      onEndReachedThreshold={0.3}
      renderItem={({ item }: { item: any }) => (
        <Card style={ht.item} elevation="sm">
          <View style={ht.itemRow}>
            <View style={ht.itemLeft}>
              <Text style={ht.itemAddress} numberOfLines={1}>{item.customerAddress}</Text>
              <Text style={ht.itemTime}>
                {item.deliveredAt
                  ? formatDistanceToNow(new Date(item.deliveredAt), { addSuffix: true })
                  : '—'}
              </Text>
            </View>
            <View style={ht.itemRight}>
              <Text style={ht.itemEarnings}>
                {parseFloat(item.earnings).toFixed(0)} EGP
              </Text>
              {item.customerRating ? (
                <Stars rating={item.customerRating} size={12} />
              ) : (
                <Text style={ht.noRating}>No rating</Text>
              )}
            </View>
          </View>
          {item.actualDuration && (
            <View style={ht.durationRow}>
              <Ionicons name="time-outline" size={12} color={colors.inkFaint} />
              <Text style={ht.duration}>{item.actualDuration} min</Text>
              <Text style={ht.itemCount}>{item.itemCount} items</Text>
            </View>
          )}
        </Card>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={ht.loadingMore}>
            <Text style={ht.loadingMoreText}>Loading more…</Text>
          </View>
        ) : null
      }
    />
  );
}

const ht = StyleSheet.create({
  list: { padding: spacing[4], paddingBottom: spacing[10] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[16], gap: spacing[3] },
  emptyText: { fontSize: typography.base, color: colors.inkMuted },
  item: { padding: spacing[4] },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  itemLeft: { flex: 1, marginRight: spacing[3] },
  itemAddress: { fontSize: typography.sm, fontFamily: typography.semibold, color: colors.ink },
  itemTime: { fontSize: typography.xs, color: colors.inkMuted, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemEarnings: { fontSize: typography.base, fontFamily: typography.bold, color: colors.primary },
  noRating: { fontSize: typography.xs, color: colors.inkFaint },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  duration: { fontSize: typography.xs, color: colors.inkFaint },
  itemCount: { fontSize: typography.xs, color: colors.inkFaint, marginLeft: spacing[2] },
  loadingMore: { padding: spacing[4], alignItems: 'center' },
  loadingMoreText: { fontSize: typography.sm, color: colors.inkMuted },
});

// ─── Document badge ───────────────────────────────────────────────────────────

function DocBadge({ label, uploaded }: { label: string; uploaded: boolean }) {
  return (
    <View style={db.badge}>
      <Ionicons
        name={uploaded ? 'checkmark-circle' : 'close-circle-outline'}
        size={14}
        color={uploaded ? colors.success : colors.error}
      />
      <Text style={[db.label, { color: uploaded ? colors.success : colors.error }]}>
        {label}
      </Text>
    </View>
  );
}

const db = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: typography.xs, fontFamily: typography.medium },
});

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const dp = user?.driverProfile;
  const { data, isLoading } = useQuery({
    queryKey: ['driver', 'profile'],
    queryFn: driverApi.getProfile,
    staleTime: 60_000,
  });

  const profile = data ?? { driverProfile: dp };
  const driver = profile?.driverProfile ?? dp;

  if (isLoading && !driver) {
    return <View style={{ padding: spacing[4] }}><SkeletonCard lines={6} /></View>;
  }

  // Build initials avatar
  const initials = user?.fullName
    ? user.fullName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'D';

  return (
    <ScrollView contentContainerStyle={pt.scroll} showsVerticalScrollIndicator={false}>
      {/* Approval banner */}
      {driver?.status === 'PENDING_APPROVAL' && (
        <View style={pt.pendingBanner}>
          <Ionicons name="time-outline" size={16} color={colors.accent} />
          <Text style={pt.pendingText}>Account pending approval</Text>
        </View>
      )}

      {/* Avatar + name */}
      <View style={pt.avatarSection}>
        <View style={pt.avatar}>
          <Text style={pt.avatarText}>{initials}</Text>
        </View>
        <Text style={pt.name}>{user?.fullName ?? '—'}</Text>
        <Text style={pt.phone}>{user?.phone ?? user?.email ?? '—'}</Text>
        {driver?.rating && (
          <View style={pt.ratingRow}>
            <Stars rating={parseFloat(driver.rating)} size={16} />
            <Text style={pt.ratingValue}>{parseFloat(driver.rating).toFixed(1)}</Text>
          </View>
        )}
        <Badge
          label={driver?.status ?? 'UNKNOWN'}
          variant={
            driver?.status === 'ACTIVE' ? 'success'
              : driver?.status === 'APPROVED' ? 'info'
              : driver?.status === 'PENDING_APPROVAL' ? 'warning'
              : driver?.status === 'SUSPENDED' ? 'error'
              : 'neutral'
          }
          dot
        />
      </View>

      {/* Vehicle info */}
      {driver && (
        <Card style={pt.card} elevation="sm">
          <Text style={pt.cardTitle}>Vehicle Information</Text>
          <View style={pt.infoGrid}>
            {[
              { label: 'Type', value: driver.vehicleType },
              { label: 'Plate', value: driver.vehiclePlate ?? '—' },
              { label: 'Model', value: driver.vehicleModel ?? '—' },
              { label: 'Color', value: driver.vehicleColor ?? '—' },
            ].map(({ label, value }) => (
              <View key={label} style={pt.infoItem}>
                <Text style={pt.infoLabel}>{label}</Text>
                <Text style={pt.infoValue}>{value}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Document status */}
      {driver && (
        <Card style={pt.card} elevation="sm">
          <Text style={pt.cardTitle}>Documents</Text>
          <View style={pt.docsGrid}>
            <DocBadge label="License" uploaded={!!driver.licensePhotoUrl} />
            <DocBadge label="National ID" uploaded={!!driver.idPhotoUrl} />
            <DocBadge label="Vehicle" uploaded={!!driver.vehiclePhotoUrl} />
            <DocBadge label="Insurance" uploaded={!!driver.insurancePhotoUrl} />
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const pt = StyleSheet.create({
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[10] },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: '#FEF9C3',
    padding: spacing[3],
    borderRadius: radii.lg,
    marginBottom: spacing[2],
  },
  pendingText: { fontSize: typography.sm, color: '#854D0E', fontFamily: typography.medium },
  avatarSection: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  avatarText: { fontFamily: typography.black, fontSize: typography['2xl'], color: colors.white },
  name:       { fontFamily: typography.bold,  fontSize: typography.xl,    color: colors.ink },
  phone:      { fontFamily: typography.regular, fontSize: typography.sm,  color: colors.inkMuted },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ratingValue:{ fontFamily: typography.bold, fontSize: typography.base, color: colors.ink },
  card:       { padding: spacing[4], gap: spacing[3] },
  cardTitle:  { fontFamily: typography.bold, fontSize: typography.base, color: colors.ink },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  infoItem: { width: '45%' },
  infoLabel: { fontFamily: typography.regular, fontSize: typography.xs, color: colors.inkMuted },
  infoValue: { fontFamily: typography.semibold, fontSize: typography.sm, color: colors.ink, marginTop: 2 },
  docsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
});

// ─── Main profile screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = useCallback(async () => {
    try {
      await driverApi.goOffline().catch(() => {});
    } catch {}
    socketManager.disconnect();
    logout();
    router.replace('/(auth)/login');
  }, []);

  const TABS: { key: ProfileTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
    { key: 'earnings', label: 'Earnings', icon: 'wallet-outline' },
    { key: 'history', label: 'History', icon: 'time-outline' },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>My Account</Text>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? colors.primary : colors.inkMuted}
              />
              <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={{ flex: 1 }}>
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'earnings' && <EarningsTab />}
          {activeTab === 'history' && <HistoryTab />}
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

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
  headerTitle: { fontFamily: typography.bold, fontSize: typography.lg, color: colors.ink },
  logoutBtn: { padding: spacing[1] },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[3],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.primary },
  tabLabel: { fontSize: typography.sm, color: colors.inkMuted, fontFamily: typography.medium },
  tabLabelActive: { color: colors.primary, fontFamily: typography.bold },
});
