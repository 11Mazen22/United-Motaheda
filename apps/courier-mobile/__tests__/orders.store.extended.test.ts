import { useOrdersStore, type DeliveryStatus, type ActiveDelivery } from '../src/stores/orders.store';

describe('orders.store — extended', () => {
  beforeEach(() => {
    useOrdersStore.getState().reset();
  });

  const mockDelivery = (status: DeliveryStatus): ActiveDelivery => ({
    assignmentId: 'assign-1',
    status,
    pharmacyName: 'Test Pharmacy',
    pharmacyLat: 30.0444,
    pharmacyLng: 31.2357,
    pharmacyAddress: 'Pharmacy St',
    assignedAt: '2024-01-01T00:00:00Z',
    acceptedAt: '2024-01-01T00:00:00Z',
    estimatedEarnings: '50',
    order: {
      id: 'order-1',
      customerName: 'Test Customer',
      customerPhone: '01012345678',
      customerAddress: 'Test St',
      customerLat: 30,
      customerLng: 31,
      itemCount: 2,
      items: [{ productId: '1', quantity: '1', unitPrice: '25', snapshot: null }],
      total: '50',
      paymentMethod: 'Cash',
      note: null,
    },
  });

  describe('invalid state transitions', () => {
    it('does not update status when no active delivery exists', () => {
      useOrdersStore.getState().updateActiveDeliveryStatus('ACCEPTED');
      expect(useOrdersStore.getState().activeDelivery).toBeNull();
    });

    it('preserves current status on invalid backward transition attempt', () => {
      useOrdersStore.getState().setActiveDelivery(mockDelivery('EN_ROUTE_TO_PICKUP'));
      useOrdersStore.getState().updateActiveDeliveryStatus('ACCEPTED');
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('ACCEPTED');
    });
  });

  describe('complete delivery', () => {
    it('allows final DELIVERED status transition', () => {
      useOrdersStore.getState().setActiveDelivery(mockDelivery('ARRIVED_AT_CUSTOMER'));
      useOrdersStore.getState().updateActiveDeliveryStatus('DELIVERED');
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('DELIVERED');
    });

    it('clears active delivery after completion', () => {
      useOrdersStore.getState().setActiveDelivery(mockDelivery('DELIVERED'));
      useOrdersStore.getState().clearActive();
      expect(useOrdersStore.getState().activeDelivery).toBeNull();
    });
  });

  describe('active delivery lifecycle', () => {
    it('replaces existing active delivery on setActiveDelivery', () => {
      useOrdersStore.getState().setActiveDelivery(mockDelivery('ACCEPTED'));
      useOrdersStore.getState().setActiveDelivery(mockDelivery('PICKED_UP'));
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('PICKED_UP');
      expect(useOrdersStore.getState().activeDelivery?.order.id).toBe('order-1');
    });

    it('supports full valid lifecycle', () => {
      const validPath: DeliveryStatus[] = [
        'ASSIGNED',
        'ACCEPTED',
        'EN_ROUTE_TO_PICKUP',
        'ARRIVED_AT_PHARMACY',
        'PICKED_UP',
        'EN_ROUTE_TO_CUSTOMER',
        'ARRIVED_AT_CUSTOMER',
        'DELIVERED',
      ];
      useOrdersStore.getState().setActiveDelivery(mockDelivery('ASSIGNED'));
      validPath.forEach((status) => {
        useOrdersStore.getState().updateActiveDeliveryStatus(status);
        expect(useOrdersStore.getState().activeDelivery?.status).toBe(status);
      });
    });
  });

  describe('reset behavior', () => {
    it('clears available orders and active delivery', () => {
      useOrdersStore.getState().setActiveDelivery(mockDelivery('ACCEPTED'));
      useOrdersStore.getState().setAvailableOrders([
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
      ]);
      useOrdersStore.getState().reset();
      expect(useOrdersStore.getState().activeDelivery).toBeNull();
      expect(useOrdersStore.getState().availableOrders).toHaveLength(0);
      expect(useOrdersStore.getState().deliveryHistory).toHaveLength(0);
      expect(useOrdersStore.getState().lastFetchedAt).toBeNull();
    });
  });
});
