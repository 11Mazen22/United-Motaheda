import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { ThemeProvider, Toast, useCourierTheme } from '@pharmacy/ui-native';
import { NetworkBanner } from '@/components/NetworkBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

const LANGUAGE_KEY = '@pharmacy/courier-language';

type AppLanguage = 'en' | 'ar';

// ─── Language context ────────────────────────────────────────────────────────
const LanguageContext = React.createContext<{
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  isRTL: boolean;
}>({
  language: 'en',
  setLanguage: async () => {},
  isRTL: false,
});

function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
      if (stored === 'ar' || stored === 'en') setLanguageState(stored);
    });
  }, []);

  const setLanguage = async (lang: AppLanguage) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    setLanguageState(lang);
  };

  const value = {
    language,
    setLanguage,
    isRTL: language === 'ar',
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage() {
  return React.useContext(LanguageContext);
}

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

// ─── Theme-aware status bar ───────────────────────────────────────────────────
function ThemeStatusBar() {
  const { isDark } = useCourierTheme();
  return Platform.OS !== 'web' ? (
    <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
  ) : null;
}

// ─── Theme provider with RTL ─────────────────────────────────────────────────
function ThemedApp() {
  const { isRTL } = useAppLanguage();
  return (
    <ThemeProvider isRTL={isRTL}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister }}
        onSuccess={() => {
          queryClient.resumePausedMutations();
        }}
      >
        <ThemeStatusBar />

        <AuthGuard />
        <GpsBootstrap />
        <PushBootstrap />

        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>

        <Toast />
        <NetworkBanner />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
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

    const safety = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3_500);

    return () => clearTimeout(safety);
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <LanguageProvider>
            <ThemedApp />
          </LanguageProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
