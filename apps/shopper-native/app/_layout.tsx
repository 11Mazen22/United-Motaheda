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

import { useRouter } from "expo-router";

import { AuthProvider, useAuth } from "@/features/auth";

import {

  markNotificationRead,

  NotificationBanner,

  useNotificationSync,

  usePushNotificationRegistration,

} from "@/features/notifications";

import { useCustomerOrdersRealtimeSync } from "@/features/orders";

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
  const systemColorScheme = useColorScheme();



  return (

    <ThemeProvider isRTL={isRtl} systemColorScheme={systemColorScheme === "dark" ? "dark" : "light"}>

      <AuthProvider>

        {Platform.OS !== "web" && (

          <StatusBar style="light" translucent backgroundColor="transparent" />

        )}

        <NotificationSync />

        <CustomerOrdersSync />

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

  // Font.loadAsync() used to be pure fire-and-forget: nothing in the tree
  // ever waited for it, so the ONLY thing gating the native splash screen
  // was a flat 3.5s timer. Any screen whose first render landed before that
  // timer -- which on a slow device/cold start can be well past when the
  // splash actually hid -- got Cairo silently substituted with the system
  // font by React Native (missing font families never error, they just
  // fall back), and since nothing re-renders a mounted screen just because
  // fonts finished loading a moment later, it STAYED on the wrong font for
  // as long as that screen instance stayed mounted -- for a tab screen,
  // that's the rest of the session. Confirmed live: reported as "fonts not
  // applied correctly" scattered across unrelated screens, matching exactly
  // this "whichever happened to render first" pattern rather than any
  // single broken screen.
  //
  // Now the real content doesn't mount at all until fonts have actually
  // resolved (success or failure -- either way there's a definite answer,
  // so the app never hangs on a font that fails to load). The 6s timer is
  // now purely a dead-man's switch for a font load that never settles at
  // all, not the primary trigger it effectively was before.
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

    // Fail-safe only. SplashOverlay (src/shared/components/SplashOverlay.tsx)
    // is the intended sole authority for hiding the native splash, timed to
    // its own opaque white "hold" painting first so the handoff has zero
    // flash. Hiding it here too, immediately on fontsReady, raced that paint
    // and regularly won: the OS splash lifted before SplashOverlay's hold
    // was on screen, briefly exposing the real app underneath -- already
    // mid "slide_from_right" screen-transition (the nested stacks' default)
    // -- which read as the splash itself "sliding in from the side".
    // Delayed well past SplashOverlay's own handoff window so this only
    // fires if that path failed (e.g. its ErrorBoundary fallback swallowed
    // it) instead of racing it every launch.
    const failSafe = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 4_000);

    return () => clearTimeout(failSafe);

  }, [fontsReady]);

  // Was `return null` -- a blank white frame (status bar still visible,
  // nothing painted) for however long font loading + JS bootstrap takes,
  // since this was the ONLY thing standing between the native splash
  // (already hidden by then, expo-splash-screen's own icon phase having
  // already handed off) and literally nothing. AppLogo needs no custom
  // font (expo-image + a PNG, see AppLogo.tsx), so it's safe to paint here
  // without the font-flash risk that made the real tree wait on fontsReady
  // in the first place. Matches SplashOverlay's own white background/logo
  // sizing so the handoff into the real overlay is invisible once fonts
  // resolve -- same hideAsync-on-first-paint pattern SplashOverlay uses.
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

