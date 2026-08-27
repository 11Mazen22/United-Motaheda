/**
 * Pharmacist domain types.
 *
 * All types are self-contained here — no cross-feature imports — so the
 * pharmacist feature is independently testable and the type graph is clear.
 */

// ─── Order status ──────────────────────────────────────────────────────────────

export type PharmacistOrderStatus =
  | "pending"
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
  building?:        string;
  floor?:           string;
  apartment?:       string;
  landmark?:        string;
  lat:              number | null;
  lng:              number | null;
  branchId:         string | null;
  zoneId:           string | null;
  zoneName:         string | null;
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
  /** Prescriptions that were validated to unblock this order at checkout —
   *  see order_prescriptions (supabase/migrations/20260827100000_prescription_order_linkage_and_refills.sql). */
  linkedPrescriptions: { id: string; reviewStatus: PrescriptionReviewStatus }[];
  createdAt:        string;
  updatedAt:        string;
  lastStatusAt:     string;
  /** Client-computed age in milliseconds. */
  ageMs?:           number;
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
  createdAt:        string;
  updatedAt:        string;
  /** Denormalised from profiles join — customer's display name. */
  customerName:     string;
  customerPhone:    string | null;
  imagePath:        string | null;
  /** Alias for createdAt used by some screens. */
  addedAt?:         string;
  /** Orders this prescription unblocked at checkout (order_prescriptions). */
  orderIds:         string[];
}

export interface ReviewPrescriptionInput {
  reviewStatus:    "approved" | "rejected";
  adminNotes?:     string;
  rejectionReason?: string;
}

// ─── Refill requests ───────────────────────────────────────────────────────────

export type RefillRequestStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export interface PharmacistRefillRequest {
  id:               string;
  prescriptionId:   string;
  userId:           string;
  medicineName:     string;
  customerName:     string;
  customerPhone:    string | null;
  delivery:         string;
  status:           RefillRequestStatus;
  trackingNumber:   string | null;
  total:            number;
  copay:            number;
  insuranceApplied: number;
  eta:              string | null;
  placedAt:         string;
  deliveredAt:      string | null;
  reviewedAt:       string | null;
  adminNotes:       string | null;
  rejectionReason:  string | null;
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

// ─── Delivery handoff ───────────────────────────────────────────────────────────

export type DeliveryAssignmentStatus = "offered" | "accepted" | "declined" | "completed";

export interface PharmacistDeliveryAssignment {
  id:                 string;
  responseStatus:     DeliveryAssignmentStatus;
  offeredAt:          string;
  respondedAt:        string | null;
  arrivedAtPharmacyAt: string | null;
  pickedUpAt:         string | null;
  arrivedAtCustomerAt: string | null;
  deliveredAt:        string | null;
}

// ─── Timeline ───────────────────────────────────────────────────────────────────

export type OrderTimelineEventType =
  | "order_created"
  | "assignment_offered"
  | "assignment_declined"
  | "assignment_accepted"
  | "picked_up"
  | "delivered"
  | "assignment_superseded"
  | "issue_reported"
  | "issue_resolved"
  | "note_added";

export interface OrderTimelineEvent {
  eventAt:   string;
  eventType: OrderTimelineEventType;
  actorId:   string | null;
  detail:    Record<string, unknown>;
}

// ─── Delivery issues ──────────────────────────────────────────────────────────

export type DeliveryIssueReasonCode =
  | "customer_unreachable"
  | "wrong_address"
  | "customer_refused"
  | "item_damaged"
  | "item_missing"
  | "access_issue"
  | "vehicle_breakdown"
  | "other";

export type DeliveryIssueStatus = "open" | "acknowledged" | "resolved";

export interface PharmacistDeliveryIssue {
  id:              string;
  reasonCode:      DeliveryIssueReasonCode;
  note:            string | null;
  status:          DeliveryIssueStatus;
  createdAt:       string;
  resolvedAt:      string | null;
  resolutionNote:  string | null;
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
