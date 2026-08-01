/**
 * Pharmacist mutations — order transitions and prescription reviews.
 *
 * Pattern mirrors useDriverMutations.ts:
 *   - Plain useMutation wrappers
 *   - No optimistic updates — these are safety-critical state changes;
 *     wait for server confirmation before updating the UI
 *   - Invalidate affected queries on success
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transitionOrder }              from "../api/orders";
import { reviewPrescription }           from "../api/prescriptions";
import { pharmacistQueryKeys }          from "./queryKeys";
import type { PharmacistTransitionTarget, ReviewPrescriptionInput } from "../api/types";

export function usePharmacistMutations() {
  const queryClient = useQueryClient();

  const invalidateQueue = () => {
    void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.orderQueue() });
    void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() });
  };

  // ── Order transitions ────────────────────────────────────────────────────────

  const advance = useMutation({
    mutationFn: (args: { orderId: string; nextStatus: PharmacistTransitionTarget }) =>
      transitionOrder(args.orderId, args.nextStatus),
    onSuccess: (_data, args) => {
      invalidateQueue();
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.order(args.orderId) });
    },
  });

  // ── Prescription review ──────────────────────────────────────────────────────

  const reviewRx = useMutation({
    mutationFn: (args: { id: string; input: ReviewPrescriptionInput }) =>
      reviewPrescription(args.id, args.input),
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.prescription(args.id) });
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.prescriptionQueue() });
      void queryClient.invalidateQueries({ queryKey: pharmacistQueryKeys.dashboard() });
      // Invalidate the "all prescriptions" list at every status so the
      // reviewed row moves out of the pending bucket instantly.
      void queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] });
    },
  });

  return {
    advance:  { mutateAsync: advance.mutateAsync,  isPending: advance.isPending,  error: advance.error  },
    reviewRx: { mutateAsync: reviewRx.mutateAsync, isPending: reviewRx.isPending, error: reviewRx.error },
  };
}
