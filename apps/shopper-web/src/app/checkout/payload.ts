import type { UserProfile } from "../../contexts/AuthContext";
import type {
  CheckoutAddressSnapshot,
  CheckoutFormInput,
  CheckoutPaymentMethod,
  CheckoutPricing,
  CheckoutSubmitCommand,
} from "./types";

function compact(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

export function buildCheckoutAddressSnapshot(
  form: CheckoutFormInput,
  options?: {
    region?: string;
    subRegion?: string;
    coordinates?: {
      lat: number;
      lng: number;
    } | null;
  },
): CheckoutAddressSnapshot {
  const floorLine = form.floor.trim() ? `Floor ${form.floor.trim()}` : null;
  const apartmentLine = form.apartmentNumber.trim()
    ? `Apt ${form.apartmentNumber.trim()}`
    : null;
  const buildingLine = form.buildingNumber.trim()
    ? `Building ${form.buildingNumber.trim()}`
    : null;
  const streetLine = compact([form.streetName.trim(), buildingLine, floorLine, apartmentLine]);

  return {
    formatted: compact([streetLine, form.city.trim()]),
    city: form.city.trim(),
    streetLine,
    region: options?.region?.trim() || undefined,
    subRegion: options?.subRegion?.trim() || undefined,
    buildingNumber: form.buildingNumber.trim() || undefined,
    floor: form.floor.trim() || undefined,
    apartmentNumber: form.apartmentNumber.trim() || undefined,
    lat: options?.coordinates?.lat,
    lng: options?.coordinates?.lng,
  };
}

export function buildCheckoutNote(options: {
  note: string;
  paymentLabel: string;
  paymentMethod: CheckoutPaymentMethod;
  requestPosMachine: boolean;
  lang: "ar" | "en";
}) {
  const lines = [options.note.trim()];

  if (options.paymentMethod === "cod" && options.requestPosMachine) {
    lines.push(
      options.lang === "ar"
        ? "طلب جهاز POS مع المندوب"
        : "POS machine requested with courier",
    );
  }

  lines.push(
    `${options.lang === "ar" ? "طريقة الدفع" : "Payment method"}: ${options.paymentLabel}`,
  );

  return lines.filter(Boolean).join("\n");
}

export function createIdempotencyKey() {
  return crypto.randomUUID();
}

export function buildCheckoutSubmitCommand(input: {
  idempotencyKey: string;
  user: UserProfile | null;
  form: CheckoutFormInput;
  pricing: CheckoutPricing;
  region?: string;
  subRegion?: string;
  coordinates?: {
    lat: number;
    lng: number;
  } | null;
  paymentMethod: CheckoutPaymentMethod;
  paymentLabel: string;
  requestPosMachine: boolean;
  note: string;
  transferNumber?: string;
  paymentProofUrl?: string;
}): CheckoutSubmitCommand {
  const address = buildCheckoutAddressSnapshot(input.form, {
    region: input.region,
    subRegion: input.subRegion,
    coordinates: input.coordinates,
  });

  return {
    idempotencyKey: input.idempotencyKey,
    customer: {
      userId: input.user?.id,
      email: input.user?.email,
      fullName: input.form.fullName.trim(),
      phone: input.form.phone.trim(),
    },
    address,
    payment: {
      method: input.paymentMethod,
      label: input.paymentLabel,
      requestPosMachine: input.requestPosMachine,
      transferNumber: input.transferNumber || undefined,
      paymentProofUrl: input.paymentProofUrl || undefined,
    },
    promoCode: input.form.promoCode.trim() || undefined,
    note: input.note,
    expectedPricing: {
      subtotal: input.pricing.subtotal,
      discount: input.pricing.discount,
      tax: input.pricing.tax,
      shipping: input.pricing.shipping,
      total: input.pricing.total,
    },
    cartLines: input.pricing.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      name: line.name,
      code: line.code,
    })),
  };
}
