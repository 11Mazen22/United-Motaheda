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
    promoCode?: string;
    discountAmount?: number;
    shippingFee?: number;
    taxRate?: number;
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
  const discount = options?.discountAmount != null
    ? roundCurrency(Math.min(subtotal, Math.max(0, options.discountAmount)))
    : isPromoCodeEligible(options?.promoCode ?? "")
      ? roundCurrency(subtotal * 0.1)
      : 0;
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
