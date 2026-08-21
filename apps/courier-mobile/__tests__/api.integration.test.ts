import { useAuthStore } from '../src/stores/auth.store';
import { useOrdersStore, type DeliveryStatus } from '../src/stores/orders.store';
import { useLocationStore } from '../src/stores/location.store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('integration — store interactions with API-shaped data', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useOrdersStore.getState().reset();
    useLocationStore.getState().reset();
  });

  it('acceptOrder-shaped response can drive store state', async () => {
    const apiResponse = {
      assignmentId: 'assign-1',
      status: 'ACCEPTED' as DeliveryStatus,
      pharmacyName: 'Pharmacy',
      pharmacyLat: 30,
      pharmacyLng: 31,
      pharmacyAddress: 'Addr',
      assignedAt: '2024-01-01T00:00:00Z',
      acceptedAt: '2024-01-01T00:00:00Z',
      estimatedEarnings: '50',
      order: {
        id: 'order-1',
        customerName: 'C',
        customerPhone: '01012345678',
        customerAddress: 'A',
        customerLat: 30,
        customerLng: 31,
        itemCount: 1,
        items: [],
        total: '50',
        paymentMethod: 'Cash',
        note: null,
      },
    };

    useOrdersStore.getState().setActiveDelivery(apiResponse);
    const active = useOrdersStore.getState().activeDelivery;
    expect(active?.assignmentId).toBe('assign-1');
    expect(active?.status).toBe('ACCEPTED');
    expect(active?.order.id).toBe('order-1');
  });

  it('availableOrders-shaped response can drive store state', async () => {
    const apiResponse = [
      {
        id: '1',
        customerName: 'C1',
        customerPhone: '01012345678',
        customerAddress: 'A1',
        customerLat: 30,
        customerLng: 31,
        itemCount: 2,
        subtotal: '40',
        total: '50',
        paymentMethod: 'Cash',
        note: null,
        createdAt: '2024-01-01',
        pharmacy: { name: 'P1', lat: 30, lng: 31, address: 'PA' },
        estimatedEarnings: 30,
        distanceToPickupMeters: 500,
        distanceToCustomerMeters: 1200,
        totalDistanceKm: 1.7,
        estimatedMinutes: 10,
      },
    ];

    useOrdersStore.getState().setAvailableOrders(apiResponse);
    expect(useOrdersStore.getState().availableOrders).toHaveLength(1);
    expect(useOrdersStore.getState().availableOrders[0].customerName).toBe('C1');
  });

  it('location update payload matches store setLocation shape', () => {
    const locationPayload = {
      latitude: 30.0444,
      longitude: 31.2357,
      accuracy: 10,
      heading: 90,
      speed: 5,
      altitude: 100,
      timestamp: Date.now(),
    };

    useLocationStore.getState().setLocation(locationPayload);
    const state = useLocationStore.getState();
    expect(state.latitude).toBe(30.0444);
    expect(state.longitude).toBe(31.2357);
    expect(state.accuracy).toBe(10);
  });

  it('delivery history-shaped response can drive store state', async () => {
    const apiResponse = [
      {
        id: 'h1',
        orderId: 'o1',
        status: 'DELIVERED' as DeliveryStatus,
        customerName: 'C',
        customerAddress: 'A',
        itemCount: 2,
        earnings: '50',
        customerRating: 5,
        deliveredAt: '2024-01-01T00:00:00Z',
        actualDuration: 15,
        actualDistance: 1.2,
      },
    ];

    useOrdersStore.getState().addHistoryItems(apiResponse);
    expect(useOrdersStore.getState().deliveryHistory).toHaveLength(1);
    expect(useOrdersStore.getState().deliveryHistory[0].orderId).toBe('o1');
    expect(useOrdersStore.getState().deliveryHistory[0].status).toBe('DELIVERED');
  });

  it('profile response shape matches auth store updateDriverProfile', () => {
    useAuthStore.getState().setAuth('token-123', {
      id: '1',
      fullName: 'Test',
      role: 'DRIVER',
      driverProfile: {
        id: '1',
        vehicleType: 'Car',
        status: 'APPROVED',
        isOnline: false,
        rating: '4.5',
        totalDeliveries: 10,
        completionRate: '95',
        totalEarnings: '500',
      },
    });

    useAuthStore.getState().updateDriverProfile({
      status: 'ACTIVE',
      totalEarnings: '600',
    });

    const profile = useAuthStore.getState().user?.driverProfile;
    expect(profile?.status).toBe('ACTIVE');
    expect(profile?.totalEarnings).toBe('600');
  });
});
