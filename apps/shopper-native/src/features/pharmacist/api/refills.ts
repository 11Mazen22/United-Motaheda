/**
 * Pharmacist Refill Requests API.
 *
 * refill_requests already existed with staff SELECT/UPDATE RLS
 * (20260705120000_prescriptions_admin_review.sql) but nothing ever wrote to
 * its review columns — no RPC existed, so a pharmacist action would have
 * meant an unrestricted raw client UPDATE. Mutations here go through
 * review_refill_request()/advance_refill_request()
 * (20260827100000_prescription_order_linkage_and_refills.sql), the same
 * SECURITY DEFINER + role-gated + transition-validated pattern as
 * review_prescription()/transition_order().
 */

import { supabase } from "@/lib/supabase";
import type { PharmacistRefillRequest, RefillRequestStatus } from "./types";

interface RawRefillRow {
  id:               string;
  prescription_id:  string;
  user_id:          string;
  delivery:         string;
  status:           string;
  pharmacy_id:      string | null;
  tracking_number:  string | null;
  total_cents:      number;
  copay_cents:      number;
  insurance_cents:  number;
  eta:              string | null;
  placed_at:        string;
  delivered_at:     string | null;
  reviewed_at:      string | null;
  admin_notes:      string | null;
  rejection_reason: string | null;
  prescriptions: { name: string; profiles: { full_name: string; phone: string | null } | null } | null;
}

const centsToUnits = (cents: number): number => cents / 100;

function mapRow(row: RawRefillRow): PharmacistRefillRequest {
  return {
    id:               row.id,
    prescriptionId:   row.prescription_id,
    userId:           row.user_id,
    medicineName:     row.prescriptions?.name ?? "—",
    customerName:     row.prescriptions?.profiles?.full_name ?? "—",
    customerPhone:    row.prescriptions?.profiles?.phone ?? null,
    delivery:         row.delivery,
    status:           row.status as RefillRequestStatus,
    trackingNumber:   row.tracking_number,
    total:            centsToUnits(row.total_cents),
    copay:            centsToUnits(row.copay_cents),
    insuranceApplied: centsToUnits(row.insurance_cents),
    eta:              row.eta,
    placedAt:         row.placed_at,
    deliveredAt:      row.delivered_at,
    reviewedAt:       row.reviewed_at,
    adminNotes:       row.admin_notes,
    rejectionReason:  row.rejection_reason,
  };
}

const REFILL_SELECT =
  "id, prescription_id, user_id, delivery, status, pharmacy_id, tracking_number, " +
  "total_cents, copay_cents, insurance_cents, eta, placed_at, delivered_at, " +
  "reviewed_at, admin_notes, rejection_reason, prescriptions(name, profiles(full_name, phone))";

export async function listRefillRequests(status?: RefillRequestStatus | "all"): Promise<PharmacistRefillRequest[]> {
  let query = supabase.from("refill_requests").select(REFILL_SELECT).order("placed_at", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawRefillRow[]).map(mapRow);
}

export async function reviewRefillRequest(input: {
  id: string;
  decision: "approved" | "rejected";
  adminNotes?: string;
  rejectionReason?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("review_refill_request", {
    p_refill_id: input.id,
    p_decision: input.decision,
    p_admin_notes: input.adminNotes ?? null,
    p_rejection_reason: input.rejectionReason ?? null,
  });
  if (error) throw error;
}

export async function advanceRefillRequest(id: string, nextStatus: RefillRequestStatus): Promise<void> {
  const { error } = await supabase.rpc("advance_refill_request", {
    p_refill_id: id,
    p_next_status: nextStatus,
  });
  if (error) throw error;
}
