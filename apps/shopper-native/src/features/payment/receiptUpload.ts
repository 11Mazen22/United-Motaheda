/**
 * Upload payment receipt screenshots to Supabase Storage (receipts bucket).
 *
 * The receipts bucket was public (Storage's getPublicUrl(), no access
 * control) until this fix -- payment-proof screenshots can contain a phone
 * number, transaction ID, and amount, so a leaked URL exposed that with no
 * authentication check at all. The bucket is now private, matching
 * prescriptions/driver-documents: upload stores a bare object path, and any
 * consumer resolves a real, time-limited signed URL at view time via
 * getReceiptSignedUrl() below (see supabase/migrations/
 * 20260923150000_receipts_bucket_privacy.sql for the RLS/bucket change).
 */

import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { readLocalFileAsBlob } from "@/lib/readLocalFileAsBlob";
import { RECEIPTS_BUCKET, normalizeReceiptStoragePath } from "@pharmacy/domain-checkout";

export type ReceiptErrorCode =
  | "permission_denied"
  | "sign_in_required"
  | "read_failed"
  | "upload_failed"
  | "url_failed";

/** Thrown by uploadPaymentReceipt with a stable code — callers translate via i18n. */
export class ReceiptUploadError extends Error {
  code: ReceiptErrorCode;
  constructor(code: ReceiptErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ReceiptUploadError";
    this.code = code;
  }
}

export type PickReceiptResult =
  | { ok: true; localUri: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; code: ReceiptErrorCode };

export async function pickPaymentReceiptImage(): Promise<PickReceiptResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, cancelled: false, code: "permission_denied" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes:    ["images"],
    allowsEditing: true,
    quality:       0.8,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return { ok: false, cancelled: true };
  }

  return { ok: true, localUri: result.assets[0].uri };
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
 * Upload a local image URI to `{userId}/{timestamp}.{ext}` and return the
 * bare object path (NOT a URL — the bucket is private). Store this path
 * as-is in orders.payment_proof_url; resolve a real, time-limited signed
 * URL at view time via getReceiptSignedUrl() instead of ever treating the
 * stored value as a directly-fetchable URL.
 */
export async function uploadPaymentReceipt(
  userId: string,
  localUri: string,
): Promise<string> {
  if (!userId) {
    throw new ReceiptUploadError("sign_in_required");
  }

  const mime = mimeForUri(localUri);
  const ext  = extForMime(mime);
  const path = `${userId}/${Date.now()}.${ext}`;

  let blob: Blob;
  try {
    blob = await readLocalFileAsBlob(localUri);
  } catch {
    throw new ReceiptUploadError("read_failed");
  }

  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });

  if (error) {
    throw new ReceiptUploadError("upload_failed", error.message);
  }

  return path;
}

/**
 * Short-lived signed URL for a private receipt object. Retries once on
 * failure (same pattern as prescriptions'/driver-documents' equivalents) —
 * a signed-URL request can transiently fail right after upload before the
 * object is fully visible to Storage's read path.
 */
export async function getReceiptSignedUrl(rawPath: string): Promise<string> {
  const path = normalizeReceiptStoragePath(rawPath);
  if (!path) throw new ReceiptUploadError("url_failed", "No receipt image is available for this order.");

  const attempt = () => supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 300);

  let { data, error } = await attempt();
  if (error) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    ({ data, error } = await attempt());
  }

  if (error || !data?.signedUrl) {
    throw new ReceiptUploadError("url_failed", error?.message);
  }
  return data.signedUrl;
}
