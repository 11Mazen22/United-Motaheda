import { Injectable } from '@nestjs/common';
import { RoleAuthGuard } from './role-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';

@Injectable()
export class AdminAuthGuard extends RoleAuthGuard {
  constructor(authService: SupabaseAuthService) {
    super(authService, 'admin');
  }
}