/**
 * useDriverProfile — the caller's own driver application/profile row.
 * Mirrors useDriverManifest.ts's conventions (query keys, staleTime shape).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyDriverProfile,
  createDriverApplication,
  type DriverProfileRecord,
  type DriverApplicationInput,
} from "../api";

export const driverProfileQueryKeys = {
  mine: (userId: string) => ["driver", "profile", userId] as const,
};

export function useMyDriverProfile(userId: string | null | undefined) {
  return useQuery<DriverProfileRecord | null, Error>({
    queryKey: driverProfileQueryKeys.mine(userId ?? ""),
    queryFn: () => getMyDriverProfile(userId!),
    enabled: Boolean(userId),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

/** Polls faster than the default staleTime while a decision is pending —
 * mirrors courier-mobile's pending.tsx, which polled every 30s. */
export function useMyDriverProfilePolling(userId: string | null | undefined, enabled: boolean) {
  return useQuery<DriverProfileRecord | null, Error>({
    queryKey: driverProfileQueryKeys.mine(userId ?? ""),
    queryFn: () => getMyDriverProfile(userId!),
    enabled: Boolean(userId) && enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateDriverApplication(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation<DriverProfileRecord, Error, DriverApplicationInput>({
    mutationFn: (input) => createDriverApplication(userId!, input),
    onSuccess: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: driverProfileQueryKeys.mine(userId) });
    },
  });
}
