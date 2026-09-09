import { NotificationWorker } from './notification.worker';
import { ConfigService } from '@nestjs/config';

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }), { virtual: true });

const mockFCM = jest.fn();
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
  messaging: jest.fn(() => ({
    sendEachForMulticast: mockFCM,
  })),
}));

// Helper to create a mock query chain for Supabase
const createQueryChain = (data: any = []) => {
  const q: any = jest.fn(() => q);
  q.select = jest.fn(() => q);
  q.eq = jest.fn(() => q);
  q.in = jest.fn(() => q);
  q.or = jest.fn(() => q);
  q.lte = jest.fn(() => q);
  q.limit = jest.fn(() => q);
  q.order = jest.fn(() => q);
  q.update = jest.fn(() => q);
  q.insert = jest.fn(() => q);
  q.single = jest.fn(() => q);
  q.is = jest.fn(() => q);
  q.then = (cb: any) => cb({ data, error: null });
  return q;
};

// Spies for assertions
const outboxUpdateSpy = jest.fn();
const outboxInsertSpy = jest.fn();
const userDevicesUpdateSpy = jest.fn();
const attemptsInsertSpy = jest.fn();

const mockSupabase = {
  from: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('NotificationWorker', () => {
  let worker: NotificationWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    outboxUpdateSpy.mockClear();
    outboxInsertSpy.mockClear();
    userDevicesUpdateSpy.mockClear();
    attemptsInsertSpy.mockClear();
    mockFCM.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });

    const configService = {
      get: jest.fn((key) => {
        if (key === 'SUPABASE_URL') return 'http://mock';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'mock-key';
        if (key === 'firebase') return { projectId: 'p', clientEmail: 'c', privateKey: 'k' };
        return null;
      }),
    } as unknown as ConfigService;

    worker = new NotificationWorker(configService);
    worker.onModuleInit(); // Initialise firebase mock
  });

  describe('Outbox claiming and concurrency (lease/claim)', () => {
    it('claims queued rows atomically using the locked_until condition', async () => {
      const q = createQueryChain([
        { id: 'row-1', recipient_id: 'user-1', title: 'T', body: 'B', attempts: 0, status: 'queued' },
      ]);
      const originalUpdate = q.update;
      q.update = jest.fn((...args) => {
        outboxUpdateSpy(...args);
        return originalUpdate(...args);
      });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') return createQueryChain([
          { token: 't1', platform: 'ios', provider: 'fcm', device_id: 'd1' },
        ]);
        if (table === 'notification_tokens') return createQueryChain([]);
        return createQueryChain();
      });

      await worker.processLoop();
      expect(outboxUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ locked_until: expect.any(String) })
      );
    });
  });

  describe('FCM and Expo routing (multi-device)', () => {
    it('routes simultaneously to multiple devices (FCM valid and invalid)', async () => {
      mockFCM.mockResolvedValueOnce({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          { success: false, error: { code: 'messaging/invalid-registration-token' } as any },
        ],
      });

      const q = createQueryChain([
        { id: 'row-1', recipient_id: 'user-1', title: 'T', body: 'B', attempts: 0, status: 'queued' },
      ]);
      const originalUpdate = q.update;
      q.update = jest.fn((...args) => {
        outboxUpdateSpy(...args);
        return originalUpdate(...args);
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') {
          const devQ = createQueryChain([
            { token: 'valid-fcm', platform: 'ios', provider: 'fcm', device_id: 'd1' },
            { token: 'invalid-fcm', platform: 'android', provider: 'fcm', device_id: 'd2' },
          ]);
          const devUpdate = devQ.update;
          devQ.update = jest.fn((...args) => {
            userDevicesUpdateSpy(...args);
            return devUpdate(...args);
          });
          return devQ;
        }
        if (table === 'notification_tokens') return createQueryChain([]);
        if (table === 'notification_delivery_attempts') {
          const aQ = createQueryChain();
          aQ.insert = jest.fn((...args) => {
            attemptsInsertSpy(...args);
            return aQ;
          });
          return aQ;
        }
        return createQueryChain();
      });

      await worker.processLoop();

      expect(outboxUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent', attempts: 1 })
      );
      expect(attemptsInsertSpy).toHaveBeenCalledTimes(2);
      expect(userDevicesUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false })
      );
    });
  });

  describe('Retry, backoff, and max attempts', () => {
    it('transitions to failed if max attempts reached', async () => {
      mockFCM.mockResolvedValueOnce({
        successCount: 0,
        failureCount: 1,
        responses: [{ success: false, error: { code: 'some-error' } as any }],
      });

      const q = createQueryChain([
        { id: 'row-2', recipient_id: 'user-2', title: 'T', body: 'B', attempts: 4, status: 'queued' },
      ]);
      const originalUpdate = q.update;
      q.update = jest.fn((...args) => {
        outboxUpdateSpy(...args);
        return originalUpdate(...args);
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') return createQueryChain([
          { token: 'fcm1', platform: 'ios', provider: 'fcm', device_id: 'd1' },
        ]);
        if (table === 'notification_tokens') return createQueryChain([]);
        return createQueryChain();
      });

      await worker.processLoop();

      expect(outboxUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', attempts: 5 })
      );
    });

    it('transitions to queued with backoff if attempts < max', async () => {
      mockFCM.mockResolvedValueOnce({
        successCount: 0,
        failureCount: 1,
        responses: [{ success: false, error: { code: 'messaging/invalid' } as any }],
      });

      const q = createQueryChain([
        { id: 'row-3', recipient_id: 'user-3', title: 'T', body: 'B', attempts: 1, status: 'queued' },
      ]);
      const originalUpdate = q.update;
      q.update = jest.fn((...args) => {
        outboxUpdateSpy(...args);
        return originalUpdate(...args);
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') return createQueryChain([
          { token: 'invalid-fcm', platform: 'android', provider: 'fcm', device_id: 'd2' },
        ]);
        if (table === 'notification_tokens') return createQueryChain([]);
        return createQueryChain();
      });

      await worker.processLoop();

      expect(outboxUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'queued',
          attempts: 2,
          next_attempt_at: expect.any(String),
        })
      );
    });
  });
});
