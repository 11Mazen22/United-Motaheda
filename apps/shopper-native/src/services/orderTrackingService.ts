/**
 * Order Tracking Service
 *
 * Manages realtime subscriptions for live driver-location + order-status
 * updates during customer order tracking, via the app's one canonical
 * realtime helper (subscribeToTable) rather than a second, hand-rolled
 * channel implementation.
 *
 * Rewritten from a version that never actually worked: it listened for
 * driver_locations UPDATE (the driver-location Edge Function only ever
 * INSERTs — a new row per ping, confirmed in supabase/functions/
 * driver-location/index.ts — so that listener received zero events, ever),
 * read payload.new.latitude/longitude (the real columns are lat/lng), and
 * tried to read driver name/phone/photo directly off the orders row (no
 * such columns exist there — driver identity only exists as
 * assigned_driver_id, a uuid needing a join to profiles).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { useOrderStore, Coordinate, ActiveOrder } from '@/stores/orders';
import { subscribeToTable, type TableSubscription } from '@/shared/lib/subscribeToTable';
import { normalizeOrderStatus } from '@/stores/orders';

// Part of this module's prior public surface. Not currently imported
// anywhere else in the repo, but kept — removing an exported type isn't
// part of the realtime fix, and another caller may already depend on this
// shape existing. Unrelated to DriverLocationRow/OrderStatusRow below,
// which are this file's own internal Supabase-row types for the (fixed)
// subscription handlers.
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

interface DriverLocationRow {
  [key: string]: unknown;
  order_id: string;
  driver_id: string;
  lat: number;
  lng: number;
  captured_at: string;
  speed_kmh?: number | null;
  heading?: number | null;
}

interface OrderStatusRow {
  [key: string]: unknown;
  id: string;
  status: string;
  assigned_driver_id: string | null;
}

class OrderTrackingService {
  private supabase: SupabaseClient | null = null;
  private locationSub: TableSubscription | null = null;
  private statusSub: TableSubscription | null = null;
  private activeOrderId: string | null = null;
  private isSubscribed: boolean = false;
  /** Avoid re-fetching the same driver's info on every subsequent status row. */
  private lastResolvedDriverId: string | null = null;
  /** Dev/QA-only — see simulateDriverMovement() below. Never set elsewhere. */
  private simulationInterval: ReturnType<typeof setInterval> | null = null;

  initialize(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  startTracking(order: ActiveOrder): void {
    this.stopTracking();

    this.activeOrderId = order.id;
    this.isSubscribed = true;
    this.lastResolvedDriverId = null;

    useOrderStore.getState().setActiveOrder(order);

    this.subscribeToDriverLocation(order.id);
    this.subscribeToOrderStatus(order.id);

    if (order.driverId) {
      this.lastResolvedDriverId = order.driverId;
    }

    console.log(`[OrderTrackingService] Started tracking order: ${order.id}`);
  }

  stopTracking(): void {
    this.locationSub?.unsubscribe();
    this.locationSub = null;
    this.statusSub?.unsubscribe();
    this.statusSub = null;
    // Switching/ending tracking must not leave a simulated feed running
    // underneath the next real order.
    this.stopSimulation();

    this.activeOrderId = null;
    this.isSubscribed = false;
    this.lastResolvedDriverId = null;

    useOrderStore.getState().clearActiveOrder();

    console.log('[OrderTrackingService] Stopped tracking');
  }

  // ---------------------------------------------------------------------
  // Dev/QA simulation utilities. Not part of the production tracking
  // path — nothing in startTracking/subscribeToDriverLocation/
  // subscribeToOrderStatus calls these. They let a developer or tester
  // manually drive the map through a route without a live driver GPS
  // feed. __DEV__-gated so this can never inject fake coordinates into a
  // production build, even if something later called it by mistake.
  // ---------------------------------------------------------------------

  simulateDriverMovement(route: Coordinate[], interval: number = 2000): void {
    if (!__DEV__) return;
    this.stopSimulation();

    if (!this.activeOrderId) {
      console.log('[OrderTrackingService] No active order to simulate');
      return;
    }

    let index = 0;
    this.simulationInterval = setInterval(() => {
      if (index >= route.length) {
        this.stopSimulation();
        return;
      }
      const point = route[index];
      useOrderStore.getState().updateDriverLocation(point);
      console.log(`[OrderTrackingService] Simulated location: lat=${point.lat}, lng=${point.lng}`);
      index += 1;
    }, interval);
  }

  stopSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  private subscribeToDriverLocation(orderId: string): void {
    this.locationSub = subscribeToTable<DriverLocationRow>(
      {
        channelName: 'order-tracking-location',
        table: 'driver_locations',
        event: 'INSERT',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        const row = payload.new as Partial<DriverLocationRow> | null | undefined;
        if (!row || typeof row.lat !== 'number' || typeof row.lng !== 'number') return;
        const coords: Coordinate = { lat: row.lat, lng: row.lng };
        useOrderStore.getState().updateDriverLocation(coords);
        // __DEV__-gated: fires on every GPS ping, would spam production logs otherwise.
        if (__DEV__) {
          console.log(`[OrderTrackingService] Driver location updated: lat=${coords.lat}, lng=${coords.lng}`);
        }
      },
    );
  }

  private subscribeToOrderStatus(orderId: string): void {
    this.statusSub = subscribeToTable<OrderStatusRow>(
      {
        channelName: 'order-tracking-status',
        table: 'orders',
        event: 'UPDATE',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        const row = payload.new as Partial<OrderStatusRow> | null | undefined;
        if (!row || typeof row.status !== 'string') return;

        const newStatus = normalizeOrderStatus(row.status);
        useOrderStore.getState().updateOrderStatus(newStatus);
        console.log(`[OrderTrackingService] Order status updated: ${newStatus}`);

        const driverId = row.assigned_driver_id ?? null;
        if (driverId && driverId !== this.lastResolvedDriverId) {
          this.lastResolvedDriverId = driverId;
          void this.resolveAndSetDriverInfo(driverId);
        } else if (!driverId) {
          this.lastResolvedDriverId = null;
        }
      },
    );
  }

  /** Best-effort — a failed lookup leaves the driver name/phone blank
   *  rather than blocking status/location updates. */
  private async resolveAndSetDriverInfo(driverId: string): Promise<void> {
    if (!this.supabase) {
      console.error('[OrderTrackingService] Supabase client not initialized');
      return;
    }
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', driverId)
        .maybeSingle();
      if (error || !data) return;
      useOrderStore.getState().setDriverInfo({
        driverId,
        driverName: (data as { full_name?: string | null }).full_name ?? null,
        driverPhone: (data as { phone?: string | null }).phone ?? null,
      });
    } catch {
      // Non-fatal — tracking continues without driver contact details.
    }
  }

  isTracking(): boolean {
    return this.isSubscribed && !!this.activeOrderId;
  }

  getActiveOrderId(): string | null {
    return this.activeOrderId;
  }

  cleanup(): void {
    this.stopTracking();
    this.supabase = null;
    console.log('[OrderTrackingService] Cleaned up');
  }
}

export const orderTrackingService = new OrderTrackingService();
