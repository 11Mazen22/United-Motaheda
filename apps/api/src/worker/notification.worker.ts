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
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

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
  push_token: string;
  platform: string;
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
  /** Bound external calls so one degraded provider cannot freeze the cron loop. */
  private readonly DB_TIMEOUT_MS = 12_000;
  private readonly PROVIDER_TIMEOUT_MS = 15_000;
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
      if (getApps().length > 0) {
        this.firebaseInitialized = true;
        return;
      }
      const nested = this.configService.get<any>('firebase');
      const cfg = {
        projectId: nested?.projectId ?? this.configService.get<string>('FIREBASE_PROJECT_ID'),
        clientEmail: nested?.clientEmail ?? this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        privateKey: nested?.privateKey ?? this.configService.get<string>('FIREBASE_PRIVATE_KEY'),
      };
      if (!cfg?.projectId || !cfg?.clientEmail || !cfg?.privateKey) {
        this.logger.warn('Firebase config missing — FCM push disabled');
        return;
      }
      initializeApp({
        credential: cert({
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

  /**
   * Re-entrancy guard: @Cron fires on schedule regardless of whether the
   * previous tick finished. Without this, a single slow/hung DB response
   * lets ticks pile up as unbounded concurrent Supabase requests, each
   * holding a pooler connection until it times out -- exactly the pattern
   * confirmed in the 2026-09-19 outage (edge_logs showed this poller
   * failing every 5-10s in a continuous loop while the DB was degraded).
   */
  private isProcessing = false;

  @Cron('*/5 * * * * *') // every 5 seconds
  async processLoop() {
    if (this.isProcessing) {
      this.logger.warn('Previous outbox tick still running -- skipping this tick');
      return;
    }
    this.isProcessing = true;
    try {
      await this.processBatch();
    } catch (err: any) {
      this.logger.error(`Worker loop error: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatch() {
    // Claim due queued/retrying jobs, plus stale processing jobs, in one
    // database transaction using FOR UPDATE SKIP LOCKED. The RPC also moves
    // rows to `processing`, sets the lease, and increments `attempts`.
    const { data: claimedRows, error: claimErr } = await this.supabase
      .rpc('claim_notification_outbox', { p_limit: this.BATCH_SIZE })
      .abortSignal(AbortSignal.timeout(this.DB_TIMEOUT_MS));

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

    const fcmTokens = fcmDevices.map((d) => d.push_token);
    const expoTokenList = expoTokens.map((t) => t.expo_push_token);

    // Send to FCM devices
    let fcmSuccessful: string[] = [];
    let fcmFailed: string[] = [];
    let fcmError: string | undefined;

    const useNativeFcm = fcmTokens.length > 0 && this.firebaseInitialized;
    if (useNativeFcm) {
      const fcmResult = await this.sendFcm(fcmTokens, title, body, payload, fcmDevices);
      fcmSuccessful = fcmResult.successful;
      fcmFailed = fcmResult.failed;
      fcmError = fcmResult.error;
    }

    // Send to Expo tokens (per-device, independently of FCM)
    let expoSuccessful: string[] = [];
    let expoFailed: string[] = [];

    // Expo is a fallback for installations without a healthy native FCM
    // registration. Never send through both providers for the same outbox
    // row, otherwise a dual-registered phone receives duplicate alerts.
    if (!useNativeFcm && expoTokenList.length > 0) {
      const expoResult = await this.sendExpo(expoTokenList, title, body, payload, expoTokens);
      expoSuccessful = expoResult.successful;
      expoFailed = expoResult.failed;
    }

    // Record delivery attempts
    const nowStr = new Date().toISOString();
    await Promise.all([
      ...fcmSuccessful.map((tok) =>
        this.recordAttempt(id, tok, 'delivered', undefined, nowStr),
      ),
      ...fcmFailed.map((tok) =>
        this.recordAttempt(id, tok, 'failed', fcmError, nowStr),
      ),
      ...expoSuccessful.map((tok) =>
        this.recordAttempt(id, tok, 'delivered', undefined, nowStr),
      ),
      ...expoFailed.map((tok) =>
        this.recordAttempt(id, tok, 'failed', 'Expo delivery failed', nowStr),
      ),
    ]);

    // Determine outbox outcome
    const totalSuccess = fcmSuccessful.length + expoSuccessful.length;
    // claim_notification_outbox increments attempts atomically.
    const newAttempts = attempts;

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
      .eq('id', id)
      .abortSignal(AbortSignal.timeout(this.DB_TIMEOUT_MS));

    if (updateErr) {
      this.logger.error(`Failed to update outbox ${id}: ${updateErr.message}`);
    }
  }

  // ── FCM delivery ────────────────────────────────────────────────────────────

  // enqueue_notification()/execute_order_cancellation() always shape the
  // outbox payload as { data: {...caller data...}, action_url,
  // notification_id } — order-lifecycle callers put orderId inside that
  // inner `data`. Reusing that id as a stable tag/collapse-id means every
  // push about the SAME order replaces the tray entry in place ("Order
  // #1248: Preparing" -> "...Ready" -> "...Delivered", one evolving
  // notification) instead of stacking a new alert per lifecycle event. No
  // id => no tag => default stacking behavior, which is what we want for
  // non-order notifications (promo blasts, etc.) that have nothing to
  // collapse into. Shared by both providers: FCM's Android `tag`/APNs
  // `apns-collapse-id` (sendFcm) and Expo's own `tag`/`collapseId` fields
  // (sendExpoSingle), which map to the exact same native mechanisms.
  private deriveActiveOrderTag(data: Record<string, any>): string | undefined {
    const innerData =
      data && typeof data === 'object' && data.data && typeof data.data === 'object'
        ? data.data
        : data;
    const orderId = typeof innerData?.orderId === 'string' ? innerData.orderId : undefined;
    return orderId ? `active-order:${orderId}` : undefined;
  }

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

      const tag = this.deriveActiveOrderTag(data);

      const message = {
        notification: { title, body },
        data: stringifiedData,
        android: {
          priority: 'high' as const,
          notification: { channelId: 'orders', sound: 'default', ...(tag ? { tag } : {}) },
        },
        apns: {
          payload: { aps: { sound: 'default', contentAvailable: true } },
          ...(tag ? { headers: { 'apns-collapse-id': tag } } : {}),
        },
        tokens,
      };

      // sendEachForMulticast is the current API in firebase-admin ≥ 12
      const response = await Promise.race([
        getMessaging().sendEachForMulticast(message),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(
            () => reject(new Error('FCM request timed out')),
            this.PROVIDER_TIMEOUT_MS,
          );
          timer.unref?.();
        }),
      ]);

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
      .in('push_token', tokens)
      .abortSignal(AbortSignal.timeout(this.DB_TIMEOUT_MS));
    if (error) {
      this.logger.error(`Token deactivation failed: ${error.message}`);
    } else {
      this.logger.log(`Deactivated ${tokens.length} invalid FCM token(s)`);
    }
  }

  // ── Expo delivery ───────────────────────────────────────────────────────────

  /**
   * One Expo API request per token rather than one batched request per
   * recipient. Root-caused a live "Unexpected Expo response format" error
   * that was failing every notification for any recipient whose
   * accumulated tokens span more than one Expo project (confirmed live:
   * this app was rebuilt/republished under a renamed Expo account at some
   * point, leaving old and new tokens registered side by side for the same
   * user) -- Expo's push API rejects the ENTIRE batch with HTTP 400
   * PUSH_TOO_MANY_EXPERIENCE_IDS when a single request mixes tokens from
   * different projects, and that error response is shaped
   * {errors: [...]}, not {data: [...]}, which is exactly what
   * `!Array.isArray(json?.data)` was catching -- correctly detecting the
   * malformed-for-us response, but failing ALL of that recipient's tokens
   * together instead of isolating the actually-bad one(s). Reproduced and
   * confirmed directly against the real Expo API with this project's real
   * token data before this fix; a single-token request for the same
   * recipient already delivered successfully (status: "ok").
   * Per-token requests trade a little batching efficiency (Expo's own docs
   * recommend batching for that reason) for correctness: one stale/wrong-
   * project token can no longer block delivery to the same recipient's
   * other, healthy tokens, which matters more for a background worker than
   * the extra round trips.
   */
  private async sendExpo(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, any>,
    tokenRows: ExpoTokenRow[],
  ): Promise<{ successful: string[]; failed: string[] }> {
    const results = await Promise.all(
      tokens.map((token) => this.sendExpoSingle(token, title, body, data)),
    );

    const successful: string[] = [];
    const failed: string[] = [];
    const invalidTokens: string[] = [];

    results.forEach((result, idx) => {
      const token = tokens[idx];
      if (result.ok) {
        successful.push(token);
      } else {
        failed.push(token);
        if (result.invalid) invalidTokens.push(token);
      }
    });

    if (invalidTokens.length > 0) {
      await this.invalidateExpoTokens(invalidTokens);
    }

    return { successful, failed };
  }

  private async sendExpoSingle(
    token: string,
    title: string,
    body: string,
    data: Record<string, any>,
  ): Promise<{ ok: boolean; invalid: boolean }> {
    try {
      const tag = this.deriveActiveOrderTag(data);
      const message: Record<string, any> = { to: token, title, body, data, sound: 'default' };
      if (tag) {
        // Android: replaces an already-displayed notification with the same
        // tag. iOS: coalesces in transit AND replaces an already-displayed
        // notification via apns-collapse-id (Expo docs, confirmed 2026-09) —
        // collapseId is the one field of the two that actually needs setting
        // for iOS; tag is Android-only but harmless to include unconditionally.
        message.tag = tag;
        message.collapseId = tag;
      }
      const payload = JSON.stringify([message]);
      const json = await this.expoPost(payload);

      if (!Array.isArray(json?.data) || json.data.length !== 1) {
        this.logger.error(`Unexpected Expo response format: ${JSON.stringify(json)}`);
        return { ok: false, invalid: false };
      }

      const item = json.data[0];
      if (item.status === 'ok') return { ok: true, invalid: false };
      return { ok: false, invalid: EXPO_INVALID_TOKEN_ERRORS.has(item.details?.error) };
    } catch (err: any) {
      this.logger.error(`Expo send error: ${err.message}`);
      return { ok: false, invalid: false };
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
      req.setTimeout(this.PROVIDER_TIMEOUT_MS, () => {
        req.destroy(new Error('Expo push request timed out'));
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
      .in('expo_push_token', tokens)
      .abortSignal(AbortSignal.timeout(this.DB_TIMEOUT_MS));
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
      .select('id, push_token, platform')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(this.DB_TIMEOUT_MS));
    if (error) this.logger.error(`FCM device fetch error: ${error.message}`);
    return (data as DeviceRow[]) ?? [];
  }

  private async fetchExpoTokens(userId: string): Promise<ExpoTokenRow[]> {
    const { data, error } = await this.supabase
      .from('notification_tokens')
      .select('id, expo_push_token, invalidated_at')
      .eq('user_id', userId)
      .is('invalidated_at', null)
      .abortSignal(AbortSignal.timeout(this.DB_TIMEOUT_MS)); // only valid tokens
    if (error) this.logger.error(`Expo token fetch error: ${error.message}`);
    return (data as ExpoTokenRow[]) ?? [];
  }

  private async recordAttempt(
    outboxId: string,
    token: string,
    status: 'delivered' | 'failed',
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
      })
      .abortSignal(AbortSignal.timeout(this.DB_TIMEOUT_MS));
    if (error) {
      this.logger.error(`Attempt record failed: ${error.message}`);
    }
  }
}
