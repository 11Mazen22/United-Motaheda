/**
 * webPaymentApi.ts — Handles payment proof upload and order payment patching
 * for the web checkout flow (Vodafone Cash / InstaPay manual transfers).
 *
 * The receipts bucket was public (getPublicUrl(), no access control) until
 * this fix -- payment-proof screenshots can contain a phone number,
 * transaction ID, and amount. The bucket is now private; upload stores a
 * bare object path and any consumer resolves a signed URL at view time via
 * getWebReceiptSignedUrl() below (see supabase/migrations/
 * 20260923150000_receipts_bucket_privacy.sql).
 */

import { getSupabaseClient } from "../lib/supabaseClient";
import { RECEIPTS_BUCKET, normalizeReceiptStoragePath } from "@pharmacy/domain-checkout";

// Reuses the same bucket apps/shopper-native uploads manual-payment receipts
// to (confirmed live: it exists, with working owner-scoped upload/read +
// staff-read policies). "payment-receipts" was never actually created as a
// bucket on either database -- every web upload attempt failed outright.
const BUCKET = RECEIPTS_BUCKET;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export type ManualPaymentMethod = "instapay" | "vodafone";

export function isManualPaymentMethod(method: string): method is ManualPaymentMethod {
  return method === "instapay" || method === "vodafone";
}

/**
 * Uploads a payment receipt image to Supabase Storage.
 * Returns the bare object path (NOT a URL — the bucket is private). Store
 * this as-is; resolve a real signed URL at view time via
 * getWebReceiptSignedUrl().
 */
export async function uploadWebPaymentReceipt(
  userId: string,
  file: File,
): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("حجم الملف أكبر من 10 ميجابايت. يرجى اختيار صورة أصغر.");
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`تعذّر رفع الإيصال: ${error.message}`);
  }

  return path;
}

/** Short-lived signed URL for a private receipt object (retry-once, same
 *  pattern as prescriptions'/driver-documents' equivalents). */
export async function getWebReceiptSignedUrl(rawPath: string): Promise<string> {
  const path = normalizeReceiptStoragePath(rawPath);
  if (!path) throw new Error("لا توجد صورة إيصال متاحة لهذا الطلب.");

  const supabase = getSupabaseClient();
  const attempt = () => supabase.storage.from(BUCKET).createSignedUrl(path, 300);

  let { data, error } = await attempt();
  if (error) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    ({ data, error } = await attempt());
  }

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "تعذّر تحميل صورة الإيصال.");
  }
  return data.signedUrl;
}

/**
 * Patches an existing order with payment proof details after it's been created.
 * Used as a fallback if the Edge Function didn't persist them.
 *
 * Goes through submit_manual_payment_proof (a SECURITY DEFINER RPC) rather
 * than a raw `.from("orders").update(...)` — the same fix already applied to
 * apps/shopper-native's equivalent path. orders never had an UPDATE policy
 * for the order's own customer at all (every such write was silently
 * rejected by RLS); the RPC is also what actually keeps this write to
 * exactly these five columns — RLS's WITH CHECK can restrict column
 * VALUES but not which columns a raw update touches in the same statement.
 */
export async function patchWebOrderManualPayment(
  orderId: string,
  transferNumber: string,
  paymentProofUrl: string,
  paymentMethod: ManualPaymentMethod,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc("submit_manual_payment_proof", {
    p_order_id: orderId,
    p_transfer_number: transferNumber.trim(),
    p_payment_proof_url: paymentProofUrl,
    p_payment_method: paymentMethod,
  });

  if (error) {
    throw new Error(`تعذّر حفظ بيانات التحويل: ${error.message}`);
  }
}
