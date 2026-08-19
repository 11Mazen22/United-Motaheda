/**
 * Delivery quote hook — branch-aware.
 *
 * Routing logic:
 *  1. If `branchId` is explicitly selected, use it.
 *  2. Else if `customerCoords` are provided, snap to nearest branch.
 *  3. Else fall back to the primary branch.
 *
 * Pricing logic (unchanged from v1):
 *  - Free delivery above FREE_DELIVERY_THRESHOLD.
 *  - Otherwise STANDARD_DELIVERY_FEE.
 *  - Phase 4.x will swap in per-distance / per-zone fees here.
 *
 * Deliverability:
 *  - At least one delivery-enabled branch must exist.
 *  - If coords supplied, point must fall inside Cairo bounding box AND
 *    within DEFAULT_BRANCH_RADIUS_KM of the resolved branch.
 *
 * SAFETY: this hook reads `useBranches()` which is reactive. The
 * DeliveryQuote contract is stable — see types.ts for the surface.
 */

import { useMemo } from "react";
import {
  DELIVERY_ETA,
  FREE_DELIVERY_THRESHOLD,
  STANDARD_DELIVERY_FEE,
} from "./constants";
import {
  DEFAULT_BRANCH_RADIUS_KM,
  distanceKm,
  findNearestBranch,
  hasValidCoordinates,
  isWithinCairo,
} from "./geofencing";
import { useBranches } from "./branches/useBranches";
import { findBranchById, getPrimaryBranch } from "./branches/data";
import type { DeliveryQuote, DeliveryQuoteInput } from "./types";

export function useDeliveryQuote(input: DeliveryQuoteInput): DeliveryQuote {
  const { data: branches = [], isLoading: branchesLoading } = useBranches();

  return useMemo<DeliveryQuote>(() => {
    // Guard NaN/Infinity from external subtotal sources (e.g. store hydration race)
    const subtotal = Math.max(0, Number.isFinite(input.subtotal) ? input.subtotal : 0);
    const isFree = subtotal >= FREE_DELIVERY_THRESHOLD;

    // ── Resolve branch ─────────────────────────────────────────────────────
    let resolvedBranch =
      findBranchById(input.branchId) ??
      (input.customerCoords && hasValidCoordinates(input.customerCoords.lat, input.customerCoords.lng)
        ? findNearestBranch(input.customerCoords, branches)?.branch ?? null
        : null);

    if (!resolvedBranch) {
      resolvedBranch = branches.find((b) => b.isPrimary && b.deliveryEnabled)
        ?? branches.find((b) => b.deliveryEnabled)
        ?? (branches.length > 0 ? branches[0] : getPrimaryBranch());
    }

    // ── Distance + deliverability ──────────────────────────────────────────
    let distance: number | null = null;
    let outOfServiceMessage: string | null = null;
    let isDeliverable = !!resolvedBranch?.deliveryEnabled;

    if (input.customerCoords && hasValidCoordinates(input.customerCoords.lat, input.customerCoords.lng)) {
      if (!isWithinCairo(input.customerCoords)) {
        isDeliverable = false;
        outOfServiceMessage = "نخدم القاهرة فقط حالياً";
      } else if (resolvedBranch) {
        const rawDist = distanceKm(input.customerCoords, { lat: resolvedBranch.lat, lng: resolvedBranch.lng });
        distance = Number.isFinite(rawDist) ? rawDist : null;
        if (distance !== null && distance > DEFAULT_BRANCH_RADIUS_KM) {
          isDeliverable = false;
          outOfServiceMessage = `العنوان خارج نطاق التوصيل (${distance.toFixed(1)} كم من أقرب فرع)`;
        }
      }
    } else if (input.address?.city) {
      // Legacy text-only address: only fail if user typed a non-Cairo city
      const c = input.address.city.trim().toLowerCase();
      const cairoVariants = ["cairo", "القاهرة", "القاهره"];
      if (c && !cairoVariants.some((v) => c.includes(v))) {
        isDeliverable = false;
        outOfServiceMessage = "نخدم القاهرة فقط حالياً";
      }
    }

    // ── Fee + ETA ──────────────────────────────────────────────────────────
    const cost = !isDeliverable ? 0 : isFree ? 0 : STANDARD_DELIVERY_FEE;

    return {
      cost,
      eta: { min: DELIVERY_ETA.min, max: DELIVERY_ETA.max },
      isDeliverable,
      isFree: isDeliverable && isFree,
      amountToFreeDelivery: isFree ? 0 : Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal),
      isLoading: branchesLoading,
      branch: resolvedBranch,
      distanceKm: distance,
      outOfServiceMessage,
    };
  }, [
    input.subtotal,
    input.branchId,
    input.customerCoords?.lat,
    input.customerCoords?.lng,
    input.address?.city,
    input.address?.streetName,
    branches,
    branchesLoading,
  ]);
}
