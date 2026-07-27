import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';

import { queryClient, asyncStoragePersister } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth.store';
import { socketManager } from '@/lib/socket';
import { useGpsTracking } from '@/hooks/useGpsTracking';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Toast } from '@/components/ui/Toast';
import { NetworkBanner } from '@/components/NetworkBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

// ─── Push notification bootstrap ─────────────────────────────────────────────
function PushBootstrap() {
  const user = useAuthStore((s) => s.user);
  usePushNotifications({ userId: user?.id });
  return null;
}

// ─── GPS tracking bootstrap — only active when authenticated ─────────────────
function GpsBootstrap() {
  useGpsTracking();
  return null;
}

// ─── Auth guard — redirects based on authentication state ────────────────────
function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated || !token) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
      // Connect socket when authenticated
      socketManager.connect();
    }
  }, [isAuthenticated, token, segments]);

  return null;
}

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  useEffect(() => {
    Font.loadAsync({
      Cairo_400Regular,
      Cairo_500Medium,
      Cairo_600SemiBold,
      Cairo_700Bold,
      Cairo_800ExtraBold,
    }).catch(() => {});

    // Safety net: hide splash after 3.5s if not already hidden
    const safety = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3_500);

    return () => clearTimeout(safety);
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: asyncStoragePersister }}
            onSuccess={() => {
              // Resume paused mutations after hydration
              queryClient.resumePausedMutations();
            }}
          >
            {Platform.OS !== 'web' && (
              <StatusBar style="dark" translucent backgroundColor="transparent" />
            )}

            <AuthGuard />
            <GpsBootstrap />
            <PushBootstrap />

            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>

            {/* Global toast — sits above everything */}
            <Toast />
            {/* Network offline banner */}
            <NetworkBanner />
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
