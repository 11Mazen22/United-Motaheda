/**
 * Pricing engine — ported verbatim from shopper-web, extended with
 * server-validated coupon support.
 *
 * Business rules:
 *  - Legacy promo "UNITED10" → 10% off subtotal (backward-compat, client-side)
 *  - Server coupon (CouponValidationResult) takes precedence over the legacy
 *    promo code when both are present. The coupon discount amount is supplied
 *    directly by the server (validate_coupon RPC) and is never recomputed here.
 *  - Tax = (subtotal - discount) * taxRate (default 0)
 *  - Shipping passed in from delivery quote
 *  - All money rounded to 2 dp
 */

import type {
  CheckoutLineInput,
  CheckoutPricing,
  CheckoutPricingLine,
} from "./types";

const PROMO_CODE = "UNITED10";

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function isPromoCodeEligible(value: string) {
  return value.trim().toUpperCase() === PROMO_CODE;
}

export function createCheckoutPricing(
  lines: CheckoutLineInput[],
  options?: {
    promoCode?:    string;
    shippingFee?:  number;
    taxRate?:      number;
    /** Discount amount from a server-validated coupon (takes precedence). */
    couponAmount?: number;
  },
): CheckoutPricing {
  const normalizedLines: CheckoutPricingLine[] = lines.map((line) => {
    const quantity = Math.max(1, Math.floor(line.quantity));
    const unitPrice = Math.max(0, Number.isFinite(line.unitPrice) ? line.unitPrice : 0);

    return {
      ...line,
      quantity,
      unitPrice: roundCurrency(unitPrice),
      lineTotal: roundCurrency(quantity * unitPrice),
    };
  });

  const itemCount = normalizedLines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = roundCurrency(
    normalizedLines.reduce((total, line) => total + line.lineTotal, 0),
  );

  // Server coupon takes precedence over the legacy UNITED10 client-side code.
  let discount: number;
  if (typeof options?.couponAmount === "number" && options.couponAmount > 0) {
    discount = roundCurrency(Math.min(options.couponAmount, subtotal));
  } else if (isPromoCodeEligible(options?.promoCode ?? "")) {
    discount = roundCurrency(subtotal * 0.1);
  } else {
    discount = 0;
  }

  const taxRate = Math.max(0, options?.taxRate ?? 0);
  const tax = roundCurrency(Math.max(0, subtotal - discount) * taxRate);
  const shipping = roundCurrency(Math.max(0, options?.shippingFee ?? 0));
  const total = roundCurrency(subtotal - discount + tax + shipping);

  return {
    itemCount,
    subtotal,
    discount,
    tax,
    shipping,
    total,
    lines: normalizedLines,
  };
}
