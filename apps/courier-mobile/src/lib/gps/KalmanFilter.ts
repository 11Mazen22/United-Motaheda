/**
 * 1D Kalman filter for GPS coordinate smoothing.
 * Adapted from the backend implementation for mobile use.
 *
 * Models a single axis (lat or lng) with position + velocity state.
 */
export class KalmanFilter1D {
  // State
  private x: number;    // position estimate
  private v: number;    // velocity estimate
  private p: number;    // position uncertainty
  private pv: number;   // velocity uncertainty
  private lastTime: number | null;

  // Tuning
  private readonly Q: number;  // process noise — how much we trust the model
  private readonly R: number;  // measurement noise — how much we trust GPS

  constructor(options?: { Q?: number; R?: number }) {
    this.Q = options?.Q ?? 3;
    this.R = options?.R ?? 15;
    this.x = 0;
    this.v = 0;
    this.p = 1000;   // high initial uncertainty
    this.pv = 100;
    this.lastTime = null;
  }

  update(measurement: number, timestampMs: number): number {
    if (this.lastTime === null) {
      // First measurement — trust it
      this.x = measurement;
      this.lastTime = timestampMs;
      return measurement;
    }

    const dt = Math.min((timestampMs - this.lastTime) / 1000, 5); // seconds, cap at 5s
    this.lastTime = timestampMs;

    // ─── Predict ────────────────────────────────────────────────────────────
    const xPred = this.x + this.v * dt;
    const pPred = this.p + this.Q * dt;

    // ─── Update ─────────────────────────────────────────────────────────────
    const K = pPred / (pPred + this.R);   // Kalman gain
    this.x = xPred + K * (measurement - xPred);
    this.p = (1 - K) * pPred;

    // Velocity estimate (simple finite difference with decay)
    if (dt > 0) {
      const measuredV = (measurement - xPred) / dt;
      this.v = this.v * 0.7 + measuredV * 0.3;
    }

    return this.x;
  }

  reset(initialValue?: number) {
    this.x = initialValue ?? 0;
    this.v = 0;
    this.p = 1000;
    this.pv = 100;
    this.lastTime = null;
  }

  getEstimate(): number {
    return this.x;
  }
}

/**
 * 2D GPS Kalman Filter — applies independent 1D filters to lat/lng.
 */
export class GpsKalmanFilter {
  private latFilter: KalmanFilter1D;
  private lngFilter: KalmanFilter1D;
  private lastAcceptedLat: number | null = null;
  private lastAcceptedLng: number | null = null;
  private lastAcceptedTime: number | null = null;

  private readonly MAX_ACCURACY_METERS = 50;
  private readonly MAX_SPEED_MS = 33.3; // ~120 km/h in m/s
  private readonly MIN_DISPLACEMENT_METERS = 2; // jitter suppression

  constructor() {
    this.latFilter = new KalmanFilter1D({ Q: 3, R: 15 });
    this.lngFilter = new KalmanFilter1D({ Q: 3, R: 15 });
  }

  /**
   * Process a raw GPS reading.
   * Returns null if the reading should be discarded.
   */
  update(
    latitude: number,
    longitude: number,
    accuracy: number | null | undefined,
    timestampMs: number,
  ): { latitude: number; longitude: number; isValid: boolean } {
    // ── Accuracy gate ────────────────────────────────────────────────────────
    if (accuracy != null && accuracy > this.MAX_ACCURACY_METERS) {
      return {
        latitude: this.latFilter.getEstimate() || latitude,
        longitude: this.lngFilter.getEstimate() || longitude,
        isValid: false,
      };
    }

    // ── Speed gate ───────────────────────────────────────────────────────────
    if (this.lastAcceptedLat != null && this.lastAcceptedTime != null) {
      const dt = (timestampMs - this.lastAcceptedTime) / 1000;
      if (dt > 0) {
        const distMeters = haversineMeters(
          this.lastAcceptedLat,
          this.lastAcceptedLng!,
          latitude,
          longitude,
        );
        const speed = distMeters / dt;
        if (speed > this.MAX_SPEED_MS) {
          // Likely a GPS jump — return last good position
          return {
            latitude: this.lastAcceptedLat,
            longitude: this.lastAcceptedLng!,
            isValid: false,
          };
        }

        // ── Jitter suppression ─────────────────────────────────────────────
        if (distMeters < this.MIN_DISPLACEMENT_METERS) {
          return {
            latitude: this.lastAcceptedLat,
            longitude: this.lastAcceptedLng!,
            isValid: true, // valid but no meaningful movement
          };
        }
      }
    }

    // ── Apply Kalman filter ──────────────────────────────────────────────────
    const filteredLat = this.latFilter.update(latitude, timestampMs);
    const filteredLng = this.lngFilter.update(longitude, timestampMs);

    this.lastAcceptedLat = filteredLat;
    this.lastAcceptedLng = filteredLng;
    this.lastAcceptedTime = timestampMs;

    return { latitude: filteredLat, longitude: filteredLng, isValid: true };
  }

  reset() {
    this.latFilter.reset();
    this.lngFilter.reset();
    this.lastAcceptedLat = null;
    this.lastAcceptedLng = null;
    this.lastAcceptedTime = null;
  }

  getLastPosition(): { latitude: number; longitude: number } | null {
    if (this.lastAcceptedLat == null) return null;
    return { latitude: this.lastAcceptedLat, longitude: this.lastAcceptedLng! };
  }
}

/** Haversine distance between two coordinates in metres */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
