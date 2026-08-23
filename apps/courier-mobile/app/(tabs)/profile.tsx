import React, { useState, useCallback, useMemo } from 'react';
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
import { CourierUI, useCourierTheme, useTheme, showToast, Dialog } from '@pharmacy/ui-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { socketManager } from '@/lib/socket';
import { useOrdersStore, type DeliveryHistoryItem } from '@/stores/orders.store';
import { useNotificationStore, type AppNotification } from '@/stores/notification.store';
import { useAppLanguage } from '../_layout';

type ProfileTab = 'profile' | 'earnings' | 'history' | 'notifications' | 'settings';

type ProfileColors = {
  canvas: { screen: string; surface: string; surfaceMuted: string };
  brand: { primary: string; primaryDark: string; primaryLight: string };
  text: { primary: string; secondary: string; inverse: string; muted: string };
  status: { success: string; error: string; warning: string; info: string };
  border: { default: string };
};

function Stars({ rating, size = 14, colors }: { rating: number; size?: number, colors: ProfileColors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={colors.brand.primary}
        />
      ))}
    </View>
  );
}

function ProfileTab() {
  const { colors } = useCourierTheme();
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
      ? colors.status.success
      : driver?.status === 'APPROVED'
        ? colors.status.info
        : driver?.status === 'PENDING_APPROVAL'
          ? colors.status.warning
          : driver?.status === 'SUSPENDED'
            ? colors.status.error
            : colors.text.muted;

  return (
    <ScrollView
      contentContainerStyle={[pt.scroll, { backgroundColor: colors.canvas.screen }]}
      showsVerticalScrollIndicator={false}
    >
      {driver?.status === 'PENDING_APPROVAL' && (
        <View style={[pt.pendingBanner, { backgroundColor: colors.status.warning + '20' }]}>
          <Ionicons name="time-outline" size={16} color={colors.status.warning} />
          <CourierUI.Typography scale="bodySm" style={{ color: colors.brand.primary }}>Account pending approval</CourierUI.Typography>
        </View>
      )}

      <View style={pt.avatarSection}>
        <View style={[pt.avatar, { backgroundColor: colors.brand.primaryDark }]}>
          <CourierUI.Typography scale="sectionHead" color="inverse">{initials}</CourierUI.Typography>
        </View>
        <CourierUI.Typography scale="sectionHead">{user?.fullName ?? '—'}</CourierUI.Typography>
        <CourierUI.Typography scale="bodySm" color="secondary">
          {user?.phone ?? user?.email ?? '—'}
        </CourierUI.Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {driver?.rating && (
            <>
              <Stars rating={parseFloat(driver.rating)} size={16} colors={colors} />
              <CourierUI.Typography scale="bodySm" style={{ color: colors.brand.primary }}>
                {parseFloat(driver.rating).toFixed(1)}
              </CourierUI.Typography>
            </>
          )}
        </View>
        <View style={[pt.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
          <View style={[pt.statusDot, { backgroundColor: statusColor }]} />
          <CourierUI.Typography scale="badge" style={{ color: colors.brand.primary }}>{driver?.status ?? 'UNKNOWN'}</CourierUI.Typography>
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
            <DocBadge label="License" uploaded={!!driver.licensePhotoUrl} colors={colors} />
            <DocBadge label="National ID" uploaded={!!driver.idPhotoUrl} colors={colors} />
            <DocBadge label="Vehicle" uploaded={!!driver.vehiclePhotoUrl} colors={colors} />
            <DocBadge label="Insurance" uploaded={!!driver.insurancePhotoUrl} colors={colors} />
          </View>
        </CourierUI.Card>
      )}
    </ScrollView>
  );
}

function DocBadge({ label, uploaded, colors }: { label: string; uploaded: boolean, colors: ProfileColors }) {
  return (
    <View style={db.row}>
      <Ionicons
        name={uploaded ? 'checkmark-circle' : 'close-circle-outline'}
        size={14}
        color={uploaded ? colors.status.success : colors.status.error}
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
  const { colors } = useCourierTheme();
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
    color = colors.brand.primary,
  }: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    color?: string;
  }) => (
    <CourierUI.Card style={et.card}>
      <View style={[et.iconBox, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <CourierUI.Typography scale="priceMd" style={{ color: colors.brand.primary }}>{value}</CourierUI.Typography>
      <CourierUI.Typography scale="caption" color="secondary">{label}</CourierUI.Typography>
      {sub && <CourierUI.Typography scale="badge" style={{ color: colors.brand.primary }}>{sub}</CourierUI.Typography>}
    </CourierUI.Card>
  );

  return (
    <ScrollView
      contentContainerStyle={[et.scroll, { backgroundColor: colors.canvas.screen }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.brand.primary} />
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
  const { colors } = useCourierTheme();
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
    getNextPageParam: (lastPage: { page: number; totalPages: number; deliveries: DeliveryHistoryItem[] }) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const allDeliveries = data?.pages.flatMap((p: { page: number; totalPages: number; deliveries: DeliveryHistoryItem[] }) => p.deliveries) ?? [];

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
      <View style={[ht.empty, { backgroundColor: colors.canvas.screen }]}>
        <Ionicons name="cube-outline" size={48} color={colors.text.muted} />
        <CourierUI.Typography scale="body" color="secondary" align="center">
          No delivery history yet
        </CourierUI.Typography>
      </View>
    );
  }

  return (
    <FlatList
      data={allDeliveries}
      keyExtractor={(item: DeliveryHistoryItem) => item.id}
      contentContainerStyle={[ht.list, { backgroundColor: colors.canvas.screen }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isFetchingNextPage}
          onRefresh={refetch}
          tintColor={colors.brand.primary}
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
              <CourierUI.Typography scale="priceSm" style={{ color: colors.brand.primary }}>
                {parseFloat(item.earnings).toFixed(0)} EGP
              </CourierUI.Typography>
              {item.customerRating ? (
                <Stars rating={item.customerRating} size={12} colors={colors} />
              ) : (
                <CourierUI.Typography scale="badge" color="secondary">No rating</CourierUI.Typography>
              )}
            </View>
          </View>
          {item.actualDuration && (
            <View style={ht.durationRow}>
              <Ionicons name="time-outline" size={12} color={colors.text.muted} />
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

function NotificationsTab() {
  const { colors } = useCourierTheme();
  const { notifications, markRead, markAllRead, clearAll } = useNotificationStore();

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => b.receivedAt - a.receivedAt);
  }, [notifications]);

  const renderNotification = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      style={[nt.item, { backgroundColor: item.isRead ? colors.canvas.surfaceMuted : colors.brand.primaryLight, borderColor: colors.border.default }]}
      onPress={() => markRead(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Notification: ${item.title}`}
    >
      <View style={nt.itemHeader}>
        <View style={[nt.iconWrap, { backgroundColor: colors.brand.primaryLight }]}>
          <Ionicons name="notifications-outline" size={18} color={colors.brand.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <CourierUI.Typography scale="bodySm" style={{ fontWeight: '600' }}>{item.title}</CourierUI.Typography>
          <CourierUI.Typography scale="caption" color="secondary">
            {formatDistanceToNow(new Date(item.receivedAt), { addSuffix: true })}
          </CourierUI.Typography>
        </View>
        {!item.isRead && <View style={[nt.unreadDot, { backgroundColor: colors.brand.primary }]} />}
      </View>
      <CourierUI.Typography scale="bodySm" color="secondary" style={{ marginTop: 6 }}>{item.body}</CourierUI.Typography>
    </TouchableOpacity>
  );

  return (
    <View style={[nt.container, { backgroundColor: colors.canvas.screen }]}>
      {notifications.length > 0 && (
        <View style={nt.headerRow}>
          <CourierUI.Button label="Mark all read" onPress={markAllRead} variant="secondary" size="sm" />
          <CourierUI.Button label="Clear all" onPress={clearAll} variant="ghost" size="sm" />
        </View>
      )}
      <FlatList
        style={{ flex: 1 }}
        data={sortedNotifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={notifications.length === 0 ? nt.emptyList : nt.list}
        showsVerticalScrollIndicator={false}
        renderItem={renderNotification}
        ListEmptyComponent={
          <View style={nt.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.text.muted} />
            <CourierUI.Typography scale="body" color="secondary" align="center">
              No notifications yet
            </CourierUI.Typography>
          </View>
        }
      />
    </View>
  );
}

const nt = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 16 },
  list: { padding: 16, paddingBottom: 96 },
  emptyList: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  item: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 4,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});

function SettingsTab() {
  const { colors, isDark } = useCourierTheme();
  const { toggleTheme } = useTheme();
  const { language, setLanguage, isRTL } = useAppLanguage();
  const router = useRouter();
  const [logoutDialog, setLogoutDialog] = useState(false);

  const handleLogout = useCallback(async () => {
    setLogoutDialog(false);
    try {
      await driverApi.goOffline().catch(() => {});
    } catch {}
    socketManager.disconnect();
    useAuthStore.getState().logout();
    useOrdersStore.getState().reset();
    router.replace('/(auth)/login');
  }, [router]);

  const toggleLanguage = useCallback(async () => {
    const next = language === 'en' ? 'ar' : 'en';
    await setLanguage(next);
    showToast(next === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English', 'success');
  }, [language, setLanguage]);

  const SettingRow = ({ icon, label, value, onPress, danger }: { icon: React.ComponentProps<typeof Ionicons>['name'], label: string, value?: string, onPress?: () => void, danger?: boolean }) => (
    <TouchableOpacity
      style={[st.row, { borderBottomColor: colors.border.default }]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "none"}
      accessibilityLabel={label}
    >
      <View style={st.rowLeft}>
        <View style={[st.iconBox, { backgroundColor: danger ? colors.status.error + '15' : colors.brand.primaryLight }]}>
          <Ionicons name={icon} size={18} color={danger ? colors.status.error : colors.brand.primary} />
        </View>
        <CourierUI.Typography scale="bodySm">{label}</CourierUI.Typography>
      </View>
      <View style={st.rowRight}>
        {value && <CourierUI.Typography scale="badge" color="secondary">{value}</CourierUI.Typography>}
        {onPress && <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[st.container, { backgroundColor: colors.canvas.screen }]}
      contentContainerStyle={st.scroll}
      showsVerticalScrollIndicator={false}
    >
      <CourierUI.Typography scale="sectionHead" style={{ marginBottom: 16 }}>Appearance</CourierUI.Typography>
      <CourierUI.Card style={{ padding: 0, overflow: 'hidden' }}>
        <SettingRow
          icon="moon-outline"
          label="Dark Mode"
          value={isDark ? 'On' : 'Off'}
          onPress={toggleTheme}
        />
        <SettingRow
          icon="language-outline"
          label={isRTL ? 'اللغة' : 'Language'}
          value={isRTL ? 'English' : 'العربية'}
          onPress={toggleLanguage}
        />
      </CourierUI.Card>

      <CourierUI.Typography scale="sectionHead" style={{ marginTop: 24, marginBottom: 16 }}>Support</CourierUI.Typography>
      <CourierUI.Card style={{ padding: 0, overflow: 'hidden' }}>
        <SettingRow
          icon="help-circle-outline"
          label="Help Center"
          onPress={() => showToast('Help center coming soon', 'info')}
        />
        <SettingRow
          icon="chatbubbles-outline"
          label="Contact Support"
          onPress={() => showToast('Support chat coming soon', 'info')}
        />
        <SettingRow
          icon="information-circle-outline"
          label="About"
          value="v1.0.0"
          onPress={() => showToast('United Pharmacy Driver v1.0.0', 'info')}
        />
      </CourierUI.Card>

      <CourierUI.Typography scale="sectionHead" style={{ marginTop: 24, marginBottom: 16 }}>Account</CourierUI.Typography>
      <CourierUI.Card style={{ padding: 0, overflow: 'hidden' }}>
        <SettingRow
          icon="log-out-outline"
          label="Sign Out"
          onPress={() => setLogoutDialog(true)}
          danger
        />
      </CourierUI.Card>

      <Dialog
        visible={logoutDialog}
        onCancel={() => setLogoutDialog(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out? You will need to log in again to accept deliveries."
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        destructive
      />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useCourierTheme();
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const clearActive = useOrdersStore((s) => s.clearActive);

  const handleLogout = useCallback(async () => {
    try {
      await driverApi.goOffline().catch(() => {});
    } catch {}
    socketManager.disconnect();
    clearActive();
    useAuthStore.getState().logout();
    router.replace('/(auth)/login');
  }, [router, clearActive]);

  const TABS: { key: ProfileTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'profile', label: 'Profile', icon: 'person-outline' },
    { key: 'earnings', label: 'Earnings', icon: 'wallet-outline' },
    { key: 'history', label: 'History', icon: 'time-outline' },
    { key: 'notifications', label: 'Alerts', icon: 'notifications-outline' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView style={[s.safe, { backgroundColor: colors.canvas.screen }]} edges={['top']}>
        <View style={[s.header, { borderBottomColor: colors.border.default }]}>
          <CourierUI.Typography scale="sectionHead">My Account</CourierUI.Typography>
          <TouchableOpacity
            onPress={handleLogout}
            style={s.logoutBtn}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Ionicons name="log-out-outline" size={22} color={colors.status.error} />
          </TouchableOpacity>
        </View>

        <View style={[s.tabBar, { borderBottomColor: colors.border.default }]}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabItem, isActive && { borderBottomColor: colors.brand.primary }]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
              >
                 <Ionicons
                   name={tab.icon}
                  size={16}
                  color={isActive ? colors.brand.primary : colors.text.muted}
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
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  logoutBtn: { padding: 12, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
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
});
