import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminAuthController, AdminOperationsController],
  providers: [AdminOperationsService],
})
export class AdminModule {}