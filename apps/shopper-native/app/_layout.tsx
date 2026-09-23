import "./_initWeb";

import "../global.css";

import React, { useEffect, useState } from "react";

import { Platform, useColorScheme, View } from "react-native";

import { Stack } from "expo-router";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import * as SplashScreen from "expo-splash-screen";

import { StatusBar } from "expo-status-bar";

import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
} from "@expo-google-fonts/cairo";

import * as Font from "expo-font";

import { AuthProvider, useAuth } from "@/features/auth";

import {
  NotificationBanner,
  useNotificationSync,
} from "@/features/notifications";

import { useCustomerOrdersRealtimeSync } from "@/features/orders";

import { useProductsRealtimeSync } from "@/features/products";

import { ErrorBoundary, PharmacyBootstrap, SplashOverlay } from "@/shared/components";
import { AppLogo } from "@/shared/components/AppLogo";

import { AppSheet } from "@/shared/components/AppSheet";

import { RtlLocaleProvider } from "@/shared/components/RtlLocaleProvider";

import { showErrorSheet } from "@/shared/store/appSheetStore";

import { queryClient } from "@/lib/queryClient";

import { persistOptions } from "@/lib/queryPersister";

import { NetworkBridge } from "@/lib/networkStatus";

import { attachQueryClientTelemetry, installCrashEnrichment } from "@/features/observability";

import { startOfflineQueueRunner } from "@/lib/offlineQueueRunner";

import { LanguageProvider, useAppLanguage } from "@/i18n/LanguageProvider";

import "@/i18n";

import { useTranslation } from "react-i18next";

import { useCartStore } from "@/stores/cart";
import { ThemePickerSheet } from "@/features/profile/components/ThemePickerSheet";

import { BottomSheetModalProvider, ThemeProvider } from "@pharmacy/ui-native";

// ============================================================
// 🆕 NEW IMPORTS FOR PUSH NOTIFICATIONS & ACTIVE ORDER BANNER
// ============================================================
import { pushNotificationService } from "@/services/pushNotificationManager";
import { useNotificationsStore } from "@/stores/notificationsStore";
import { ActiveOrderBanner } from "@/components/ui/ActiveOrderBanner";

SplashScreen.preventAutoHideAsync();

try { installCrashEnrichment(); } catch (e) { if (__DEV__) console.error("[boot] crashEnrichment:", e); }

try { attachQueryClientTelemetry(queryClient); } catch (e) { if (__DEV__) console.error("[boot] queryTelemetry:", e); }

try { startOfflineQueueRunner(); } catch (e) { if (__DEV__) console.error("[boot] queueRunner:", e); }

if (typeof ErrorUtils !== "undefined") {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (__DEV__) console.error("[GlobalHandler] isFatal:", isFatal, error);
    prev?.(error, isFatal);
  });
}

function NotificationSync() {
  const { user } = useAuth();
  useNotificationSync(user?.id);
  return null;
}

function CustomerOrdersSync() {
  const { user } = useAuth();
  useCustomerOrdersRealtimeSync(user?.id);
  return null;
}

function ProductsSync() {
  useProductsRealtimeSync();
  return null;
}

function PushBootstrap() {
  const { user } = useAuth();
  const { fetchNotifications } = useNotificationsStore();

  // pushNotificationService is the only push-registration path -- it writes
  // to user_devices' current schema (device_id/push_token/platform) and its
  // own tap handler already navigates to the real (customer)/... routes.
  // A second, older registration hook used to run alongside this one; it
  // targeted user_devices columns (token/provider) that predate the
  // central-notification-hub migration and no longer exist, so every write
  // through it was silently failing, and its notification-tap deep-link
  // allowlist referenced a (app)/... route group that doesn't exist in this
  // router. Removed rather than fixed in place -- nothing depended on it
  // working, since it never did against the live schema.
  useEffect(() => {
    const initPush = async () => {
      try {
        await pushNotificationService.initialize(user!.id);
        await fetchNotifications({ refresh: true });
        await pushNotificationService.updateBadgeCount();
      } catch (error) {
        console.error('[PushBootstrap] Failed to initialize push:', error);
      }
    };

    if (user?.id) {
      void initPush();
    } else {
      pushNotificationService.shutdown();
    }
    return () => pushNotificationService.shutdown();
  }, [user?.id]);

  return null;
}

function CartReservationNotifier() {
  const { t } = useTranslation();
  const last = useCartStore((s) => s.lastReservationError);
  useEffect(() => {
    if (!last) return;
    showErrorSheet(t("cart.reservationError"), last.message, {
      onRetry: () => useCartStore.getState().clearReservationError(),
    });
  }, [last, t]);
  return null;
}

function ThemedApp() {
  const { isRtl } = useAppLanguage();
  const systemColorScheme = useColorScheme();

  return (
    <ThemeProvider isRTL={isRtl} systemColorScheme={systemColorScheme === "dark" ? "dark" : "light"}>
      <AuthProvider>
        {Platform.OS !== "web" && (
          <StatusBar style="light" translucent backgroundColor="transparent" />
        )}
        <NotificationSync />
        <CustomerOrdersSync />
        <ProductsSync />
        <PushBootstrap />
        <CartReservationNotifier />
        <PharmacyBootstrap />
        
        {/* ============================================================
            🆕 NEW: Active Order Banner - Floating on top of everything
            ============================================================ */}
        <ActiveOrderBanner />

        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="(customer)" options={{ headerShown: false }} />
          <Stack.Screen name="(driver)" options={{ headerShown: false }} />
          <Stack.Screen name="(pharmacist)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }} />
          {__DEV__ && <Stack.Screen name="__preview/components" options={{ headerShown: false, animation: "slide_from_right" }} />}
        </Stack>

        <NotificationBanner />
        <AppSheet />
        <ThemePickerSheet />

      </AuthProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Font loading logic
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let settled = false;
    const markReady = () => { if (!settled) { settled = true; setFontsReady(true); } };

    Font.loadAsync({
      Cairo_400Regular,
      Cairo_600SemiBold,
      Cairo_700Bold,
      Cairo_800ExtraBold,
      Cairo_900Black,
    }).then(markReady).catch(markReady);

    const safety = setTimeout(markReady, 6_000);
    return () => clearTimeout(safety);
  }, []);

  useEffect(() => {
    if (!fontsReady) return;
    const failSafe = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 4_000);
    return () => clearTimeout(failSafe);
  }, [fontsReady]);

  if (!fontsReady) {
    return (
      <View
        style={{ flex: 1, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}
        onLayout={() => { SplashScreen.hideAsync().catch(() => {}); }}
      >
        <AppLogo size="lg" />
      </View>
    );
  }

  return (
    <ErrorBoundary surface="root">
      <RtlLocaleProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <SafeAreaProvider>
              <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
                <NetworkBridge />
                <LanguageProvider>
                  <ThemedApp />
                </LanguageProvider>
              </PersistQueryClientProvider>
            </SafeAreaProvider>
            <ErrorBoundary surface="splash-overlay" fallback={() => null}>
              <SplashOverlay />
            </ErrorBoundary>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </RtlLocaleProvider>
    </ErrorBoundary>
  );
}
