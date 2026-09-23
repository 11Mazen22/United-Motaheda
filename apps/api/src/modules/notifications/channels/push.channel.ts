/**
 * Push Channel Service
 * 
 * Handles sending push notifications via FCM (Firebase Cloud Messaging)
 * to iOS and Android devices.
 * 
 * Features:
 * - Multi-platform support (iOS/Android)
 * - Device token management
 * - Token invalidation on failure
 * - Priority handling
 * - Batch sending
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  type: string;
  priority?: 'high' | 'normal';
  sound?: string;
  badge?: number;
  image?: string;
}

export interface PushResult {
  status: 'sent' | 'failed' | 'delivered';
  error?: string;
  deviceTokens?: string[];
  successfulTokens?: string[];
  failedTokens?: string[];
}

@Injectable()
export class PushChannelService {
  private readonly logger = new Logger(PushChannelService.name);
  private supabase: SupabaseClient;
  private firebaseApp?: App;
  private isFirebaseInitialized = false;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Firebase
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    try {
      // Check if Firebase is already initialized
      if (getApps().length > 0) {
        this.firebaseApp = getApps()[0];
        this.isFirebaseInitialized = true;
        this.logger.log('Firebase already initialized');
        return;
      }

      const nested = this.configService.get<any>('firebase');
      const firebaseConfig = {
        projectId: nested?.projectId ?? this.configService.get<string>('FIREBASE_PROJECT_ID'),
        clientEmail: nested?.clientEmail ?? this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        privateKey: nested?.privateKey ?? this.configService.get<string>('FIREBASE_PRIVATE_KEY'),
      };
      
      if (!firebaseConfig) {
        this.logger.warn('Firebase config not found, push notifications disabled');
        return;
      }

      // Check if we have the required credentials
      if (!firebaseConfig.projectId || !firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
        this.logger.warn('Firebase credentials incomplete, push notifications disabled');
        return;
      }

      // Initialize Firebase Admin
      this.firebaseApp = initializeApp({
        credential: cert({
          projectId: firebaseConfig.projectId,
          clientEmail: firebaseConfig.clientEmail,
          privateKey: firebaseConfig.privateKey.replace(/\\n/g, '\n'),
        }),
      });

      this.isFirebaseInitialized = true;
      this.logger.log('Firebase initialized successfully');

    } catch (error) {
      this.logger.error(`Failed to initialize Firebase: ${error.message}`);
      this.isFirebaseInitialized = false;
    }
  }

  /**
   * Send push notification to a user
   */
  async send(payload: PushPayload): Promise<PushResult> {
    try {
      this.logger.debug(`Sending push to user: ${payload.userId}`);

      // Check if Firebase is initialized
      if (!this.isFirebaseInitialized) {
        return {
          status: 'failed',
          error: 'Firebase not initialized',
        };
      }

      // Get user's active devices
      const devices = await this.getUserDevices(payload.userId);

      if (devices.length === 0) {
        return {
          status: 'failed',
          error: 'No active devices found for user',
        };
      }

      const tokens = devices.map(d => d.push_token);

      // Send to all devices
      const result = await this.sendToDevices(tokens, payload);

      // Update device status if tokens failed
      if (result.failedTokens && result.failedTokens.length > 0) {
        await this.invalidateTokens(result.failedTokens);
      }

      // Update last_seen_at for successful tokens
      if (result.successfulTokens && result.successfulTokens.length > 0) {
        await this.updateDeviceActivity(result.successfulTokens);
      }

      return {
        status: result.successfulTokens && result.successfulTokens.length > 0 ? 'sent' : 'failed',
        deviceTokens: tokens,
        successfulTokens: result.successfulTokens,
        failedTokens: result.failedTokens,
        error: result.failedTokens?.length === tokens.length ? 'All devices failed' : undefined,
      };

    } catch (error) {
      this.logger.error(`Push send failed: ${error.message}`);
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Send push to multiple devices
   */


  /**
   * Get all active devices for a user
   */
  private async getUserDevices(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.error(`Failed to get user devices: ${error.message}`);
      return [];
    }
  }

  /**
   * Invalidate tokens that failed
   */
  private async invalidateTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    try {
      const { error } = await this.supabase
        .from('user_devices')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in('push_token', tokens);

      if (error) throw error;
      this.logger.log(`Invalidated ${tokens.length} tokens`);
    } catch (error) {
      this.logger.error(`Failed to invalidate tokens: ${error.message}`);
    }
  }

  /**
   * Update device activity timestamp
   */
  private async updateDeviceActivity(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    try {
      const { error } = await this.supabase
        .from('user_devices')
        .update({
          last_seen_at: new Date().toISOString(),
        })
        .in('push_token', tokens);

      if (error) throw error;
    } catch (error) {
      this.logger.error(`Failed to update device activity: ${error.message}`);
    }
  }

  /**
   * Send push notification to multiple device tokens using Firebase Admin SDK.
   * Returns successful and failed token arrays.
   */
  private async sendToDevices(tokens: string[], payload: PushPayload): Promise<{ successfulTokens: string[]; failedTokens: string[] }> {
    if (!this.isFirebaseInitialized) {
      this.logger.warn('Attempted to send push without Firebase initialized');
      return { successfulTokens: [], failedTokens: tokens };
    }
    const message: MulticastMessage = {
      data: Object.fromEntries(
        Object.entries(payload.data ?? {}).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : JSON.stringify(value),
        ]),
      ),
      notification: {
        title: payload.title,
        body: payload.body,
      },
      android: {
        priority: payload.priority === 'normal' ? 'normal' : 'high',
        notification: { channelId: 'orders', sound: payload.sound ?? 'default' },
      },
      apns: { payload: { aps: { sound: payload.sound ?? 'default' } } },
      tokens,
    };
    try {
      const response = await getMessaging(this.firebaseApp).sendEachForMulticast(message);
      const successfulTokens: string[] = [];
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          successfulTokens.push(tokens[idx]);
        } else {
          failedTokens.push(tokens[idx]);
        }
      });
      return { successfulTokens, failedTokens };
    } catch (err) {
      this.logger.error(`FCM multicast send error: ${err.message}`);
      return { successfulTokens: [], failedTokens: tokens };
    }
  }

  /**
   * Register a new device token
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
      // Check if token already exists
      const { data: existing } = await this.supabase
        .from('user_devices')
        .select('id')
        .eq('push_token', params.deviceToken)
        .single();

      if (existing) {
        // Update existing
        const { error } = await this.supabase
          .from('user_devices')
          .update({
            user_id: params.userId,
            platform: params.platform,
            app_version: params.appVersion,
            is_active: true,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('push_token', params.deviceToken)

        if (error) throw error;
        this.logger.log(`Updated device token for user ${params.userId}`);
        return true;
      }

      // Create new
      const { error } = await this.supabase
        .from('user_devices')
        .insert({
          user_id: params.userId,
          push_token: params.deviceToken,
          device_id: params.deviceToken,
          platform: params.platform,
          app_version: params.appVersion,
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
   * Unregister a device token (logout)
   */
  async unregisterDevice(deviceToken: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('user_devices')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('push_token', deviceToken);

      if (error) throw error;
      this.logger.log(`Unregistered device token`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unregister device: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if push notifications are available
   */
  isAvailable(): boolean {
    return this.isFirebaseInitialized;
  }
}
