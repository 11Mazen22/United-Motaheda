/**
 * In-App Channel Service
 * 
 * Handles storing notifications in the database for display
 * inside the mobile app's notification center (inbox).
 * 
 * Features:
 * - Store notifications with read/unread tracking
 * - Mark notifications as read
 * - Get unread count
 * - Pagination support
 * - Soft delete
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

export interface InAppPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  type: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface InAppResult {
  status: 'sent' | 'failed';
  notificationId?: string;
  error?: string;
}

export interface NotificationFilters {
  unreadOnly?: boolean;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class InAppChannelService {
  private readonly logger = new Logger(InAppChannelService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Send in-app notification (store in database)
   */
  async send(payload: InAppPayload): Promise<InAppResult> {
    try {
      this.logger.debug(`Sending in-app notification to user: ${payload.userId}`);

      const notificationId = uuidv4();

      const { error } = await this.supabase
        .from('notifications')
        .insert({
          id: notificationId,
          user_id: payload.userId,
          type: payload.type,
          channel: 'in_app',
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          priority: payload.priority || 'normal',
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      this.logger.debug(`In-app notification stored: ${notificationId}`);

      return {
        status: 'sent',
        notificationId,
      };

    } catch (error) {
      this.logger.error(`Failed to send in-app notification: ${error.message}`);
      return {
        status: 'failed',
        error: error.message,
      };
    }
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
   * Get total notification count for a user
   */
  async getTotalCount(userId: string): Promise<number> {
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
   * Get notifications for a user with pagination
   */
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      filters?: NotificationFilters;
    } = {}
  ): Promise<{
    data: any[];
    total: number;
    unreadCount: number;
  }> {
    const { limit = 20, offset = 0, filters = {} } = options;

    try {
      let query = this.supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters.unreadOnly) {
        query = query.is('read_at', null);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
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

  /**
   * Get a single notification by ID
   */
  async getNotification(notificationId: string, userId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      this.logger.error(`Failed to get notification: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete a notification (soft delete or hard delete)
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
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
   * Get notifications by type
   */
  async getNotificationsByType(
    userId: string,
    type: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{
    data: any[];
    total: number;
  }> {
    const { limit = 20, offset = 0 } = options;

    try {
      const { data, error, count } = await this.supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('type', type)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
      };

    } catch (error) {
      this.logger.error(`Failed to get notifications by type: ${error.message}`);
      return {
        data: [],
        total: 0,
      };
    }
  }

  /**
   * Get recent notifications (last 24 hours)
   */
  async getRecentNotifications(userId: string): Promise<any[]> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];

    } catch (error) {
      this.logger.error(`Failed to get recent notifications: ${error.message}`);
      return [];
    }
  }

  /**
   * Bulk store notifications for multiple users
   */
  async sendBulk(
    payloads: InAppPayload[]
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    let successful = 0;
    let failed = 0;

    for (const payload of payloads) {
      const result = await this.send(payload);
      if (result.status === 'sent') {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: payloads.length,
      successful,
      failed,
    };
  }

  /**
   * Get notification statistics for a user
   */
  async getStats(userId: string): Promise<{
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
        .select('type', { count: 'exact' })
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
      this.logger.error(`Failed to get stats: ${error.message}`);
      return {
        total: 0,
        unread: 0,
        read: 0,
        byType: {},
      };
    }
  }
}