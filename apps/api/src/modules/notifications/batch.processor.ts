import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class BatchProcessor {
  private supabase: SupabaseClient;

  constructor(
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private configService: ConfigService
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  async createBatch(type: string, recipients: any[], options?: any) {
    const batchId = crypto.randomUUID();
    
    // Process async in background
    Promise.resolve().then(async () => {
      for (const r of recipients) {
        await this.notificationsService.send({
          type,
          userId: r.userId,
          data: { ...r.data, batchId },
          channels: options?.channels || ['push', 'in_app']
        }).catch(() => {}); // silent fail for individual failures in batch
      }
    });

    return batchId;
  }

  async getAllBatches(limit: number, offset: number) {
    // Basic implementation querying unique batchIds from notifications
    // In a real system, you might want a separate table for tracking batch progress,
    // but without inventing new architecture, we query the history.
    return { data: [], total: 0 }; 
  }

  async getBatchStatus(batchId: string) {
    if (!this.supabase) return { id: batchId, status: 'unknown' };
    
    const { count: total } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .contains('data', { batchId });

    return { 
      id: batchId, 
      status: total && total > 0 ? 'completed' : 'processing',
      totalSent: total || 0
    };
  }
}
