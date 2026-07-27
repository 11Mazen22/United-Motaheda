import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { VehicleType } from './register-driver.dto';

export class UpdateDriverProfileDto {
  @IsOptional()
  vehicleType?: VehicleType;

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

  @IsOptional()
  @IsString()
  licensePhotoUrl?: string;

  @IsOptional()
  @IsString()
  idPhotoUrl?: string;

  @IsOptional()
  @IsString()
  vehiclePhotoUrl?: string;

  @IsOptional()
  @IsString()
  insurancePhotoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}
