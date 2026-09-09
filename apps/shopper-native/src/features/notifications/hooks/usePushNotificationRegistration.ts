/**
 * Push notification registration hook.
 *
 * Responsibilities:
 *  - Request iOS/Android permissions
 *  - Fetch the Expo push token (for legacy devices)
 *  - Register native FCM token on iOS devices
 *  - Register token against `notification_tokens` (Expo) or `user_devices` (FCM)
 *  - Configure the Android notification channel
 *  - Set the foreground handler so notifications surface while app is open
 *  - Handle notification taps (foreground or background)
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { registerPushToken, registerDevice } from "../api";
import { theme } from "@pharmacy/design-tokens";

// Foreground handler: show alert + play sound + show in tray even when active.
// Guard: expo-notifications is a no‑op on web and emits a warning if we register listeners there.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensurePermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status: requested } = await Notifications.requestPermissionsAsync();
  return requested === "granted";
}

async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("orders", {
    name: "Order and delivery updates",
    description: "Time-sensitive delivery, assignment, and payment updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: theme.colors.teal[500],
    sound: "default",
  });
}

async function fetchExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) console.warn("[push] Skipping: not a physical device (simulator)");
    return null;
  }
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch (err) {
    if (__DEV__) console.warn("[push] getExpoPushTokenAsync failed:", err);
    return null;
  }
}

interface Options {
  userId: string | undefined;
  enabled?: boolean;
  onNotificationTap?: (actionUrl: string | null, data: Record<string, unknown>) => void;
}

export function usePushNotificationRegistration({
  userId,
  enabled = true,
  onNotificationTap,
}: Options): void {
  const tapHandlerRef = useRef(onNotificationTap);
  tapHandlerRef.current = onNotificationTap;

  // Token registration (Expo or native FCM)
  useEffect(() => {
    if (Platform.OS === "web") return; // push registration not supported on web
    if (!enabled || !userId) return;
    let cancelled = false;

    (async () => {
      const granted = await ensurePermissions();
      if (!granted || cancelled) return;

      await configureAndroidChannel();

      if (Platform.OS === "ios") {
        // Native iOS FCM registration via React Native Firebase
        try {
          const messaging = (await import('@react-native-firebase/messaging')) as any;
          await (messaging.default || messaging)().registerDeviceForRemoteMessages();
          const fcmToken = await (messaging.default || messaging)().getToken();
          if (fcmToken) {
            await registerDevice({
              userId,
              deviceToken: fcmToken,
              platform: "ios",
              appVersion: Constants.expoConfig?.version,
            });
          }
          
          // Handle token refresh
          const unsubscribe = (messaging.default || messaging)().onTokenRefresh(async (newToken: string) => {
            if (!userId) return;
            await registerDevice({
              userId,
              deviceToken: newToken,
              platform: "ios",
              appVersion: Constants.expoConfig?.version,
            });
          });
          
          // We attach the unsubscribe to the window or a ref in a real app,
          // but since this is inside a useEffect, we can just return it in the cleanup.
          // We'll handle cleanup below.
          (window as any)._fcmUnsubscribe = unsubscribe;
        } catch (err) {
          if (__DEV__) console.warn("[push] FCM registration failed:", err);
        }
      } else if (Platform.OS === "android") {
        // Android: Native FCM registration via Expo Device Push Token
        let nativeTokenRegistered = false;
        try {
          const tokenData = await Notifications.getDevicePushTokenAsync();
          if (tokenData && tokenData.data) {
             await registerDevice({
               userId,
               deviceToken: tokenData.data,
               platform: "android",
               appVersion: Constants.expoConfig?.version,
             });
             nativeTokenRegistered = true;
          }
        } catch (err) {
           if (__DEV__) console.warn("[push] getDevicePushTokenAsync failed:", err);
        }
        
        // Only register Expo token if native FCM registration failed, to prevent duplicate pushes
        if (!nativeTokenRegistered) {
          const token = await fetchExpoPushToken();
          if (token && !cancelled) {
            await registerPushToken({
              userId,
              expoPushToken: token,
              platform: "android",
              appVersion: Constants.expoConfig?.version,
            });
          }
        }
      } else {
        // Web / Others
        const token = await fetchExpoPushToken();
        if (!token || cancelled) return;
        await registerPushToken({
          userId,
          expoPushToken: token,
          platform: "web",
          appVersion: Constants.expoConfig?.version,
        });
      }
    })().catch((err) => {
      if (__DEV__) console.warn("[push] registration error:", err);
    });

    return () => {
      cancelled = true;
      if ((window as any)._fcmUnsubscribe) {
        (window as any)._fcmUnsubscribe();
      }
    };
  }, [userId, enabled]);

  // Response listener – fires on notification tap (foreground OR background)
  useEffect(() => {
    if (Platform.OS === "web") return; // response listeners not supported on web
    if (!enabled) return;

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const actionUrl = typeof data.action_url === "string" ? data.action_url : null;
      tapHandlerRef.current?.(actionUrl, data);
    };

    void Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [enabled]);
}
