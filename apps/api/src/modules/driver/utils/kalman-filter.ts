/**
 * Kalman Filter for GPS location smoothing
 * Reduces GPS noise and provides more accurate location tracking
 */

interface KalmanState {
  // Position state
  latitude: number;
  longitude: number;
  
  // Velocity state (degrees per second)
  velocityLat: number;
  velocityLng: number;
  
  // Covariance matrix (simplified 4x4)
  covariance: number[][];
  
  // Last update timestamp
  lastUpdate: number;
}

export class GpsKalmanFilter {
  private state: KalmanState | null = null;
  
  // Process noise (how much we trust the motion model)
  private readonly processNoise = 0.1;
  
  // Minimum accuracy threshold (meters) - reject updates with worse accuracy
  private readonly minAccuracy = 50;
  
  // Maximum speed threshold (m/s) - reject impossible speed changes
  private readonly maxSpeed = 100; // ~360 km/h
  
  /**
   * Update the Kalman filter with new GPS measurement
   */
  update(
    latitude: number,
    longitude: number,
    accuracy: number,
    timestamp: number
  ): { latitude: number; longitude: number; isValid: boolean } {
    
    // Reject measurements with poor accuracy
    if (accuracy > this.minAccuracy) {
      return { latitude, longitude, isValid: false };
    }
    
    // Initialize state on first measurement
    if (!this.state) {
      this.state = {
        latitude,
        longitude,
        velocityLat: 0,
        velocityLng: 0,
        covariance: [
          [accuracy * accuracy, 0, 0, 0],
          [0, accuracy * accuracy, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1]
        ],
        lastUpdate: timestamp
      };
      return { latitude, longitude, isValid: true };
    }
    
    const deltaTime = (timestamp - this.state.lastUpdate) / 1000; // seconds
    
    // Skip if time delta is too small or negative
    if (deltaTime <= 0 || deltaTime > 300) { // Max 5 minutes
      return { 
        latitude: this.state.latitude, 
        longitude: this.state.longitude, 
        isValid: false 
      };
    }
    
    // Predict step
    const predictedLat = this.state.latitude + this.state.velocityLat * deltaTime;
    const predictedLng = this.state.longitude + this.state.velocityLng * deltaTime;
    
    // Check for impossible speed (teleportation detection)
    const distance = this.calculateDistance(
      this.state.latitude, this.state.longitude,
      latitude, longitude
    );
    const speed = distance / deltaTime; // m/s
    
    if (speed > this.maxSpeed) {
      return { 
        latitude: this.state.latitude, 
        longitude: this.state.longitude, 
        isValid: false 
      };
    }
    
    // Update covariance for prediction
    const processVariance = this.processNoise * deltaTime;
    this.state.covariance[0][0] += processVariance;
    this.state.covariance[1][1] += processVariance;
    this.state.covariance[2][2] += processVariance;
    this.state.covariance[3][3] += processVariance;
    
    // Measurement noise (based on GPS accuracy)
    const measurementNoise = accuracy * accuracy;
    
    // Kalman gain calculation (simplified)
    const gainLat = this.state.covariance[0][0] / (this.state.covariance[0][0] + measurementNoise);
    const gainLng = this.state.covariance[1][1] / (this.state.covariance[1][1] + measurementNoise);
    
    // Update position
    const filteredLat = predictedLat + gainLat * (latitude - predictedLat);
    const filteredLng = predictedLng + gainLng * (longitude - predictedLng);
    
    // Update velocity (simple approximation)
    this.state.velocityLat = (filteredLat - this.state.latitude) / deltaTime;
    this.state.velocityLng = (filteredLng - this.state.longitude) / deltaTime;
    
    // Update state
    this.state.latitude = filteredLat;
    this.state.longitude = filteredLng;
    this.state.lastUpdate = timestamp;
    
    // Update covariance (simplified)
    this.state.covariance[0][0] *= (1 - gainLat);
    this.state.covariance[1][1] *= (1 - gainLng);
    
    return { 
      latitude: filteredLat, 
      longitude: filteredLng, 
      isValid: true 
    };
  }
  
  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }
  
  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Get current filtered position
   */
  getCurrentPosition(): { latitude: number; longitude: number } | null {
    if (!this.state) return null;
    return {
      latitude: this.state.latitude,
      longitude: this.state.longitude
    };
  }
  
  /**
   * Reset the filter (useful when driver goes offline/online)
   */
  reset(): void {
    this.state = null;
  }
}