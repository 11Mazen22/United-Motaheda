/**
 * useOrderTracking — TanStack Query wrapper for the track-order Edge Function.
 *
 * Mirrors the conventions established in useOrders.ts and useDriverManifest.ts:
 *   - staleTime / gcTime / retry matching the project pattern
 *   - refetchOnWindowFocus: false  (same as all other order queries)
 *   - enabled guard: requires both orderId and qrToken
 *
 * Polling at 20 000 ms matches the driver broadcast interval (DeliveryExecutionScreen
 * calls pushDriverLocation every 20 s) and the web client's OrderTracking.tsx
 * setInterval. The realtime subscription added in Task 5 will trigger
 * invalidation faster when a new ping arrives; the poll acts as a fallback
 * for environments where realtime is unavailable or the subscription
 * temporarily drops (matching the retry pattern in notifications/realtime.ts).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrderTracking, type TrackingSnapshot } from "../api/fetchOrderTracking";

// ─── Query key ────────────────────────────────────────────────────────────────

export const trackingQueryKeys = {
  snapshot: (orderId: string) => ["orders", "tracking", orderId] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOrderTracking(
  orderId:  string | null | undefined,
  qrToken:  string | null | undefined,
) {
  return useQuery<TrackingSnapshot, Error>({
    queryKey:     trackingQueryKeys.snapshot(orderId ?? ""),
    queryFn:      () => fetchOrderTracking(orderId!, qrToken!),
    enabled:      Boolean(orderId) && Boolean(qrToken),
    staleTime:    15_000,
    gcTime:       5 * 60_000,
    retry:        2,
    refetchInterval:     20_000,  // poll matches driver broadcast cadence
    refetchOnWindowFocus: false,
  });
}

// ─── Invalidation helper ──────────────────────────────────────────────────────

/** Called by the realtime subscription (Task 5) on driver_locations INSERT. */
export function invalidateOrderTracking(
  queryClient: ReturnType<typeof useQueryClient>,
  orderId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: trackingQueryKeys.snapshot(orderId),
  });
}
