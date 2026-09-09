import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
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
    @Inject(forwardRef(() => PrismaService))
    private prisma: PrismaService,
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
    const targetChannels = await this.filterByPreferences(userId, type, channels || definition.supportedChannels);
    // If no channels are allowed after preferences filtering, abort without recording or sending
    if (targetChannels.length === 0) {
      this.logger.warn(`All channels filtered out by user preferences for notification type ${type}`);
      return { notificationId: uuidv4(), success: false, channels: [] };
    }
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
      idempotencyKey,
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

  private async filterByPreferences(
    userId: string,
    type: string,
    channels: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', userId)
        .single();

      if (error || !data?.notification_preferences) return channels;

      const prefs = data.notification_preferences as {
        channels?: Record<string, boolean>;
        categories?: Record<string, boolean>;
      };

      // Extract the category key from the notification type (e.g. "order.created"   "order_updates")
      const categoryMap: Record<string, string> = {
        'order.': 'order_updates',
        'promotion.': 'promotions',
        'security.': 'security_alerts',
        'health.': 'health_reminders',
        'product.': 'new_arrivals',
        'account.': 'account_updates',
      };
      let categoryKey: string | undefined;
      for (const [prefix, cat] of Object.entries(categoryMap)) {
        if (type.startsWith(prefix)) { categoryKey = cat; break; }
      }

      // If the category is disabled globally, suppress all channels.
      if (categoryKey && prefs.categories?.[categoryKey] === false) {
        return [];
      }

      // Filter channels by per-channel toggle.
      return channels.filter((ch) => {
        const channelKey = ch === 'in_app' ? 'push' : ch; // in_app uses push toggle
        return prefs.channels?.[channelKey] !== false;
      });
    } catch {
      // If preference fetch fails, allow delivery (fail-open).
      return channels;
    }
  }


  private async enqueueOutbox(params: {
    notificationId: string;
    recipientId: string;
    type: string;
    title: string;
    body: string;
    payload: Record<string, any>;
    priority: NotificationPriority;
    idempotencyKey?: string;
  }, tx?: Prisma.TransactionClient): Promise<boolean> {
    try {
      const payload = {
        notification_id: params.notificationId,
        recipient_id: params.recipientId,
        event_type: params.type,
        title: params.title,
        body: params.body,
        payload: params.payload || {},
        idempotency_key: params.idempotencyKey ?? `${params.notificationId}-push`,
        status: 'queued',
        attempts: 0,
        next_attempt_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      if (tx) {
        await tx.notification_outbox.create({ data: payload });
      } else if (this.prisma) {
        await this.prisma.notification_outbox.create({ data: payload });
      } else {
        const { error } = await this.supabase.from('notification_outbox').insert({ ...payload, next_attempt_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`enqueueOutbox error: ${err.message}`);
      if (tx) throw err;
      return false;
    }
  }

  private async sendThroughChannels(
params: {
    notificationId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, any>;
    channels: NotificationChannel[];
    priority: NotificationPriority;
    idempotencyKey?: string;
  }, tx?: Prisma.TransactionClient): Promise<{ channel: NotificationChannel; status: NotificationStatus; error?: string }[]> {
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
            const enqueued = await this.enqueueOutbox({
              notificationId: params.notificationId,
              recipientId: params.userId,
              type: params.type,
              title: params.title,
              body: params.body,
              payload: params.data,
              priority: params.priority,
              idempotencyKey: params.idempotencyKey,
            }, tx);
            result = {
              status: enqueued ? 'sent' : 'failed',
              error: enqueued ? undefined : 'Failed to enqueue push notification',
            };
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
    idempotencyKey?: string;
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
          idempotency_key: params.idempotencyKey,
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
    options: Omit<SendNotificationOptions, 'userId' | 'data' | 'type'> = {}
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
          updated_at: new Date().toISOString(),
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

  // ============================================================
  // 🆕 NEW METHODS ADDED FOR CONTROLLER COMPATIBILITY
  // ============================================================

  /**
   * Register a device for push notifications
   */
  async registerDevice(params: {
    userId: string;
    deviceToken: string;
    platform: 'ios' | 'android' | 'web';
    appVersion?: string;
    deviceModel?: string;
    osVersion?: string;
  }): Promise<boolean> {
    try {
      // Check if device already exists
      const { data: existing } = await this.supabase
        .from('user_devices')
        .select('id')
        .eq('device_token', params.deviceToken)
        .single();

      if (existing) {
        // Update existing device
        const { error } = await this.supabase
          .from('user_devices')
          .update({
            user_id: params.userId,
            platform: params.platform,
            app_version: params.appVersion,
            device_model: params.deviceModel,
            os_version: params.osVersion,
            is_active: true,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('device_token', params.deviceToken);

        if (error) throw error;
        this.logger.log(`Updated device token for user ${params.userId}`);
        return true;
      }

      // Create new device
      const { error } = await this.supabase
        .from('user_devices')
        .insert({
          user_id: params.userId,
          device_token: params.deviceToken,
          platform: params.platform,
          app_version: params.appVersion,
          device_model: params.deviceModel,
          os_version: params.osVersion,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      this.logger.log(`Registered new device token for user ${params.userId}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to register device: ${error.message}`);
      return false;
    }
  }

  /**
   * Unregister a device (logout)
   */
  async unregisterDevice(deviceToken: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('user_devices')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('device_token', deviceToken);

      if (error) throw error;
      this.logger.log(`Unregistered device token`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to unregister device: ${error.message}`);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .update({
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .is('read_at', null)
        .select('id');

      if (error) throw error;

      const count = data?.length || 0;
      this.logger.log(`Marked ${count} notifications as read for user ${userId}`);
      return count;

    } catch (error) {
      this.logger.error(`Failed to mark all as read: ${error.message}`);
      return 0;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
      this.logger.log(`Deleted notification ${notificationId} for user ${userId}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .select('id');

      if (error) throw error;

      const count = data?.length || 0;
      this.logger.log(`Deleted ${count} notifications for user ${userId}`);
      return count;

    } catch (error) {
      this.logger.error(`Failed to delete all notifications: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get notification stats for a user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    read: number;
    byType: Record<string, number>;
  }> {
    try {
      // Get total and unread
      const total = await this.getTotalCount(userId);
      const unread = await this.getUnreadCount(userId);

      // Get counts by type
      const { data, error } = await this.supabase
        .from('notifications')
        .select('type')
        .eq('user_id', userId);

      if (error) throw error;

      const byType: Record<string, number> = {};
      for (const item of data || []) {
        byType[item.type] = (byType[item.type] || 0) + 1;
      }

      return {
        total,
        unread,
        read: total - unread,
        byType,
      };

    } catch (error) {
      this.logger.error(`Failed to get notification stats: ${error.message}`);
      return {
        total: 0,
        unread: 0,
        read: 0,
        byType: {},
      };
    }
  }

  /**
   * Get total notification count for a user
   */
  private async getTotalCount(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId);

      if (error) throw error;
      return data?.length || 0;

    } catch (error) {
      this.logger.error(`Failed to get total count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Add job to queue (for BullMQ integration)
   * This is a placeholder - actual implementation uses @nestjs/bull
   */
  async addJob(queueName: string, data: any): Promise<void> {
    // This will be implemented with @nestjs/bull
    // For now, just log
    this.logger.debug(`Adding job to queue ${queueName}:`, data);
  }
}
