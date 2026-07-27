/**
 * couponApi — client for the validate-coupon Edge Function.
 *
 * Separation of concerns: the API call lives here, completely decoupled from
 * any React state. The useApplyCoupon hook composes this with loading/error
 * state. The pricing engine consumes the result independently.
 *
 * All validation is server-side. The client displays the result.
 */

import { supabase } from "@/lib/supabase";
import type {
  CouponValidationPayload,
  CouponValidationResult,
} from "./types";

const EDGE_FUNCTION_NAME = "validate-coupon";

/** Map the raw wire payload to the typed domain result. */
function parseCouponPayload(
  raw: CouponValidationPayload,
): CouponValidationResult {
  if (raw.valid) {
    return {
      valid:          true,
      couponId:       raw.coupon_id   ?? "",
      code:           raw.code        ?? "",
      discountType:   (raw.discount_type as "percentage" | "fixed_amount") ?? "fixed_amount",
      discountValue:  raw.discount_value  ?? 0,
      discountAmount: raw.discount_amount ?? 0,
      minOrderAmount: raw.min_order_amount ?? null,
      firstOrderOnly: raw.first_order_only ?? false,
    };
  }

  // Map raw reason string to the typed union. Unknown reasons fall back to
  // 'not_found' so the UI always has a message to show.
  const validReasons = new Set([
    "not_found",
    "inactive",
    "expired",
    "limit_reached",
    "already_redeemed",
    "first_order_only",
    "min_order_not_met",
  ]);

  const reason = validReasons.has(raw.reason ?? "")
    ? (raw.reason as CouponValidationResult["reason" & keyof Extract<CouponValidationResult, { valid: false }>])
    : "not_found";

  return {
    valid:           false,
    reason:          reason as CouponValidationResult extends { valid: false; reason: infer R } ? R : never,
    minOrderAmount:  raw.min_order_amount ?? undefined,
  };
}

export class CouponValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponValidationError";
  }
}

/**
 * validateCouponCode — calls the validate-coupon Edge Function.
 *
 * @param code           — raw coupon string as typed by the user
 * @param orderSubtotal  — cart subtotal BEFORE the coupon (used for
 *                         min_order_amount and discount_amount calculation)
 * @returns CouponValidationResult — never throws for business-logic failures;
 *          only throws CouponValidationError for network / server errors.
 */
export async function validateCouponCode(
  code:           string,
  orderSubtotal:  number,
): Promise<CouponValidationResult> {
  const { data, error } = await supabase.functions.invoke<CouponValidationPayload>(
    EDGE_FUNCTION_NAME,
    {
      body: {
        code:            code.trim().toUpperCase(),
        order_subtotal:  orderSubtotal,
      },
    },
  );

  if (error) {
    throw new CouponValidationError(
      error.message ?? "Failed to validate coupon. Please try again.",
    );
  }

  if (!data) {
    throw new CouponValidationError("Empty response from coupon service.");
  }

  return parseCouponPayload(data);
}
