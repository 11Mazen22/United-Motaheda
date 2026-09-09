import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushChannelService } from './channels/push.channel';
import { InAppChannelService } from './channels/in-app.channel';
import { TemplateCompilerService } from './templates/template.compiler';
import { BatchProcessor } from './batch.processor';
import { ExpoProvider } from '../../providers/expo.provider';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushChannelService,
    InAppChannelService,
    TemplateCompilerService,
    BatchProcessor,
    ExpoProvider,
  ],
  exports: [
    NotificationsService,
    PushChannelService,
    ExpoProvider,
  ],
})
export class NotificationsModule {}
