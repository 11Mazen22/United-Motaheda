import { useCallback } from "react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { releaseInventory } from "../api/inventoryApi";
import { newIdempotencyKey } from "@/lib/idempotency";
import { inventoryKeys } from "../api/queryKeys";
import type { ReleaseResponse } from "../types";

export interface UseReleaseInventoryInput {
  reservationId: string;
  reason:        string;
  productId?:    string;
}

interface InternalArgs {
  reservationId:  string;
  reason:         string;
  idempotencyKey: string;
}

export interface UseReleaseInventoryReturn
  extends Omit<UseMutationResult<ReleaseResponse, Error, InternalArgs>, "mutate" | "mutateAsync"> {
  release:      (input: UseReleaseInventoryInput) => void;
  releaseAsync: (input: UseReleaseInventoryInput) => Promise<ReleaseResponse>;
}

export function useReleaseInventory(): UseReleaseInventoryReturn {
  const qc = useQueryClient();

  const m = useMutation<ReleaseResponse, Error, InternalArgs>({
    mutationFn: (args) => releaseInventory(args),
  });

  const wrap = (input: UseReleaseInventoryInput): InternalArgs => ({
    reservationId:  input.reservationId,
    reason:         input.reason,
    idempotencyKey: newIdempotencyKey(),
  });

  const release = useCallback(
    (input: UseReleaseInventoryInput) => {
      m.mutate(wrap(input), {
        onSuccess: () => {
          if (input.productId) qc.invalidateQueries({ queryKey: inventoryKeys.state(input.productId) });
        },
      });
    },
    [m, qc],
  );
  const releaseAsync = useCallback(
    async (input: UseReleaseInventoryInput) => {
      const r = await m.mutateAsync(wrap(input));
      if (input.productId) qc.invalidateQueries({ queryKey: inventoryKeys.state(input.productId) });
      return r;
    },
    [m, qc],
  );

  const { mutate: _m, mutateAsync: _ma, ...rest } = m;
  return { ...rest, release, releaseAsync };
}
