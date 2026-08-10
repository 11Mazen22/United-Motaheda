import { IsOptional, IsString } from 'class-validator';

export class LoginDriverDto {
  @IsString()
  @IsOptional()
  identifier?: string;

  @IsString()
  @IsOptional()
  emailOrPhone?: string;

  @IsString()
  password: string;
}
