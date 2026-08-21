import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { GpsKalmanFilter, haversineMeters } from './KalmanFilter';

export const BACKGROUND_LOCATION_TASK = 'DRIVER_BACKGROUND_LOCATION';

export interface FilteredLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  timestamp: number;
}

type LocationCallback = (loc: FilteredLocation) => void;
type AccuracyWarningCallback = (message: string) => void;

/**
 * Adaptive GPS update interval based on current speed.
 * Stationary: 15s, Slow: 5s, Fast: 3s
 */
function getIntervalMs(speedMs: number | null): number {
  if (speedMs == null || speedMs < 1) return 15_000;
  if (speedMs < 10) return 5_000;
  return 3_000;
}

class GpsManagerClass {
  private kalman = new GpsKalmanFilter();
  private subscription: Location.LocationSubscription | null = null;
  private onLocationCb: LocationCallback | null = null;
  private onAccuracyWarningCb: AccuracyWarningCallback | null = null;

  private lastPostTime = 0;
  private lastPostLat: number | null = null;
  private lastPostLng: number | null = null;
  private currentIntervalMs = 10_000;

  // Whether we've started background tracking (during active delivery)
  private backgroundTracking = false;

  /**
   * Register callbacks
   */
  onLocation(cb: LocationCallback) {
    this.onLocationCb = cb;
  }

  onAccuracyWarning(cb: AccuracyWarningCallback) {
    this.onAccuracyWarningCb = cb;
  }

  /**
   * Request permissions and start foreground location watching
   */
  async startForeground(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      this.onAccuracyWarningCb?.('Location permission denied');
      return false;
    }

    await this.stopForeground();

    this.kalman.reset();

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
        },
        (location) => this.processRawLocation(location),
      );
    } catch (err: any) {
      const message = err?.message ?? 'Location error';
      if (message.toLowerCase().includes('disabled') || message.toLowerCase().includes('unavailable')) {
        this.onAccuracyWarningCb?.('Location services disabled. Enable them in settings to continue.');
      } else {
        this.onAccuracyWarningCb?.(message);
      }
      return false;
    }

    return true;
  }

  /**
   * Stop foreground location watching
   */
  async stopForeground() {
    this.subscription?.remove();
    this.subscription = null;
  }

  /**
   * Start background location task (requires BACKGROUND_LOCATION_TASK to be defined)
   */
  async startBackground(): Promise<boolean> {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      this.onAccuracyWarningCb?.('Background location permission denied');
      return false;
    }

    const isRegistered = TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK);
    if (!isRegistered) {
      console.warn('[GpsManager] Background task not defined');
      return false;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5_000,
      distanceInterval: 10,
      foregroundService: {
        notificationTitle: 'United Pharmacy Driver',
        notificationBody: 'Your location is being tracked during delivery',
        notificationColor: '#0E7E74',
      },
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
    });

    this.backgroundTracking = true;
    return true;
  }

  /**
   * Stop background location task
   */
  async stopBackground() {
    const isTracking = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    }
    this.backgroundTracking = false;
  }

  /**
   * Full stop — foreground + background
   */
  async stopAll() {
    await this.stopForeground();
    await this.stopBackground();
    this.kalman.reset();
    this.lastPostTime = 0;
    this.lastPostLat = null;
    this.lastPostLng = null;
  }

  /**
   * Process raw location from expo-location.
   * Applies Kalman filter, accuracy/speed gating, adaptive interval.
   */
  processRawLocation(location: Location.LocationObject) {
    const { latitude, longitude, accuracy, heading, speed, altitude } = location.coords;
    const timestamp = location.timestamp ?? Date.now();

    // Emit accuracy warning
    if (accuracy != null && accuracy > 50) {
      this.onAccuracyWarningCb?.(`Low GPS accuracy: ${Math.round(accuracy)}m`);
    }

    const filtered = this.kalman.update(latitude, longitude, accuracy, timestamp);

    if (!filtered.isValid) {
      // Reading discarded — don't post
      return;
    }

    // Adaptive interval: check if enough time has passed since last post
    const speedMs = speed ?? null;
    const intervalMs = getIntervalMs(speedMs);
    const now = Date.now();

    if (now - this.lastPostTime < intervalMs) {
      // Not time yet — skip posting but still emit to UI for smooth marker
      this.onLocationCb?.({
        latitude: filtered.latitude,
        longitude: filtered.longitude,
        accuracy,
        heading,
        speed,
        altitude,
        timestamp,
      });
      return;
    }

    // Check if driver moved enough to warrant a post (>5m from last post)
    if (this.lastPostLat != null) {
      const dist = haversineMeters(
        this.lastPostLat,
        this.lastPostLng!,
        filtered.latitude,
        filtered.longitude,
      );
      if (dist < 5 && speedMs != null && speedMs < 1) {
        // Stationary — very infrequent posting
        if (now - this.lastPostTime < 30_000) return;
      }
    }

    this.lastPostTime = now;
    this.lastPostLat = filtered.latitude;
    this.lastPostLng = filtered.longitude;
    this.currentIntervalMs = intervalMs;

    this.onLocationCb?.({
      latitude: filtered.latitude,
      longitude: filtered.longitude,
      accuracy,
      heading,
      speed,
      altitude,
      timestamp,
    });
  }

  getAccuracyLevel(accuracy: number | null): 'good' | 'fair' | 'poor' {
    if (accuracy == null) return 'poor';
    if (accuracy <= 15) return 'good';
    if (accuracy <= 50) return 'fair';
    return 'poor';
  }

  isBackgroundTracking(): boolean {
    return this.backgroundTracking;
  }
}

export const GpsManager = new GpsManagerClass();

// ─── Register the background task (must be at module level) ──────────────────
// This is called once when the module loads. The actual handler is set
// up in the app entry point / root layout.
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error) {
      console.error('[BackgroundLocation]', error.message);
      return;
    }
    if (data?.locations) {
      for (const loc of data.locations) {
        GpsManager.processRawLocation(loc);
      }
    }
  });
}
