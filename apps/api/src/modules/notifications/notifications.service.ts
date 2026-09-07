/**
 * Notification Hub Service
 * 
 * Centralized notification service that acts as the single gateway
 * for all notification sending in the system.
 * 
 * Features:
 * - Multi-channel support (in_app, push, email, sms)
 * - Template compilation
 * - Event-driven architecture
 * - Idempotency protection
 * - Delivery tracking
 * - Batch processing
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import {
  NotificationTypeDefinition,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NOTIFICATION_REGISTRY,
  getNotificationDefinition,
  isValidNotificationType,
  validateNotificationData,
} from './registry/notification.registry';

import { TemplateCompilerService } from './templates/template.compiler';
import { PushChannelService } from './channels/push.channel';
import { InAppChannelService } from './channels/in-app.channel';

export interface SendNotificationOptions {
  /** Notification type (must be registered) */
  type: string;
  /** Recipient user ID */
  userId: string;
  /** Data for template compilation */
  data: Record<string, any>;
  /** Optional: force specific channels */
  channels?: NotificationChannel[];
  /** Optional: override priority */
  priority?: NotificationPriority;
  /** Optional: prevent duplicate delivery */
  idempotencyKey?: string;
}

export interface NotificationResult {
  notificationId: string;
  success: boolean;
  channels: {
    channel: NotificationChannel;
    status: NotificationStatus;
    error?: string;
  }[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private supabase: SupabaseClient;
  private readonly BATCH_SIZE = 100;

  constructor(
    private configService: ConfigService,
    private templateCompiler: TemplateCompilerService,
    private pushChannel: PushChannelService,
    private inAppChannel: InAppChannelService,
    private eventEmitter: EventEmitter2,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Main entry point for sending notifications
   * 
   * @param options - Notification options
   * @returns Promise<NotificationResult>
   */
  async send(options: SendNotificationOptions): Promise<NotificationResult> {
    const { type, userId, data, channels, priority, idempotencyKey } = options;

    this.logger.debug(`Sending notification: ${type} to user: ${userId}`);

    // 1. Validate notification type
    if (!isValidNotificationType(type)) {
      throw new Error(`Invalid notification type: ${type}`);
    }

    const definition = getNotificationDefinition(type);

    // 2. Validate required data
    const validation = validateNotificationData(type, data);
    if (!validation.valid) {
      throw new Error(
        `Missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    // 3. Check idempotency (prevent duplicates)
    if (idempotencyKey) {
      const isDuplicate = await this.checkIdempotency(idempotencyKey, type, userId);
      if (isDuplicate) {
        this.logger.warn(`Duplicate notification prevented: ${idempotencyKey}`);
        return {
          notificationId: idempotencyKey,
          success: false,
          channels: [],
        };
      }
    }

    // 4. Compile template
    const compiled = await this.templateCompiler.compileTemplate(type, data, {
      locale: await this.getUserLocale(userId),
    });

    if (!compiled) {
      throw new Error(`Failed to compile template for type: ${type}`);
    }

    // 5. Determine channels to use
    const targetChannels = channels || definition.supportedChannels;
    const targetPriority = priority || definition.defaultPriority;

    // 6. Create notification record
    const notificationId = uuidv4();
    await this.createNotification({
      id: notificationId,
      userId,
      type,
      title: compiled.title,
      body: compiled.body,
      data,
      priority: targetPriority,
      channel: targetChannels[0], // Primary channel
    });

    // 7. Send through each channel
    const channelResults = await this.sendThroughChannels({
      notificationId,
      userId,
      type,
      title: compiled.title,
      body: compiled.body,
      data,
      channels: targetChannels,
      priority: targetPriority,
      idempotencyKey,
    });

    // 8. Track delivery
    await this.trackDelivery({
      notificationId,
      userId,
      results: channelResults,
    });

    // 9. Emit event for analytics/audit
    this.eventEmitter.emit('notification.sent', {
      notificationId,
      userId,
      type,
      channels: targetChannels,
      status: channelResults.some(r => r.status === 'sent') ? 'sent' : 'failed',
    });

    return {
      notificationId,
      success: channelResults.some(r => r.status === 'sent' || r.status === 'delivered'),
      channels: channelResults,
    };
  }

  /**
   * Send notification through multiple channels
   */
  private async sendThroughChannels(params: {
    notificationId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, any>;
    channels: NotificationChannel[];
    priority: NotificationPriority;
    idempotencyKey?: string;
  }): Promise<{ channel: NotificationChannel; status: NotificationStatus; error?: string }[]> {
    const results = [];

    for (const channel of params.channels) {
      try {
        let result: { status: NotificationStatus; error?: string };

        switch (channel) {
          case 'in_app':
            result = await this.inAppChannel.send({
              userId: params.userId,
              title: params.title,
              body: params.body,
              data: params.data,
              type: params.type,
            });
            break;

          case 'push':
            result = await this.pushChannel.send({
              userId: params.userId,
              title: params.title,
              body: params.body,
              data: params.data,
              type: params.type,
              priority: params.priority,
            });
            break;

          case 'email':
            // TODO: Implement email channel
            result = { status: 'failed', error: 'Email channel not implemented' };
            break;

          case 'sms':
            // TODO: Implement SMS channel
            result = { status: 'failed', error: 'SMS channel not implemented' };
            break;

          default:
            result = { status: 'failed', error: `Unknown channel: ${channel}` };
        }

        // Record delivery log
        await this.recordDelivery({
          notificationId: params.notificationId,
          userId: params.userId,
          channel,
          status: result.status,
          errorMessage: result.error,
        });

        results.push({
          channel,
          status: result.status,
          error: result.error,
        });

      } catch (error) {
        this.logger.error(`Error sending via ${channel}: ${error.message}`);
        results.push({
          channel,
          status: 'failed',
          error: error.message,
        });

        // Record failed delivery
        await this.recordDelivery({
          notificationId: params.notificationId,
          userId: params.userId,
          channel,
          status: 'failed',
          errorMessage: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Create notification record in database
   */
  private async createNotification(params: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, any>;
    priority: NotificationPriority;
    channel: NotificationChannel;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          id: params.id,
          user_id: params.userId,
          type: params.type,
          channel: params.channel,
          title: params.title,
          body: params.body,
          data: params.data || {},
          priority: params.priority,
          created_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.error(`Failed to create notification: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`Error creating notification: ${error.message}`);
    }
  }

  /**
   * Record delivery log
   */
  private async recordDelivery(params: {
    notificationId: string;
    userId: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notification_deliveries')
        .insert({
          notification_id: params.notificationId,
          recipient_id: params.userId,
          channel: params.channel,
          status: params.status,
          error_message: params.errorMessage,
          sent_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.error(`Failed to record delivery: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`Error recording delivery: ${error.message}`);
    }
  }

  /**
   * Track overall delivery status
   */
  private async trackDelivery(params: {
    notificationId: string;
    userId: string;
    results: { channel: NotificationChannel; status: NotificationStatus; error?: string }[];
  }): Promise<void> {
    try {
      const allSent = params.results.every(r => r.status === 'sent' || r.status === 'delivered');
      const someSent = params.results.some(r => r.status === 'sent' || r.status === 'delivered');

      const status = allSent ? 'delivered' : someSent ? 'sent' : 'failed';

      const { error } = await this.supabase
        .from('notifications')
        .update({
          delivered_at: status === 'delivered' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.notificationId);

      if (error) {
        this.logger.error(`Failed to track delivery: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(`Error tracking delivery: ${error.message}`);
    }
  }

  /**
   * Check idempotency to prevent duplicate notifications
   */
  private async checkIdempotency(
    key: string,
    type: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('idempotency_key', key)
        .limit(1);

      if (error) {
        this.logger.error(`Idempotency check failed: ${error.message}`);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      this.logger.error(`Error checking idempotency: ${error.message}`);
      return false;
    }
  }

  /**
   * Get user's preferred locale
   */
  private async getUserLocale(userId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('locale')
        .eq('id', userId)
        .single();

      if (error) {
        return 'ar'; // Default to Arabic
      }

      return data?.locale || 'ar';
    } catch (error) {
      return 'ar';
    }
  }

  /**
   * Send batch notification to multiple users
   */
  async sendBatch(
    type: string,
    recipients: { userId: string; data: Record<string, any> }[],
    options: Omit<SendNotificationOptions, 'userId' | 'data'> = {}
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: NotificationResult[];
  }> {
    this.logger.log(`Sending batch notification: ${type} to ${recipients.length} users`);

    const results: NotificationResult[] = [];
    let successful = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < recipients.length; i += this.BATCH_SIZE) {
      const batch = recipients.slice(i, i + this.BATCH_SIZE);
      
      const batchPromises = batch.map(async (recipient) => {
        try {
          const result = await this.send({
            type,
            userId: recipient.userId,
            data: recipient.data,
            ...options,
          });
          
          if (result.success) {
            successful++;
          } else {
            failed++;
          }
          
          return result;
        } catch (error) {
          failed++;
          return {
            notificationId: uuidv4(),
            success: false,
            channels: [],
          } as NotificationResult;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      this.logger.debug(`Batch ${i / this.BATCH_SIZE + 1} completed`);
    }

    return {
      total: recipients.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .is('read_at', null);

      if (error) throw error;
      return true;
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error.message}`);
      return false;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .is('read_at', null);

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get notifications for a user (with pagination)
   */
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: string;
    } = {}
  ): Promise<{
    data: any[];
    total: number;
    unreadCount: number;
  }> {
    const { limit = 20, offset = 0, unreadOnly = false, type } = options;

    try {
      let query = this.supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.is('read_at', null);
      }

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const unreadCount = await this.getUnreadCount(userId);

      return {
        data: data || [],
        total: count || 0,
        unreadCount,
      };
    } catch (error) {
      this.logger.error(`Failed to get user notifications: ${error.message}`);
      return {
        data: [],
        total: 0,
        unreadCount: 0,
      };
    }
  }
}