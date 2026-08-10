import { IsEmail, IsString, IsOptional, MinLength, IsEnum } from 'class-validator';

export enum VehicleType {
  MOTORCYCLE = 'motorcycle',
  CAR = 'car',
  VAN = 'van',
  BICYCLE = 'bicycle',
  SCOOTER = 'scooter',
}

export class RegisterDriverDto {
  @IsString()
  @MinLength(3)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  vehicleModel?: string;

  @IsOptional()
  @IsString()
  vehicleColor?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  licenseExpiry?: string; // ISO date string
}
