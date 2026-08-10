import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { DriverAuthGuard } from './driver-auth.guard';
import { RoleAuthGuard } from './role-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  imports: [PrismaModule],
  providers: [SupabaseAuthService, DriverAuthGuard, AdminAuthGuard],
  exports: [SupabaseAuthService, DriverAuthGuard, AdminAuthGuard],
})
export class AuthModule {}