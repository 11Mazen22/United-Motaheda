/**
 * Pharmacist Prescriptions API — staff review of pending prescriptions.
 *
 * RLS grants:
 *   "prescriptions: staff select all"  — pharmacist/admin/manager SELECT
 *   "prescriptions: staff update review" — pharmacist/admin/manager UPDATE
 *   (see supabase/migrations/20260705120000_prescriptions_admin_review.sql)
 *
 * The customer-facing prescriptions feature (features/prescriptions/api.ts)
 * only handles the customer's own rows. This module is the staff-side mirror:
 *   - listPendingPrescriptions()   — review queue
 *   - getPrescription()            — single detail
 *   - reviewPrescription()         — approve / reject
 */

import { supabase } from "@/lib/supabase";
import type {
  PharmacistPrescription,
  PrescriptionReviewStatus,
  ReviewPrescriptionInput,
  SubmissionSource,
} from "./types";

// ─── Raw row ───────────────────────────────────────────────────────────────────

interface RawPrescriptionRow {
  id:                string;
  user_id:           string;
  name:              string;
  dose:              string | null;
  doctor:            string | null;
  rx_number:         string | null;
  refills:           number | null;
  review_status:     string;
  submission_source: string;
  admin_notes:       string | null;
  rejection_reason:  string | null;
  reviewed_by:       string | null;
  reviewed_at:       string | null;
  added_at:          string;
  updated_at:        string | null;
  // joined from profiles
  profiles: {
    full_name: string;
    phone:     string | null;
  } | null;
}

function mapRow(row: RawPrescriptionRow): PharmacistPrescription {
  return {
    id:               row.id,
    userId:           row.user_id,
    name:             row.name,
    dose:             row.dose ?? "",
    doctor:           row.doctor ?? "",
    rxNumber:         row.rx_number ?? null,
    refills:          row.refills ?? 0,
    reviewStatus:     row.review_status as PrescriptionReviewStatus,
    submissionSource: row.submission_source as SubmissionSource,
    adminNotes:       row.admin_notes ?? null,
    rejectionReason:  row.rejection_reason ?? null,
    reviewedBy:       row.reviewed_by ?? null,
    reviewedAt:       row.reviewed_at ?? null,
    addedAt:          row.added_at,
    updatedAt:        row.updated_at ?? row.added_at,
    customerName:     row.profiles?.full_name ?? "—",
    customerPhone:    row.profiles?.phone ?? null,
  };
}

const RX_SELECT =
  "id, user_id, name, dose, doctor, rx_number, refills, review_status, " +
  "submission_source, admin_notes, rejection_reason, reviewed_by, reviewed_at, " +
  "added_at, updated_at, profiles(full_name, phone)";

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Prescription review queue — pending_review only, oldest first.
 */
export async function listPendingPrescriptions(): Promise<PharmacistPrescription[]> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(RX_SELECT)
    .eq("review_status", "pending_review")
    .order("added_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as RawPrescriptionRow[]).map(mapRow);
}

/**
 * All prescriptions (for the full list view with filter chips).
 */
export async function listAllPrescriptions(
  reviewStatus?: PrescriptionReviewStatus,
  limit = 50,
  offset = 0,
): Promise<PharmacistPrescription[]> {
  let query = supabase
    .from("prescriptions")
    .select(RX_SELECT)
    .order("added_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (reviewStatus) {
    query = query.eq("review_status", reviewStatus);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawPrescriptionRow[]).map(mapRow);
}

/**
 * Single prescription detail — used by the review screen.
 */
export async function getPrescription(id: string): Promise<PharmacistPrescription | null> {
  const { data, error } = await supabase
    .from("prescriptions")
    .select(RX_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as unknown as RawPrescriptionRow) : null;
}

/**
 * Approve or reject a prescription. Sets review_status, admin_notes,
 * rejection_reason, reviewed_by (auth.uid()), and reviewed_at.
 */
export async function reviewPrescription(
  id:    string,
  input: ReviewPrescriptionInput,
): Promise<PharmacistPrescription> {
  const { data, error } = await supabase.rpc("review_prescription", {
    p_prescription_id: id,
    p_decision: input.reviewStatus,
    p_admin_notes: input.adminNotes ?? null,
    p_rejection_reason: input.rejectionReason ?? null,
  });

  if (error) throw error;
  return mapRow(data as unknown as RawPrescriptionRow);
}

/** Count of prescriptions awaiting review — used in dashboard stats. */
export async function countPendingPrescriptions(): Promise<number> {
  const { count, error } = await supabase
    .from("prescriptions")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "pending_review");

  if (error) throw error;
  return count ?? 0;
}
