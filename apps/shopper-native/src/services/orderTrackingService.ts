/**
 * Order Tracking Service
 * 
 * Manages Supabase Realtime subscriptions for live driver location updates.
 * Emits coordinate changes to the Zustand store.
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { useOrderStore, Coordinate, ActiveOrder } from '@/stores/orders';

export interface DriverLocationUpdate {
  orderId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
  heading?: number;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: 'pending' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
  timestamp: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverPhoto?: string;
  estimatedArrival?: number;
}

class OrderTrackingService {
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private activeOrderId: string | null = null;
  private isSubscribed: boolean = false;

  /**
   * Initialize the service with Supabase client
   */
  initialize(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Start tracking a specific order
   */
  startTracking(order: ActiveOrder): void {
    if (!this.supabase) {
      console.error('[OrderTrackingService] Supabase client not initialized');
      return;
    }

    // Stop any existing tracking
    this.stopTracking();

    this.activeOrderId = order.id;
    this.isSubscribed = true;

    // Set the active order in the store
    useOrderStore.getState().setActiveOrder(order);

    // Subscribe to driver location updates
    this.subscribeToDriverLocation(order.id);

    // Subscribe to order status updates
    this.subscribeToOrderStatus(order.id);

    console.log(`[OrderTrackingService] Started tracking order: ${order.id}`);
  }

  /**
   * Stop tracking the current order
   */
  stopTracking(): void {
    if (this.channel) {
      this.supabase?.removeChannel(this.channel);
      this.channel = null;
    }

    this.activeOrderId = null;
    this.isSubscribed = false;

    // Clear the active order from store
    useOrderStore.getState().clearActiveOrder();

    console.log('[OrderTrackingService] Stopped tracking');
  }

  /**
   * Subscribe to real-time driver location updates
   */
  private subscribeToDriverLocation(orderId: string): void {
    if (!this.supabase) return;

    // Listen for changes on the driver_locations table
    this.channel = this.supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newLocation = payload.new as {
            order_id: string;
            driver_id: string;
            latitude: number;
            longitude: number;
            updated_at: string;
            speed?: number;
            heading?: number;
          };

          if (newLocation) {
            const coords: Coordinate = {
              lat: newLocation.latitude,
              lng: newLocation.longitude,
            };

            // Update the store with new driver location
            useOrderStore.getState().updateDriverLocation(coords);
            
            console.log(
              `[OrderTrackingService] Driver location updated: lat=${coords.lat}, lng=${coords.lng}`
            );
          }
        }
      )
      .subscribe((status) => {
        console.log(`[OrderTrackingService] Driver location subscription status: ${status}`);
      });
  }

  /**
   * Subscribe to real-time order status updates
   */
  private subscribeToOrderStatus(orderId: string): void {
    if (!this.supabase) return;

    // We reuse the same channel but add another listener
    this.channel?.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        const newOrder = payload.new as {
          id: string;
          status: string;
          driver_id?: string;
          driver_name?: string;
          driver_phone?: string;
          driver_photo?: string;
          estimated_arrival?: number;
        };

        if (newOrder) {
          const statusMap: Record<string, ActiveOrder['status']> = {
            'pending': 'pending',
            'accepted': 'accepted',
            'driver_accepted': 'accepted',
            'out_for_delivery': 'picked_up',
            'picked_up': 'picked_up',
            'delivered': 'delivered',
            'cancelled': 'cancelled',
          };

          const newStatus = statusMap[newOrder.status] || 'pending';

          // Update order status in store
          useOrderStore.getState().updateOrderStatus(newStatus);

          // Also update driver info if available
          const currentOrder = useOrderStore.getState().activeOrder;
          if (currentOrder && (newOrder.driver_id || newOrder.driver_name)) {
            useOrderStore.getState().setActiveOrder({
              ...currentOrder,
              driverId: newOrder.driver_id || currentOrder.driverId,
              driverName: newOrder.driver_name || currentOrder.driverName,
              driverPhone: newOrder.driver_phone || currentOrder.driverPhone,
              driverPhoto: newOrder.driver_photo || currentOrder.driverPhoto,
              estimatedArrival: newOrder.estimated_arrival || currentOrder.estimatedArrival,
            });
          }

          console.log(`[OrderTrackingService] Order status updated: ${newStatus}`);
        }
      }
    );
  }

  /**
   * Check if currently tracking an order
   */
  isTracking(): boolean {
    return this.isSubscribed && !!this.activeOrderId;
  }

  /**
   * Get the current active order ID
   */
  getActiveOrderId(): string | null {
    return this.activeOrderId;
  }

  /**
   * Simulate driver location updates (for testing)
   */
  simulateDriverMovement(route: Coordinate[], interval: number = 2000): void {
    if (!this.activeOrderId) {
      console.error('[OrderTrackingService] No active order to simulate');
      return;
    }

    let index = 0;
    const intervalId = setInterval(() => {
      if (index >= route.length) {
        clearInterval(intervalId);
        return;
      }

      const point = route[index];
      useOrderStore.getState().updateDriverLocation(point);
      console.log(`[OrderTrackingService] Simulated location: lat=${point.lat}, lng=${point.lng}`);

      index++;
    }, interval);

    // Store interval ID for cleanup
    (this as any).simulationInterval = intervalId;
  }

  /**
   * Stop simulation (if running)
   */
  stopSimulation(): void {
    if ((this as any).simulationInterval) {
      clearInterval((this as any).simulationInterval);
      (this as any).simulationInterval = null;
    }
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    this.stopTracking();
    this.stopSimulation();
    this.supabase = null;
    this.activeOrderId = null;
    this.isSubscribed = false;
    console.log('[OrderTrackingService] Cleaned up');
  }
}

// Export a singleton instance
export const orderTrackingService = new OrderTrackingService();