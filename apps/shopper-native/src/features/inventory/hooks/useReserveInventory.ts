/**
 * useReserveInventory — wraps reserve_inventory RPC.
 *
 * Idempotency-key generated per call() so React Query retries reuse it and
 * the server replays the same reservation row. Caller is responsible for
 * tracking the resulting reservation_id (typically alongside the cart line
 * it represents) and releasing/extending it as the cart mutates.
 *
 * On success, invalidates the per-product inventory state so any subscribed
 * "low stock" badge re-renders immediately.
 */

import { useCallback } from "react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { reserveInventory, type ReserveArgs } from "../api/inventoryApi";
import { newIdempotencyKey } from "@/lib/idempotency";
import { inventoryKeys } from "../api/queryKeys";
import type { ReserveResponse, ReservationKind } from "../types";

export interface UseReserveInventoryInput {
  productId:        string;
  quantity:         number;
  reservationKind?: ReservationKind;
  reservationRef?:  string;
  expiresInSecs?:   number;
}

interface InternalArgs extends ReserveArgs {}

export interface UseReserveInventoryReturn
  extends Omit<UseMutationResult<ReserveResponse, Error, InternalArgs>, "mutate" | "mutateAsync"> {
  reserve:      (input: UseReserveInventoryInput) => void;
  reserveAsync: (input: UseReserveInventoryInput) => Promise<ReserveResponse>;
}

export function useReserveInventory(): UseReserveInventoryReturn {
  const qc = useQueryClient();

  const m = useMutation<ReserveResponse, Error, InternalArgs>({
    mutationFn: (args) => reserveInventory(args),
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: inventoryKeys.state(res.product_id) });
    },
  });

  const buildArgs = (input: UseReserveInventoryInput): InternalArgs => ({
    productId:       input.productId,
    quantity:        input.quantity,
    reservationKind: input.reservationKind ?? "cart",
    reservationRef:  input.reservationRef,
    expiresInSecs:   input.expiresInSecs,
    idempotencyKey:  newIdempotencyKey(),
  });

  const reserve      = useCallback((input: UseReserveInventoryInput) => m.mutate(buildArgs(input)),      [m]);
  const reserveAsync = useCallback((input: UseReserveInventoryInput) => m.mutateAsync(buildArgs(input)), [m]);

  const { mutate: _m, mutateAsync: _ma, ...rest } = m;
  return { ...rest, reserve, reserveAsync };
}
