import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useNotificationsStore } from "@/stores/notificationsStore";

const EXPO_TOKEN_KEY = "@push_token";
const DEVICE_ID_KEY = "@device_id";
const CHANNELS = [
  { id: "orders", name: "Order and delivery updates" },
  { id: "offers", name: "Driver offers" },
  { id: "system", name: "Account and system updates" },
] as const;

type PushData = {
  action_url?: string;
  notification_id?: string;
  notificationId?: string;
  [key: string]: unknown;
};

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

class PushNotificationManager {
  private expoToken: string | null = null;
  private initializedUserId: string | null = null;
  private generation = 0;
  private cleanups: Array<() => void> = [];
  private handled = new Set<string>();

  async initialize(userId: string): Promise<void> {
    if (Platform.OS === "web" || !Device.isDevice) return;
    if (this.initializedUserId === userId) return;
    this.shutdown();
    this.initializedUserId = userId;
    const generation = this.generation;

    this.installExpoListeners();
    await this.configureAndroidChannels();
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.status === "granted"
      ? existing
      : await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted" || generation !== this.generation) return;

    // Native FCM is primary; Expo remains a fallback. The server selects one
    // provider per device, so registering both never creates duplicate alerts.
    await Promise.allSettled([
      this.registerExpoToken(generation),
      this.registerNativeFcm(userId, generation),
    ]);
    if (generation !== this.generation) return;
    await this.consumeColdStartResponse();
    await this.updateBadgeCount();
  }

  shutdown(): void {
    this.generation += 1;
    this.initializedUserId = null;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  private installExpoListeners(): void {
    const received = Notifications.addNotificationReceivedListener(() => {
      void useNotificationsStore.getState().fetchNotifications({ refresh: true });
      void this.updateBadgeCount();
    });
    const response = Notifications.addNotificationResponseReceivedListener((value) => {
      this.handleData(
        value.notification.request.content.data as PushData,
        value.notification.request.identifier,
      );
    });
    this.cleanups.push(() => received.remove(), () => response.remove());
  }

  private async configureAndroidChannels(): Promise<void> {
    if (Platform.OS !== "android") return;
    await Promise.all(CHANNELS.map(({ id, name }) => Notifications.setNotificationChannelAsync(id, {
      name,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: "#0E7E74",
      sound: "default",
      enableVibrate: true,
    })));
  }

  private async getDeviceId(): Promise<string> {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const created = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  }

  private async registerExpoToken(generation: number): Promise<void> {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error("Expo projectId is missing.");
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (generation !== this.generation) return;
    const { error } = await supabase.rpc("register_push_token", {
      p_expo_push_token: token,
      p_platform: Platform.OS,
      p_device_id: await this.getDeviceId(),
      p_app_version: Constants.expoConfig?.version ?? null,
    });
    if (error) throw error;
    this.expoToken = token;
    await AsyncStorage.setItem(EXPO_TOKEN_KEY, token);
  }

  private async registerNativeFcm(userId: string, generation: number): Promise<void> {
    const messagingModule = await import("@react-native-firebase/messaging");
    const client = messagingModule.getMessaging();
    await messagingModule.registerDeviceForRemoteMessages(client);
    const deviceId = await this.getDeviceId();
    const persist = async (token: string) => {
      if (!token || generation !== this.generation || this.initializedUserId !== userId) return;
      const { error } = await supabase.rpc("register_device_push_token", {
        p_device_id: deviceId,
        p_push_token: token,
        p_platform: Platform.OS,
        p_app_version: Constants.expoConfig?.version ?? null,
      });
      if (error) throw error;
    };

    await persist(await messagingModule.getToken(client));
    this.cleanups.push(
      messagingModule.onTokenRefresh(client, (token) => { void persist(token); }),
      messagingModule.onNotificationOpenedApp(client, (message) => {
        this.handleData(message.data as PushData | undefined, message.messageId ?? undefined);
      }),
      messagingModule.onMessage(client, async (message) => {
        if (generation !== this.generation) return;
        const key = message.messageId ?? `foreground-${Date.now()}`;
        if (this.handled.has(key)) return;
        this.handled.add(key);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: message.notification?.title ?? "صيدليات المتحدة",
            body: message.notification?.body ?? "لديك تحديث جديد",
            data: message.data ?? {},
            sound: "default",
          },
          trigger: null,
        });
        void useNotificationsStore.getState().fetchNotifications({ refresh: true });
      }),
    );

    const initial = await messagingModule.getInitialNotification(client);
    if (initial) this.handleData(initial.data as PushData | undefined, initial.messageId ?? undefined);
  }

  private async consumeColdStartResponse(): Promise<void> {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      this.handleData(
        response.notification.request.content.data as PushData,
        response.notification.request.identifier,
      );
    }
    await Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }

  private handleData(data: PushData | undefined, responseKey?: string): void {
    if (!data) return;
    const key = responseKey ?? data.notification_id ?? data.notificationId;
    if (key && this.handled.has(key)) return;
    if (key) this.handled.add(key);
    const notificationId = data.notification_id ?? data.notificationId;
    if (notificationId) useNotificationsStore.getState().markAsRead(notificationId);
    if (typeof data.action_url === "string" && data.action_url.startsWith("/")) {
      setTimeout(() => router.push(data.action_url as import("expo-router").Href), 0);
    }
    void this.updateBadgeCount();
  }

  async deactivateToken(_userId?: string): Promise<void> {
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    const expoToken = this.expoToken ?? await AsyncStorage.getItem(EXPO_TOKEN_KEY);
    const cleanup = Promise.allSettled([
      deviceId ? supabase.rpc("deactivate_push_device", { p_device_id: deviceId }) : Promise.resolve(),
      expoToken
        ? supabase.from("notification_tokens").update({
            invalidated_at: new Date().toISOString(), invalid_reason: "signed_out",
          }).eq("expo_push_token", expoToken)
        : Promise.resolve(),
    ]);
    // Token cleanup is best-effort and must never block account sign-out if
    // PostgREST is slow or unavailable.
    await Promise.race([
      cleanup,
      new Promise<void>((resolve) => setTimeout(resolve, 2_500)),
    ]);
    this.shutdown();
  }

  async updateBadgeCount(): Promise<void> {
    if (Platform.OS === "web") return;
    const unread = await useNotificationsStore.getState().getUnreadCount();
    await Notifications.setBadgeCountAsync(unread);
  }
}

export const pushNotificationService = new PushNotificationManager();
