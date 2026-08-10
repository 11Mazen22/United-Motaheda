import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDriverDto, LoginDriverDto } from './dto';
import { SupabaseAuthService } from '../../auth/supabase-auth.service';

@Injectable()
export class DriverAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: SupabaseAuthService,
  ) {}

  /**
   * Register a new driver with profile and vehicle information
   */
  async register(dto: RegisterDriverDto) {
    // Check if email or phone already exists
    const existingProfile = await this.prisma.profiles.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { phone: dto.phone },
        ],
      },
    });

    if (existingProfile) {
      throw new ConflictException('Email or phone already registered');
    }

    try {
      const authUser = await this.authService.createUser({
        email: dto.email,
        password: dto.password,
        phone: dto.phone,
        fullName: dto.fullName,
      });

      // Create profile with driver role
      const profile = await this.prisma.profiles.upsert({
        where: { id: authUser.id },
        create: {
          id: authUser.id,
          full_name: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          role: 'driver',
          status: 'Active',
        },
        update: {
          full_name: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          role: 'driver',
          status: 'Active',
        },
      });

      // Create driver profile
      const driverProfile = await this.prisma.driverProfile.create({
        data: {
          userId: profile.id,
          vehicleType: dto.vehicleType,
          vehiclePlate: dto.vehiclePlate,
          vehicleModel: dto.vehicleModel,
          vehicleColor: dto.vehicleColor,
          licenseNumber: dto.licenseNumber,
          licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : null,
          status: 'PENDING_APPROVAL', // Requires admin approval
        },
      });

      const session = await this.authService.signIn(dto.email, dto.password);
      const driver = this.toDriverResponse(profile, driverProfile);

      return {
        token: session.session.access_token,
        user: driver,
        driver,
      };
    } catch (error) {
      console.error('Driver registration error:', error);
      throw new BadRequestException('Failed to register driver');
    }
  }

  /**
   * Login driver with email/phone and password
   */
  async login(dto: LoginDriverDto) {
    const identifier = dto.emailOrPhone ?? dto.identifier;
    const session = await this.authService.signIn(identifier, dto.password);
    const profile = await this.prisma.profiles.findFirst({
      where: {
        id: session.user.id,
      },
      include: {
        driverProfile: true,
      },
    });

    if (!profile || !profile.driverProfile) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if driver is approved
    if (profile.driverProfile.status === 'REJECTED') {
      throw new UnauthorizedException('Your driver application was rejected');
    }

    if (profile.driverProfile.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    const driver = this.toDriverResponse(profile, profile.driverProfile);
    return {
      token: session.session.access_token,
      user: driver,
      driver,
    };
  }

  private toDriverResponse(profile: any, driverProfile: any) {
    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      driverProfile: {
        id: driverProfile.id,
        vehicleType: driverProfile.vehicleType,
        vehiclePlate: driverProfile.vehiclePlate,
        vehicleModel: driverProfile.vehicleModel,
        vehicleColor: driverProfile.vehicleColor,
        status: driverProfile.status,
        isOnline: driverProfile.isOnline,
        rating: driverProfile.rating.toString(),
        totalDeliveries: driverProfile.totalDeliveries,
        completionRate: driverProfile.completionRate.toString(),
        totalEarnings: driverProfile.totalEarnings.toString(),
      },
    };
  }
}
