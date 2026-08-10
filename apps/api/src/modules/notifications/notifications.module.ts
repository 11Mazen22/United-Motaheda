import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthModule } from '../../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { DriverModule } from '../driver/driver.module';

@Module({
  imports: [AuthModule, DriverModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
