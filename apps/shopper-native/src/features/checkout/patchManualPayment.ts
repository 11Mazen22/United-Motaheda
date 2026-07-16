/**
 * After create-order, persist manual payment proof on the order row.
 * Edge Function may not yet accept proof fields — this client patch is the
 * fallback aligned with RLS policy "orders owner manual payment proof".
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
  const { error } = await supabase
    .from("orders")
    .update({
      status:             "payment_pending",
      payment_status:     "pending_verification",
      transfer_number:    patch.transferNumber.trim(),
      payment_proof_url:  patch.paymentProofUrl,
      payment_method:     paymentMethod,
    })
    .eq("id", orderId);

  if (error) {
    throw new Error(error.message || "تعذّر حفظ بيانات التحويل على الطلب.");
  }
}
