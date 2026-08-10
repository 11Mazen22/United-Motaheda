import { Injectable } from '@nestjs/common';
import { RoleAuthGuard } from './role-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';

@Injectable()
export class DriverAuthGuard extends RoleAuthGuard {
  constructor(authService: SupabaseAuthService) {
    super(authService, 'driver');
  }
}