/**
 * Delivery quote hook — now backed by the Supabase-native zone engine.
 *
 * Reconstruction pass (2026-08-26): this used to compute a flat delivery fee
 * client-side (free above a threshold, otherwise a hardcoded constant) and
 * "deliverable" was a Cairo bounding-box + fixed-radius circle check — never
 * touching the real, seeded, polygon-based Branch/DeliveryZone tables. It now
 * calls resolve_delivery_zone() (see supabase/migrations/
 * 20260826956000_delivery_zone_resolution_rpc.sql), the same RPC the
 * create-order Edge Function uses to compute the authoritative fee — so the
 * price shown at checkout and the price actually charged can never drift
 * apart. The rich Branch object (name, phone, hours) for display purposes
 * still comes from useBranches(); resolve_delivery_zone only returns the
 * branch id, which is looked up against that same static/queried list — the
 * two use the same id namespace (confirmed live: "gardenia" exists in both).
 *
 * Contract (DeliveryQuote) is unchanged — existing consumers (checkout.tsx)
 * don't need to change.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { FREE_DELIVERY_THRESHOLD, DELIVERY_ETA } from "./constants";
import { hasValidCoordinates } from "./geofencing";
import { useBranches } from "./branches/useBranches";
import { findBranchById, getPrimaryBranch } from "./branches/data";
import type { DeliveryQuote, DeliveryQuoteInput } from "./types";

interface ZoneRpcRow {
  branch_id: string;
  branch_name_ar: string;
  branch_name_en: string;
  zone_id: string;
  zone_name: string;
  base_fee: number;
  effective_fee: number;
  surge_applied: boolean;
  free_above_subtotal: number | null;
  distance_km: number;
}

async function fetchZone(lat: number, lng: number, subtotal: number): Promise<ZoneRpcRow | null> {
  const { data, error } = await supabase
    .rpc("resolve_delivery_zone", { p_lat: lat, p_lng: lng, p_subtotal: subtotal })
    .maybeSingle();
  if (error) throw error;
  return (data as ZoneRpcRow | null) ?? null;
}

export function useDeliveryQuote(input: DeliveryQuoteInput): DeliveryQuote {
  const { t } = useTranslation();
  const { data: branches = [], isLoading: branchesLoading } = useBranches();

  const subtotal = Math.max(0, Number.isFinite(input.subtotal) ? input.subtotal : 0);
  const hasCoords = !!input.customerCoords && hasValidCoordinates(input.customerCoords.lat, input.customerCoords.lng);
  const lat = hasCoords ? input.customerCoords!.lat : null;
  const lng = hasCoords ? input.customerCoords!.lng : null;

  const zoneQuery = useQuery({
    queryKey: ["delivery-zone", lat, lng, subtotal],
    queryFn: () => fetchZone(lat!, lng!, subtotal),
    enabled: hasCoords,
    staleTime: 60_000,
  });

  return useMemo<DeliveryQuote>(() => {
    const isFree = subtotal >= FREE_DELIVERY_THRESHOLD;

    // No coordinates yet — nothing to quote. Matches create-order's own
    // "location_required" rejection: a text-only address is no longer
    // enough to place an order, so it shouldn't look deliverable here either.
    if (!hasCoords) {
      const fallbackBranch = input.branchId ? findBranchById(input.branchId) : null;
      return {
        cost: 0,
        eta: { min: DELIVERY_ETA.min, max: DELIVERY_ETA.max },
        isDeliverable: false,
        isFree: false,
        amountToFreeDelivery: Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
        isLoading: branchesLoading,
        branch: fallbackBranch ?? getPrimaryBranch(),
        distanceKm: null,
        outOfServiceMessage: null,
      };
    }

    if (zoneQuery.isLoading || branchesLoading) {
      return {
        cost: 0,
        eta: { min: DELIVERY_ETA.min, max: DELIVERY_ETA.max },
        isDeliverable: false,
        isFree: false,
        amountToFreeDelivery: Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
        isLoading: true,
        branch: null,
        distanceKm: null,
        outOfServiceMessage: null,
      };
    }

    if (zoneQuery.isError) {
      return {
        cost: 0,
        eta: { min: DELIVERY_ETA.min, max: DELIVERY_ETA.max },
        isDeliverable: false,
        isFree: false,
        amountToFreeDelivery: Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
        isLoading: false,
        branch: null,
        distanceKm: null,
        outOfServiceMessage: t("checkout.zoneCheckError"),
      };
    }

    const zone = zoneQuery.data;
    if (!zone) {
      return {
        cost: 0,
        eta: { min: DELIVERY_ETA.min, max: DELIVERY_ETA.max },
        isDeliverable: false,
        isFree: false,
        amountToFreeDelivery: Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
        isLoading: false,
        branch: null,
        distanceKm: null,
        outOfServiceMessage: t("checkout.zoneOutOfRange"),
      };
    }

    const resolvedBranch = findBranchById(zone.branch_id);

    return {
      cost: zone.effective_fee,
      eta: { min: DELIVERY_ETA.min, max: DELIVERY_ETA.max },
      isDeliverable: true,
      isFree: isFree || zone.effective_fee === 0,
      amountToFreeDelivery:
        zone.free_above_subtotal != null
          ? Math.max(0, zone.free_above_subtotal - subtotal)
          : Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
      isLoading: false,
      branch: resolvedBranch,
      distanceKm: zone.distance_km,
      outOfServiceMessage: null,
    };
  }, [subtotal, hasCoords, input.branchId, branches, branchesLoading, zoneQuery.isLoading, zoneQuery.isError, zoneQuery.data, t]);
}
