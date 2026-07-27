import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationUpdateDto } from './dto';
import { GpsKalmanFilter } from './utils/kalman-filter';
import { LocationBroadcastGateway } from './location-broadcast.gateway';

@Injectable()
export class DriverLocationService {
  // Store Kalman filters for each driver
  private kalmanFilters = new Map<string, GpsKalmanFilter>();
  
  // Batch location updates for efficient database writes
  private locationBatch = new Map<string, any[]>();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_INTERVAL = 5000; // 5 seconds

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LocationBroadcastGateway))
    private readonly locationGateway: LocationBroadcastGateway,
  ) {
    // Start batch processing
    this.startBatchProcessor();
  }

  /**
   * Update driver location with GPS filtering
   */
  async updateLocation(userId: string, locationData: LocationUpdateDto) {
    // Get driver profile
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!profile || !profile.driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    // Only allow location updates for active/online drivers
    if (!profile.driverProfile.isOnline) {
      throw new ForbiddenException('Driver must be online to update location');
    }

    // Get or create Kalman filter for this driver
    let kalmanFilter = this.kalmanFilters.get(profile.driverProfile.id);
    if (!kalmanFilter) {
      kalmanFilter = new GpsKalmanFilter();
      this.kalmanFilters.set(profile.driverProfile.id, kalmanFilter);
    }

    // Apply Kalman filtering
    const timestamp = locationData.timestamp || Date.now();
    const filteredLocation = kalmanFilter.update(
      locationData.latitude,
      locationData.longitude,
      locationData.accuracy,
      timestamp
    );

    // If location is invalid (filtered out), return current position
    if (!filteredLocation.isValid) {
      const currentPos = kalmanFilter.getCurrentPosition();
      return {
        message: 'Location filtered out due to poor accuracy or impossible speed',
        location: currentPos || {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        },
        filtered: true
      };
    }

    // Prepare location record
    const locationRecord = {
      driverId: profile.driverProfile.id,
      latitude: filteredLocation.latitude,
      longitude: filteredLocation.longitude,
      accuracy: locationData.accuracy,
      heading: locationData.heading,
      speed: locationData.speed,
      altitude: locationData.altitude,
      timestamp: new Date(timestamp),
    };

    // Add to batch for database insertion
    this.addToBatch(profile.driverProfile.id, locationRecord);

    // Update driver profile with current location (real-time)
    const updatedProfile = await this.prisma.driverProfile.update({
      where: { id: profile.driverProfile.id },
      data: {
        currentLat: filteredLocation.latitude,
        currentLng: filteredLocation.longitude,
        lastLocationAt: new Date(timestamp),
      },
    });

    // Broadcast location update via WebSocket
    if (this.locationGateway) {
      this.locationGateway.broadcastLocationUpdate({
        driverId: profile.driverProfile.id,
        userId: profile.id,
        fullName: profile.full_name,
        vehicleType: profile.driverProfile.vehicleType,
        vehiclePlate: profile.driverProfile.vehiclePlate || '',
        currentLat: filteredLocation.latitude,
        currentLng: filteredLocation.longitude,
        lastLocationAt: new Date(timestamp).toISOString(),
        status: profile.driverProfile.status,
      });
    }

    return {
      message: 'Location updated successfully',
      location: {
        latitude: filteredLocation.latitude,
        longitude: filteredLocation.longitude,
        accuracy: locationData.accuracy,
        heading: locationData.heading,
        speed: locationData.speed,
        timestamp: new Date(timestamp).toISOString(),
      },
      filtered: false
    };
  }

  /**
   * Get driver's current location
   */
  async getCurrentLocation(userId: string) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!profile || !profile.driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    return {
      driverId: profile.driverProfile.id,
      currentLat: profile.driverProfile.currentLat,
      currentLng: profile.driverProfile.currentLng,
      lastLocationAt: profile.driverProfile.lastLocationAt,
      isOnline: profile.driverProfile.isOnline,
    };
  }

  /**
   * Get driver's location history
   */
  async getLocationHistory(userId: string, limit: number = 50) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!profile || !profile.driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    const locations = await this.prisma.driverLocation.findMany({
      where: { driverId: profile.driverProfile.id },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return {
      driverId: profile.driverProfile.id,
      totalRecords: locations.length,
      locations: locations.map(loc => ({
        id: loc.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        heading: loc.heading,
        speed: loc.speed,
        altitude: loc.altitude,
        timestamp: loc.timestamp,
      })),
    };
  }

  /**
   * Get all online drivers' locations (for admin/dispatch)
   */
  async getAllOnlineDriversLocations() {
    const onlineDrivers = await this.prisma.driverProfile.findMany({
      where: {
        isOnline: true,
        currentLat: { not: null },
        currentLng: { not: null },
      },
      include: {
        user: {
          select: {
            full_name: true,
            phone: true,
          },
        },
      },
    });

    return {
      totalOnlineDrivers: onlineDrivers.length,
      drivers: onlineDrivers.map(driver => ({
        id: driver.id,
        userId: driver.userId,
        fullName: driver.user.full_name,
        phone: driver.user.phone,
        vehicleType: driver.vehicleType,
        vehiclePlate: driver.vehiclePlate,
        currentLat: driver.currentLat,
        currentLng: driver.currentLng,
        lastLocationAt: driver.lastLocationAt,
        status: driver.status,
      })),
    };
  }

  /**
   * Broadcast driver status change
   */
  async broadcastDriverStatusChange(driverId: string, isOnline: boolean) {
    if (!this.locationGateway) return;

    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: { select: { full_name: true } } },
    });

    if (driver) {
      this.locationGateway.broadcastDriverStatusChange({
        driverId: driver.id,
        userId: driver.userId,
        fullName: driver.user.full_name,
        vehicleType: driver.vehicleType,
        vehiclePlate: driver.vehiclePlate || '',
        isOnline,
        status: driver.status,
      });
    }
  }

  /**
   * Reset Kalman filter when driver goes online
   */
  resetDriverFilter(driverId: string) {
    const filter = this.kalmanFilters.get(driverId);
    if (filter) {
      filter.reset();
    }
  }

  /**
   * Clean up when driver goes offline
   */
  cleanupDriverTracking(driverId: string) {
    // Remove Kalman filter
    this.kalmanFilters.delete(driverId);
    
    // Process any remaining batch data
    this.processBatch(driverId);
  }

  /**
   * Add location to batch for efficient database writes
   */
  private addToBatch(driverId: string, locationRecord: any) {
    if (!this.locationBatch.has(driverId)) {
      this.locationBatch.set(driverId, []);
    }

    const batch = this.locationBatch.get(driverId)!;
    batch.push(locationRecord);

    // If batch is full, process immediately
    if (batch.length >= this.BATCH_SIZE) {
      this.processBatch(driverId);
    }
  }

  /**
   * Process batched location updates
   */
  private async processBatch(driverId: string) {
    const batch = this.locationBatch.get(driverId);
    if (!batch || batch.length === 0) return;

    try {
      // Insert all locations in batch
      await this.prisma.driverLocation.createMany({
        data: batch,
        skipDuplicates: true,
      });

      console.log(`Processed ${batch.length} location updates for driver ${driverId}`);
    } catch (error) {
      console.error('Error processing location batch:', error);
    }

    // Clear batch
    this.locationBatch.set(driverId, []);
  }

  /**
   * Start batch processor timer
   */
  private startBatchProcessor() {
    this.batchTimer = setInterval(() => {
      // Process all pending batches
      for (const driverId of this.locationBatch.keys()) {
        this.processBatch(driverId);
      }
    }, this.BATCH_INTERVAL);
  }

  /**
   * Cleanup method for service shutdown
   */
  onModuleDestroy() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Process any remaining batches
    for (const driverId of this.locationBatch.keys()) {
      this.processBatch(driverId);
    }
  }

  /**
   * Clean up old location records (run periodically)
   */
  async cleanupOldLocations(olderThanDays: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.driverLocation.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`Cleaned up ${result.count} old location records`);
    return result.count;
  }
}