import { useOrdersStore, type DeliveryStatus, type ActiveDelivery, type AvailableOrder } from '../src/stores/orders.store';

describe('orders.store', () => {
  beforeEach(() => {
    useOrdersStore.getState().reset();
  });

  describe('active delivery lifecycle', () => {
    const mockDelivery: ActiveDelivery = {
      assignmentId: 'assign-1',
      status: 'ACCEPTED',
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
    };

    it('sets active delivery', () => {
      useOrdersStore.getState().setActiveDelivery(mockDelivery);
      expect(useOrdersStore.getState().activeDelivery?.order.id).toBe('order-1');
    });

    it('updates active delivery status through valid transitions', () => {
      useOrdersStore.getState().setActiveDelivery(mockDelivery);
      useOrdersStore.getState().updateActiveDeliveryStatus('EN_ROUTE_TO_PICKUP');
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('EN_ROUTE_TO_PICKUP');

      useOrdersStore.getState().updateActiveDeliveryStatus('ARRIVED_AT_PHARMACY');
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('ARRIVED_AT_PHARMACY');

      useOrdersStore.getState().updateActiveDeliveryStatus('PICKED_UP');
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('PICKED_UP');

      useOrdersStore.getState().updateActiveDeliveryStatus('EN_ROUTE_TO_CUSTOMER');
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('EN_ROUTE_TO_CUSTOMER');

      useOrdersStore.getState().updateActiveDeliveryStatus('ARRIVED_AT_CUSTOMER');
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('ARRIVED_AT_CUSTOMER');

      useOrdersStore.getState().updateActiveDeliveryStatus('DELIVERED');
      expect(useOrdersStore.getState().activeDelivery?.status).toBe('DELIVERED');
    });

    it('clears active delivery on completion', () => {
      useOrdersStore.getState().setActiveDelivery(mockDelivery);
      useOrdersStore.getState().clearActive();
      expect(useOrdersStore.getState().activeDelivery).toBeNull();
    });

    it('sets available orders', () => {
      const orders: AvailableOrder[] = [
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
          pharmacy: { name: 'P1', lat: 30.0444, lng: 31.2357, address: 'Pharmacy St' },
          estimatedEarnings: 30,
          distanceToPickupMeters: 500,
          distanceToCustomerMeters: 1200,
          totalDistanceKm: 1.7,
          estimatedMinutes: 10,
        },
        {
          id: '2',
          customerName: 'C2',
          customerPhone: '01087654321',
          customerAddress: 'A2',
          customerLat: 30.1,
          customerLng: 31.1,
          itemCount: 1,
          subtotal: '20',
          total: '35',
          paymentMethod: 'Card',
          note: null,
          createdAt: '2024-01-01',
          pharmacy: { name: 'P2', lat: 30.05, lng: 31.24, address: 'Pharmacy St 2' },
          estimatedEarnings: 45,
          distanceToPickupMeters: 800,
          distanceToCustomerMeters: 1500,
          totalDistanceKm: 2.3,
          estimatedMinutes: 15,
        },
      ];
      useOrdersStore.getState().setAvailableOrders(orders);
      expect(useOrdersStore.getState().availableOrders).toHaveLength(2);
      expect(useOrdersStore.getState().availableOrders[0].id).toBe('1');
    });
  });

  describe('state reset', () => {
    it('resets all state to initial values', () => {
      useOrdersStore.getState().setActiveDelivery({
        assignmentId: '1',
        status: 'ACCEPTED',
        pharmacyName: 'P',
        pharmacyLat: 30,
        pharmacyLng: 31,
        pharmacyAddress: 'PA',
        assignedAt: '2024-01-01T00:00:00Z',
        acceptedAt: '2024-01-01T00:00:00Z',
        estimatedEarnings: '50',
        order: {
          id: '1',
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
      });
      useOrdersStore.getState().setAvailableOrders([
        {
          id: '1',
          customerName: 'C',
          customerPhone: '01012345678',
          customerAddress: 'A',
          customerLat: 30,
          customerLng: 31,
          itemCount: 0,
          subtotal: '0',
          total: '0',
          paymentMethod: 'Cash',
          note: null,
          createdAt: '2024-01-01',
          pharmacy: { name: 'P', lat: 30, lng: 31, address: 'PA' },
          estimatedEarnings: 0,
          distanceToPickupMeters: 0,
          distanceToCustomerMeters: 0,
          totalDistanceKm: 0,
          estimatedMinutes: 0,
        },
      ]);

      useOrdersStore.getState().reset();

      expect(useOrdersStore.getState().activeDelivery).toBeNull();
      expect(useOrdersStore.getState().availableOrders).toHaveLength(0);
    });
  });
});
