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
  reportIssue,
  type IssueReasonCode,
} from "../api";
import { driverQueryKeys, invalidateDriverLists } from "./useDriverManifest";

export function useDriverMutations(driverId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateAll = () => { if (driverId) invalidateDriverLists(queryClient, driverId); };

  const accept = useMutation({
    mutationFn: (assignmentId: string) => acceptAssignment(assignmentId, driverId as string),
    onSuccess: (_data, assignmentId) => {
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.offer(assignmentId) });
    },
  });

  const decline = useMutation({
    mutationFn: (args: { assignmentId: string; orderId: string; reason: string }) =>
      declineAssignment(args.assignmentId, driverId as string, args.orderId, args.reason),
    onSuccess: (_data, args) => {
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.offer(args.assignmentId) });
    },
  });

  const pickup = useMutation({
    mutationFn: (args: { orderId: string; assignmentId: string }) =>
      confirmPickup(args.orderId, args.assignmentId, driverId as string),
    onSuccess: (_data, args) => {
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.order(args.orderId) });
    },
  });

  const deliver = useMutation({
    mutationFn: (args: { orderId: string; assignmentId: string }) =>
      completeDelivery(args.orderId, args.assignmentId, driverId as string),
    onSuccess: (_data, args) => {
      invalidateAll();
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.order(args.orderId) });
    },
  });

  const report = useMutation({
    mutationFn: (args: { orderId: string; reasonCode: IssueReasonCode; note?: string }) =>
      reportIssue(args.orderId, driverId as string, args.reasonCode, args.note),
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({ queryKey: driverQueryKeys.issues(args.orderId) });
    },
  });

  return {
    accept:  { mutateAsync: accept.mutateAsync,  isPending: accept.isPending },
    decline: { mutateAsync: decline.mutateAsync, isPending: decline.isPending },
    pickup:  { mutateAsync: pickup.mutateAsync,  isPending: pickup.isPending },
    deliver: { mutateAsync: deliver.mutateAsync,  isPending: deliver.isPending },
    report:  { mutateAsync: report.mutateAsync,  isPending: report.isPending },
  };
}
