import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { SupabaseAuthService } from '../../auth/supabase-auth.service';

class AdminLoginDto {
  @IsString()
  identifier: string;

  @IsString()
  password: string;
}

@Controller('admin')
export class AdminAuthController {
  constructor(private readonly authService: SupabaseAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginDto) {
    const session = await this.authService.signIn(dto.identifier, dto.password);
    const authenticated = await this.authService.authenticateAccessToken(session.session.access_token);
    if (authenticated.profile.role !== 'admin') {
      throw new ForbiddenException('Admin credentials required');
    }

    return {
      token: session.session.access_token,
      user: {
        id: authenticated.profile.id,
        fullName: authenticated.profile.full_name,
        email: authenticated.profile.email,
        phone: authenticated.profile.phone,
        role: authenticated.profile.role,
      },
    };
  }
}