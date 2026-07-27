import { Controller, Get, Post, Param, Body, NotFoundException } from '@nestjs/common';
import { DriverLocationService } from './driver-location.service';
import { PrismaService } from '../../prisma/prisma.service';

// TODO: Implement proper admin authentication guard
// For now, we'll create the endpoints without authentication
@Controller('admin/drivers')
export class AdminDriverController {
  constructor(
    private readonly locationService: DriverLocationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get all online drivers with their current locations
   * GET /admin/drivers/online
   * For admin/dispatch dashboard
   */
  @Get('online')
  async getAllOnlineDrivers() {
    return this.locationService.getAllOnlineDriversLocations();
  }

  /**
   * Get specific driver's location history
   * GET /admin/drivers/:driverId/location/history
   */
  @Get(':driverId/location/history')
  async getDriverLocationHistory(@Param('driverId') driverId: string) {
    // Find the userId from driverId for location service
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });

    if (!driverProfile) {
      throw new NotFoundException('Driver not found');
    }

    return this.locationService.getLocationHistory(driverProfile.userId);
  }

  /**
   * Clean up old location data
   * POST /admin/drivers/cleanup-locations
   */
  @Post('cleanup-locations')
  async cleanupOldLocations(@Body() body: { olderThanDays?: number }) {
    const days = body.olderThanDays || 7;
    const cleanedCount = await this.locationService.cleanupOldLocations(days);
    
    return {
      message: `Cleaned up location records older than ${days} days`,
      recordsDeleted: cleanedCount,
    };
  }
}