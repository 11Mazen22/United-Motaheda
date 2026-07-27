import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDriverProfileDto } from './dto';
import { DriverLocationService } from './driver-location.service';

@Injectable()
export class DriverProfileService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DriverLocationService))
    private readonly locationService: DriverLocationService,
  ) {}

  /**
   * Get driver profile by user ID
   */
  async getProfile(userId: string) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      include: {
        driverProfile: true,
      },
    });

    if (!profile || !profile.driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      status: profile.status,
      driverProfile: {
        id: profile.driverProfile.id,
        vehicleType: profile.driverProfile.vehicleType,
        vehiclePlate: profile.driverProfile.vehiclePlate,
        vehicleModel: profile.driverProfile.vehicleModel,
        vehicleColor: profile.driverProfile.vehicleColor,
        licenseNumber: profile.driverProfile.licenseNumber,
        licenseExpiry: profile.driverProfile.licenseExpiry,
        licensePhotoUrl: profile.driverProfile.licensePhotoUrl,
        idPhotoUrl: profile.driverProfile.idPhotoUrl,
        vehiclePhotoUrl: profile.driverProfile.vehiclePhotoUrl,
        insurancePhotoUrl: profile.driverProfile.insurancePhotoUrl,
        status: profile.driverProfile.status,
        isOnline: profile.driverProfile.isOnline,
        currentLat: profile.driverProfile.currentLat,
        currentLng: profile.driverProfile.currentLng,
        lastLocationAt: profile.driverProfile.lastLocationAt,
        rating: profile.driverProfile.rating.toString(),
        totalDeliveries: profile.driverProfile.totalDeliveries,
        completionRate: profile.driverProfile.completionRate.toString(),
        totalEarnings: profile.driverProfile.totalEarnings.toString(),
        approvedAt: profile.driverProfile.approvedAt,
        rejectionReason: profile.driverProfile.rejectionReason,
        createdAt: profile.driverProfile.createdAt,
        updatedAt: profile.driverProfile.updatedAt,
      },
    };
  }

  /**
   * Update driver profile
   */
  async updateProfile(userId: string, dto: UpdateDriverProfileDto) {
    // Check if driver profile exists
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!profile || !profile.driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    // Drivers cannot change their status directly
    if (profile.driverProfile.status === 'SUSPENDED' || profile.driverProfile.status === 'REJECTED') {
      throw new ForbiddenException('Cannot update profile while account is suspended or rejected');
    }

    // Update driver profile
    const updatedProfile = await this.prisma.driverProfile.update({
      where: { id: profile.driverProfile.id },
      data: {
        ...(dto.vehicleType && { vehicleType: dto.vehicleType }),
        ...(dto.vehiclePlate !== undefined && { vehiclePlate: dto.vehiclePlate }),
        ...(dto.vehicleModel !== undefined && { vehicleModel: dto.vehicleModel }),
        ...(dto.vehicleColor !== undefined && { vehicleColor: dto.vehicleColor }),
        ...(dto.licenseNumber !== undefined && { licenseNumber: dto.licenseNumber }),
        ...(dto.licenseExpiry && { licenseExpiry: new Date(dto.licenseExpiry) }),
        ...(dto.licensePhotoUrl !== undefined && { licensePhotoUrl: dto.licensePhotoUrl }),
        ...(dto.idPhotoUrl !== undefined && { idPhotoUrl: dto.idPhotoUrl }),
        ...(dto.vehiclePhotoUrl !== undefined && { vehiclePhotoUrl: dto.vehiclePhotoUrl }),
        ...(dto.insurancePhotoUrl !== undefined && { insurancePhotoUrl: dto.insurancePhotoUrl }),
        ...(dto.isOnline !== undefined && { isOnline: dto.isOnline }),
      },
    });

    return {
      message: 'Profile updated successfully',
      driverProfile: updatedProfile,
    };
  }

  /**
   * Update driver online status
   */
  async updateOnlineStatus(userId: string, isOnline: boolean) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!profile || !profile.driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    // Check if driver is approved
    if (profile.driverProfile.status !== 'APPROVED' && profile.driverProfile.status !== 'ACTIVE') {
      throw new ForbiddenException('Only approved drivers can go online');
    }

    // Update status
    const updatedProfile = await this.prisma.driverProfile.update({
      where: { id: profile.driverProfile.id },
      data: {
        isOnline,
        status: isOnline ? 'ACTIVE' : 'APPROVED',
      },
    });

    // If going online, create a new session
    if (isOnline) {
      await this.prisma.driverSession.create({
        data: {
          driverId: updatedProfile.id,
        },
      });
    } else {
      // If going offline, end the current session
      const currentSession = await this.prisma.driverSession.findFirst({
        where: {
          driverId: updatedProfile.id,
          endedAt: null,
        },
        orderBy: {
          startedAt: 'desc',
        },
      });

      if (currentSession) {
        const now = new Date();
        const onlineTime = Math.floor((now.getTime() - currentSession.startedAt.getTime()) / 60000);
        
        await this.prisma.driverSession.update({
          where: { id: currentSession.id },
          data: {
            endedAt: now,
            totalOnlineTime: onlineTime,
          },
        });
      }
    }

    // Broadcast status change via WebSocket
    if (this.locationService) {
      await this.locationService.broadcastDriverStatusChange(profile.driverProfile.id, isOnline);
    }

    return {
      message: isOnline ? 'Driver is now online' : 'Driver is now offline',
      isOnline: updatedProfile.isOnline,
      status: updatedProfile.status,
    };
  }

  /**
   * Get driver statistics
   */
  async getStatistics(userId: string) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!profile || !profile.driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    // Get today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEarnings = await this.prisma.driverEarning.aggregate({
      where: {
        driverId: profile.driverProfile.id,
        earnedAt: {
          gte: today,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    // Get this week's earnings
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEarnings = await this.prisma.driverEarning.aggregate({
      where: {
        driverId: profile.driverProfile.id,
        earnedAt: {
          gte: weekStart,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    // Get this month's earnings
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEarnings = await this.prisma.driverEarning.aggregate({
      where: {
        driverId: profile.driverProfile.id,
        earnedAt: {
          gte: monthStart,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    return {
      rating: profile.driverProfile.rating.toString(),
      totalDeliveries: profile.driverProfile.totalDeliveries,
      completionRate: profile.driverProfile.completionRate.toString(),
      totalEarnings: profile.driverProfile.totalEarnings.toString(),
      today: {
        deliveries: todayEarnings._count,
        earnings: todayEarnings._sum.totalAmount?.toString() || '0',
      },
      thisWeek: {
        deliveries: weekEarnings._count,
        earnings: weekEarnings._sum.totalAmount?.toString() || '0',
      },
      thisMonth: {
        deliveries: monthEarnings._count,
        earnings: monthEarnings._sum.totalAmount?.toString() || '0',
      },
    };
  }
}
