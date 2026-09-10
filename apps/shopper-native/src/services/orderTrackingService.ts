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
  }

  stopTracking(): void {
    this.locationSub?.unsubscribe();
    this.locationSub = null;
    this.statusSub?.unsubscribe();
    this.statusSub = null;

    this.activeOrderId = null;
    this.isSubscribed = false;
    this.lastResolvedDriverId = null;

    useOrderStore.getState().clearActiveOrder();
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

        useOrderStore.getState().updateOrderStatus(normalizeOrderStatus(row.status));

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
    if (!this.supabase) return;
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
  }
}

export const orderTrackingService = new OrderTrackingService();
