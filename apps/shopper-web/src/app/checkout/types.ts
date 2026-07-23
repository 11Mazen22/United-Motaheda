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
    transferNumber?: string;
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
