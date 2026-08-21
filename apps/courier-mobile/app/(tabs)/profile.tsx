import React, { useState, useCallback } from 'react';
import {
  View,
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
import { CourierUI, kit, showToast } from '@pharmacy/ui-native';
import { colors as courierColors } from '@pharmacy/ui-native/courier-tokens';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { socketManager } from '@/lib/socket';
import { useOrdersStore, type DeliveryHistoryItem } from '@/stores/orders.store';

type ProfileTab = 'profile' | 'earnings' | 'history';

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={kit.darkColor.accent}
        />
      ))}
    </View>
  );
}

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
    return (
      <View style={{ gap: 16, padding: 24 }}>
        <CourierUI.Skeleton height={80} />
        <CourierUI.Skeleton height={120} />
      </View>
    );
  }

  const initials = user?.fullName
    ? user.fullName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'D';

  const statusColor =
    driver?.status === 'ACTIVE'
      ? courierColors.online
      : driver?.status === 'APPROVED'
        ? courierColors.statusAccepted
        : driver?.status === 'PENDING_APPROVAL'
          ? courierColors.statusArrived
          : driver?.status === 'SUSPENDED'
            ? courierColors.statusCancelled
            : kit.darkColor.inkFaint;

  return (
    <ScrollView
      contentContainerStyle={pt.scroll}
      showsVerticalScrollIndicator={false}
    >
      {driver?.status === 'PENDING_APPROVAL' && (
        <View style={[pt.pendingBanner, { backgroundColor: courierColors.statusArrived + '25' }]}>
          <Ionicons name="time-outline" size={16} color={courierColors.statusArrived} />
          <CourierUI.Typography scale="bodySm" style={{ color: kit.darkColor.accent }}>Account pending approval</CourierUI.Typography>
        </View>
      )}

      <View style={pt.avatarSection}>
        <View style={pt.avatar}>
          <CourierUI.Typography scale="sectionHead" color="inverse">{initials}</CourierUI.Typography>
        </View>
        <CourierUI.Typography scale="sectionHead">{user?.fullName ?? '—'}</CourierUI.Typography>
        <CourierUI.Typography scale="bodySm" color="secondary">
          {user?.phone ?? user?.email ?? '—'}
        </CourierUI.Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {driver?.rating && (
            <>
              <Stars rating={parseFloat(driver.rating)} size={16} />
              <CourierUI.Typography scale="bodySm" style={{ color: kit.darkColor.accent }}>
                {parseFloat(driver.rating).toFixed(1)}
              </CourierUI.Typography>
            </>
          )}
        </View>
        <View style={[pt.statusPill, { backgroundColor: statusColor + '25', borderColor: statusColor + '50' }]}>
          <View style={[pt.statusDot, { backgroundColor: statusColor }]} />
          <CourierUI.Typography scale="badge" style={{ color: kit.darkColor.accent }}>{driver?.status ?? 'UNKNOWN'}</CourierUI.Typography>
        </View>
      </View>

      {driver && (
        <CourierUI.Card style={pt.card}>
          <CourierUI.Typography scale="sectionHead" style={{ marginBottom: 16 }}>Vehicle Information</CourierUI.Typography>
          <View style={pt.infoGrid}>
            {[
              { label: 'Type', value: driver.vehicleType },
              { label: 'Plate', value: driver.vehiclePlate ?? '—' },
              { label: 'Model', value: driver.vehicleModel ?? '—' },
              { label: 'Color', value: driver.vehicleColor ?? '—' },
            ].map(({ label, value }) => (
              <View key={label} style={pt.infoItem}>
                <CourierUI.Typography scale="caption" color="secondary">{label}</CourierUI.Typography>
                <CourierUI.Typography scale="bodySm">{value}</CourierUI.Typography>
              </View>
            ))}
          </View>
        </CourierUI.Card>
      )}

      {driver && (
        <CourierUI.Card style={pt.card}>
          <CourierUI.Typography scale="sectionHead" style={{ marginBottom: 16 }}>Documents</CourierUI.Typography>
          <View style={pt.docsGrid}>
            <DocBadge label="License" uploaded={!!driver.licensePhotoUrl} />
            <DocBadge label="National ID" uploaded={!!driver.idPhotoUrl} />
            <DocBadge label="Vehicle" uploaded={!!driver.vehiclePhotoUrl} />
            <DocBadge label="Insurance" uploaded={!!driver.insurancePhotoUrl} />
          </View>
        </CourierUI.Card>
      )}
    </ScrollView>
  );
}

function DocBadge({ label, uploaded }: { label: string; uploaded: boolean }) {
  return (
    <View style={db.row}>
      <Ionicons
        name={uploaded ? 'checkmark-circle' : 'close-circle-outline'}
        size={14}
        color={uploaded ? courierColors.online : courierColors.statusCancelled}
      />
      <CourierUI.Typography
        scale="caption"
        color={uploaded ? 'success' : 'danger'}
      >
        {label}
      </CourierUI.Typography>
    </View>
  );
}

const db = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

const pt = StyleSheet.create({
  scroll: { padding: 16, gap: 16, paddingBottom: 96 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  avatarSection: { alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: kit.darkColor.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  card: { gap: 0 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
  infoItem: { width: '45%', gap: 2 },
  docsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
});

function EarningsTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver', 'statistics'],
    queryFn: driverApi.getStatistics,
    staleTime: 60_000,
  });

  const stats = data ?? {
    today: { earnings: '0', deliveries: 0 },
    thisWeek: { earnings: '0', deliveries: 0 },
    thisMonth: { earnings: '0', deliveries: 0 },
  };

  const StatCard = ({
    label,
    value,
    sub,
    icon,
    color = kit.darkColor.accent,
  }: {
    label: string;
    value: string;
    sub?: string;
    icon: string;
    color?: string;
  }) => (
    <CourierUI.Card style={et.card}>
      <View style={[et.iconBox, { backgroundColor: color + '25' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <CourierUI.Typography scale="priceMd" style={{ color: kit.darkColor.accent }}>{value}</CourierUI.Typography>
      <CourierUI.Typography scale="caption" color="secondary">{label}</CourierUI.Typography>
      {sub && <CourierUI.Typography scale="badge" style={{ color: kit.darkColor.accent }}>{sub}</CourierUI.Typography>}
    </CourierUI.Card>
  );

  return (
    <ScrollView
      contentContainerStyle={et.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={kit.darkColor.accent} />
      }
    >
      <CourierUI.Typography scale="sectionHead" style={{ marginBottom: 12 }}>Earnings Overview</CourierUI.Typography>
      <View style={et.row}>
        <StatCard
          label="Today"
          value={`${parseFloat(stats.today.earnings).toFixed(0)} EGP`}
          sub={`${stats.today.deliveries} deliveries`}
          icon="today-outline"
        />
        <StatCard
          label="This Week"
          value={`${parseFloat(stats.thisWeek.earnings).toFixed(0)} EGP`}
          sub={`${stats.thisWeek.deliveries} deliveries`}
          icon="calendar-outline"
        />
      </View>
      <View style={et.row}>
        <StatCard
          label="This Month"
          value={`${parseFloat(stats.thisMonth.earnings).toFixed(0)} EGP`}
          sub={`${stats.thisMonth.deliveries} deliveries`}
          icon="bar-chart-outline"
        />
        <StatCard
          label="Rating"
          value={parseFloat(data?.rating ?? '0').toFixed(1)}
          sub="out of 5"
          icon="star-outline"
        />
      </View>

      <CourierUI.Typography scale="sectionHead" style={{ marginTop: 8, marginBottom: 12 }}>Performance</CourierUI.Typography>
      <View style={et.row}>
        <StatCard
          label="Total Deliveries"
          value={String(data?.totalDeliveries ?? 0)}
          icon="cube-outline"
        />
        <StatCard
          label="Completion Rate"
          value={`${parseFloat(data?.completionRate ?? '0').toFixed(0)}%`}
          icon="checkmark-circle-outline"
        />
      </View>
    </ScrollView>
  );
}

const et = StyleSheet.create({
  scroll: { padding: 16, gap: 20, paddingBottom: 96 },
  row: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, padding: 16, alignItems: 'center', gap: 6 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});

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
    queryFn: ({ pageParam = 1 }) =>
      driverApi.getDeliveryHistory(pageParam as number, 20),
    getNextPageParam: (lastPage: any) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const allDeliveries = data?.pages.flatMap((p: any) => p.deliveries) ?? [];

  if (isLoading) {
    return (
      <View style={{ gap: 16, padding: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <CourierUI.Skeleton key={i} height={100} />
        ))}
      </View>
    );
  }

  if (allDeliveries.length === 0) {
    return (
      <View style={ht.empty}>
        <Ionicons name="cube-outline" size={48} color={kit.darkColor.inkFaint} />
        <CourierUI.Typography scale="body" color="secondary" align="center">
          No delivery history yet
        </CourierUI.Typography>
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
        <RefreshControl
          refreshing={isFetching && !isFetchingNextPage}
          onRefresh={refetch}
          tintColor={kit.darkColor.accent}
        />
      }
      onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
      onEndReachedThreshold={0.3}
      renderItem={({ item }: { item: DeliveryHistoryItem }) => (
        <CourierUI.Card style={ht.item}>
          <View style={ht.itemRow}>
            <View style={ht.itemLeft}>
              <CourierUI.Typography scale="bodySm" numberOfLines={1}>{item.customerAddress}</CourierUI.Typography>
              <CourierUI.Typography scale="caption" color="secondary">
                {item.deliveredAt
                  ? formatDistanceToNow(new Date(item.deliveredAt), { addSuffix: true })
                  : '—'}
              </CourierUI.Typography>
            </View>
            <View style={ht.itemRight}>
              <CourierUI.Typography scale="priceSm" style={{ color: kit.darkColor.accent }}>
                {parseFloat(item.earnings).toFixed(0)} EGP
              </CourierUI.Typography>
              {item.customerRating ? (
                <Stars rating={item.customerRating} size={12} />
              ) : (
                <CourierUI.Typography scale="badge" color="secondary">No rating</CourierUI.Typography>
              )}
            </View>
          </View>
          {item.actualDuration && (
            <View style={ht.durationRow}>
              <Ionicons name="time-outline" size={12} color={kit.darkColor.inkFaint} />
              <CourierUI.Typography scale="badge" color="secondary">{item.actualDuration} min</CourierUI.Typography>
              <CourierUI.Typography scale="badge" color="secondary">{item.itemCount} items</CourierUI.Typography>
            </View>
          )}
        </CourierUI.Card>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={ht.loadingMore}>
            <CourierUI.Typography scale="caption" color="secondary">Loading more…</CourierUI.Typography>
          </View>
        ) : null
      }
    />
  );
}

const ht = StyleSheet.create({
  list: { padding: 16, paddingBottom: 96 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  item: { gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  itemLeft: { flex: 1, marginRight: 12 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  loadingMore: { padding: 16, alignItems: 'center' },
});

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const logout = useAuthStore((s) => s.logout);
  const clearActive = useOrdersStore((s) => s.clearActive);

  const handleLogout = useCallback(async () => {
    try {
      await driverApi.goOffline().catch(() => {});
    } catch {}
    socketManager.disconnect();
    clearActive();
    logout();
    router.replace('/(auth)/login');
  }, []);

  const TABS: { key: ProfileTab; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
    { key: 'earnings', label: 'Earnings', icon: 'wallet-outline' },
    { key: 'history', label: 'History', icon: 'time-outline' },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <CourierUI.Typography scale="sectionHead">My Account</CourierUI.Typography>
          <TouchableOpacity
            onPress={handleLogout}
            style={s.logoutBtn}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="log-out-outline" size={22} color={courierColors.statusCancelled} />
          </TouchableOpacity>
        </View>

        <View style={s.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabItem, isActive && s.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? kit.darkColor.accent : kit.darkColor.inkFaint}
                />
                <CourierUI.Typography
                  scale="badge"
                  color={isActive ? 'brand' : 'secondary'}
                >
                  {tab.label}
                </CourierUI.Typography>
              </TouchableOpacity>
            );
          })}
        </View>

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
  safe: { flex: 1, backgroundColor: kit.darkColor.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: kit.darkColor.line,
  },
  logoutBtn: { padding: 8 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: kit.darkColor.line,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: kit.darkColor.accent },
});
