/**
 * useDriverManifest — React Query wrappers around the driver API's read
 * paths. Mirrors features/orders/hooks/useOrders.ts's conventions exactly
 * (query keys, staleTime/gcTime/retry shape, refetchOnWindowFocus: false).
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMyManifest,
  listMyOpenAssignmentOffers,
  getAssignment,
  getMyAssignmentForOrder,
  getOrderForDriver,
  listMyIssuesForOrder,
  getMyAcceptanceRate,
  type ManifestOrder,
  type DeliveryAssignment,
  type AssignmentOffer,
  type Order,
  type DeliveryIssue,
} from "../api";

export type { ManifestOrder, DeliveryAssignment, AssignmentOffer, Order, DeliveryIssue } from "../api";

export const driverQueryKeys = {
  manifest:           (driverId: string) => ["driver", "manifest", driverId] as const,
  offers:             (driverId: string) => ["driver", "offers",   driverId] as const,
  offer:              (assignmentId: string) => ["driver", "offer", assignmentId] as const,
  order:              (orderId: string) => ["driver", "order", orderId] as const,
  assignmentForOrder: (orderId: string) => ["driver", "assignmentForOrder", orderId] as const,
  issues:             (orderId: string) => ["driver", "issues", orderId] as const,
  acceptanceRate:     (driverId: string) => ["driver", "acceptanceRate", driverId] as const,
};

/** Orders currently assigned to me and in an active delivery stage. */
export function useDriverManifest(driverId: string | null | undefined) {
  return useQuery<ManifestOrder[], Error>({
    queryKey:  driverQueryKeys.manifest(driverId ?? ""),
    queryFn:   () => listMyManifest(driverId!),
    enabled:   Boolean(driverId),
    staleTime: 15_000,
    gcTime:    5 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
  });
}

/** New assignment offers awaiting my accept/decline. */
export function useDriverOffers(driverId: string | null | undefined) {
  return useQuery<AssignmentOffer[], Error>({
    queryKey:  driverQueryKeys.offers(driverId ?? ""),
    queryFn:   () => listMyOpenAssignmentOffers(driverId!),
    enabled:   Boolean(driverId),
    staleTime: 10_000,
    gcTime:    5 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
  });
}

export function useDriverOffer(assignmentId: string | null | undefined, driverId: string | null | undefined) {
  return useQuery<DeliveryAssignment | null, Error>({
    queryKey:  driverQueryKeys.offer(assignmentId ?? ""),
    queryFn:   () => getAssignment(assignmentId!, driverId!),
    enabled:   Boolean(assignmentId) && Boolean(driverId),
    staleTime: 10_000,
    gcTime:    5 * 60_000,
    retry:     1,
    refetchOnWindowFocus: false,
  });
}

/** The currently-accepted assignment for one order — the delivery-execution
 * screen is navigated to with only an orderId, so it needs this to know
 * which assignment row to update on pickup/deliver. */
export function useMyAssignmentForOrder(orderId: string | null | undefined, driverId: string | null | undefined) {
  return useQuery<DeliveryAssignment | null, Error>({
    queryKey:  driverQueryKeys.assignmentForOrder(orderId ?? ""),
    queryFn:   () => getMyAssignmentForOrder(orderId!, driverId!),
    enabled:   Boolean(orderId) && Boolean(driverId),
    staleTime: 15_000,
    gcTime:    5 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
  });
}

/** Order detail for the delivery-execution screen. */
export function useDriverOrderDetail(orderId: string | null | undefined) {
  return useQuery<Order | null, Error>({
    queryKey:  driverQueryKeys.order(orderId ?? ""),
    queryFn:   () => getOrderForDriver(orderId!),
    enabled:   Boolean(orderId),
    staleTime: 15_000,
    gcTime:    5 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
  });
}

/** My own past issue reports for one order — lets the issue-report screen
 * warn "you already reported this" instead of allowing silent duplicates. */
export function useMyIssuesForOrder(orderId: string | null | undefined, driverId: string | null | undefined) {
  return useQuery<DeliveryIssue[], Error>({
    queryKey:  driverQueryKeys.issues(orderId ?? ""),
    queryFn:   () => listMyIssuesForOrder(orderId!, driverId!),
    enabled:   Boolean(orderId) && Boolean(driverId),
    staleTime: 10_000,
    gcTime:    5 * 60_000,
    retry:     1,
    refetchOnWindowFocus: false,
  });
}

export function useMyAcceptanceRate(driverId: string | null | undefined) {
  return useQuery<number, Error>({
    queryKey:  driverQueryKeys.acceptanceRate(driverId ?? ""),
    queryFn:   () => getMyAcceptanceRate(driverId!),
    enabled:   Boolean(driverId),
    staleTime: 30_000,
    gcTime:    5 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
  });
}

/** Invalidate the manifest + offers lists — call after any mutation that
 * changes assignment or order state, so the task list reflects it immediately
 * even before the realtime layer (Phase 4) lands. */
export function invalidateDriverLists(
  queryClient: ReturnType<typeof useQueryClient>,
  driverId: string,
) {
  void queryClient.invalidateQueries({ queryKey: driverQueryKeys.manifest(driverId) });
  void queryClient.invalidateQueries({ queryKey: driverQueryKeys.offers(driverId) });
}
