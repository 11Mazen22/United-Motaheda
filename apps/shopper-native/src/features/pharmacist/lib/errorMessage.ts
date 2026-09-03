/**
 * Pharmacist-specific error codes, layered on top of the shared
 * action-error foundation (src/shared/lib/actionErrorMessage.ts).
 *
 * Confirmed live tonight: every pharmacist action screen (OrderDetail,
 * PrescriptionDetail, Refills) fell back to `e instanceof Error ? e.message
 * : ""` — the exact same class of bug that showed a driver the literal
 * string "invalid_order_transition" in a failure sheet. Pharmacist RPCs
 * (review_prescription, review_refill_request, advance_refill_request) use
 * the identical RAISE EXCEPTION convention, so without this they would show
 * things like "prescription_already_reviewed" or "rejection_reason_required"
 * raw, or "[object Object]" for a non-Error PostgrestError.
 */
import { createActionErrorMessage, errorMessage, type ActionErrorEntry } from "@/shared/lib/actionErrorMessage";

export { errorMessage };

/** Codes only a pharmacist action can raise — see review_prescription /
 *  review_refill_request / advance_refill_request in ../api/*.ts. */
const PHARMACIST_CODES: Record<string, ActionErrorEntry> = {
  invalid_review_decision: {
    key: "errors.invalidReviewDecision",
    fallback: "That's not a valid review decision.",
  },
  prescription_not_found: {
    key: "errors.prescriptionNotFound",
    fallback: "This prescription could not be found.",
  },
  prescription_already_reviewed: {
    key: "errors.prescriptionAlreadyReviewed",
    fallback: "This prescription has already been reviewed.",
  },
  rejection_reason_required: {
    key: "errors.rejectionReasonRequired",
    fallback: "Please add a reason for rejecting this.",
  },
  refill_not_found: {
    key: "errors.refillNotFound",
    fallback: "This refill request could not be found.",
  },
  refill_already_reviewed: {
    key: "errors.refillAlreadyReviewed",
    fallback: "This refill request has already been reviewed.",
  },
  invalid_refill_transition: {
    key: "errors.invalidRefillTransition",
    fallback: "This refill request has already moved past this step.",
  },
};

export const getPharmacistActionErrorMessage = createActionErrorMessage(PHARMACIST_CODES, "pharmacist");
