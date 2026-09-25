import { NotificationWorker } from './notification.worker';
import { ConfigService } from '@nestjs/config';

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }), { virtual: true });

const mockFCM = jest.fn();
jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({
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
  q.abortSignal = jest.fn(() => q);
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
  rpc: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock PrismaService — $queryRaw stands in for the retired
// claim_notification_outbox() RPC. Tests configure its resolved value the
// same way they previously configured mockSupabase.rpc().
const mockQueryRaw = jest.fn();
const mockPrisma = {
  $queryRaw: (...args: any[]) => mockQueryRaw(...args),
};

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
        if (key === 'FIREBASE_PROJECT_ID') return 'p';
        if (key === 'FIREBASE_CLIENT_EMAIL') return 'c';
        if (key === 'FIREBASE_PRIVATE_KEY') return 'k';
        return null;
      }),
    } as unknown as ConfigService;

    worker = new NotificationWorker(configService, mockPrisma as any);
    worker.onModuleInit(); // Initialise firebase mock
  });

  describe('Outbox claiming and concurrency (lease/claim)', () => {
    it('claims due rows through the atomic database transaction', async () => {
      const claimedRows = [
        { id: 'row-1', recipient_id: 'user-1', title: 'T', body: 'B', attempts: 1, status: 'processing' },
      ];
      mockQueryRaw.mockResolvedValue(claimedRows);
      const q = createQueryChain();
      const originalUpdate = q.update;
      q.update = jest.fn((...args) => {
        outboxUpdateSpy(...args);
        return originalUpdate(...args);
      });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') return createQueryChain([
          { push_token: 't1', platform: 'ios', device_id: 'd1' },
        ]);
        if (table === 'notification_tokens') return createQueryChain([]);
        return createQueryChain();
      });

      await worker.processLoop();
      expect(mockQueryRaw).toHaveBeenCalled();
      expect(outboxUpdateSpy).toHaveBeenCalled();
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

      const q = createQueryChain();
      mockQueryRaw.mockResolvedValue([
        { id: 'row-1', recipient_id: 'user-1', title: 'T', body: 'B', attempts: 1, status: 'processing' },
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
            { push_token: 'valid-fcm', platform: 'ios', device_id: 'd1' },
            { push_token: 'invalid-fcm', platform: 'android', device_id: 'd2' },
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

    it('keeps Expo fallback active for a legacy device when another device has FCM', async () => {
      const q = createQueryChain();
      mockQueryRaw.mockResolvedValue([
        { id: 'row-legacy', recipient_id: 'user-1', title: 'T', body: 'B', payload: {}, attempts: 1, status: 'processing' },
      ]);
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') return createQueryChain([
          { push_token: 'new-fcm', platform: 'android', device_id: 'new-device' },
        ]);
        if (table === 'notification_tokens') return createQueryChain([
          { expo_push_token: 'ExponentPushToken[legacy]', device_id: 'legacy-device', invalidated_at: null },
        ]);
        return createQueryChain();
      });

      const sendExpo = jest.spyOn(worker as any, 'sendExpo').mockResolvedValue({
        successful: ['ExponentPushToken[legacy]'], failed: [],
      });
      await worker.processLoop();

      expect(mockFCM).toHaveBeenCalled();
      expect(sendExpo).toHaveBeenCalledWith(
        ['ExponentPushToken[legacy]'], 'T', 'B', {},
        [expect.objectContaining({ device_id: 'legacy-device' })],
      );
    });

    it('does not duplicate Expo push for a device already receiving FCM', async () => {
      const q = createQueryChain();
      mockQueryRaw.mockResolvedValue([
        { id: 'row-dedupe', recipient_id: 'user-1', title: 'T', body: 'B', payload: {}, attempts: 1, status: 'processing' },
      ]);
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') return createQueryChain([
          { push_token: 'new-fcm', platform: 'android', device_id: 'same-device' },
        ]);
        if (table === 'notification_tokens') return createQueryChain([
          { expo_push_token: 'ExponentPushToken[same]', device_id: 'same-device', invalidated_at: null },
        ]);
        return createQueryChain();
      });

      const sendExpo = jest.spyOn(worker as any, 'sendExpo');
      await worker.processLoop();
      expect(sendExpo).not.toHaveBeenCalled();
    });
  });

  describe('Retry, backoff, and max attempts', () => {
    it('transitions to failed if max attempts reached', async () => {
      mockFCM.mockResolvedValueOnce({
        successCount: 0,
        failureCount: 1,
        responses: [{ success: false, error: { code: 'some-error' } as any }],
      });

      const q = createQueryChain();
      mockQueryRaw.mockResolvedValue([
        { id: 'row-2', recipient_id: 'user-2', title: 'T', body: 'B', attempts: 5, status: 'processing' },
      ]);
      const originalUpdate = q.update;
      q.update = jest.fn((...args) => {
        outboxUpdateSpy(...args);
        return originalUpdate(...args);
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') return createQueryChain([
          { push_token: 'fcm1', platform: 'ios', device_id: 'd1' },
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

      const q = createQueryChain();
      mockQueryRaw.mockResolvedValue([
        { id: 'row-3', recipient_id: 'user-3', title: 'T', body: 'B', attempts: 2, status: 'processing' },
      ]);
      const originalUpdate = q.update;
      q.update = jest.fn((...args) => {
        outboxUpdateSpy(...args);
        return originalUpdate(...args);
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_outbox') return q;
        if (table === 'user_devices') return createQueryChain([
          { push_token: 'invalid-fcm', platform: 'android', device_id: 'd2' },
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
