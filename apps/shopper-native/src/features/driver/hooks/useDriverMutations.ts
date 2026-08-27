/**
 * useDriverMutations — accept/decline/pickup/deliver/report-issue.
 * Mirrors usePrescriptionMutations.ts's shape: plain useMutation wrappers
 * that invalidate the relevant query keys on success, no optimistic local
 * writes (this is staff-safety-critical state; wait for the server to
 * confirm before updating the UI).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  acceptAssignment,
  declineAssignment,
  confirmPickup,
  completeDelivery,
  markArrival,
  reportIssue,
  uploadIssuePhoto,
  setDriverAvailability,
  type IssueReasonCode,
} from "../api";
import { driverQueryKeys, invalidateDriverLists } from "./useDriverManifest";
import { driverProfileQueryKeys } from "./useDriverProfile";

export function useDriverMutations(driverId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateAll = () => { if (driverId) invalidateDriverLists(queryClient, driverId); };
  const requireDriverId = (): string => {
    if (!driverId) throw new Error("Driver session is no longer available. Please sign in again.");
    return driverId;
  };

  const accept = useMutation({
    mutationFn: (assignmentId: string) => acceptAssignment(assignmentId, requireDriverId()),
    onSuccess: (_data, assignmentId) => {
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.offer(assignmentId) });
    },
  });

  const decline = useMutation({
    mutationFn: (args: { assignmentId: string; orderId: string; reason: string }) =>
      declineAssignment(args.assignmentId, args.reason),
    onSuccess: (_data, args) => {
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.offer(args.assignmentId) });
    },
  });

  const pickup = useMutation({
    mutationFn: (args: { orderId: string; assignmentId: string }) =>
      confirmPickup(args.orderId, args.assignmentId, requireDriverId()),
    onSuccess: (_data, args) => {
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.order(args.orderId) });
      // Confirmed bug: this used to be omitted, so the "arrived at
      // pharmacy" -> "confirm pickup" -> "arrived at customer" action
      // gates on DeliveryExecutionScreen kept reading a stale
      // assignment.pickedUpAt for up to assignmentForOrder's 15s
      // staleTime after every pickup confirmation.
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.assignmentForOrder(args.orderId) });
    },
  });

  const deliver = useMutation({
    mutationFn: (args: { orderId: string; assignmentId: string }) =>
      completeDelivery(args.orderId, args.assignmentId, requireDriverId()),
    onSuccess: (_data, args) => {
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.order(args.orderId) });
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.assignmentForOrder(args.orderId) });
    },
  });

  const arrival = useMutation({
    mutationFn: (args: { assignmentId: string; orderId: string; stage: "pharmacy" | "customer"; coords: { lat: number; lng: number } }) =>
      markArrival(args.assignmentId, args.orderId, args.stage, args.coords),
    onSuccess: (_data, args) => {
      invalidateAll();
      // Confirmed bug: this used to only fire for stage === "customer",
      // silently skipping "pharmacy" — so canConfirmPickup kept reading a
      // stale assignment.arrivedAtPharmacy right after "Arrived at
      // pharmacy" until staleTime lapsed. Both stages change this same
      // cached row, so both must invalidate it.
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.assignmentForOrder(args.orderId) });
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.order(args.orderId) });
    },
  });

  const setAvailability = useMutation({
    mutationFn: (args: { isOnline: boolean; coords?: { lat: number; lng: number } }) =>
      setDriverAvailability(args.isOnline, args.coords),
    onSuccess: () => {
      if (driverId) void queryClient.invalidateQueries({ queryKey: driverProfileQueryKeys.mine(driverId) });
    },
  });

  const report = useMutation({
    mutationFn: async (args: { orderId: string; reasonCode: IssueReasonCode; note?: string; photoUri?: string }) => {
      const driverIdValue = requireDriverId();
      const photoUrl = args.photoUri ? await uploadIssuePhoto(driverIdValue, args.orderId, args.photoUri) : undefined;
      return reportIssue(args.orderId, driverIdValue, args.reasonCode, args.note, photoUrl);
    },
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.issues(args.orderId) });
    },
  });

  return {
    accept:  { mutateAsync: accept.mutateAsync,  isPending: accept.isPending },
    decline: { mutateAsync: decline.mutateAsync, isPending: decline.isPending },
    pickup:  { mutateAsync: pickup.mutateAsync,  isPending: pickup.isPending },
    deliver: { mutateAsync: deliver.mutateAsync,  isPending: deliver.isPending },
    arrival: { mutateAsync: arrival.mutateAsync, isPending: arrival.isPending },
    report:  { mutateAsync: report.mutateAsync,  isPending: report.isPending },
    setAvailability: { mutateAsync: setAvailability.mutateAsync, isPending: setAvailability.isPending },
  };
}
