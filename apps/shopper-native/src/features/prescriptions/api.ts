/**
 * Prescriptions API — direct Supabase CRUD for the authenticated user's own
 * prescriptions. RLS on the `prescriptions` table scopes every row to
 * `user_id = auth.uid()`; every call here also filters by userId explicitly
 * so a bad id can never touch another user's row even if RLS were misconfigured.
 */

import { supabase } from "@/lib/supabase";
import type { Prescription } from "@/stores/prescriptionsStore";
import { rowToPrescription, type PrescriptionRow } from "./lib/rowMappers";

export type SubmissionSource = "manual" | "scan" | "whatsapp";

export interface PrescriptionInput {
  name:      string;
  rxNumber?: string;
  dose?:     string;
  doctor?:   string;
  refills?:  number;
  imagePath?: string;
}

function mimeForUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  return "jpg";
}

/**
 * Upload a local image URI to `prescriptions/{userId}/{prescriptionId}/image.{ext}`.
 * Returns the exact storage path. Retries once on failure -- confirmed live
 * that a single slow-connection blip was enough to fail this with no
 * automatic recovery, showing "couldn't upload" for what a second attempt
 * a moment later would have handled fine.
 */
export async function uploadPrescriptionImage(
  userId: string,
  prescriptionId: string,
  localUri: string,
): Promise<string> {
  const mime = mimeForUri(localUri);
  const ext  = extForMime(mime);
  const path = `${userId}/${prescriptionId}/image.${ext}`;

  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error("Failed to read local image file");
  }
  const blob = await response.blob();

  const attempt = () => supabase.storage
    .from("prescriptions")
    .upload(path, blob, { contentType: mime, upsert: true });

  let { error } = await attempt();
  if (error) {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    ({ error } = await attempt());
  }

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  return path;
}

/**
 * Creates a prescription and enters it into the staff review queue
 * (review_status: 'pending_review'). Every NEW submission from the app goes
 * through review — the DB column default of 'approved' exists only so
 * pre-existing historical rows aren't retroactively flagged, never for rows
 * this function inserts.
 */
export async function createPrescription(
  userId: string,
  input:  PrescriptionInput,
  source: SubmissionSource = "manual",
): Promise<Prescription> {
  const { data, error } = await supabase
    .from("prescriptions")
    .insert({
      user_id:           userId,
      name:              input.name,
      dose:              input.dose ?? "",
      doctor:            input.doctor ?? "",
      refills:           input.refills ?? 0,
      next_refill:       null,
      status:            "active",
      is_controlled:     false,
      rx_number:         input.rxNumber ?? null,
      review_status:     "pending_review",
      submission_source: source,
      image_path:        input.imagePath ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  const prescription = rowToPrescription(data as PrescriptionRow);
  try {
    await supabase.rpc("notify_staff_prescription_submitted", {
      p_prescription_id: prescription.id,
    });
  } catch (notificationError) {
    if (__DEV__) console.warn("[prescriptions] staff notification failed:", notificationError);
  }
  return prescription;
}

/**
 * Lightweight tracking placeholder for the "Send via WhatsApp" path — no
 * automation exists to receive/parse the actual photo the customer sends
 * over WhatsApp (that remains a human-to-human conversation), but staff
 * should still see "a customer said they're sending one" in their review
 * queue so nothing silently falls through the cracks.
 */
export async function createWhatsAppPrescriptionPlaceholder(
  userId: string,
  placeholderName: string,
): Promise<Prescription> {
  return createPrescription(userId, { name: placeholderName }, "whatsapp");
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
  if (input.imagePath !== undefined) patch.image_path = input.imagePath;

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

/**
 * Executes the safe, multi-step transaction for submitting a prescription with an image:
 * 1. Create the pending prescription record to get an ID.
 * 2. Upload the image to the secure storage path.
 * 3. Update the record with the image_path.
 *
 * If the upload fails, the just-created record is deleted rather than left
 * behind image-less: the pharmacist queue has no way to represent "still
 * waiting on an image" (every card assumes one exists), so an orphaned
 * record just sat there confusingly forever, and retrying from the scan
 * screen created a new one every time on top of it. Deleting lets a retry
 * produce one clean record instead of accumulating ghosts.
 */
export async function submitPrescriptionWithImage(
  userId: string,
  input: PrescriptionInput,
  localImageUri: string,
  source: SubmissionSource = "manual"
): Promise<Prescription> {
  // 1. Create the record
  const prescription = await createPrescription(userId, input, source);

  try {
    // 2. Upload the image
    const imagePath = await uploadPrescriptionImage(userId, prescription.id, localImageUri);

    // 3. Link the image path to the record
    return await updatePrescription(prescription.id, userId, { imagePath });
  } catch (error) {
    await deletePrescription(prescription.id, userId).catch(() => {
      // Best-effort cleanup — surfacing the original upload error matters
      // more than a cleanup failure the user can't act on anyway.
    });
    throw Object.assign(new Error(`Prescription record created, but image upload failed.`), {
      prescriptionId: prescription.id,
      originalError: error,
    });
  }
}

export async function deletePrescription(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("prescriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
