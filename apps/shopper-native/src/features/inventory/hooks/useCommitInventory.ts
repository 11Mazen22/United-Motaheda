/**
 * useCommitInventory — called by the checkout flow once the order row has
 * been written. Promotes each cart-line reservation from 'reserved' to
 * 'committed' atomically.
 *
 * Pattern at checkout:
 *
 *   1. Write the orders row (existing flow).
 *   2. For each cart line with a reservation_id, call commitAsync().
 *   3. On any failure, the order should be cancelled and committed
 *      reservations rolled back via rollback_committed_reservation (admin).
 *
 * commit_inventory is idempotent server-side, so a retry after a partial
 * commit-batch failure is safe.
 */

import { useCallback } from "react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { commitInventory } from "../api/inventoryApi";
import { newIdempotencyKey } from "@/lib/idempotency";
import { inventoryKeys } from "../api/queryKeys";
import type { CommitResponse } from "../types";

export interface UseCommitInventoryInput {
  reservationId: string;
  orderId:       string;
  productId?:    string;
}

interface InternalArgs {
  reservationId:  string;
  orderId:        string;
  idempotencyKey: string;
}

export interface UseCommitInventoryReturn
  extends Omit<UseMutationResult<CommitResponse, Error, InternalArgs>, "mutate" | "mutateAsync"> {
  commit:      (input: UseCommitInventoryInput) => void;
  commitAsync: (input: UseCommitInventoryInput) => Promise<CommitResponse>;
}

export function useCommitInventory(): UseCommitInventoryReturn {
  const qc = useQueryClient();

  const m = useMutation<CommitResponse, Error, InternalArgs>({
    mutationFn: (args) => commitInventory(args),
  });

  const wrap = (input: UseCommitInventoryInput): InternalArgs => ({
    reservationId:  input.reservationId,
    orderId:        input.orderId,
    idempotencyKey: newIdempotencyKey(),
  });

  const commit = useCallback(
    (input: UseCommitInventoryInput) => {
      m.mutate(wrap(input), {
        onSuccess: () => {
          if (input.productId) qc.invalidateQueries({ queryKey: inventoryKeys.state(input.productId) });
        },
      });
    },
    [m, qc],
  );
  const commitAsync = useCallback(
    async (input: UseCommitInventoryInput) => {
      const r = await m.mutateAsync(wrap(input));
      if (input.productId) qc.invalidateQueries({ queryKey: inventoryKeys.state(input.productId) });
      return r;
    },
    [m, qc],
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mutate: _m, mutateAsync: _ma, ...rest } = m;
  return { ...rest, commit, commitAsync };
}
