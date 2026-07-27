import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDriverDto, LoginDriverDto } from './dto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class DriverAuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  private readonly JWT_EXPIRES_IN = '30d';

  constructor(private readonly prisma: PrismaService) {}

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

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // In production, you'd use Supabase Auth API to create the auth.users entry
    // For now, we'll create the profile directly
    // NOTE: This requires the auth.users entry to exist first in production

    try {
      // Create profile with driver role
      const profile = await this.prisma.profiles.create({
        data: {
          id: crypto.randomUUID(), // In production, this comes from Supabase Auth
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

      // Generate JWT token
      const token = this.generateToken(profile.id, 'driver');

      return {
        token,
        driver: {
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
            status: driverProfile.status,
            rating: driverProfile.rating,
            totalDeliveries: driverProfile.totalDeliveries,
          },
        },
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
    // Find driver by email or phone
    const profile = await this.prisma.profiles.findFirst({
      where: {
        OR: [
          { email: dto.emailOrPhone },
          { phone: dto.emailOrPhone },
        ],
        role: 'driver',
      },
      include: {
        driverProfile: true,
      },
    });

    if (!profile || !profile.driverProfile) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // In production, verify password against Supabase Auth
    // For now, we'll use a placeholder verification
    // const isPasswordValid = await bcrypt.compare(dto.password, hashedPassword);
    
    // Temporarily allow any password for development
    // TODO: Integrate with Supabase Auth for production
    const isPasswordValid = true; // Replace with actual password verification

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if driver is approved
    if (profile.driverProfile.status === 'REJECTED') {
      throw new UnauthorizedException('Your driver application was rejected');
    }

    if (profile.driverProfile.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    // Generate JWT token
    const token = this.generateToken(profile.id, 'driver');

    return {
      token,
      driver: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        driverProfile: {
          id: profile.driverProfile.id,
          vehicleType: profile.driverProfile.vehicleType,
          vehiclePlate: profile.driverProfile.vehiclePlate,
          vehicleModel: profile.driverProfile.vehicleModel,
          vehicleColor: profile.driverProfile.vehicleColor,
          status: profile.driverProfile.status,
          isOnline: profile.driverProfile.isOnline,
          rating: profile.driverProfile.rating.toString(),
          totalDeliveries: profile.driverProfile.totalDeliveries,
          completionRate: profile.driverProfile.completionRate.toString(),
          totalEarnings: profile.driverProfile.totalEarnings.toString(),
        },
      },
    };
  }

  /**
   * Verify JWT token and return driver profile
   */
  async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: string; role: string };
      
      if (decoded.role !== 'driver') {
        throw new UnauthorizedException('Invalid token');
      }

      const profile = await this.prisma.profiles.findUnique({
        where: { id: decoded.userId },
        include: {
          driverProfile: true,
        },
      });

      if (!profile || !profile.driverProfile) {
        throw new UnauthorizedException('Driver not found');
      }

      return {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        driverProfile: profile.driverProfile,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string, role: string): string {
    return jwt.sign(
      { userId, role },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }
}
