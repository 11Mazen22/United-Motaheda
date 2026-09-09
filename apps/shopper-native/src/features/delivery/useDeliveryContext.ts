/**
 * useDeliveryContext — unified delivery pricing source.
 *
 * Always calls the Supabase delivery-zone RPC so the fee is real
 * (zone-polygon engine, per-zone cost, live deliverability).
 *
 * Coordinate resolution order:
 *   1. Customer GPS coordinates (most accurate)
 *   2. Saved default address lat/lng
 *   3. Selected branch lat/lng (user picked a branch explicitly)
 *   4. Primary branch lat/lng (absolute fallback — gives the base zone fee)
 *
 * The static Haversine + flat-fee hook is only used while the Supabase
 * query is loading or if it fails, so the UI never blocks.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/stores/cart";
import { useAddressStore } from "@/features/addresses";
import { supabaseApi } from "@/lib/supabaseApi";
import { useDeliveryQuote } from "./useDeliveryQuote";
import { useLocationState } from "./locationStore";
import { FREE_DELIVERY_THRESHOLD } from "./constants";
import type { DeliveryQuote } from "./types";

export interface DeliveryContext extends DeliveryQuote {
  subtotal: number;
  isResolvedFromContext: boolean;
}

export function useDeliveryContext(): DeliveryContext {
  // ── Cart state ──────────────────────────────────────────────────────────
  const subtotal = useCartStore((s) => s.subtotal());
  const items    = useCartStore((s) => s.items);

  // ── Location state ──────────────────────────────────────────────────────
  const coordinates      = useLocationState((s) => s.coordinates);
  const selectedBranchId = useLocationState((s) => s.selectedBranchId);
  const selectedArea     = useLocationState((s) => s.selectedArea);

  // ── Saved address fallback ──────────────────────────────────────────────
  const defaultAddress = useAddressStore((s) =>
    s.addresses.find((a) => a.is_default) ?? s.addresses[0] ?? null,
  );

  // ── Resolve the best available coordinates ──────────────────────────────
  const queryCoords = useMemo(() => {
    // 1. Real GPS
    if (coordinates) return coordinates;
    // 2. Saved address with geocoded lat/lng
    if (
      defaultAddress &&
      typeof defaultAddress.lat === "number" &&
      typeof defaultAddress.lng === "number"
    ) {
      return { lat: defaultAddress.lat, lng: defaultAddress.lng };
    }
    // No real customer location — don't fake it with branch coordinates.
    // Using branch coords as customer = distance 0, misleading quote.
    return null;
  }, [coordinates, defaultAddress]);

  const effectiveCity = useMemo(() => {
    if (selectedArea) return selectedArea;
    return defaultAddress?.city;
  }, [selectedArea, defaultAddress?.city]);

  // Whether we have a real customer location (affects isResolvedFromContext)
  const hasRealLocation = !!(coordinates || defaultAddress?.lat || selectedBranchId);

  // ── Cart items for Supabase ─────────────────────────────────────────────
  const cartItems = useMemo(
    () =>
      items.map((i) => ({
        productId: i.productId,
        name:      i.product.name,
        quantity:  i.quantity,
        unitPrice: i.product.price,
      })),
    [items],
  );

  // ── Supabase real quote (only when we have real customer coordinates) ───────
  const { data: supabaseQuote, isLoading: supabaseLoading } = useQuery({
    queryKey: [
      "delivery/quote",
      queryCoords?.lat,
      queryCoords?.lng,
      selectedBranchId,
      subtotal,
    ],
    enabled: queryCoords !== null,
    queryFn: () =>
      supabaseApi.getDeliveryQuote({
        coordinates:       queryCoords!,
        cart:              { items: cartItems, itemCount: items.reduce((s, i) => s + i.quantity, 0), subtotal },
        requestedBranchId: selectedBranchId ?? undefined,
      }),
    staleTime:            60_000,
    retry:                1,
    refetchOnWindowFocus: false,
  });

  // ── Static fallback (used while Supabase loads or on failure) ───────────
  const staticQuote = useDeliveryQuote({
    subtotal,
    branchId:       selectedBranchId,
    customerCoords: coordinates ?? undefined,
    address:        effectiveCity ? { city: effectiveCity } : undefined,
  });

  // ── Merge ───────────────────────────────────────────────────────────────
  return useMemo<DeliveryContext>(() => {
    if (supabaseQuote) {
      const outOfServiceMessage =
        supabaseQuote.reasonCode === "OUT_OF_CAIRO" ? "نخدم القاهرة فقط حالياً" :
        supabaseQuote.reasonCode === "OUT_OF_ZONE"  ? "العنوان خارج نطاق التوصيل" :
        supabaseQuote.reasonCode === "NO_BRANCH"    ? "لا يوجد فرع متاح في منطقتك" :
        null;

      return {
        cost:                 supabaseQuote.cost ?? 0,
        eta:                  supabaseQuote.eta
                                ? { min: supabaseQuote.eta.minMinutes, max: supabaseQuote.eta.maxMinutes }
                                : { min: 30, max: 60 },
        isDeliverable:        supabaseQuote.isDeliverable,
        isFree:               supabaseQuote.breakdown?.freeDeliveryApplied ?? false,
        amountToFreeDelivery: Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
        isLoading:            supabaseLoading,
        branch:               staticQuote.branch,
        distanceKm:           supabaseQuote.distanceKm,
        outOfServiceMessage,
        subtotal,
        isResolvedFromContext: hasRealLocation,
      };
    }

    // Supabase still loading or failed — use static
    return {
      ...staticQuote,
      subtotal,
      isResolvedFromContext: hasRealLocation,
    };
  }, [
    supabaseQuote,
    supabaseLoading,
    staticQuote,
    subtotal,
    hasRealLocation,
  ]);
}
