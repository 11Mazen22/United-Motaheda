import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { driverApi } from '@/lib/api';
import { useNotificationStore } from '@/stores/notification.store';
import { showToast } from '@pharmacy/ui-native';

// Configure how notifications appear while app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications({ userId }: { userId?: string }) {
  const router = useRouter();
  const setToken = useNotificationStore((s) => s.setToken);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    // Register for push notifications
    const register = async () => {
      if (!Device.isDevice) {
        console.log('[Push] Push notifications only work on physical devices');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[Push] Permission not granted');
        return;
      }

      // Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'United Pharmacy Driver',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0E7E74',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('orders', {
          name: 'New Orders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#0E7E74',
          sound: 'default',
        });
      }

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;

        if (!mounted) return;

        setToken(token);

        await driverApi.registerPushToken(
          token,
          Platform.OS === 'ios' ? 'ios' : 'android',
        );
      } catch (err) {
        console.warn('[Push] Token registration failed:', err);
      }
    };

    register();

    // Handle foreground notifications
    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      addNotification({
        id: notification.request.identifier,
        title: title ?? '',
        body: body ?? '',
        data: data as Record<string, unknown>,
      });
      // Show in-app toast for foreground notifications
      if (title) showToast(title + (body ? `: ${body}` : ''), 'info');
    });

    // Handle notification taps (background/killed)
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;

      if (data?.screen) {
        router.push(data.screen as string);
      } else if (data?.orderId) {
        router.push('/(tabs)/delivery');
      }
    });

    return () => {
      mounted = false;
      foregroundSub.remove();
      tapSub.remove();
    };
  }, [userId, addNotification, router, setToken]);
}
