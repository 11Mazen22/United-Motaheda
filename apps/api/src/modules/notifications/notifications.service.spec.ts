import { NotificationsService } from './notifications.service';
import { ConfigService } from '@nestjs/config';
import { TemplateCompilerService } from './templates/template.compiler';
import { PushChannelService } from './channels/push.channel';
import { InAppChannelService } from './channels/in-app.channel';
import type { EventEmitter2 } from '@nestjs/event-emitter';

// Mock Nest ESM modules
jest.mock('@nestjs/config', () => ({
  ConfigService: class {
    get(key: string) {
      if (key === 'SUPABASE_URL') return 'http://mock';
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'mock-key';
      return null;
    }
  }
}), { virtual: true });
jest.mock('@nestjs/event-emitter', () => ({ EventEmitter2: class {} }), { virtual: true });

// Define a typed interface for the mock to avoid TS2339 errors
interface MockSupabaseClient {
  from: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
  then: (resolve: any) => any;
}

let _currentTable = '';
export let mockUserPreferences: any = null;

const mockSupabase: MockSupabaseClient = {
  from: jest.fn((table: string) => {
    _currentTable = table;
    return mockSupabase;
  }),
  insert: jest.fn().mockResolvedValue({ error: null }),
  update: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  single: jest.fn().mockImplementation(() => {
    if (_currentTable === 'users') {
      return Promise.resolve({
        data: {
          notification_preferences: mockUserPreferences || { channels: {}, categories: {} },
          locale: 'ar'
        },
        error: null
      });
    }
    return Promise.resolve({ data: null, error: null });
  }),
  then: (resolve: any) => resolve({ data: [], error: null }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let inAppChannel: InAppChannelService;
  let eventEmitter: EventEmitter2;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserPreferences = null;
    
    // Manual DI to bypass @nestjs/testing ESM issues
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'http://mock';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'mock-key';
        return null;
      }),
    } as unknown as ConfigService;
    const templateCompiler = { compileTemplate: jest.fn().mockResolvedValue({ title: 'T', body: 'B' }) } as unknown as TemplateCompilerService;
    const pushChannel = { send: jest.fn().mockResolvedValue({ status: 'sent' }) } as unknown as PushChannelService;
    
    inAppChannel = { send: jest.fn().mockResolvedValue({ status: 'sent' }) } as unknown as InAppChannelService;
    eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const prismaService = undefined as any; // No Prisma mock needed, fallback to Supabase
    
    service = new NotificationsService(
      configService,
      templateCompiler,
      pushChannel,
      inAppChannel,
      eventEmitter,
      prismaService,
    );
  });

  describe('Device Registration', () => {
    it('registers a new FCM device token in user_devices', async () => {
      const result = await service.registerDevice({
        userId: 'user-123',
        deviceToken: 'token-abc',
        platform: 'ios',
      });
      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_devices');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });
  });

  describe('Pipeline & Outbox', () => {
    it('enqueues push notifications to outbox instead of sending directly', async () => {
      // Mock no preferences block
      mockUserPreferences = null;

      const result = await service.send({
        type: 'order.created',
        userId: 'user-123',
        data: { orderId: 'O-1', orderNumber: '123' },
        channels: ['push'],
      });

      expect(result.success).toBe(true);
      
      // Verify outbox insertion
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_outbox');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: 'user-123',
          event_type: 'order.created',
          status: 'queued',
          attempts: 0
        })
      );
      
      // In-App channel should NOT be called
      expect(inAppChannel.send).not.toHaveBeenCalled();
      
      // Event should be emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith('notification.sent', expect.any(Object));
    });

    it('handles in-app channel synchronously', async () => {
      mockUserPreferences = null;

      await service.send({
        type: 'order.created',
        userId: 'user-123',
        data: { orderId: 'O-1', orderNumber: '123' },
        channels: ['in_app'],
      });

      expect(inAppChannel.send).toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalledWith('notification_outbox');
    });

    it('filters out channels disabled in user preferences', async () => {
      // Mock user preference with 'push' disabled globally
      mockUserPreferences = { channels: { push: false } };

      const result = await service.send({
        type: 'order.created',
        userId: 'user-123',
        data: { orderId: 'O-1', orderNumber: '123' },
        channels: ['push', 'in_app'],
      });

      // Both push and in_app(which maps to push toggle) are filtered out
      expect(result.channels.length).toBe(0);
      expect(result.success).toBe(false);
      expect(mockSupabase.insert).not.toHaveBeenCalled();
      expect(inAppChannel.send).not.toHaveBeenCalled();
    });
    
    it('filters out channels based on category preferences', async () => {
      // Mock user preference with 'order_updates' category disabled
      mockUserPreferences = { categories: { order_updates: false } };

      const result = await service.send({
        type: 'order.created',
        userId: 'user-123',
        data: { orderId: 'O-1', orderNumber: '123' },
        channels: ['push'],
      });

      expect(result.channels.length).toBe(0);
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });
  });
});
