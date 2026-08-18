/**
 * Supabase row ↔ store-shape mappers.
 *
 * The DB uses snake_case + cents-integers; the store uses camelCase + numbers
 * in plain currency units. Convert at the boundary so screens never see DB
 * casing.
 */

import type {
  Prescription,
  RefillRequest,
  RxStatus,
  RefillDelivery,
  RefillStatus,
  ReviewStatus,
  SubmissionSource,
} from "@/stores/prescriptionsStore";

// ── Prescription ───────────────────────────────────────────────────────────

export interface PrescriptionRow {
  id:                string;
  user_id:           string;
  dependent_id:      string | null;
  name:              string;
  dose:              string;
  refills:           number;
  next_refill:       string | null;
  doctor:            string | null;
  status:            RxStatus;
  is_controlled:     boolean;
  dea_schedule:      number | null;
  rx_number:         string | null;
  original_pharmacy: string | null;
  added_at:          string;
  updated_at:        string;
  review_status?:      ReviewStatus;
  submission_source?:  SubmissionSource;
  reviewed_at?:        string | null;
  admin_notes?:        string | null;
  rejection_reason?:   string | null;
  image_path?:         string | null;
}

export function rowToPrescription(row: PrescriptionRow): Prescription {
  return {
    id:           row.id,
    userId:       row.user_id,
    dependentId:  row.dependent_id ?? undefined,
    name:         row.name,
    dose:         row.dose,
    refills:      row.refills,
    nextRefill:   row.next_refill ?? "",
    doctor:       row.doctor ?? "",
    status:       row.status,
    isControlled: row.is_controlled,
    schedule:     row.dea_schedule != null
      ? (row.dea_schedule as Prescription["schedule"])
      : undefined,
    rxNumber:         row.rx_number ?? undefined,
    addedAt:          row.added_at,
    updatedAt:        row.updated_at,
    reviewStatus:     row.review_status ?? "approved",
    submissionSource: row.submission_source ?? "manual",
    reviewedAt:       row.reviewed_at ?? undefined,
    adminNotes:       row.admin_notes ?? undefined,
    rejectionReason:  row.rejection_reason ?? undefined,
    imagePath:        row.image_path ?? undefined,
  };
}

// ── Refill request ─────────────────────────────────────────────────────────

export interface RefillRequestRow {
  id:              string;
  prescription_id: string;
  user_id:         string;
  delivery:        RefillDelivery;
  status:          RefillStatus;
  pharmacy_id:     string | null;
  tracking_number: string | null;
  total_cents:     number;
  copay_cents:     number;
  insurance_cents: number;
  eta:             string | null;
  placed_at:       string;
  delivered_at:    string | null;
  reviewed_at?:      string | null;
  admin_notes?:      string | null;
  rejection_reason?: string | null;
}

const centsToUnits = (cents: number): number => cents / 100;

export function rowToRefillRequest(row: RefillRequestRow): RefillRequest {
  return {
    id:               row.id,
    prescriptionId:   row.prescription_id,
    delivery:         row.delivery,
    status:           row.status,
    pharmacyId:       row.pharmacy_id ?? "",
    trackingNumber:   row.tracking_number ?? undefined,
    total:            centsToUnits(row.total_cents),
    copay:            centsToUnits(row.copay_cents),
    insuranceApplied: centsToUnits(row.insurance_cents),
    placedAt:         row.placed_at,
    eta:              row.eta ?? undefined,
    reviewedAt:       row.reviewed_at ?? undefined,
    adminNotes:       row.admin_notes ?? undefined,
    rejectionReason:  row.rejection_reason ?? undefined,
  };
}
