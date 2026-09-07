/**
 * Notifications Controller
 * 
 * Updated to work with the new Notification Hub Service.
 * All methods now use the centralized NotificationsService.
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// ============================================================
// DTOs
// ============================================================

export class RegisterDeviceDto {
  deviceToken: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
}

export class MarkReadDto {
  notificationId: string;
}

export class GetNotificationsQueryDto {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  type?: string;
}

// ============================================================
// Controller
// ============================================================

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  /**
   * Get all notifications for the current user
   */
  @Get()
  async getMyNotifications(
    @Request() req,
    @Query() query: GetNotificationsQueryDto,
  ) {
    const userId = req.user.id;
    const { limit = 20, offset = 0, unreadOnly = false, type } = query;

    return this.notificationsService.getUserNotifications(userId, {
      limit,
      offset,
      unreadOnly,
      type,
    });
  }

  /**
   * Get unread notification count
   */
  @Get('unread/count')
  async getUnreadCount(@Request() req) {
    const userId = req.user.id;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark a notification as read
   */
  @Put('read')
  async markAsRead(@Request() req, @Body() dto: MarkReadDto) {
    const userId = req.user.id;
    const success = await this.notificationsService.markAsRead(
      dto.notificationId,
      userId,
    );
    return { success };
  }

  /**
   * Mark all notifications as read
   */
  @Put('read/all')
  async markAllAsRead(@Request() req) {
    const userId = req.user.id;
    const count = await this.notificationsService.markAllAsRead(userId);
    return { count };
  }

  /**
   * Delete a notification
   */
  @Delete(':id')
  async deleteNotification(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    const success = await this.notificationsService.deleteNotification(id, userId);
    return { success };
  }

  /**
   * Register a device for push notifications
   */
  @Post('register')
  async registerDevice(@Request() req, @Body() dto: RegisterDeviceDto) {
    const userId = req.user.id;
    const success = await this.notificationsService.registerDevice({
      userId,
      deviceToken: dto.deviceToken,
      platform: dto.platform,
      appVersion: dto.appVersion,
      deviceModel: dto.deviceModel,
      osVersion: dto.osVersion,
    });
    return { success };
  }

  /**
   * Unregister a device (logout)
   */
  @Post('unregister')
  async unregisterDevice(@Body() body: { deviceToken: string }) {
    const success = await this.notificationsService.unregisterDevice(
      body.deviceToken,
    );
    return { success };
  }
}
