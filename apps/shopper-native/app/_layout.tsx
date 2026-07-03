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
import { LanguageProvider } from "@/i18n/LanguageProvider";
import "@/i18n";
import { useTranslation } from "react-i18next";
import { useCartStore } from "@/stores/cart";

SplashScreen.preventAutoHideAsync();

// ─── Module-scope boot sequence — each call wrapped so one failure never
//     silences the next, and never propagates to the root ErrorBoundary. ──────

// Observability must run first so breadcrumbs are attached from the very
// first render. Both calls are pure side-effects on existing singletons.
try { installCrashEnrichment(); }      catch (e) { if (__DEV__) console.error("[boot] crashEnrichment:", e); }
try { attachQueryClientTelemetry(queryClient); } catch (e) { if (__DEV__) console.error("[boot] queryTelemetry:", e); }

// Drain the offline queue whenever the device is online. Bound to
// onlineManager from slice 1, so this respects the same NetInfo signal
// that powers query pause/resume.
try { startOfflineQueueRunner(); } catch (e) { if (__DEV__) console.error("[boot] queueRunner:", e); }

// Global unhandled-rejection safety net — prevents silent white/grey screens
// from unhandled async throws outside component trees.
if (typeof ErrorUtils !== "undefined") {
  const prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (__DEV__) console.error("[GlobalHandler] isFatal:", isFatal, error);
    // Re-invoke the existing handler (Expo / React Native default) so it can
    // still show the LogBox red screen in dev and report in prod.
    prev?.(error, isFatal);
  });
}

// ─── Notification sync — single realtime channel + banner toast bridge ──────

function NotificationSync() {
  const { user } = useAuth();
  useNotificationSync(user?.id);
  return null;
}

// ─── Push notification registration + deep-link routing ──────────────────────

function PushBootstrap() {
  const { user } = useAuth();
  const router   = useRouter();

  usePushNotificationRegistration({
    userId: user?.id,
    enabled: !!user?.id,
    onNotificationTap: (actionUrl) => {
      if (actionUrl) router.push(actionUrl as any);
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

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  // All user-data stores are auth-aware and hydrated inside PharmacyBootstrap
  // (fires on user.id change). Root mount only handles fonts + RTL + splash.
  useEffect(() => {
    // Load brand fonts in the background. The SplashOverlay covers the app for
    // its whole sequence, so fonts are ready well before any content is shown —
    // no flash of unstyled content, and no need to gate anything on this.
    Font.loadAsync({
      Cairo_400Regular,
      Cairo_600SemiBold,
      Cairo_700Bold,
      Cairo_800ExtraBold,
      Cairo_900Black,
    }).catch(() => {});

    // The native splash is dismissed by SplashOverlay at its first layout (see
    // SplashOverlay.start) so the hand-off is atomic with the brand reveal and
    // never gated on slow font loading. This timer is only a last-resort safety
    // net: if the overlay ever fails to mount, the native splash is still
    // guaranteed to come down rather than hang forever.
    const safety = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 3_500);
    return () => clearTimeout(safety);
  }, []);

  return (
    <ErrorBoundary surface="root">
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <NetworkBridge />
          <LanguageProvider>
          <AuthProvider>
            {Platform.OS !== "web" && (
              <StatusBar style="light" translucent backgroundColor="transparent" />
            )}
            <NotificationSync />
            <PushBootstrap />
            <CartReservationNotifier />
            <PharmacyBootstrap />
            <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
              <Stack.Screen name="index"                  options={{ headerShown: false }} />
              <Stack.Screen name="onboarding"             options={{ headerShown: false, animation: "fade" }} />
              <Stack.Screen name="(tabs)"                 options={{ headerShown: false }} />
              <Stack.Screen name="(auth)"                 options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="product/[id]"           options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="category/[id]"          options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="checkout"               options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="orders"                 options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="favorites"              options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="addresses"              options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="notifications"          options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="notification-preferences" options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="payment"                options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="faq"                    options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="deals"               options={{ headerShown: false, animation: "slide_from_bottom" }} />
              <Stack.Screen name="featured"            options={{ headerShown: false, animation: "slide_from_bottom" }} />
              <Stack.Screen name="reset-password"         options={{ headerShown: false }} />
              <Stack.Screen name="about"                  options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="privacy"                options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="terms"                  options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="prescriptions"          options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="order/[id]"            options={{ headerShown: false, animation: "slide_from_right" }} />
              {__DEV__ && (
                <Stack.Screen name="__preview/components" options={{ headerShown: false, animation: "slide_from_right" }} />
              )}
            </Stack>
            <NotificationBanner />
            <AppSheet />
          </AuthProvider>
          </LanguageProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
      {/* JS splash overlay — appears once per app launch after native splash
          hides, fades out after ~1.2 s. Mounted at the root so it sits above
          every route.
          Wrapped in its own ErrorBoundary so a Reanimated/asset crash inside
          SplashOverlay (most likely after an OTA update with a native module
          version mismatch) is silently swallowed rather than propagating to
          the root boundary and showing the grey error screen to the user. */}
      <ErrorBoundary surface="splash-overlay" fallback={() => null}>
        <SplashOverlay />
      </ErrorBoundary>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
