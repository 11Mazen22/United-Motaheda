/**
 * NotificationWorker
 *
 * Background processor for the notification_outbox table.
 *
 * Responsibilities:
 * - Poll notification_outbox every 5 seconds
 * - Atomically claim rows by setting locked_until (preventing concurrent processing)
 * - Recover stale jobs whose locked_until has passed
 * - Resolve recipient FCM devices (user_devices) and Expo tokens (notification_tokens)
 * - Route each device independently to the correct provider (FCM vs Expo)
 * - Record delivery attempts in notification_delivery_attempts
 * - Apply exponential back-off on transient failures
 * - Mark permanently failed entries after MAX_ATTEMPTS
 * - Invalidate FCM tokens that return registration/token errors
 *
 * This worker runs INSIDE the main NestJS process via @Cron.
 * Start: `npm run start:prod` (or `nest start --watch` in dev).
 * The worker does not require Redis or BullMQ.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { Cron, CronExpression } from '@nestjs/schedule';

// Use require() for Firebase Admin (CommonJS project)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');

// ── Helpers ─────────────────────────────────────────────────────────────────
function addMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60000).toISOString();
}

// ── FCM error codes that mean the token is permanently invalid ───────────────
const FCM_INVALID_TOKEN_ERRORS = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

// ── Expo error types that mean the token is permanently invalid ──────────────
const EXPO_INVALID_TOKEN_ERRORS = new Set([
  'DeviceNotRegistered',
  'InvalidCredentials',
]);

interface OutboxRow {
  id: string;
  notification_id: string;
  recipient_id: string;
  event_type: string;
  title: string;
  body: string;
  payload: Record<string, any>;
  attempts: number;
  status: string;
  locked_until: string | null;
  next_attempt_at: string;
}

interface DeviceRow {
  id: string;
  token: string;
  platform: string;
  provider: string;
}

interface ExpoTokenRow {
  id: string;
  expo_push_token: string;
  invalidated_at: string | null;
}

@Injectable()
export class NotificationWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationWorker.name);
  private supabase: SupabaseClient;
  private firebaseInitialized = false;

  /** Claim lease duration — prevent double-processing by other worker instances */
  private readonly LOCK_MINUTES = 2;
  /** Max delivery attempts before marking outbox row as permanently failed */
  private readonly MAX_ATTEMPTS = 5;
  /** How many outbox rows to claim per tick */
  private readonly BATCH_SIZE = 50;
  /** Expo push API endpoint */
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('NotificationWorker: Supabase credentials not configured');
    }
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /** Initialise Firebase once on bootstrap */
  onModuleInit() {
    this.initFirebase();
    this.logger.log('NotificationWorker started — polling notification_outbox every 5 s');
  }

  private initFirebase() {
    try {
      if (admin.apps?.length > 0) {
        this.firebaseInitialized = true;
        return;
      }
      const cfg = this.configService.get('firebase');
      if (!cfg?.projectId || !cfg?.clientEmail || !cfg?.privateKey) {
        this.logger.warn('Firebase config missing — FCM push disabled');
        return;
      }
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: cfg.projectId,
          clientEmail: cfg.clientEmail,
          privateKey: (cfg.privateKey as string).replace(/\\n/g, '\n'),
        }),
      });
      this.firebaseInitialized = true;
      this.logger.log('Firebase Admin SDK initialised');
    } catch (err: any) {
      this.logger.error(`Firebase init failed: ${err.message}`);
    }
  }

  // ── Main polling loop ───────────────────────────────────────────────────────

  @Cron('*/5 * * * * *') // every 5 seconds
  async processLoop() {
    try {
      await this.processBatch();
    } catch (err: any) {
      this.logger.error(`Worker loop error: ${err.message}`);
    }
  }

  private async processBatch() {
    const nowStr = new Date().toISOString();

    // 1. SELECT rows that are queued AND either not locked or lock has expired.
    const { data: rows, error: selectErr } = await this.supabase
      .from('notification_outbox')
      .select('*')
      .eq('status', 'queued')
      .lte('next_attempt_at', nowStr)
      .or(`locked_until.is.null,locked_until.lte.${nowStr}`)
      .order('next_attempt_at', { ascending: true })
      .limit(this.BATCH_SIZE);

    if (selectErr) {
      this.logger.error(`Outbox select failed: ${selectErr.message}`);
      return;
    }

    if (!rows || rows.length === 0) return;

    // 2. Claim rows atomically by setting locked_until and returning the actually claimed rows.
    //    We repeat the exact lock condition in the UPDATE WHERE clause.
    const claimIds = (rows as OutboxRow[]).map((r) => r.id);
    const lockUntil = addMinutes(new Date(), this.LOCK_MINUTES);

    const { data: claimedRows, error: claimErr } = await this.supabase
      .from('notification_outbox')
      .update({ locked_until: lockUntil, updated_at: new Date().toISOString() })
      .in('id', claimIds)
      .eq('status', 'queued') // guard: only claim still-queued rows
      .or(`locked_until.is.null,locked_until.lte.${nowStr}`) // ATOMIC LOCK GUARD
      .select();

    if (claimErr) {
      this.logger.error(`Outbox claim failed: ${claimErr.message}`);
      return;
    }

    if (!claimedRows || claimedRows.length === 0) return; // Another worker claimed them

    // 3. Process each atomically claimed row independently.
    await Promise.all(
      (claimedRows as OutboxRow[]).map((row) =>
        this.processRow(row).catch((err: any) => {
          this.logger.error(`Row ${row.id} processing threw: ${err.message}`);
        }),
      ),
    );
  }

  // ── Per-row processing ──────────────────────────────────────────────────────

  private async processRow(row: OutboxRow) {
    const { id, recipient_id, title, body, payload, attempts } = row;

    // Fetch FCM devices (user_devices, provider=fcm, is_active=true)
    const [fcmDevices, expoTokens] = await Promise.all([
      this.fetchFcmDevices(recipient_id),
      this.fetchExpoTokens(recipient_id),
    ]);

    const fcmTokens = fcmDevices.map((d) => d.token);
    const expoTokenList = expoTokens.map((t) => t.expo_push_token);

    // Send to FCM devices
    let fcmSuccessful: string[] = [];
    let fcmFailed: string[] = [];
    let fcmError: string | undefined;

    if (fcmTokens.length > 0 && this.firebaseInitialized) {
      const fcmResult = await this.sendFcm(fcmTokens, title, body, payload, fcmDevices);
      fcmSuccessful = fcmResult.successful;
      fcmFailed = fcmResult.failed;
      fcmError = fcmResult.error;
    }

    // Send to Expo tokens (per-device, independently of FCM)
    let expoSuccessful: string[] = [];
    let expoFailed: string[] = [];

    if (expoTokenList.length > 0) {
      const expoResult = await this.sendExpo(expoTokenList, title, body, payload, expoTokens);
      expoSuccessful = expoResult.successful;
      expoFailed = expoResult.failed;
    }

    // Record delivery attempts
    const nowStr = new Date().toISOString();
    await Promise.all([
      ...fcmSuccessful.map((tok) =>
        this.recordAttempt(id, tok, 'sent', undefined, nowStr),
      ),
      ...fcmFailed.map((tok) =>
        this.recordAttempt(id, tok, 'failed', fcmError, nowStr),
      ),
      ...expoSuccessful.map((tok) =>
        this.recordAttempt(id, tok, 'sent', undefined, nowStr),
      ),
      ...expoFailed.map((tok) =>
        this.recordAttempt(id, tok, 'failed', 'Expo delivery failed', nowStr),
      ),
    ]);

    // Determine outbox outcome
    const totalSuccess = fcmSuccessful.length + expoSuccessful.length;
    const newAttempts = attempts + 1;

    let newStatus: string;
    const updatePayload: Record<string, any> = {
      attempts: newAttempts,
      locked_until: null,
      updated_at: nowStr,
    };

    if (totalSuccess > 0) {
      newStatus = 'sent';
      updatePayload.completed_at = nowStr;
    } else if (newAttempts >= this.MAX_ATTEMPTS) {
      newStatus = 'failed';
      updatePayload.last_error = fcmError ?? 'Max attempts reached with no delivery';
    } else {
      // Exponential back-off: 1, 2, 4, 8, 16 minutes
      newStatus = 'queued';
      const backoffMin = Math.min(Math.pow(2, newAttempts), 30);
      updatePayload.next_attempt_at = addMinutes(new Date(), backoffMin);
      updatePayload.last_error = fcmError;
    }

    updatePayload.status = newStatus;

    const { error: updateErr } = await this.supabase
      .from('notification_outbox')
      .update(updatePayload)
      .eq('id', id);

    if (updateErr) {
      this.logger.error(`Failed to update outbox ${id}: ${updateErr.message}`);
    }
  }

  // ── FCM delivery ────────────────────────────────────────────────────────────

  private async sendFcm(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, any>,
    devices: DeviceRow[],
  ): Promise<{ successful: string[]; failed: string[]; error?: string }> {
    try {
      // Ensure all data values are strings (FCM requirement)
      const stringifiedData: Record<string, string> = {};
      for (const [k, v] of Object.entries(data || {})) {
        stringifiedData[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }

      const message = {
        notification: { title, body },
        data: stringifiedData,
        tokens,
      };

      // sendEachForMulticast is the current API in firebase-admin ≥ 12
      const response = await admin.messaging().sendEachForMulticast(message);

      const successful: string[] = [];
      const failed: string[] = [];
      const invalidTokens: string[] = [];

      response.responses.forEach((resp: any, idx: number) => {
        const token = tokens[idx];
        if (resp.success) {
          successful.push(token);
        } else {
          const errCode: string = resp.error?.code ?? '';
          if (FCM_INVALID_TOKEN_ERRORS.has(errCode)) {
            invalidTokens.push(token);
          }
          failed.push(token);
        }
      });

      // Permanently deactivate invalid tokens
      if (invalidTokens.length > 0) {
        await this.deactivateFcmTokens(invalidTokens);
      }

      return { successful, failed };
    } catch (err: any) {
      this.logger.error(`FCM sendEachForMulticast error: ${err.message}`);
      return { successful: [], failed: tokens, error: err.message };
    }
  }

  private async deactivateFcmTokens(tokens: string[]) {
    const { error } = await this.supabase
      .from('user_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('token', tokens);
    if (error) {
      this.logger.error(`Token deactivation failed: ${error.message}`);
    } else {
      this.logger.log(`Deactivated ${tokens.length} invalid FCM token(s)`);
    }
  }

  // ── Expo delivery ───────────────────────────────────────────────────────────

  private async sendExpo(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, any>,
    tokenRows: ExpoTokenRow[],
  ): Promise<{ successful: string[]; failed: string[] }> {
    try {
      const messages = tokens.map((token) => ({
        to: token,
        title,
        body,
        data,
        sound: 'default',
      }));

      const payload = JSON.stringify(messages);
      const json = await this.expoPost(payload);

      if (!Array.isArray(json?.data)) {
        this.logger.error('Unexpected Expo response format');
        return { successful: [], failed: tokens };
      }

      const successful: string[] = [];
      const failed: string[] = [];
      const invalidTokens: string[] = [];

      json.data.forEach((item: any, idx: number) => {
        const token = tokens[idx];
        if (item.status === 'ok') {
          successful.push(token);
        } else {
          failed.push(token);
          if (EXPO_INVALID_TOKEN_ERRORS.has(item.details?.error)) {
            invalidTokens.push(token);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await this.invalidateExpoTokens(invalidTokens);
      }

      return { successful, failed };
    } catch (err: any) {
      this.logger.error(`Expo send error: ${err.message}`);
      return { successful: [], failed: tokens };
    }
  }

  private expoPost(payload: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const { request } = require('https');
      const buf = Buffer.from(payload, 'utf8');
      const options = {
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': buf.length,
          Accept: 'application/json',
        },
      };
      const req = request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Expo parse error: ${data}`)); }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  private async invalidateExpoTokens(tokens: string[]) {
    const { error } = await this.supabase
      .from('notification_tokens')
      .update({
        invalidated_at: new Date().toISOString(),
        invalid_reason: 'DeviceNotRegistered',
      })
      .in('expo_push_token', tokens);
    if (error) {
      this.logger.error(`Expo token invalidation failed: ${error.message}`);
    } else {
      this.logger.log(`Invalidated ${tokens.length} Expo token(s)`);
    }
  }

  // ── Database helpers ────────────────────────────────────────────────────────

  private async fetchFcmDevices(userId: string): Promise<DeviceRow[]> {
    const { data, error } = await this.supabase
      .from('user_devices')
      .select('id, token, platform, provider')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('provider', 'fcm');
    if (error) this.logger.error(`FCM device fetch error: ${error.message}`);
    return (data as DeviceRow[]) ?? [];
  }

  private async fetchExpoTokens(userId: string): Promise<ExpoTokenRow[]> {
    const { data, error } = await this.supabase
      .from('notification_tokens')
      .select('id, expo_push_token, invalidated_at')
      .eq('user_id', userId)
      .is('invalidated_at', null); // only valid tokens
    if (error) this.logger.error(`Expo token fetch error: ${error.message}`);
    return (data as ExpoTokenRow[]) ?? [];
  }

  private async recordAttempt(
    outboxId: string,
    token: string,
    status: 'sent' | 'failed',
    errorMsg: string | undefined,
    sentAt: string,
  ) {
    const { error } = await this.supabase
      .from('notification_delivery_attempts')
      .insert({
        outbox_id: outboxId,
        // token_id is a foreign key to notification_tokens.id (Expo) — for FCM we store
        // the token string in error_message for now since user_devices has no FK here.
        status,
        error_message: errorMsg ?? null,
        created_at: sentAt,
        updated_at: sentAt,
      });
    if (error) {
      this.logger.error(`Attempt record failed: ${error.message}`);
    }
  }
}
