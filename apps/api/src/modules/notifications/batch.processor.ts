import { Injectable } from '@nestjs/common';

@Injectable()
export class BatchProcessor {
  async createBatch(...args: any[]) {
    return 'mock-batch-id';
  }

  async getAllBatches(limit: number, offset: number) {
    return { data: [], total: 0 };
  }

  async getBatchStatus(batchId: string) {
    return { id: batchId, status: 'completed' };
  }
}
