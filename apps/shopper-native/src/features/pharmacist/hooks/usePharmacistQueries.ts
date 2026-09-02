/**
 * Pharmacist TanStack Query hooks — read operations.
 *
 * Conventions match features/driver/hooks/useDriverManifest.ts:
 *   - staleTime: 15 s for live-critical queues, 60 s for slower datasets
 *   - gcTime: 5 min
 *   - retry: 2
 *   - refetchOnWindowFocus: false (Expo app, no window focus concept)
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchDashboardStats }         from "../api/dashboard";
import {
  listPharmacistOrderQueue,
  getPharmacistOrder,
  getTodayOrdersForAnalytics,
  getRecentlyCompletedOrders,
  getOrderDeliveryAssignment,
  getOrderTimeline,
  getActiveDeliveryIssue,
  getActiveReturnRequestId,
  listPendingReturns,
}                                      from "../api/orders";
import {
  listPendingPrescriptions,
  listAllPrescriptions,
  getPrescription,
  getPrescriptionImageSignedUrl,
  getPrescriptionStatusCounts,
}                                      from "../api/prescriptions";
import {
  searchProducts,
  getLowStockProducts,
  getOutOfStockProducts,
}                                      from "../api/inventory";
import { listRefillRequests }          from "../api/refills";
import { pharmacistQueryKeys }         from "./queryKeys";
import type { PrescriptionReviewStatus, RefillRequestStatus } from "../api/types";

const BASE = { staleTime: 15_000, gcTime: 5 * 60_000, retry: 2, refetchOnWindowFocus: false } as const;

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export function usePharmacistDashboard() {
  return useQuery({
    queryKey: pharmacistQueryKeys.dashboard(),
    queryFn:  fetchDashboardStats,
    staleTime: 30_000,
    gcTime:    5 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
    refetchInterval:      60_000,   // auto-refresh every 60 s
  });
}

// ─── Order queue ───────────────────────────────────────────────────────────────

export function usePharmacistOrderQueue() {
  return useQuery({
    queryKey: pharmacistQueryKeys.orderQueue(),
    queryFn:  listPharmacistOrderQueue,
    ...BASE,
    staleTime: 10_000,
  });
}

export function usePharmacistReturns() {
  return useQuery({
    queryKey: pharmacistQueryKeys.returnsQueue(),
    queryFn:  listPendingReturns,
    ...BASE,
    staleTime: 15_000,
  });
}

export function usePharmacistOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: pharmacistQueryKeys.order(orderId ?? ""),
    queryFn:  () => getPharmacistOrder(orderId!),
    enabled:  Boolean(orderId),
    ...BASE,
  });
}

export function useOrderDeliveryAssignment(orderId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...pharmacistQueryKeys.order(orderId ?? ""), "delivery-assignment"],
    queryFn:  () => getOrderDeliveryAssignment(orderId!),
    enabled:  Boolean(orderId) && enabled,
    ...BASE,
  });
}

export function useActiveDeliveryIssue(orderId: string | null | undefined) {
  return useQuery({
    queryKey: [...pharmacistQueryKeys.order(orderId ?? ""), "delivery-issue"],
    queryFn:  () => getActiveDeliveryIssue(orderId!),
    enabled:  Boolean(orderId),
    ...BASE,
    staleTime: 15_000,
  });
}

export function useActiveReturnRequest(orderId: string | null | undefined) {
  return useQuery({
    queryKey: [...pharmacistQueryKeys.order(orderId ?? ""), "return-request"],
    queryFn:  () => getActiveReturnRequestId(orderId!),
    enabled:  Boolean(orderId),
    ...BASE,
    staleTime: 15_000,
  });
}

export function useOrderTimeline(orderId: string | null | undefined) {
  return useQuery({
    queryKey: [...pharmacistQueryKeys.order(orderId ?? ""), "timeline"],
    queryFn:  () => getOrderTimeline(orderId!),
    enabled:  Boolean(orderId),
    ...BASE,
    staleTime: 20_000,
  });
}

export function useRecentlyCompletedOrders() {
  return useQuery({
    queryKey: pharmacistQueryKeys.recentlyCompleted(),
    queryFn:  () => getRecentlyCompletedOrders(8),
    ...BASE,
    staleTime: 30_000,
  });
}

export function useTodayOrdersForAnalytics(dateISO: string) {
  return useQuery({
    queryKey: pharmacistQueryKeys.todayOrders(dateISO),
    queryFn:  () => getTodayOrdersForAnalytics(dateISO),
    ...BASE,
    staleTime: 60_000,
  });
}

// ─── Prescriptions ─────────────────────────────────────────────────────────────

export function usePrescriptionQueue() {
  return useQuery({
    queryKey: pharmacistQueryKeys.prescriptionQueue(),
    queryFn:  listPendingPrescriptions,
    ...BASE,
  });
}

export function useAllPrescriptions(reviewStatus?: PrescriptionReviewStatus) {
  return useQuery({
    queryKey: pharmacistQueryKeys.prescriptions(reviewStatus),
    queryFn:  () => listAllPrescriptions(reviewStatus),
    ...BASE,
    staleTime:       30_000,
    placeholderData: keepPreviousData,
  });
}

export function usePrescriptionStatusCounts() {
  return useQuery({
    queryKey: pharmacistQueryKeys.prescriptionCounts(),
    queryFn:  getPrescriptionStatusCounts,
    ...BASE,
    staleTime: 30_000,
  });
}

export function usePrescription(id: string | null | undefined) {
  return useQuery({
    queryKey: pharmacistQueryKeys.prescription(id ?? ""),
    queryFn:  () => getPrescription(id!),
    enabled:  Boolean(id),
    ...BASE,
  });
}

export function usePrescriptionImage(imagePath: string | null | undefined) {
  return useQuery({
    queryKey: [...pharmacistQueryKeys.prescriptions(undefined), "image", imagePath],
    queryFn:  () => getPrescriptionImageSignedUrl(imagePath!),
    enabled:  Boolean(imagePath),
    staleTime: 50_000, // Valid for 60s, refetch slightly before
  });
}

// ─── Inventory ─────────────────────────────────────────────────────────────────

export function useProductSearch(query: string) {
  return useQuery({
    queryKey: pharmacistQueryKeys.products(query),
    queryFn:  () => searchProducts(query, { limit: 30 }),
    enabled:  query.trim().length >= 1,
    staleTime: 60_000,
    gcTime:    5 * 60_000,
    retry:     1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: pharmacistQueryKeys.lowStock(),
    queryFn:  () => getLowStockProducts(5, 50),
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
  });
}

// ─── Refills ───────────────────────────────────────────────────────────────────

export function usePharmacistRefills(status?: RefillRequestStatus | "all") {
  return useQuery({
    queryKey: pharmacistQueryKeys.refills(status),
    queryFn:  () => listRefillRequests(status),
    ...BASE,
    staleTime: 20_000,
  });
}

export function useOutOfStockProducts() {
  return useQuery({
    queryKey: [...pharmacistQueryKeys.lowStock(), "out-of-stock"],
    queryFn:  () => getOutOfStockProducts(100),
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
    retry:     2,
    refetchOnWindowFocus: false,
  });
}
