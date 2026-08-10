import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { SupabaseAuthService } from './supabase-auth.service';

@Injectable()
export class RoleAuthGuard implements CanActivate {
  constructor(
    private readonly authService: SupabaseAuthService,
    private readonly requiredRole: 'admin' | 'driver',
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.readBearerToken(request.headers.authorization);
    const authenticated = await this.authService.authenticateAccessToken(token);

    if (authenticated.profile.role !== this.requiredRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.user = {
      userId: authenticated.userId,
      id: authenticated.userId,
      role: authenticated.profile.role,
      profile: authenticated.profile,
      driverProfile: authenticated.profile.driverProfile,
    };
    return true;
  }

  private readBearerToken(header?: string) {
    const [scheme, token] = (header ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }
    return token;
  }
}