/**
 * useDriverLivePosition — the one shared GPS subscription for the driver
 * app.
 *
 * This is a true module-level singleton, reference-counted across every
 * caller: DeliveryExecutionScreen (active-delivery readout + server push),
 * DriverMap (full map tab), and AssignmentOffersList (nearby-offer
 * distance) each call this hook independently, and React Navigation's tab
 * navigator keeps sibling tab screens mounted rather than unmounting them
 * on blur — so with a naive per-call `watchPositionAsync`, a driver who has
 * simply visited the offers tab once (AssignmentOffersList calls this with
 * `enabled: true`, unconditionally) keeps a live GPS watcher running for
 * the rest of the session, and a second delivery/map watcher stacks on top
 * of it whenever those screens are also active — multiple concurrent native
 * GPS subscriptions and Kalman filters for the same physical device, for no
 * benefit (confirmed live: previously each call site created its own
 * subscription+filter instance despite this file's own header comment
 * already claiming to be "the one shared GPS subscription").
 *
 * Now there is exactly one real `watchPositionAsync` subscription for the
 * whole app at any time, started when the first enabled caller mounts and
 * stopped when the last one unmounts/disables. Every caller keeps reading
 * `{ fix, permissionDenied, fixRef }` exactly as before — no call site
 * needed to change.
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

// ─── Module-level shared subscription state ────────────────────────────────

let sharedSubscription: ExpoLocation.LocationSubscription | null = null;
let sharedFilter: GpsKalmanFilter | null = null;
let sharedFix: DriverLiveFix | null = null;
let sharedPermissionDenied = false;
let subscriberCount = 0;
let startPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

async function ensureSharedSubscriptionStarted(): Promise<void> {
  if (sharedSubscription) return;
  if (startPromise) {
    await startPromise;
    return;
  }

  startPromise = (async () => {
    sharedFilter = new GpsKalmanFilter();
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    // A caller may have dropped to zero subscribers while permission was
    // still being requested (fast mount/unmount) — don't leave a dangling
    // subscription nobody wants.
    if (subscriberCount <= 0) return;
    if (permission.status !== "granted") {
      sharedPermissionDenied = true;
      notifyListeners();
      return;
    }
    sharedSubscription = await ExpoLocation.watchPositionAsync(
      { accuracy: ExpoLocation.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
      (position) => {
        const smoothed = sharedFilter!.update(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
          position.timestamp,
        );
        sharedFix = {
          lat: smoothed.latitude,
          lng: smoothed.longitude,
          accuracy: position.coords.accuracy ?? undefined,
          heading: typeof position.coords.heading === "number" ? position.coords.heading : undefined,
          speedKmh: typeof position.coords.speed === "number" ? Math.max(position.coords.speed, 0) * 3.6 : undefined,
          capturedAt: new Date(position.timestamp).toISOString(),
        };
        notifyListeners();
      },
    );
    if (subscriberCount <= 0) {
      // Every subscriber disappeared while watchPositionAsync itself was
      // still resolving — tear down immediately rather than leak a live GPS
      // watcher with nobody left to read it.
      sharedSubscription.remove();
      sharedSubscription = null;
      sharedFilter = null;
      sharedFix = null;
    }
  })();

  await startPromise;
  startPromise = null;
}

function releaseSharedSubscription(): void {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount > 0) return;
  sharedSubscription?.remove();
  sharedSubscription = null;
  sharedFilter = null;
  sharedFix = null;
  sharedPermissionDenied = false;
}

export function useDriverLivePosition(enabled: boolean): UseDriverLivePositionResult {
  const [, forceRender] = useState(0);
  const fixRef = useRef<DriverLiveFix | null>(sharedFix);

  useEffect(() => {
    if (!enabled) return;

    subscriberCount += 1;
    const listener = () => {
      fixRef.current = sharedFix;
      forceRender((n) => n + 1);
    };
    listeners.add(listener);
    void ensureSharedSubscriptionStarted();

    return () => {
      listeners.delete(listener);
      releaseSharedSubscription();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { fix: fixRef.current, permissionDenied: sharedPermissionDenied, fixRef };
}
