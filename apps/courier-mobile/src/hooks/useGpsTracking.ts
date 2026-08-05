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
 *
 * Stale-callback fix: onLocation is stored in a ref so GpsManager always
 * invokes the latest version without needing to re-register on every render.
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
      if (__DEV__) console.warn('[useGpsTracking] Post error:', err);
    } finally {
      postingRef.current = false;
      const next = postQueue.current.shift();
      if (next) postLocation(next);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Stable ref to always-latest location handler ────────────────────────
  // Avoids stale closure: GpsManager stores this ref function once and the
  // ref.current always points at the latest setLocation / postLocation.
  const onLocationRef = useRef<(loc: FilteredLocation) => void>(() => {});
  onLocationRef.current = useCallback(
    (loc: FilteredLocation) => {
      setLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        speed: loc.speed,
        accuracy: loc.accuracy,
        altitude: loc.altitude,
      });
      postLocation(loc);
    },
    [setLocation, postLocation],
  );

  // ─── Register the stable ref wrapper ONCE ────────────────────────────────
  useEffect(() => {
    GpsManager.onLocation((loc) => onLocationRef.current(loc));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Start / stop foreground tracking based on online status ─────────────
  useEffect(() => {
    if (isOnline) {
      GpsManager.startForeground().then((ok) => {
        if (ok) startTracking();
      });
    } else {
      GpsManager.stopAll().then(() => stopTracking());
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Background tracking during active delivery ───────────────────────────
  useEffect(() => {
    if (activeDelivery && isOnline) {
      GpsManager.startBackground().catch(() => {});
    } else {
      GpsManager.stopBackground().catch(() => {});
    }
  }, [!!activeDelivery, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Resume foreground when app comes back to foreground ─────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isOnline && !GpsManager.isBackgroundTracking()) {
        GpsManager.startForeground().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [isOnline]);
}
