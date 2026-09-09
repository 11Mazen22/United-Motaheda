import { BatchProcessor } from './batch.processor';
import { NotificationsService } from './notifications.service';
import { ConfigService } from '@nestjs/config';

describe('BatchProcessor', () => {
  let batchProcessor: BatchProcessor;
  let notificationsService: jest.Mocked<NotificationsService>;
  let configService: any;

  beforeEach(() => {
    notificationsService = {
      send: jest.fn().mockResolvedValue({ success: true, notificationId: 'n1', channels: [] }),
    } as any;
    configService = {
      get: jest.fn(),
    };
    batchProcessor = new BatchProcessor(notificationsService, configService);
    // Mock Supabase
    (batchProcessor as any).supabase = {
      from: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue({ error: null }),
      eq: jest.fn().mockReturnThis(),
    };
  });

  it('iterates recipients and enqueues them via NotificationsService with batchId', async () => {
    const recipients = [{ userId: 'user1', data: {} }, { userId: 'user2', data: {} }];
    const batchId = await batchProcessor.createBatch('promo', recipients);

    // Give microtasks time to execute
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notificationsService.send).toHaveBeenCalledTimes(2);
    expect(notificationsService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'promo',
        userId: 'user1',
        data: expect.objectContaining({ batchId }),
      })
    );
  });
});
