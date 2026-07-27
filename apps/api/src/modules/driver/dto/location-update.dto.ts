import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class LocationUpdateDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(0)
  accuracy: number; // meters

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number; // degrees (0-360)

  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number; // m/s

  @IsOptional()
  @IsNumber()
  altitude?: number; // meters

  @IsOptional()
  @IsNumber()
  timestamp?: number; // Unix timestamp in milliseconds
}