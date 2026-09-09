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

      const { error } = await supabase.from('user_devices').upsert({
        user_id: userResponse.user.id,
        device_id: deviceId,
        push_token: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        app_version: appVersion,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' });

      if (error) {
        throw new Error(`Failed to sync token via Supabase: ${error.message}`);
      }`);
      }

      this.isRegistered = true;
      console.log('[PushNotificationService] Token synced successfully');

    } catch (error) {
      console.error('[PushNotificationService] Failed to sync token:', error);
    }
  }

  /**
   * Get Android device model
   */
  private async getAndroidModel(): Promise<string> {
    try {
      const DeviceInfo = await import('react-native-device-info');
      const manufacturer = await DeviceInfo.getManufacturer();
      const model = DeviceInfo.getModel();
      return `${manufacturer} ${model}`;
    } catch {
      return 'Android';
    }
  }

  /**
   * Deactivate device token on logout
   */
  async deactivateToken(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (!token) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_devices')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('push_token', token);

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