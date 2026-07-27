import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GpsManager, FilteredLocation } from '@/lib/gps/GpsManager';
import { useLocationStore } from '@/stores/location.store';
import { useAuthStore } from '@/stores/auth.store';
import { useOrdersStore } from '@/stores/orders.store';
import { driverApi } from '@/lib/api';

/**
 * Main GPS tracking hook.
 * - Starts foreground tracking when driver is online.
 * - Starts background tracking when there's an active delivery.
 * - Applies Kalman-filtered locations to the location store.
 * - Posts to the backend on the adaptive interval managed by GpsManager.
 */
export function useGpsTracking() {
  const isOnline = useAuthStore((s) => s.user?.driverProfile?.isOnline ?? false);
  const activeDelivery = useOrdersStore((s) => s.activeDelivery);
  const setLocation = useLocationStore((s) => s.setLocation);
  const startTracking = useLocationStore((s) => s.startTracking);
  const stopTracking = useLocationStore((s) => s.stopTracking);

  const postQueue = useRef<FilteredLocation[]>([]);
  const postingRef = useRef(false);

  // ─── Post location to backend ─────────────────────────────────────────────
  const postLocation = useCallback(async (loc: FilteredLocation) => {
    if (postingRef.current) {
      postQueue.current.push(loc);
      return;
    }

    postingRef.current = true;
    try {
      await driverApi.updateLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy ?? undefined,
        heading: loc.heading ?? undefined,
        speed: loc.speed ?? undefined,
        altitude: loc.altitude ?? undefined,
        timestamp: loc.timestamp,
      });
    } catch (err) {
      // Non-critical — location posting failure shouldn't block the app
      if (__DEV__) console.warn('[useGpsTracking] Post error:', err);
    } finally {
      postingRef.current = false;
      // Drain the queue
      const next = postQueue.current.shift();
      if (next) postLocation(next);
    }
  }, []);

  // ─── Location callback from GpsManager ───────────────────────────────────
  const onLocation = useCallback(
    (loc: FilteredLocation) => {
      // Always update UI store
      setLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        speed: loc.speed,
        accuracy: loc.accuracy,
        altitude: loc.altitude,
      });

      // Post to backend (GpsManager already applies adaptive interval)
      postLocation(loc);
    },
    [setLocation, postLocation],
  );

  // ─── Start / stop tracking based on online status ─────────────────────────
  useEffect(() => {
    GpsManager.onLocation(onLocation);

    if (isOnline) {
      GpsManager.startForeground().then((ok) => {
        if (ok) startTracking();
      });
    } else {
      GpsManager.stopAll().then(() => stopTracking());
    }

    return () => {
      // Don't stop on unmount if still online (layout remounts)
    };
  }, [isOnline]);

  // ─── Background tracking during active delivery ───────────────────────────
  useEffect(() => {
    if (activeDelivery && isOnline) {
      GpsManager.startBackground().catch(() => {});
    } else {
      GpsManager.stopBackground().catch(() => {});
    }
  }, [!!activeDelivery, isOnline]);

  // ─── Foreground / background app state ────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isOnline && !GpsManager.isBackgroundTracking()) {
        GpsManager.startForeground().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [isOnline]);
}
