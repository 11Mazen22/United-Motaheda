/**
 * fetchOrderTracking — calls the track-order Edge Function to get a
 * TrackingSnapshot for one order identified by (orderId, qrToken).
 *
 * The function is token-authenticated (no user JWT required): the qr_token
 * is the bearer capability. This mirrors the shopper-web implementation in
 * apps/shopper-web/src/services/logisticsApi.ts fetchTrackingSnapshot().
 *
 * Return shape matches the TrackingSnapshot type used on the web; typed
 * locally here so shopper-native has no cross-app import dependency.
 */

import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrackingLocation {
  lat:         number;
  lng:         number;
  captured_at: string;
}

export interface TrackingDriver {
  first_name: string;
  phone:      string;
}

export interface TrackingOrder {
  id:           string;
  status:       string;
  destination:  Record<string, unknown>;
  customer_lat: number | null;
  customer_lng: number | null;
}

export interface TrackingSnapshot {
  order:    TrackingOrder;
  driver:   TrackingDriver | null;
  location: TrackingLocation | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function fetchOrderTracking(
  orderId:  string,
  qrToken:  string,
): Promise<TrackingSnapshot> {
  const { data, error } = await supabase.functions.invoke("track-order", {
    body: { order_id: orderId, token: qrToken },
  });

  if (error) throw error;

  const payload = data as TrackingSnapshot;
  return payload;
}
