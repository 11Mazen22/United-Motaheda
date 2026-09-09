// src/providers/expo.provider.ts
// Uses Node.js built-in https module — no external fetch dep needed.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

export interface ExpoPayload {
  /** Expo push token, e.g. "ExponentPushToken[xxx]" */
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
}

export interface ExpoSendResult {
  success: boolean;
  token: string;
  receiptId?: string;
  error?: string;
}

@Injectable()
export class ExpoProvider {
  private readonly logger = new Logger(ExpoProvider.name);
  private readonly expoPushHost = 'exp.host';
  private readonly expoPushPath = '/--/api/v2/push/send';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send push notifications via the Expo Push API.
   * Uses the batched endpoint to send up to 100 messages per call.
   * Returns per-token results.
   */
  async send(payloads: ExpoPayload[]): Promise<ExpoSendResult[]> {
    if (payloads.length === 0) return [];

    const messages = payloads.map((p) => ({
      to: p.token,
      title: p.title,
      body: p.body,
      data: p.data,
      sound: p.sound ?? 'default',
      badge: p.badge,
    }));

    try {
      const json = await this._postJson(messages);

      if (!Array.isArray(json?.data)) {
        this.logger.error('Unexpected Expo API response format');
        return payloads.map((p) => ({
          success: false,
          token: p.token,
          error: 'Invalid Expo response',
        }));
      }

      return json.data.map((item: any, idx: number) => {
        const success = item.status === 'ok';
        return {
          success,
          token: payloads[idx]?.token ?? '',
          receiptId: item.id,
          error: success ? undefined : item.message,
        };
      });
    } catch (err: any) {
      this.logger.error(`Expo send failed: ${err.message}`);
      return payloads.map((p) => ({
        success: false,
        token: p.token,
        error: err.message,
      }));
    }
  }

  /** POST JSON via Node.js native https */
  private _postJson(body: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const options: https.RequestOptions = {
        hostname: this.expoPushHost,
        path: this.expoPushPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Accept: 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse Expo response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
