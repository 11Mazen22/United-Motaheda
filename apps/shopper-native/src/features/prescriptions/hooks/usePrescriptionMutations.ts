/**
 * usePrescriptionMutations — create / update / delete a prescription.
 *
 * Unlike useRequestRefill's optimistic local-write pattern, these mutations
 * write straight to Supabase and invalidate the ["prescriptions", userId]
 * query on success — the existing usePrescriptionsQuery hydration then
 * refreshes the Zustand store with the authoritative server row. Simpler
 * than duplicating optimistic-store logic for a screen-level create/edit/
 * delete flow that already shows its own loading state.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPrescription,
  updatePrescription,
  deletePrescription,
  type PrescriptionInput,
} from "../api";

export function usePrescriptionMutations(userId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate   = () => queryClient.invalidateQueries({ queryKey: ["prescriptions", userId] });

  const create = useMutation({
    mutationFn: (input: PrescriptionInput) => createPrescription(userId as string, input),
    onSuccess:  invalidate,
  });

  const update = useMutation({
    mutationFn: (args: { id: string; input: Partial<PrescriptionInput> }) =>
      updatePrescription(args.id, userId as string, args.input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePrescription(id, userId as string),
    onSuccess:  invalidate,
  });

  return {
    create: {
      mutateAsync: create.mutateAsync,
      isPending:   create.isPending,
    },
    update: {
      mutateAsync: update.mutateAsync,
      isPending:   update.isPending,
    },
    remove: {
      mutateAsync: remove.mutateAsync,
      isPending:   remove.isPending,
    },
  };
}
