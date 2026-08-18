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
}                                      from "../api/orders";
import {
  listPendingPrescriptions,
  listAllPrescriptions,
  getPrescription,
  getPrescriptionImageSignedUrl,
}                                      from "../api/prescriptions";
import {
  searchProducts,
  getLowStockProducts,
  getOutOfStockProducts,
}                                      from "../api/inventory";
import { pharmacistQueryKeys }         from "./queryKeys";
import type { PrescriptionReviewStatus } from "../api/types";

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

export function usePharmacistOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: pharmacistQueryKeys.order(orderId ?? ""),
    queryFn:  () => getPharmacistOrder(orderId!),
    enabled:  Boolean(orderId),
    ...BASE,
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
