/**
 * Admin Notifications Controller
 * 
 * API Endpoints for admin notification management:
 * - Send manual blasts
 * - Preview templates
 * - View history
 * - View metrics (delivery rate, failures)
 * 
 * All endpoints require admin authentication.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from '../../notifications/notifications.service';
import { TemplateCompilerService } from '../../notifications/templates/template.compiler';
import { BatchProcessor } from '../../notifications/batch.processor';
import { AdminAuthGuard } from '../../../auth/admin-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Logger } from '@nestjs/common';

// ============================================================
// DTOs
// ============================================================

export class SendBlastDto {
  type: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  channels?: string[];
  priority?: 'high' | 'normal' | 'low';
  targeting: {
    userType?: 'customers' | 'drivers' | 'pharmacists' | 'all';
    branchId?: string;
    zoneId?: string;
    userIds?: string[];
  };
  schedule?: {
    sendAt: string; // ISO date
  };
}

export class PreviewTemplateDto {
  type: string;
  data: Record<string, any>;
  locale?: string;
}

export class NotificationHistoryQueryDto {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export class NotificationMetricsDto {
  startDate?: string;
  endDate?: string;
}

// ============================================================
// Controller
// ============================================================

@ApiTags('Admin Notifications')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(AdminAuthGuard, RbacGuard)
export class AdminNotificationsController {
  private readonly logger = new Logger(AdminNotificationsController.name);

  constructor(
    private notificationsService: NotificationsService,
    private templateCompiler: TemplateCompilerService,
    private batchProcessor: BatchProcessor,
  ) {}

  /**
   * Send a manual notification blast
   */
  @Post('send')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Send a manual notification blast' })
  @ApiResponse({ status: 202, description: 'Blast accepted for processing' })
  async sendBlast(@Body() dto: SendBlastDto, @Request() req) {
    this.logger.log(`Admin ${req.user.id} sending blast: ${dto.type}`);

    try {
      // Get recipients based on targeting
      const recipients = await this.getRecipients(dto.targeting);

      if (recipients.length === 0) {
        return {
          success: false,
          message: 'No recipients found for targeting criteria',
        };
      }

      // If custom title/body provided, use them; otherwise use template
      let customData: Record<string, any> = dto.data || {};

      if (dto.title && dto.body) {
        customData = {
          ...customData,
          customTitle: dto.title,
          customBody: dto.body,
        };
      }

      // Create batch
      const batchId = await this.batchProcessor.createBatch(
        dto.type,
        recipients.map(r => ({
          userId: r.id,
          data: {
            ...customData,
            ...r.data,
          },
        })),
        {
          channels: dto.channels,
          priority: dto.priority,
        }
      );

      return {
        success: true,
        batchId,
        totalRecipients: recipients.length,
        message: `Blast accepted. Processing ${recipients.length} recipients.`,
      };

    } catch (error) {
      this.logger.error(`Failed to send blast: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Preview a template with data
   */
  @Post('preview')
  @Roles('admin', 'super_admin', 'manager')
  @ApiOperation({ summary: 'Preview a notification template' })
  @ApiResponse({ status: 200, description: 'Template preview' })
  async previewTemplate(@Body() dto: PreviewTemplateDto) {
    this.logger.log(`Previewing template: ${dto.type}`);

    try {
      const compiled = await this.templateCompiler.compileTemplate(
        dto.type,
        dto.data,
        { locale: dto.locale }
      );

      if (!compiled) {
        return {
          success: false,
          message: 'Template not found',
        };
      }

      return {
        success: true,
        data: compiled,
      };

    } catch (error) {
      this.logger.error(`Failed to preview template: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get notification history
   */
  @Get('history')
  @Roles('admin', 'super_admin', 'manager')
  @ApiOperation({ summary: 'Get notification history' })
  @ApiResponse({ status: 200, description: 'Notification history' })
  async getHistory(@Query() query: NotificationHistoryQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    try {
      // Get batches
      const batches = await this.batchProcessor.getAllBatches(limit, offset);

      // Get recent notifications
      // This would be a more complex query in production

      return {
        success: true,
        data: {
          batches,
          pagination: {
            page,
            limit,
            offset,
          },
        },
      };

    } catch (error) {
      this.logger.error(`Failed to get history: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get notification metrics
   */
  @Get('metrics')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get notification metrics' })
  @ApiResponse({ status: 200, description: 'Notification metrics' })
  async getMetrics(@Query() query: NotificationMetricsDto) {
    try {
      // This would query the database for real metrics
      // For now, return placeholder data
      return {
        success: true,
        data: {
          totalSent: 15234,
          totalDelivered: 14892,
          deliveryRate: 97.8,
          failed: 342,
          byType: {
            'order.ready': 5234,
            'order.out_for_delivery': 4210,
            'payment.success': 3456,
            'system.announcement': 1234,
          },
          byChannel: {
            push: 8923,
            in_app: 8923,
            email: 2345,
            sms: 1234,
          },
          dailyTrend: [
            { date: '2026-09-01', sent: 450 },
            { date: '2026-09-02', sent: 520 },
            { date: '2026-09-03', sent: 480 },
          ],
          period: {
            startDate: query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: query.endDate || new Date().toISOString(),
          },
        },
      };

    } catch (error) {
      this.logger.error(`Failed to get metrics: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get batch status
   */
  @Get('batches/:batchId')
  @Roles('admin', 'super_admin', 'manager')
  @ApiOperation({ summary: 'Get batch status' })
  @ApiResponse({ status: 200, description: 'Batch status' })
  async getBatchStatus(@Param('batchId') batchId: string) {
    try {
      const status = await this.batchProcessor.getBatchStatus(batchId);

      if (!status) {
        return {
          success: false,
          message: 'Batch not found',
        };
      }

      return {
        success: true,
        data: status,
      };

    } catch (error) {
      this.logger.error(`Failed to get batch status: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get all templates
   */
  @Get('templates')
  @Roles('admin', 'super_admin', 'manager')
  @ApiOperation({ summary: 'Get all notification templates' })
  @ApiResponse({ status: 200, description: 'All templates' })
  async getTemplates() {
    try {
      const templates = await this.templateCompiler.getAllTemplates();

      return {
        success: true,
        data: templates,
      };

    } catch (error) {
      this.logger.error(`Failed to get templates: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get recipients based on targeting criteria
   */
  private async getRecipients(targeting: SendBlastDto['targeting']): Promise<Array<{ id: string; data?: Record<string, any> }>> {
    // This would query the database based on targeting criteria
    // For now, return placeholder data

    // In production, you would:
    // 1. Query users table with filters
    // 2. Join with user_devices for active tokens
    // 3. Filter by branch/zone if specified

    // Placeholder: return some mock users
    return [
      { id: 'user-1', data: { userName: 'Ahmed' } },
      { id: 'user-2', data: { userName: 'Mohamed' } },
      { id: 'user-3', data: { userName: 'Sara' } },
    ];
  }
}