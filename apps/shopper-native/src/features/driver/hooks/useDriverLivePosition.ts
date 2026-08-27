/**
 * useDriverLivePosition — the one shared GPS subscription for the driver
 * app. Before this, DeliveryExecutionScreen's server-broadcast loop and
 * DriverMap's own position watcher each independently requested permission,
 * ran their own GpsKalmanFilter instance, and drove their own subscription
 * — two live GPS reads running in parallel for the same physical device
 * whenever both happened to be relevant, for no benefit. This hook is now
 * the single continuous `watchPositionAsync` subscription; callers that
 * need to push to the server on an interval read the latest smoothed fix
 * from here instead of requesting a fresh one-shot position themselves.
 */
import { useEffect, useRef, useState } from "react";
import * as ExpoLocation from "expo-location";
import { GpsKalmanFilter } from "../lib/GpsKalmanFilter";

export interface DriverLiveFix {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speedKmh?: number;
  capturedAt: string;
}

export interface UseDriverLivePositionResult {
  fix: DriverLiveFix | null;
  permissionDenied: boolean;
  /** Ref mirror of `fix`, safe to read from a setInterval closure without
   *  re-subscribing the effect on every GPS update. */
  fixRef: React.MutableRefObject<DriverLiveFix | null>;
}

export function useDriverLivePosition(enabled: boolean): UseDriverLivePositionResult {
  const [fix, setFix] = useState<DriverLiveFix | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const fixRef = useRef<DriverLiveFix | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const filter = new GpsKalmanFilter();
    let subscription: ExpoLocation.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (!cancelled) setPermissionDenied(true);
        return;
      }
      subscription = await ExpoLocation.watchPositionAsync(
        { accuracy: ExpoLocation.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
        (position) => {
          if (cancelled) return;
          const smoothed = filter.update(position.coords.latitude, position.coords.longitude, position.coords.accuracy, position.timestamp);
          const next: DriverLiveFix = {
            lat: smoothed.latitude,
            lng: smoothed.longitude,
            accuracy: position.coords.accuracy ?? undefined,
            heading: typeof position.coords.heading === "number" ? position.coords.heading : undefined,
            speedKmh: typeof position.coords.speed === "number" ? Math.max(position.coords.speed, 0) * 3.6 : undefined,
            capturedAt: new Date(position.timestamp).toISOString(),
          };
          fixRef.current = next;
          setFix(next);
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      fixRef.current = null;
    };
  }, [enabled]);

  return { fix, permissionDenied, fixRef };
}
