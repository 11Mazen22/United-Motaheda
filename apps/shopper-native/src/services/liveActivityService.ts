/**
 * Live Activity Service
 * 
 * Bridges JavaScript with native iOS Live Activities and Android Foreground Services.
 * Handles starting, updating, and ending live activities for order tracking.
 */

import { Platform } from 'react-native';
import { useOrderStore, type CanonicalOrderStatus } from '@/stores/orders';

// iOS Live Activities
interface LiveActivityOptions {
  orderId: string;
  driverName: string;
  driverLocation: string;
  /** Minutes, when a real estimate is available. This app has no stored/
   *  computed ETA source today — omit rather than fabricate one. */
  estimatedArrival?: number;
  status: CanonicalOrderStatus;
  progress: number; // 0.0 - 1.0
  originAddress: string;
  destinationAddress: string;
  driverPhoto?: string;
}

interface LiveActivityState {
  activityId?: string;
  isActive: boolean;
}

class LiveActivityService {
  private state: LiveActivityState = {
    isActive: false,
  };

  /**
   * Start a live activity (iOS) or foreground service (Android)
   */
  async startLiveActivity(options: LiveActivityOptions): Promise<void> {
    if (Platform.OS === 'ios') {
      await this.startIOSLiveActivity(options);
    } else if (Platform.OS === 'android') {
      await this.startAndroidForegroundService(options);
    } else {
      console.warn('[LiveActivityService] Platform not supported');
    }
  }

  /**
   * Update live activity with new data
   */
  async updateLiveActivity(options: Partial<LiveActivityOptions>): Promise<void> {
    if (!this.state.isActive) {
      console.warn('[LiveActivityService] No active live activity to update');
      return;
    }

    if (Platform.OS === 'ios') {
      await this.updateIOSLiveActivity(options);
    } else if (Platform.OS === 'android') {
      await this.updateAndroidForegroundService(options);
    }
  }

  /**
   * End live activity
   */
  async endLiveActivity(): Promise<void> {
    if (!this.state.isActive) {
      console.warn('[LiveActivityService] No active live activity to end');
      return;
    }

    if (Platform.OS === 'ios') {
      await this.endIOSLiveActivity();
    } else if (Platform.OS === 'android') {
      await this.endAndroidForegroundService();
    }

    this.state.isActive = false;
    this.state.activityId = undefined;
  }

  /**
   * Check if a live activity is currently active
   */
  isActive(): boolean {
    return this.state.isActive;
  }

  // ============================================================
  // iOS Live Activities (via Native Module)
  // ============================================================

  private async startIOSLiveActivity(options: LiveActivityOptions): Promise<void> {
    try {
      // Check if native module is available
      const { LiveActivities } = require('react-native-live-activities');
      
      const result = await LiveActivities.startActivity({
        orderId: options.orderId,
        driverName: options.driverName,
        driverLocation: options.driverLocation,
        estimatedArrival: options.estimatedArrival,
        status: options.status,
        progress: options.progress,
        originAddress: options.originAddress,
        destinationAddress: options.destinationAddress,
        driverPhoto: options.driverPhoto,
      });

      this.state.isActive = true;
      this.state.activityId = result.activityId;
      
      console.log(`[LiveActivityService] iOS Live Activity started: ${result.activityId}`);
    } catch (error) {
      console.error('[LiveActivityService] Failed to start iOS Live Activity:', error);
    }
  }

  private async updateIOSLiveActivity(options: Partial<LiveActivityOptions>): Promise<void> {
    try {
      const { LiveActivities } = require('react-native-live-activities');
      
      await LiveActivities.updateActivity(this.state.activityId, {
        driverName: options.driverName,
        driverLocation: options.driverLocation,
        estimatedArrival: options.estimatedArrival,
        status: options.status,
        progress: options.progress,
        driverPhoto: options.driverPhoto,
      });

      console.log(`[LiveActivityService] iOS Live Activity updated: ${this.state.activityId}`);
    } catch (error) {
      console.error('[LiveActivityService] Failed to update iOS Live Activity:', error);
    }
  }

  private async endIOSLiveActivity(): Promise<void> {
    try {
      const { LiveActivities } = require('react-native-live-activities');
      
      await LiveActivities.endActivity(this.state.activityId);
      
      console.log(`[LiveActivityService] iOS Live Activity ended: ${this.state.activityId}`);
    } catch (error) {
      console.error('[LiveActivityService] Failed to end iOS Live Activity:', error);
    }
  }

  // ============================================================
  // Android Foreground Service (via Notifee)
  // ============================================================

  private async startAndroidForegroundService(options: LiveActivityOptions): Promise<void> {
    try {
      const notifee = require('@notifee/react-native');
      
      // Create a notification channel
      const channelId = await notifee.createChannel({
        id: 'order_tracking',
        name: 'Order Tracking',
        importance: notifee.Importance.HIGH,
        vibration: true,
        sound: 'default',
      });

      // Start foreground service with notification
      await notifee.displayNotification({
        title: `🚚 ${options.driverName} في طريقه إليك`,
        body: `الوقت المتوقع: ${options.estimatedArrival} دقيقة • ${options.status}`,
        data: {
          orderId: options.orderId,
          type: 'order_tracking',
        },
        android: {
          channelId,
          asForegroundService: true,
          color: '#8B5CF6',
          pressAction: {
            id: 'default',
          },
          ongoing: true,
          // Progress indicator
          progress: {
            max: 1,
            current: options.progress,
            indeterminate: false,
          },
          actions: [
            {
              title: 'تتبع الطلب',
              pressAction: {
                id: 'open_order',
              },
            },
            {
              title: 'اتصال',
              pressAction: {
                id: 'call_driver',
              },
            },
          ],
        },
        ios: {
          // iOS fallback (should not be used)
        },
      });

      this.state.isActive = true;
      console.log('[LiveActivityService] Android Foreground Service started');
    } catch (error) {
      console.error('[LiveActivityService] Failed to start Android Foreground Service:', error);
    }
  }

  private async updateAndroidForegroundService(options: Partial<LiveActivityOptions>): Promise<void> {
    try {
      const notifee = require('@notifee/react-native');
      
      // Update the notification with new data
      await notifee.displayNotification({
        title: `🚚 ${options.driverName || 'السائق'} في طريقه إليك`,
        body: `الوقت المتوقع: ${options.estimatedArrival} دقيقة • ${options.status}`,
        data: {
          type: 'order_tracking',
        },
        android: {
          channelId: 'order_tracking',
          asForegroundService: true,
          color: '#8B5CF6',
          ongoing: true,
          progress: {
            max: 1,
            current: options.progress || 0,
            indeterminate: false,
          },
        },
      });

      console.log('[LiveActivityService] Android Foreground Service updated');
    } catch (error) {
      console.error('[LiveActivityService] Failed to update Android Foreground Service:', error);
    }
  }

  private async endAndroidForegroundService(): Promise<void> {
    try {
      const notifee = require('@notifee/react-native');
      
      // Stop foreground service
      await notifee.stopForegroundService();
      
      console.log('[LiveActivityService] Android Foreground Service ended');
    } catch (error) {
      console.error('[LiveActivityService] Failed to end Android Foreground Service:', error);
    }
  }

  /**
   * Subscribe to order tracking and auto-update live activity
   */
  subscribeToOrderTracking(): () => void {
    // Subscribe to store updates
    const unsubscribe = useOrderStore.subscribe((state) => {
      const { activeOrder, driverLocation } = state;
      
      if (!activeOrder) {
        // No active order, end live activity
        this.endLiveActivity();
        return;
      }

      // Check if live activity should be active — anything not yet terminal.
      const shouldBeActive = !['delivered', 'cancelled', 'archived'].includes(activeOrder.status);

      if (shouldBeActive && !this.isActive()) {
        // Start live activity
        this.startLiveActivity({
          orderId: activeOrder.id,
          driverName: activeOrder.driverName || 'السائق',
          driverLocation: driverLocation ? 'في الطريق' : 'جاري التحديث...',
          status: activeOrder.status,
          progress: 0.5, // You can calculate this based on route progress
          originAddress: 'نقطة البداية',
          destinationAddress: 'نقطة الوصول',
          driverPhoto: activeOrder.driverPhoto,
        });
      } else if (shouldBeActive && this.isActive()) {
        // Update live activity
        this.updateLiveActivity({
          driverName: activeOrder.driverName || 'السائق',
          driverLocation: driverLocation ? 'في الطريق' : 'جاري التحديث...',
          status: activeOrder.status,
          progress: 0.5,
          driverPhoto: activeOrder.driverPhoto,
        });
      } else if (!shouldBeActive && this.isActive()) {
        // End live activity
        this.endLiveActivity();
      }
    });

    return unsubscribe;
  }

  /**
   * Clean up and end any active live activity
   */
  cleanup(): void {
    if (this.state.isActive) {
      this.endLiveActivity();
    }
  }
}

// Export singleton instance
export const liveActivityService = new LiveActivityService();

// For iOS, we need to register the native module
// This is a placeholder - the actual native module will be linked
export const registerLiveActivities = () => {
  if (Platform.OS === 'ios') {
    console.log('[LiveActivityService] iOS Live Activities ready');
  }
};