/**
 * Delivery quote hook — Supabase-native zone engine, matching
 * apps/shopper-native/src/features/delivery/useDeliveryQuote.ts exactly.
 *
 * Confirmed live (2026-09-04): this app's checkout was instead going
 * through @pharmacy/api-client's quoteCheckout(), which hits apps/api's
 * NestJS /delivery/quote REST endpoint — a second, independently
 * maintained implementation of the same zone/fee logic, on a completely
 * separate Prisma connection. Native's checkout has never used that path;
 * it calls resolve_delivery_zone() directly, the same RPC create-order's
 * Edge Function uses to compute the fee that's actually charged. Two
 * pharmacy apps quoting a customer two potentially different fees for the
 * same address was the direct complaint this fixes — not a hypothetical.
 *
 * Returns the exact same DeliveryStatus shape @pharmacy/api-client's
 * quoteCheckout() did, wrapped the same react-query way, so every existing
 * consumer (Checkout.tsx, Cart.tsx, useDeliveryContext.ts) only needs its
 * import switched to this file — nothing about how the result is read
 * changes.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocationState } from "@pharmacy/domain-location";
import type { CartSnapshot, DeliveryStatus, Branch } from "@pharmacy/contracts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { fetchBranches } from "../../services/branchesApi";

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
  const { data, error } = await getSupabaseClient()
    .rpc("resolve_delivery_zone", { p_lat: lat, p_lng: lng, p_subtotal: subtotal })
    .maybeSingle();
  if (error) throw error;
  return (data as ZoneRpcRow | null) ?? null;
}

function outOfRangeStatus(reasonCode: DeliveryStatus["reasonCode"]): DeliveryStatus {
  return {
    isDeliverable: false,
    cost: null,
    currency: "EGP",
    eta: null,
    branch: null,
    distanceKm: null,
    assignmentToken: null,
    quoteToken: null,
    zoneId: null,
    reasonCode,
    updatedAt: new Date().toISOString(),
  };
}

export function useDeliveryQuote(cart: CartSnapshot, _label?: string, requestedBranchId?: string) {
  const coordinates = useLocationState((state) => state.coordinates);
  const subtotal = Math.max(0, Number.isFinite(cart.subtotal) ? cart.subtotal : 0);
  const hasCoords = !!coordinates;

  return useQuery<DeliveryStatus>({
    queryKey: ["delivery-zone-web", coordinates?.lat, coordinates?.lng, subtotal, requestedBranchId],
    enabled: hasCoords && cart.itemCount > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<DeliveryStatus> => {
      if (!coordinates) return outOfRangeStatus("NO_COORDINATES");

      const zone = await fetchZone(coordinates.lat, coordinates.lng, subtotal);
      if (!zone) return outOfRangeStatus("OUT_OF_ZONE");

      const branches = await fetchBranches();
      const branch: Branch | null = branches.find((b) => b.id === zone.branch_id) ?? null;

      return {
        isDeliverable: true,
        cost: zone.effective_fee,
        currency: "EGP",
        eta: { minMinutes: 30, maxMinutes: 60 },
        branch,
        distanceKm: zone.distance_km,
        assignmentToken: null,
        quoteToken: null,
        zoneId: zone.zone_id,
        reasonCode: "OK",
        breakdown: {
          baseFee: zone.base_fee,
          surgeMultiplier: zone.surge_applied ? 1.5 : 1,
          freeDeliveryApplied: zone.effective_fee === 0 && zone.base_fee > 0,
        },
        updatedAt: new Date().toISOString(),
      };
    },
  });
}
