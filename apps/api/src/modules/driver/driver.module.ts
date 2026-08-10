import { Module, forwardRef } from '@nestjs/common';
import { DriverController } from './driver.controller';
import { AdminDriverController } from './admin-driver.controller';
import { DriverAuthService } from './driver-auth.service';
import { DriverProfileService } from './driver-profile.service';
import { DriverLocationService } from './driver-location.service';
import { DriverOrdersService } from './driver-orders.service';
import { FileUploadService } from './file-upload.service';
import { LocationBroadcastGateway } from './location-broadcast.gateway';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DriverController, AdminDriverController],
  providers: [
    DriverAuthService,
    DriverProfileService,
    DriverLocationService,
    DriverOrdersService,
    FileUploadService,
    LocationBroadcastGateway,
  ],
  exports: [
    DriverAuthService,
    DriverProfileService,
    DriverLocationService,
    DriverOrdersService,
    FileUploadService,
    LocationBroadcastGateway,
  ],
})
export class DriverModule {}
