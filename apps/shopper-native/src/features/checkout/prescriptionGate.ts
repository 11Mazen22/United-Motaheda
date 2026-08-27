/**
 * Prescription gate — client-side check mirroring create-order's own
 * server-side gate (supabase/functions/create-order/index.ts), so the
 * customer sees "you need a prescription for this" as a normal checkout
 * step instead of the backend's 422 rejection being the first they hear of
 * it.
 *
 * The server-side check remains authoritative — this is purely UX, not a
 * security boundary; create-order re-validates every prescriptionId against
 * public.prescriptions itself before ever creating the order.
 */
import { supabase } from "@/lib/supabase";

/** Which of the given product ids currently require a prescription. */
export async function fetchPrescriptionRequiredProductIds(productIds: string[]): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds)
    .eq("requires_prescription", true);
  if (error) {
    if (__DEV__) console.warn("[checkout] prescription-required lookup failed:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.id as string));
}
