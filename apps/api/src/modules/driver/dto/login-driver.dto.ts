import { IsString } from 'class-validator';

export class LoginDriverDto {
  @IsString()
  emailOrPhone: string;

  @IsString()
  password: string;
}
