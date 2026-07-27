import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum BroadcastTarget {
  ALL_DRIVERS       = 'all_drivers',
  ONLINE_DRIVERS    = 'online_drivers',
  SPECIFIC_USERS    = 'specific_users',
}

export class BroadcastNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsEnum(BroadcastTarget)
  target: BroadcastTarget;

  /** Required when target = SPECIFIC_USERS */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  /** Required when target = DRIVERS_BY_STATUS */
  @IsOptional()
  @IsString()
  driverStatus?: string;

  @IsOptional()
  data?: Record<string, string>;
}

export class RegisterTokenDto {
  @IsString()
  token: string;

  @IsString()
  platform: string; // ios | android | web

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;
}
