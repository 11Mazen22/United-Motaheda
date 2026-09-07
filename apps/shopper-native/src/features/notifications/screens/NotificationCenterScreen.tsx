/**
 * Notification Center Screen
 * 
 * The Inbox UI (🔔) displaying historical notifications fetched from the
 * notifications DB table.
 * 
 * Features:
 * - List of notifications with read/unread status
 * - Pull to refresh
 * - Infinite scroll (pagination)
 * - Mark as read on tap
 * - Deep linking to target screens
 * - Unread count badge
 * - Filter by type
 * - Delete notifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
  priority: 'high' | 'normal' | 'low';
}

export default function NotificationCenterScreen() {
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotificationsStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications({ unreadOnly: filter === 'unread' });
  }, [filter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications({ unreadOnly: filter === 'unread', refresh: true });
    setRefreshing(false);
  }, [filter]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading) {
      fetchNotifications({ unreadOnly: filter === 'unread' });
    }
  }, [isLoading, filter]);

  const handleNotificationPress = useCallback(async (item: NotificationItem) => {
    // Mark as read
    if (!item.read_at) {
      await markAsRead(item.id);
    }

    // Deep link to target screen based on type
    navigateToTarget(item);
  }, []);

  const navigateToTarget = (item: NotificationItem) => {
    const { type, data } = item;

    switch (type) {
      case 'order.ready':
      case 'order.accepted':
      case 'order.out_for_delivery':
      case 'order.delivered':
      case 'order.cancelled':
        if (data?.orderId) {
          router.push(`/(customer)/order-tracking/${data.orderId}` as import('expo-router').Href);
        }
        break;

      case 'payment.success':
      case 'payment.failed':
        if (data?.orderId) {
          router.push(`/(customer)/orders/${data.orderId}` as import('expo-router').Href);
        }
        break;

      case 'system.announcement':
        router.push('/(customer)/announcements' as import('expo-router').Href);
        break;

      case 'promo.offer':
        if (data?.link) {
          router.push(data.link as import('expo-router').Href);
        }
        break;

      default:
        // Default to home
        router.push('/(customer)' as import('expo-router').Href);
    }
  };

  const handleLongPress = useCallback((item: NotificationItem) => {
    Alert.alert(
      'حذف الإشعار',
      'هل تريد حذف هذا الإشعار؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => deleteNotification(item.id),
        },
      ],
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    Alert.alert(
      'تحديد الكل كمقروء',
      'هل تريد تحديد جميع الإشعارات كمقروءة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد',
          onPress: markAllAsRead,
        },
      ],
    );
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'حذف الكل',
      'هل تريد حذف جميع الإشعارات؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الكل',
          style: 'destructive',
          onPress: clearAllNotifications,
        },
      ],
    );
  }, []);

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const isRead = !!item.read_at;
    const isHighPriority = item.priority === 'high';

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !isRead && styles.unreadItem,
          isHighPriority && styles.highPriorityItem,
        ]}
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            {getNotificationIcon(item.type)}
          </View>

          {/* Content */}
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, !isRead && styles.unreadTitle]} numberOfLines={1}>
                {item.title}
              </Text>
              {!isRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.body} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.time}>
              {format(new Date(item.created_at), 'dd MMM yyyy, hh:mm a', { locale: ar })}
            </Text>
          </View>

          {/* Delete button */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteNotification(item.id)}
          >
            <Ionicons name="close-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
      <Text style={styles.emptySubtitle}>
        ستظهر الإشعارات هنا عند تحديث طلباتك
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>الإشعارات</Text>
        {unreadCount > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            الكل
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'unread' && styles.filterButtonActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
            غير مقروء
          </Text>
          {filter === 'unread' && unreadCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {notifications.length > 0 && (
          <>
            <TouchableOpacity style={styles.actionButton} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleClearAll}>
              <Ionicons name="trash-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {renderHeader()}

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          isLoading && notifications.length > 0 ? (
            <ActivityIndicator style={styles.loader} color="#8B5CF6" />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// Helper: Get notification icon based on type
function getNotificationIcon(type: string): React.ReactElement {
  const iconMap: Record<string, { name: string; color: string }> = {
    'order.ready': { name: 'bag-check-outline', color: '#10B981' },
    'order.accepted': { name: 'checkmark-circle-outline', color: '#3B82F6' },
    'order.out_for_delivery': { name: 'car-outline', color: '#8B5CF6' },
    'order.delivered': { name: 'gift-outline', color: '#10B981' },
    'order.cancelled': { name: 'close-circle-outline', color: '#EF4444' },
    'payment.success': { name: 'card-outline', color: '#10B981' },
    'payment.failed': { name: 'alert-circle-outline', color: '#EF4444' },
    'system.announcement': { name: 'megaphone-outline', color: '#F59E0B' },
    'promo.offer': { name: 'pricetag-outline', color: '#EC4899' },
    'driver.assigned': { name: 'person-outline', color: '#3B82F6' },
    'driver.arrived': { name: 'location-outline', color: '#8B5CF6' },
  };

  const icon = iconMap[type] || { name: 'notifications-outline', color: '#6B7280' };

  return (
    <View style={[styles.iconCircle, { backgroundColor: icon.color + '20' }]}>
      <Ionicons name={icon.name as any} size={24} color={icon.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  badgeContainer: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  filterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  actionButton: {
    padding: 6,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadItem: {
    backgroundColor: '#F5F3FF',
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  highPriorityItem: {
    borderRightWidth: 3,
    borderRightColor: '#EF4444',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#1F2937',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
    marginLeft: 8,
  },
  body: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  loader: {
    paddingVertical: 16,
  },
});