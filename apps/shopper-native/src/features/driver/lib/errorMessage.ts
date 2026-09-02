/**
 * Driver-specific error codes, layered on top of the shared action-error
 * foundation (src/shared/lib/actionErrorMessage.ts — see that file for why
 * this is split from pharmacist's version instead of two independent
 * copies). `errorMessage` is re-exported because several call sites outside
 * this module import it directly for non-RPC error extraction.
 */
import { createActionErrorMessage, errorMessage, type ActionErrorEntry } from "@/shared/lib/actionErrorMessage";

export { errorMessage };

/** Codes only a driver action can raise (assignment offers, arrival
 *  geofencing) — see acceptAssignment/declineAssignment/markArrival in
 *  ../api.ts for the RPCs these come from. */
const DRIVER_CODES: Record<string, ActionErrorEntry> = {
  assignment_not_found: {
    key: "errors.assignmentNotFound",
    fallback: "This offer is no longer available.",
  },
  assignment_not_found_or_already_resolved: {
    key: "errors.assignmentAlreadyResolved",
    fallback: "This offer has already been accepted or declined.",
  },
  assignment_not_accepted: {
    key: "errors.assignmentNotAccepted",
    fallback: "You need to accept this delivery before continuing.",
  },
  invalid_arrival_stage: {
    key: "errors.invalidArrivalStage",
    fallback: "That doesn't match this delivery's current stage.",
  },
  coordinates_required: {
    key: "errors.coordinatesRequired",
    fallback: "Location access is needed to confirm this.",
  },
  order_not_ready_for_pharmacy_arrival: {
    key: "errors.orderNotReadyPharmacy",
    fallback: "This order isn't ready for pharmacy pickup yet.",
  },
  order_not_out_for_delivery: {
    key: "errors.orderNotOutForDelivery",
    fallback: "This order isn't out for delivery yet.",
  },
};

export const getDriverActionErrorMessage = createActionErrorMessage(DRIVER_CODES, "driver");
