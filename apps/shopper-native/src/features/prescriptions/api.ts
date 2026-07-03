/**
 * Prescriptions API — direct Supabase CRUD for the authenticated user's own
 * prescriptions. RLS on the `prescriptions` table scopes every row to
 * `user_id = auth.uid()`; every call here also filters by userId explicitly
 * so a bad id can never touch another user's row even if RLS were misconfigured.
 */

import { supabase } from "@/lib/supabase";
import type { Prescription } from "@/stores/prescriptionsStore";
import { rowToPrescription, type PrescriptionRow } from "./lib/rowMappers";

export interface PrescriptionInput {
  name:      string;
  rxNumber:  string;
  dose?:     string;
  doctor?:   string;
}

export async function createPrescription(
  userId: string,
  input:  PrescriptionInput,
): Promise<Prescription> {
  const { data, error } = await supabase
    .from("prescriptions")
    .insert({
      user_id:       userId,
      name:          input.name,
      dose:          input.dose ?? "",
      doctor:        input.doctor ?? "",
      refills:       0,
      next_refill:   null,
      status:        "active",
      is_controlled: false,
      rx_number:     input.rxNumber,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToPrescription(data as PrescriptionRow);
}

export async function updatePrescription(
  id:     string,
  userId: string,
  input:  Partial<PrescriptionInput>,
): Promise<Prescription> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name     !== undefined) patch.name      = input.name;
  if (input.dose      !== undefined) patch.dose      = input.dose;
  if (input.doctor    !== undefined) patch.doctor    = input.doctor;
  if (input.rxNumber  !== undefined) patch.rx_number = input.rxNumber;

  const { data, error } = await supabase
    .from("prescriptions")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return rowToPrescription(data as PrescriptionRow);
}

export async function deletePrescription(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("prescriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
