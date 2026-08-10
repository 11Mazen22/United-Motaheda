import { Controller, Post, Get, Body, Query, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { BroadcastNotificationDto, BroadcastTarget, RegisterTokenDto } from './dto/broadcast.dto';
import { DriverAuthGuard } from '../driver/guards/driver-auth.guard';
import { AdminAuthGuard } from '../../auth/admin-auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  // ─── Driver: register device token ────────────────────────────────────────

  @Post('token')
  @UseGuards(DriverAuthGuard)
  async registerToken(@Request() req: any, @Body() dto: RegisterTokenDto) {
    return this.svc.registerToken(req.user.userId, dto.token, dto.platform, dto.deviceId, dto.deviceName);
  }

  // ─── Driver: notification history ─────────────────────────────────────────

  @Get('history')
  @UseGuards(DriverAuthGuard)
  async getHistory(@Request() req: any, @Query('limit') limit?: string) {
    return this.svc.getNotificationHistory(req.user.userId, limit ? parseInt(limit, 10) : 50);
  }

  // ─── Admin: broadcast ─────────────────────────────────────────────────────

  @Post('broadcast')
  @UseGuards(AdminAuthGuard)
  async broadcast(@Body() dto: BroadcastNotificationDto) {
    const payload = { title: dto.title, body: dto.body, imageUrl: dto.imageUrl, data: dto.data };

    switch (dto.target) {
      case BroadcastTarget.ALL_DRIVERS:
        return this.svc.broadcastToDriversByStatus('APPROVED', payload)
          .then(r1 => this.svc.broadcastToDriversByStatus('ACTIVE', payload)
            .then(r2 => ({ sent: r1.sent + r2.sent, failed: r1.failed + r2.failed })));

      case BroadcastTarget.ONLINE_DRIVERS:
        return this.svc.broadcastToOnlineDrivers(payload);

      case BroadcastTarget.SPECIFIC_USERS:
        if (!dto.userIds?.length) return { sent: 0, failed: 0, results: [] };
        return this.svc.broadcastToMultipleUsers(dto.userIds, payload);

      default:
        return { sent: 0, failed: 0, error: 'Invalid target' };
    }
  }

  // ─── Admin: notification log ──────────────────────────────────────────────

  @Get('admin/history')
  @UseGuards(AdminAuthGuard)
  async getAdminHistory(@Query('limit') limit?: string) {
    return this.svc.getNotificationHistory(undefined, limit ? parseInt(limit, 10) : 100);
  }
}
