/**
 * Checkout domain types — ported verbatim from shopper-web.
 * Single source of truth for checkout/cart contracts.
 */

export type CheckoutPaymentMethod =
  | "cod"
  | "instapay"
  | "vodafone"
  | "online"
  | "banquemisr";

export type CheckoutFormInput = {
  fullName: string;
  phone: string;
  city: string;
  streetName: string;
  buildingNumber: string;
  floor: string;
  apartmentNumber: string;
  note: string;
  promoCode: string;
};

export type CheckoutLineInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  name: string;
  code?: string;
  reservationId?: string;
};

export type CheckoutPricingLine = CheckoutLineInput & {
  lineTotal: number;
};

export type CheckoutPricing = {
  itemCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  lines: CheckoutPricingLine[];
};

export type CheckoutConflict = {
  productId: string;
  code: "out_of_stock" | "price_changed" | "unavailable" | "invalid_line";
  message: string;
  availableQuantity?: number;
  currentUnitPrice?: number;
};

export type CheckoutAddressSnapshot = {
  formatted: string;
  city: string;
  streetLine: string;
  region?: string;
  subRegion?: string;
  buildingNumber?: string;
  floor?: string;
  apartmentNumber?: string;
  lat?: number;
  lng?: number;
};

export type CheckoutSubmitCommand = {
  idempotencyKey: string;
  customer: {
    userId?: string;
    email?: string;
    fullName: string;
    phone: string;
  };
  address: CheckoutAddressSnapshot;
  payment: {
    method: CheckoutPaymentMethod;
    label: string;
    requestPosMachine: boolean;
    /** Sender phone or InstaPay handle — required for manual wallet methods. */
    transferNumber?: string;
    /** Public URL of uploaded transfer screenshot. */
    paymentProofUrl?: string;
  };
  promoCode?: string;
  note: string;
  expectedPricing: {
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
  };
  cartLines: CheckoutLineInput[];
};

export type CreateOrderResult = {
  orderId: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentReference?: string | null;
  idempotentReplay?: boolean;
  conflicts: CheckoutConflict[];
};

export type CheckoutFieldName =
  | "fullName"
  | "phone"
  | "city"
  | "streetName"
  | "buildingNumber"
  | "floor"
  | "apartmentNumber";

export type CheckoutFieldErrors = Partial<Record<CheckoutFieldName, string>>;

// ─── Coupon types ─────────────────────────────────────────────────────────────

/** All possible reasons a coupon is invalid — mirrors the validate_coupon RPC. */
export type CouponInvalidReason =
  | "not_found"
  | "inactive"
  | "expired"
  | "limit_reached"
  | "already_redeemed"
  | "first_order_only"
  | "min_order_not_met";

export type CouponValidationResult =
  | {
      valid:            true;
      couponId:         string;
      code:             string;
      discountType:     "percentage" | "fixed_amount";
      discountValue:    number;
      /** Concrete EGP amount deducted from the order subtotal. */
      discountAmount:   number;
      minOrderAmount:   number | null;
      firstOrderOnly:   boolean;
    }
  | {
      valid:            false;
      reason:           CouponInvalidReason;
      /** Present when reason === 'min_order_not_met'. */
      minOrderAmount?:  number;
    };

/** Wire shape returned by the validate-coupon edge function. */
export interface CouponValidationPayload {
  valid:             boolean;
  coupon_id?:        string;
  code?:             string;
  discount_type?:    string;
  discount_value?:   number;
  discount_amount?:  number;
  min_order_amount?: number | null;
  first_order_only?: boolean;
  reason?:           string;
  error?:            string;
}
