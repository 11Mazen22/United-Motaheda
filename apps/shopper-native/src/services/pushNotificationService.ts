/**
 * Push Notification Service
 * 
 * Manages push notification registration, handling, and deep linking.
 * 
 * Features:
 * - Device token registration with backend
 * - Token sync on app startup
 * - Deactivate tokens on logout
 * - Handle incoming notifications
 * - Deep linking navigation
 * - Badge count management
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useNotificationsStore } from '@/stores/notificationsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@push_token';
const DEVICE_ID_KEY = '@device_id';

export interface PushNotificationData {
  type: string;
  orderId?: string;
  notificationId?: string;
  [key: string]: any;
}

class PushNotificationService {
  private deviceToken: string | null = null;
  private isRegistered: boolean = false;

  /**
   * Initialize push notification service
   * Call this in app _layout.tsx on mount
   */
  async initialize(): Promise<void> {
    try {
      // Set up notification handlers
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Handle notification responses (when user taps notification)
      Notifications.addNotificationResponseReceivedListener(
        this.handleNotificationResponse.bind(this)
      );

      // Handle notifications received while app is in foreground
      Notifications.addNotificationReceivedListener(
        this.handleNotificationReceived.bind(this)
      );

      // Register for push notifications
      await this.registerForPushNotifications();

      // Sync token with backend
      await this.syncTokenWithBackend();

      // Get initial unread count
      await this.updateBadgeCount();

      console.log('[PushNotificationService] Initialized successfully');
    } catch (error) {
      console.error('[PushNotificationService] Initialization failed:', error);
    }
  }

  /**
   * Register for push notifications and get token
   */
  private async registerForPushNotifications(): Promise<void> {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[PushNotificationService] Permission not granted');
        return;
      }

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId) {
        console.warn('[PushNotificationService] No project ID found');
        return;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.deviceToken = token.data;
      
      // Save token locally
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token.data);

      console.log('[PushNotificationService] Push token obtained:', token.data);

    } catch (error) {
      console.error('[PushNotificationService] Failed to register:', error);
    }
  }

  /**
   * Sync device token with backend
   */
  private async syncTokenWithBackend(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (!token) {
        console.warn('[PushNotificationService] No token to sync');
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[PushNotificationService] No user logged in');
        return;
      }

      // Get device ID or generate one
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }

      // Get app version
      const appVersion = Constants.expoConfig?.version || '1.0.0';

      // Call Supabase directly to register device
      const { data: userResponse } = await supabase.auth.getUser();
      if (!userResponse.user) return;

      // notification_tokens (not user_devices) is the canonical store for
      // Expo push tokens -- both delivery workers read from here. Goes
      // through the register_push_token RPC rather than a raw upsert: a
      // physical device re-registering under a different account needs to
      // reassign this row (not leave the previous account still attached
      // to it -- confirmed live: that's how 3 tokens ended up with rows
      // under two different accounts each), but a raw client upsert's
      // conflict path is an UPDATE under the hood, and the owner-scoped
      // RLS policy correctly blocks "user B updating user A's row" even
      // though this is really a legitimate reassignment. The RPC derives
      // the owner from auth.uid() itself instead of trusting a client-
      // supplied user_id, so it can safely do what a broadened RLS policy
      // couldn't without also letting any user hijack any other user's
      // token row.
      const { error } = await supabase.rpc('register_push_token', {
        p_expo_push_token: token,
        p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
        p_device_id: deviceId,
        p_app_version: appVersion,
      });

      if (error) {
        throw new Error(`Failed to sync token via Supabase: ${error.message}`);
      }

      this.isRegistered = true;
      console.log('[PushNotificationService] Token synced successfully');

    } catch (error) {
      console.error('[PushNotificationService] Failed to sync token:', error);
    }
  }

  

  /**
   * Deactivate device token on logout. Pass userId when the caller already
   * knows it (e.g. sign-out, after the session -- and so
   * supabase.auth.getUser() -- has already been cleared); otherwise it's
   * read from the current session.
   */
  async deactivateToken(userId?: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (!token) return;

      let targetUserId = userId;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        targetUserId = user.id;
      }

      // Soft-invalidate rather than delete, matching how this table already
      // treats a dead Expo token (see the notification workers) -- a fresh
      // registration (sign-in, same or different account, same device)
      // clears invalidated_at again via the upsert above.
      await supabase.from('notification_tokens')
        .update({ invalidated_at: new Date().toISOString(), invalid_reason: 'signed_out' })
        .eq('user_id', targetUserId)
        .eq('expo_push_token', token);

      this.isRegistered = false;
      console.log('[PushNotificationService] Token deactivated');

    } catch (error) {
      console.error('[PushNotificationService] Failed to deactivate token:', error);
    }
  }

  /**
   * Handle notification response (user tapped notification)
   */
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { data } = response.notification.request.content;
    
    console.log('[PushNotificationService] Notification tapped:', data);

    if (!data) return;

    // Navigate based on notification type
    this.navigateToTarget(data as unknown as PushNotificationData);

    // Mark notification as read if notificationId is present
    if (data.notificationId) {
      useNotificationsStore.getState().markAsRead(data.notificationId as string);
    }

    // Update badge count
    this.updateBadgeCount();
  }

  /**
   * Handle notification received while app is in foreground
   */
  private handleNotificationReceived(notification: Notifications.Notification): void {
    console.log('[PushNotificationService] Notification received:', notification);

    // Refresh notification list
    useNotificationsStore.getState().fetchNotifications({ refresh: true });
    
    // Update badge count
    this.updateBadgeCount();
  }

  /**
   * Navigate to target screen based on notification type
   */
  private navigateToTarget(data: PushNotificationData): void {
    const { type, orderId } = data;

    console.log('[PushNotificationService] Navigating to:', type, orderId);

    switch (type) {
      case 'order.ready':
      case 'order.accepted':
      case 'order.out_for_delivery':
      case 'order.delivered':
      case 'order.cancelled':
        if (orderId) {
          router.push(`/(customer)/order-tracking/${orderId}` as import('expo-router').Href);
        } else {
          router.push('/(customer)/orders' as import('expo-router').Href);
        }
        break;

      case 'payment.success':
      case 'payment.failed':
        if (orderId) {
          router.push(`/(customer)/orders/${orderId}` as import('expo-router').Href);
        } else {
          router.push('/(customer)/orders' as import('expo-router').Href);
        }
        break;

      case 'system.announcement':
        router.push('/(customer)/announcements' as import('expo-router').Href);
        break;

      case 'promo.offer':
        if (data.link) {
          router.push(data.link as import('expo-router').Href);
        } else {
          router.push('/(customer)/offers' as import('expo-router').Href);
        }
        break;

      case 'driver.assigned':
      case 'driver.arrived':
        if (orderId) {
          router.push(`/(customer)/order-tracking/${orderId}` as import('expo-router').Href);
        } else {
          router.push('/(customer)' as import('expo-router').Href);
        }
        break;

      default:
        // Default to notification center
        router.push('/(customer)/notifications' as import('expo-router').Href);
    }
  }

  /**
   * Update app badge count
   */
  async updateBadgeCount(): Promise<void> {
    try {
      const unreadCount = await useNotificationsStore.getState().getUnreadCount();
      await Notifications.setBadgeCountAsync(unreadCount);
    } catch (error) {
      console.error('[PushNotificationService] Failed to update badge count:', error);
    }
  }

  /**
   * Send local notification (for testing or internal use)
   */
  async sendLocalNotification(title: string, body: string, data?: Record<string, any>): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('[PushNotificationService] Failed to send local notification:', error);
    }
  }

  /**
   * Schedule a notification for a future time
   */
  async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, any>
  ): Promise<string | undefined> {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger,
      });

      console.log('[PushNotificationService] Scheduled notification:', id);
      return id;

    } catch (error) {
      console.error('[PushNotificationService] Failed to schedule notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllScheduledNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[PushNotificationService] All scheduled notifications cancelled');
    } catch (error) {
      console.error('[PushNotificationService] Failed to cancel scheduled notifications:', error);
    }
  }

  /**
   * Get current device token
   */
  getDeviceToken(): string | null {
    return this.deviceToken;
  }

  /**
   * Check if user is registered for push notifications
   */
  isPushRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * Reset push notification state (for testing)
   */
  reset(): void {
    this.deviceToken = null;
    this.isRegistered = false;
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();