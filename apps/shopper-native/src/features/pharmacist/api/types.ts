/**
 * Pharmacist domain types.
 *
 * All types are self-contained here — no cross-feature imports — so the
 * pharmacist feature is independently testable and the type graph is clear.
 */

// ─── Order status ──────────────────────────────────────────────────────────────

export type PharmacistOrderStatus =
  | "pending"
  | "confirmed"
  | "verification"
  | "payment_pending"
  | "payment_approved"
  | "preparing"
  | "ready"
  | "driver_assigned"
  | "driver_accepted"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "archived";

/** Statuses that appear in the pharmacist active queue (not yet dispatched). */
export const PHARMACIST_ACTIVE_STATUSES: PharmacistOrderStatus[] = [
  "pending",
  "confirmed",
  "verification",
  "payment_pending",
  "payment_approved",
  "preparing",
  "ready",
];

/** Statuses the pharmacist can transition an order TO. */
export type PharmacistTransitionTarget =
  | "verification"
  | "payment_pending"
  | "payment_approved"
  | "preparing"
  | "ready"
  | "cancelled";

// ─── Order queue item ──────────────────────────────────────────────────────────

export interface PharmacistOrderItem {
  productId:       string;
  name:            string;
  quantity:        number;
  unitPrice:       number;
  lineTotal:       number;
  imageUrl?:       string;
  code?:           string;
}

export interface PharmacistOrder {
  id:               string;
  status:           PharmacistOrderStatus;
  customerName:     string;
  customerPhone:    string;
  customerAddress:  string;
  subtotal:         number;
  total:            number;
  discountTotal:    number;
  shippingFee:      number;
  note:             string;
  paymentMethod:    string | null;
  paymentStatus:    string;
  paymentProofUrl:  string | null;
  transferNumber:   string | null;
  items:            PharmacistOrderItem[];
  createdAt:        string;
  updatedAt:        string;
  lastStatusAt:     string;
  /** Milliseconds since createdAt — used for urgency sorting. */
  ageMs:            number;
}

// ─── Prescription ──────────────────────────────────────────────────────────────

export type PrescriptionReviewStatus = "pending_review" | "approved" | "rejected";
export type SubmissionSource         = "manual" | "whatsapp" | "scan";

export interface PharmacistPrescription {
  id:               string;
  userId:           string;
  name:             string;
  dose:             string;
  doctor:           string;
  rxNumber:         string | null;
  refills:          number;
  reviewStatus:     PrescriptionReviewStatus;
  submissionSource: SubmissionSource;
  adminNotes:       string | null;
  rejectionReason:  string | null;
  reviewedBy:       string | null;
  reviewedAt:       string | null;
  addedAt:          string;
  updatedAt:        string;
  /** Denormalised from profiles join — customer's display name. */
  customerName:     string;
  customerPhone:    string | null;
  imagePath:        string | null;
}

export interface ReviewPrescriptionInput {
  reviewStatus:    "approved" | "rejected";
  adminNotes?:     string;
  rejectionReason?: string;
}

// ─── Inventory ─────────────────────────────────────────────────────────────────

export interface PharmacistProduct {
  id:              string;
  code:            string | null;
  barcode:         string | null;
  nameAr:          string | null;
  nameEn:          string | null;
  name:            string;
  price:           number;
  effectivePrice:  number;
  stock:           number;
  onHand:          number;
  reserved:        number;
  available:       number;
  categoryName:    string | null;
  imageUrl:        string | null;
  isActive:        boolean;
  hasPromotion:    boolean;
}

// ─── Dashboard stats ───────────────────────────────────────────────────────────

export interface PharmacistDashboardStats {
  /** Orders in the active queue right now. */
  activeOrders:         number;
  /** Orders waiting for payment verification. */
  pendingPayment:       number;
  /** Orders actively being prepared. */
  preparing:            number;
  /** Orders ready for driver pickup. */
  ready:                number;
  /** Prescriptions pending pharmacist review. */
  pendingPrescriptions: number;
  /** Products with stock <= lowStockThreshold (default 5). */
  lowStockCount:        number;
  /** Orders completed today (delivered). */
  deliveredToday:       number;
  /** Orders cancelled today. */
  cancelledToday:       number;
}
