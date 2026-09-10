/**
 * Unit tests for OrderTrackingService.
 *
 * Rewritten alongside the service fix: the previous version of these tests
 * asserted the OLD, broken behavior as correct (payload.new.latitude/
 * longitude, an UPDATE listener on driver_locations, driver name/phone read
 * directly off the orders row) — none of which match the real schema or the
 * driver-location Edge Function's actual INSERT-only write pattern. These
 * tests now exercise the real column names and event types the fixed
 * service (and the tables it subscribes to) actually use.
 */

import { orderTrackingService } from '@/services/orderTrackingService';
import { useOrderStore, ActiveOrder } from '@/stores/orders';
import { supabase } from '@/lib/supabase';

type ChangeHandler = (payload: { new: Record<string, unknown> | null }) => void;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => {
      const fake: any = {
        _handlers: [] as Array<{ config: any; handler: ChangeHandler }>,
      };
      fake.on = jest.fn((_event: string, config: any, handler: ChangeHandler) => {
        fake._handlers.push({ config, handler });
        return fake;
      });
      fake.subscribe = jest.fn(() => fake);
      return fake;
    }),
    removeChannel: jest.fn(),
    from: jest.fn(),
  },
}));

const mockedSupabase = supabase as unknown as {
  channel: jest.Mock;
  removeChannel: jest.Mock;
  from: jest.Mock;
};

function fireChange(channel: any, table: string, newRow: Record<string, unknown> | null) {
  const entry = (channel._handlers as Array<{ config: any; handler: ChangeHandler }>).find(
    (h) => h.config.table === table,
  );
  entry?.handler({ new: newRow });
}

describe('OrderTrackingService', () => {
  let mockOrder: ActiveOrder;

  beforeEach(() => {
    jest.clearAllMocks();
    useOrderStore.setState({
      activeOrder: null,
      driverLocation: null,
      isTracking: false,
    });

    mockOrder = {
      id: 'order-123',
      status: 'driver_accepted',
      origin: { lat: 30.0444, lng: 31.2357 },
      destination: { lat: 30.0123, lng: 31.4567 },
      driverId: null,
      driverName: null,
      driverPhone: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orderTrackingService.initialize(supabase as any);
  });

  afterEach(() => {
    orderTrackingService.cleanup();
  });

  it('sets the active order and subscribes to both tables on startTracking', () => {
    orderTrackingService.startTracking(mockOrder);

    expect(useOrderStore.getState().activeOrder?.id).toBe('order-123');
    expect(useOrderStore.getState().isTracking).toBe(true);
    expect(mockedSupabase.channel).toHaveBeenCalledTimes(2);
  });

  it('driver_locations INSERT uses lat/lng (not latitude/longitude)', () => {
    orderTrackingService.startTracking(mockOrder);
    const locationChannel = mockedSupabase.channel.mock.results[0].value;

    fireChange(locationChannel, 'driver_locations', {
      order_id: 'order-123',
      driver_id: 'driver-456',
      lat: 30.0555,
      lng: 31.2457,
      captured_at: new Date().toISOString(),
    });

    expect(useOrderStore.getState().driverLocation).toEqual({ lat: 30.0555, lng: 31.2457 });
  });

  it('ignores a driver_locations payload missing lat/lng instead of writing NaN/undefined', () => {
    orderTrackingService.startTracking(mockOrder);
    const locationChannel = mockedSupabase.channel.mock.results[0].value;
    const before = useOrderStore.getState().driverLocation;

    fireChange(locationChannel, 'driver_locations', { order_id: 'order-123' });

    expect(useOrderStore.getState().driverLocation).toBe(before);
  });

  it('normalizes the real order_status enum on an orders UPDATE, not the old 5-value subset', () => {
    orderTrackingService.startTracking(mockOrder);
    const statusChannel = mockedSupabase.channel.mock.results[1].value;

    fireChange(statusChannel, 'orders', { id: 'order-123', status: 'out_for_delivery', assigned_driver_id: null });

    expect(useOrderStore.getState().activeOrder?.status).toBe('out_for_delivery');
  });

  it('resolves driver name/phone from profiles when assigned_driver_id first appears', async () => {
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { full_name: 'أحمد محمد', phone: '+20123456789' },
            error: null,
          }),
        }),
      }),
    });

    orderTrackingService.startTracking(mockOrder);
    const statusChannel = mockedSupabase.channel.mock.results[1].value;

    fireChange(statusChannel, 'orders', {
      id: 'order-123',
      status: 'driver_accepted',
      assigned_driver_id: 'driver-456',
    });

    // Driver resolution is async (a real query) — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
    expect(useOrderStore.getState().activeOrder?.driverName).toBe('أحمد محمد');
    expect(useOrderStore.getState().activeOrder?.driverPhone).toBe('+20123456789');
  });

  it('does not re-fetch driver info on subsequent updates for the same driver', async () => {
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { full_name: 'X', phone: 'Y' }, error: null }),
        }),
      }),
    });

    orderTrackingService.startTracking(mockOrder);
    const statusChannel = mockedSupabase.channel.mock.results[1].value;

    fireChange(statusChannel, 'orders', { id: 'order-123', status: 'driver_accepted', assigned_driver_id: 'driver-456' });
    await Promise.resolve();
    await Promise.resolve();
    fireChange(statusChannel, 'orders', { id: 'order-123', status: 'out_for_delivery', assigned_driver_id: 'driver-456' });
    await Promise.resolve();

    expect(mockedSupabase.from).toHaveBeenCalledTimes(1);
  });

  it('stopTracking removes both channels and clears the store', () => {
    orderTrackingService.startTracking(mockOrder);
    orderTrackingService.stopTracking();

    expect(mockedSupabase.removeChannel).toHaveBeenCalledTimes(2);
    expect(useOrderStore.getState().activeOrder).toBeNull();
    expect(orderTrackingService.isTracking()).toBe(false);
    expect(orderTrackingService.getActiveOrderId()).toBeNull();
  });

  it('stops previous tracking before starting a new order', () => {
    orderTrackingService.startTracking(mockOrder);
    const newOrder = { ...mockOrder, id: 'order-456' };
    orderTrackingService.startTracking(newOrder);

    expect(orderTrackingService.getActiveOrderId()).toBe('order-456');
    // 2 channels for the first order removed, 2 more created for the second.
    expect(mockedSupabase.removeChannel).toHaveBeenCalledTimes(2);
  });
});
