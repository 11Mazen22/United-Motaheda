import "./_initWeb";

import "../global.css";

import React, { useEffect } from "react";

import { Platform } from "react-native";

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

import { useRouter } from "expo-router";

import { AuthProvider, useAuth } from "@/features/auth";

import {

  markNotificationRead,

  NotificationBanner,

  useNotificationSync,

  usePushNotificationRegistration,

} from "@/features/notifications";

import { ErrorBoundary, PharmacyBootstrap, SplashOverlay } from "@/shared/components";

import { AppSheet } from "@/shared/components/AppSheet";

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

import { BottomSheetModalProvider, ThemeProvider } from "@pharmacy/ui-native";



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



function PushBootstrap() {

  const { user } = useAuth();

  const router = useRouter();



  usePushNotificationRegistration({

    userId: user?.id,

    enabled: !!user?.id,

    onNotificationTap: (actionUrl, data) => {

      const notificationId = typeof data.notification_id === "string" ? data.notification_id : undefined;

      if (notificationId && user?.id) markNotificationRead(notificationId, user.id).catch(() => {});

      if (actionUrl) router.push(actionUrl as unknown as never);

    },

  });



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



  return (

    <ThemeProvider isRTL={isRtl}>

      <AuthProvider>

        {Platform.OS !== "web" && (

          <StatusBar style="light" translucent backgroundColor="transparent" />

        )}

        <NotificationSync />

        <PushBootstrap />

        <CartReservationNotifier />

        <PharmacyBootstrap />

        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="(customer)" options={{ headerShown: false }} />
          <Stack.Screen name="(driver)" options={{ headerShown: false }} />
          <Stack.Screen name="(pharmacist)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          {__DEV__ && <Stack.Screen name="__preview/components" options={{ headerShown: false, animation: "slide_from_right" }} />}
        </Stack>

        <NotificationBanner />

        <AppSheet />

      </AuthProvider>

    </ThemeProvider>

  );

}



export default function RootLayout() {

  useEffect(() => {

    Font.loadAsync({

      Cairo_400Regular,

      Cairo_600SemiBold,

      Cairo_700Bold,

      Cairo_800ExtraBold,

      Cairo_900Black,

    }).catch(() => {});

    const safety = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 3_500);

    return () => clearTimeout(safety);

  }, []);



  return (

    <ErrorBoundary surface="root">

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

    </ErrorBoundary>

  );

}

