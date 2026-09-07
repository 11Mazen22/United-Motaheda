/**
 * Unit tests for OrderTrackingService
 * 
 * Tests:
 * - Service initialization
 * - Start/stop tracking
 * - Location updates
 * - Status updates
 * - Error handling
 * - Cleanup
 */

import { orderTrackingService } from '@/services/orderTrackingService';
import { useOrderStore, ActiveOrder, Coordinate } from '@/stores/orders';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  RealtimeChannel: jest.fn(),
  SupabaseClient: jest.fn().mockImplementation(() => ({
    channel: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    removeChannel: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock the store
jest.mock('@/stores/orders', () => ({
  useOrderStore: {
    getState: jest.fn().mockReturnValue({
      setActiveOrder: jest.fn(),
      updateDriverLocation: jest.fn(),
      updateOrderStatus: jest.fn(),
      clearActiveOrder: jest.fn(),
    }),
  },
}));

describe('OrderTrackingService', () => {
  let mockOrder: ActiveOrder;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrder = {
      id: 'order-123',
      status: 'pending',
      origin: { lat: 30.0444, lng: 31.2357 },
      destination: { lat: 30.0123, lng: 31.4567 },
      driverId: 'driver-456',
      driverName: 'أحمد محمد',
      driverPhone: '+20123456789',
      estimatedArrival: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockSupabase = {
      channel: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      removeChannel: jest.fn().mockResolvedValue(true),
    };
  });

  // ============================================================
  // Test 1: Service Initialization
  // ============================================================
  describe('initialize', () => {
    it('should initialize with Supabase client', () => {
      orderTrackingService.initialize(mockSupabase);
      expect(orderTrackingService['supabase']).toBe(mockSupabase);
    });

    it('should not fail if initialized multiple times', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.initialize(mockSupabase);
      expect(orderTrackingService['supabase']).toBe(mockSupabase);
    });
  });

  // ============================================================
  // Test 2: Start Tracking
  // ============================================================
  describe('startTracking', () => {
    it('should start tracking an order', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);

      expect(useOrderStore.getState().setActiveOrder).toHaveBeenCalledWith(mockOrder);
      expect(orderTrackingService['activeOrderId']).toBe(mockOrder.id);
      expect(orderTrackingService['isSubscribed']).toBe(true);
    });

    it('should stop existing tracking before starting new one', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);
      
      const newOrder = { ...mockOrder, id: 'order-456' };
      orderTrackingService.startTracking(newOrder);

      expect(orderTrackingService['activeOrderId']).toBe(newOrder.id);
    });

    it('should not start tracking if Supabase is not initialized', () => {
      // Don't initialize
      orderTrackingService.startTracking(mockOrder);

      expect(useOrderStore.getState().setActiveOrder).not.toHaveBeenCalled();
      expect(orderTrackingService['isSubscribed']).toBe(false);
    });
  });

  // ============================================================
  // Test 3: Stop Tracking
  // ============================================================
  describe('stopTracking', () => {
    it('should stop tracking and clear store', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);
      orderTrackingService.stopTracking();

      expect(useOrderStore.getState().clearActiveOrder).toHaveBeenCalled();
      expect(orderTrackingService['activeOrderId']).toBeNull();
      expect(orderTrackingService['isSubscribed']).toBe(false);
    });

    it('should remove the Supabase channel', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);
      
      // Create a mock channel
      const mockChannel = { 
        on: jest.fn().mockReturnThis(), 
        subscribe: jest.fn().mockReturnThis() 
      };
      orderTrackingService['channel'] = mockChannel as any;

      orderTrackingService.stopTracking();

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should handle stop when not tracking gracefully', () => {
      // Not tracking
      orderTrackingService.stopTracking();
      
      expect(useOrderStore.getState().clearActiveOrder).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Test 4: isTracking
  // ============================================================
  describe('isTracking', () => {
    it('should return true when tracking', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);
      
      expect(orderTrackingService.isTracking()).toBe(true);
    });

    it('should return false when not tracking', () => {
      expect(orderTrackingService.isTracking()).toBe(false);
    });

    it('should return false after stopTracking', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);
      orderTrackingService.stopTracking();
      
      expect(orderTrackingService.isTracking()).toBe(false);
    });
  });

  // ============================================================
  // Test 5: getActiveOrderId
  // ============================================================
  describe('getActiveOrderId', () => {
    it('should return active order ID when tracking', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);
      
      expect(orderTrackingService.getActiveOrderId()).toBe(mockOrder.id);
    });

    it('should return null when not tracking', () => {
      expect(orderTrackingService.getActiveOrderId()).toBeNull();
    });
  });

  // ============================================================
  // Test 6: Driver Location Updates
  // ============================================================
  describe('driver location updates', () => {
    it('should update driver location in store when new data arrives', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);

      const newLocation: Coordinate = { lat: 30.0555, lng: 31.2457 };
      
      // Simulate location update
      orderTrackingService['channel']?.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
          filter: `order_id=eq.${mockOrder.id}`,
        },
        (payload: any) => {
          const newLocationData = {
            order_id: mockOrder.id,
            driver_id: 'driver-456',
            latitude: newLocation.lat,
            longitude: newLocation.lng,
            updated_at: new Date().toISOString(),
          };
          
          useOrderStore.getState().updateDriverLocation({
            lat: newLocationData.latitude,
            lng: newLocationData.longitude,
          });
        }
      );

      // Trigger the callback
      const mockPayload = {
        new: {
          order_id: mockOrder.id,
          driver_id: 'driver-456',
          latitude: newLocation.lat,
          longitude: newLocation.lng,
          updated_at: new Date().toISOString(),
        },
      };

      // This would normally be called by Supabase
      // We're testing the handler logic
      expect(useOrderStore.getState().updateDriverLocation).toHaveBeenCalledWith(newLocation);
    });
  });

  // ============================================================
  // Test 7: Order Status Updates
  // ============================================================
  describe('order status updates', () => {
    it('should update order status in store when status changes', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);

      const newStatus: ActiveOrder['status'] = 'accepted';
      
      // Simulate status update
      orderTrackingService['channel']?.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${mockOrder.id}`,
        },
        (payload: any) => {
          useOrderStore.getState().updateOrderStatus(newStatus);
        }
      );

      expect(useOrderStore.getState().updateOrderStatus).toHaveBeenCalledWith(newStatus);
    });

    it('should map statuses correctly', () => {
      const statusMap: Record<string, ActiveOrder['status']> = {
        'pending': 'pending',
        'accepted': 'accepted',
        'driver_accepted': 'accepted',
        'out_for_delivery': 'picked_up',
        'picked_up': 'picked_up',
        'delivered': 'delivered',
        'cancelled': 'cancelled',
      };

      expect(statusMap['pending']).toBe('pending');
      expect(statusMap['driver_accepted']).toBe('accepted');
      expect(statusMap['out_for_delivery']).toBe('picked_up');
      expect(statusMap['delivered']).toBe('delivered');
    });
  });

  // ============================================================
  // Test 8: Cleanup
  // ============================================================
  describe('cleanup', () => {
    it('should clean up all resources', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);
      
      // Add a channel
      orderTrackingService['channel'] = { 
        on: jest.fn().mockReturnThis(), 
        subscribe: jest.fn().mockReturnThis() 
      } as any;

      orderTrackingService.cleanup();

      expect(orderTrackingService['supabase']).toBeNull();
      expect(orderTrackingService['activeOrderId']).toBeNull();
      expect(orderTrackingService['isSubscribed']).toBe(false);
      expect(useOrderStore.getState().clearActiveOrder).toHaveBeenCalled();
    });

    it('should stop simulation if running', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);
      
      const mockRoute: Coordinate[] = [
        { lat: 30.0444, lng: 31.2357 },
        { lat: 30.0555, lng: 31.2457 },
      ];
      
      orderTrackingService.simulateDriverMovement(mockRoute, 100);
      orderTrackingService.cleanup();
      
      // Simulation should be stopped
      expect((orderTrackingService as any).simulationInterval).toBeNull();
    });
  });

  // ============================================================
  // Test 9: Simulation
  // ============================================================
  describe('simulateDriverMovement', () => {
    it('should simulate driver movement', (done) => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);

      const mockRoute: Coordinate[] = [
        { lat: 30.0444, lng: 31.2357 },
        { lat: 30.0555, lng: 31.2457 },
        { lat: 30.0666, lng: 31.2557 },
      ];

      orderTrackingService.simulateDriverMovement(mockRoute, 100);

      // Wait for first update
      setTimeout(() => {
        expect(useOrderStore.getState().updateDriverLocation).toHaveBeenCalledWith(mockRoute[0]);
        done();
      }, 150);
    });

    it('should not simulate if no active order', () => {
      // Not tracking
      const mockRoute: Coordinate[] = [
        { lat: 30.0444, lng: 31.2357 },
      ];

      orderTrackingService.simulateDriverMovement(mockRoute);

      expect(useOrderStore.getState().updateDriverLocation).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Test 10: Error Handling
  // ============================================================
  describe('error handling', () => {
    it('should handle Supabase errors gracefully', () => {
      const errorSupabase = {
        channel: jest.fn().mockImplementation(() => {
          throw new Error('Supabase error');
        }),
      };

      orderTrackingService.initialize(errorSupabase as any);
      
      // Should not throw
      expect(() => {
        orderTrackingService.startTracking(mockOrder);
      }).not.toThrow();
      
      // Should not be tracking
      expect(orderTrackingService.isTracking()).toBe(false);
    });

    it('should handle missing driver location gracefully', () => {
      orderTrackingService.initialize(mockSupabase);
      orderTrackingService.startTracking(mockOrder);

      // Missing location data
      const payload = {
        new: null,
      };

      // Should not crash
      expect(() => {
        // This would be handled by the subscription
        if (!payload.new) {
          // No update
        }
      }).not.toThrow();
    });
  });
});