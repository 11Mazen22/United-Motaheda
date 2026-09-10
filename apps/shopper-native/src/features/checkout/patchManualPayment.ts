/**
 * After create-order, persist manual payment proof on the order row.
 * Edge Function may not yet accept proof fields — this client patch is the
 * fallback, calling the submit_manual_payment_proof RPC (not a raw table
 * update: RLS's WITH CHECK can restrict column VALUES but not which columns
 * a caller touches, so the RPC's fixed column list is what actually keeps
 * this to exactly transfer_number/payment_proof_url/payment_method/status/
 * payment_status).
 */

import { supabase } from "@/lib/supabase";

export interface ManualPaymentPatch {
  transferNumber: string;
  paymentProofUrl: string;
}

export async function patchOrderManualPayment(
  orderId: string,
  patch: ManualPaymentPatch,
  paymentMethod: "vodafone" | "instapay",
): Promise<void> {
  const { error } = await supabase.rpc("submit_manual_payment_proof", {
    p_order_id:          orderId,
    p_transfer_number:   patch.transferNumber.trim(),
    p_payment_proof_url: patch.paymentProofUrl,
    p_payment_method:    paymentMethod,
  });

  if (error) {
    throw new Error(error.message || "تعذّر حفظ بيانات التحويل على الطلب.");
  }
}
