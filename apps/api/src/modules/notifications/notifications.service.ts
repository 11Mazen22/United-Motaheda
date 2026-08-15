import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging, Message, MulticastMessage } from 'firebase-admin/messaging';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface SendResult   { success: boolean; messageId?: string; error?: string; }
export interface BroadcastResult {
  sent: number;
  failed: number;
  results: Array<{ tokenId: string; success: boolean; error?: string }>;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseInitialized = false;
  private app: App | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() { this.initFirebase(); }

  // ─── Firebase ─────────────────────────────────────────────────────────────

  private initFirebase() {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials missing — push notifications disabled');
      return;
    }
    try {
      this.app = getApps().length > 0
        ? getApps()[0]
        : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      this.firebaseInitialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (e) { this.logger.error('Firebase init failed', e); }
  }

  // ─── Token Management ─────────────────────────────────────────────────────

  /**
   * Register a push notification token for the user.
   * Ensures only one token per device/platform by deactivating other tokens.
   *
   * When a user logs in on a new device:
   *  1. Old tokens for the same platform are deactivated (user likely signed out)
   *  2. Multiple deviceIds on same platform are pruned (user switched devices)
   *  3. New token is upserted
   *
   * This prevents notifications from being sent to old/discarded devices.
   */
  async registerToken(userId: string, token: string, platform: string, deviceId?: string, deviceName?: string) {
    // Deactivate all other tokens for this user on this platform
    // This ensures notifications only go to the current device
    await this.prisma.notificationToken.updateMany({
      where: {
        userId,
        platform,
        token: { not: token }, // Keep the token we're about to upsert
        isActive: true,
      },
      data: { isActive: false },
    });

    // If deviceId is provided, also deactivate other tokens with same deviceId
    // (in case the app was reinstalled and generated a new FCM token)
    if (deviceId) {
      await this.prisma.notificationToken.updateMany({
        where: {
          userId,
          deviceId,
          token: { not: token },
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    // Upsert the new token
    await this.prisma.notificationToken.upsert({
      where: { token },
      update: { userId, isActive: true, lastUsedAt: new Date(), deviceId, deviceName, platform },
      create: { userId, token, platform, deviceId, deviceName, isActive: true },
    });

    return { message: 'Token registered' };
  }

  async deactivateToken(token: string) {
    await this.prisma.notificationToken.updateMany({ where: { token }, data: { isActive: false } });
  }

  // ─── Single ───────────────────────────────────────────────────────────────

  async sendToUser(userId: string, payload: NotificationPayload): Promise<BroadcastResult> {
    const tokens = await this.prisma.notificationToken.findMany({ where: { userId, isActive: true } });
    if (!tokens.length) return { sent: 0, failed: 0, results: [] };
    return this._sendToTokenRecords(tokens, payload, userId);
  }

  async sendToToken(token: string, payload: NotificationPayload): Promise<SendResult> {
    if (!this.firebaseInitialized || !this.app) return { success: false, error: 'Firebase not configured' };
    const msg: Message = {
      token,
      notification: { title: payload.title, body: payload.body, imageUrl: payload.imageUrl },
      data: payload.data ?? {},
      android: { priority: 'high', notification: { channelId: 'delivery-orders', priority: 'high', defaultSound: true, defaultVibrateTimings: true } },
      apns: { payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } }, headers: { 'apns-priority': '10' } },
    };
    try {
      const messageId = await getMessaging(this.app).send(msg);
      await this._log(null, token, payload, 'sent');
      return { success: true, messageId };
    } catch (e: any) {
      const err = e?.message ?? String(e);
      await this._log(null, token, payload, 'failed', err);
      if (err.includes('registration-token-not-registered') || err.includes('invalid-registration-token'))
        await this.deactivateToken(token);
      return { success: false, error: err };
    }
  }

  // ─── Broadcast ────────────────────────────────────────────────────────────

  async broadcastToAll(payload: NotificationPayload) {
    const tokens = await this.prisma.notificationToken.findMany({ where: { isActive: true } });
    return this._sendToTokenRecords(tokens, payload, null);
  }

  async broadcastToOnlineDrivers(payload: NotificationPayload) {
    const ids = (await this.prisma.driverProfile.findMany({ where: { isOnline: true }, select: { userId: true } })).map(d => d.userId);
    if (!ids.length) return { sent: 0, failed: 0, results: [] };
    const tokens = await this.prisma.notificationToken.findMany({ where: { userId: { in: ids }, isActive: true } });
    return this._sendToTokenRecords(tokens, payload, null);
  }

  async broadcastToDriversByStatus(status: string, payload: NotificationPayload) {
    const ids = (await this.prisma.driverProfile.findMany({ where: { status: status as any }, select: { userId: true } })).map(d => d.userId);
    if (!ids.length) return { sent: 0, failed: 0, results: [] };
    const tokens = await this.prisma.notificationToken.findMany({ where: { userId: { in: ids }, isActive: true } });
    return this._sendToTokenRecords(tokens, payload, null);
  }

  async broadcastToMultipleUsers(userIds: string[], payload: NotificationPayload) {
    const tokens = await this.prisma.notificationToken.findMany({ where: { userId: { in: userIds }, isActive: true } });
    return this._sendToTokenRecords(tokens, payload, null);
  }

  async getNotificationHistory(userId?: string, limit = 50) {
    return this.prisma.notificationLog.findMany({ where: userId ? { userId } : {}, orderBy: { sentAt: 'desc' }, take: limit });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async _sendToTokenRecords(
    tokens: Array<{ id: string; token: string; userId: string; platform: string }>,
    payload: NotificationPayload,
    _userId: string | null,
  ): Promise<BroadcastResult> {
    if (!this.firebaseInitialized || !this.app)
      return { sent: 0, failed: tokens.length, results: [] };

    const CHUNK = 500;
    let sent = 0, failed = 0;
    const results: BroadcastResult['results'] = [];

    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      const msg: MulticastMessage = {
        tokens: chunk.map(t => t.token),
        notification: { title: payload.title, body: payload.body, imageUrl: payload.imageUrl },
        data: payload.data ?? {},
        android: { priority: 'high', notification: { channelId: 'delivery-orders', priority: 'high', defaultSound: true } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } }, headers: { 'apns-priority': '10' } },
      };
      try {
        const response = await getMessaging(this.app).sendEachForMulticast(msg);
        response.responses.forEach((r, idx) => {
          const t = chunk[idx];
          if (r.success) {
            sent++; results.push({ tokenId: t.id, success: true });
            this._log(t.userId, t.token, payload, 'sent').catch(() => {});
          } else {
            failed++;
            const errMsg = r.error?.message ?? 'Unknown';
            results.push({ tokenId: t.id, success: false, error: errMsg });
            this._log(t.userId, t.token, payload, 'failed', errMsg).catch(() => {});
            if (errMsg.includes('registration-token-not-registered') || errMsg.includes('invalid-registration-token'))
              this.deactivateToken(t.token).catch(() => {});
          }
        });
      } catch (e: any) {
        failed += chunk.length;
        chunk.forEach(t => results.push({ tokenId: t.id, success: false, error: String(e) }));
      }
    }

    this.logger.log(`Broadcast complete — sent:${sent} failed:${failed}`);
    return { sent, failed, results };
  }

  private async _log(userId: string | null, token: string, payload: NotificationPayload, status: string, errorMessage?: string) {
    try {
      const rec = await this.prisma.notificationToken.findFirst({ where: { token } });
      await this.prisma.notificationLog.create({
        data: {
          userId: userId ?? rec?.userId,
          tokenId: rec?.id,
          title: payload.title, body: payload.body,
          data: payload.data ?? {}, imageUrl: payload.imageUrl,
          status, platform: rec?.platform ?? 'unknown',
          errorMessage: errorMessage ?? null,
        },
      });
    } catch (_) { /* non-critical */ }
  }
}
