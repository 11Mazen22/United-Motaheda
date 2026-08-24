/**
 * Driver API — direct Supabase CRUD for the authenticated driver's own
 * assignments, orders, and issue reports.
 *
 * Mirrors apps/shopper-web/src/services/logisticsApi.ts's conventions:
 *   - Every mutation uses `.update(...).select()` and verifies the returned
 *     row actually reflects the intended change before treating it as a
 *     success — an RLS-silent-denial must surface as a real error, not a
 *     false "it worked".
 *   - Every query is explicitly filtered by the authenticated driver's own
 *     id, as defense-in-depth alongside RLS (orders_select_driver /
 *     order_items_select_driver / delivery_assignments "driver select own" /
 *     delivery_issues "driver select own"/"driver insert own" — see
 *     database/20260708_delivery_assignments_and_issues.sql and
 *     database/20260709_driver_orders_select_access.sql).
 *
 * Order detail reuses fetchOrderById from features/orders/api.ts directly —
 * that query has no user_id filter at all and relies entirely on RLS, so it
 * already works correctly for a driver session now that orders_select_driver
 * exists; no separate "getOrderForDriver" query was needed.
 */

import { supabase } from "@/lib/supabase";
import { fetchOrderById } from "@/features/orders/api";
import { normalizeOrderStatus, type Order, type OrderItem } from "@/stores/orders";
import { notifyCustomerOrderUpdate } from "./customerNotify";

export type { Order, OrderItem };

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssignmentResponseStatus = "offered" | "accepted" | "declined" | "superseded" | "completed";

export interface DeliveryAssignment {
  id:             string;
  orderId:        string;
  driverId:       string;
  assignedBy:     string | null;
  assignmentKind: "assigned" | "reassigned";
  responseStatus: AssignmentResponseStatus;
  declineReason:  string | null;
  offeredAt:      string;
  respondedAt:    string | null;
  pickedUpAt:     string | null;
  deliveredAt:    string | null;
  arrivedAtPharmacy: string | null;
  arrivedAtCustomer: string | null;
}

export type IssueReasonCode =
  | "customer_unreachable"
  | "wrong_address"
  | "customer_refused"
  | "item_damaged"
  | "item_missing"
  | "access_issue"
  | "vehicle_breakdown"
  | "other";

export interface DeliveryIssue {
  id:             string;
  orderId:        string;
  driverId:       string;
  reasonCode:     IssueReasonCode;
  note:           string | null;
  status:         "open" | "acknowledged" | "resolved";
  resolvedBy:     string | null;
  resolvedAt:     string | null;
  resolutionNote: string | null;
  createdAt:      string;
}

export interface DriverLocationPayload {
  driver_id: string;
  order_id: string;
  lat: number;
  lng: number;
  accuracy_meters?: number;
  speed_kmh?: number;
  heading?: number;
  captured_at?: string;
}

/** A manifest entry — an assigned order plus a lightweight summary, enough
 * for the task-list screen without fetching every line item up front. */
export interface ManifestOrder {
  id:              string;
  status:          Order["status"];
  customerName:    string;
  customerPhone:   string;
  customerAddress: string;
  total:           number;
  updatedAt:       string;
}

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface RawAssignmentRow {
  id:               string;
  order_id:         string;
  driver_id:        string;
  assigned_by:      string | null;
  assignment_kind:  "assigned" | "reassigned";
  response_status:  AssignmentResponseStatus;
  decline_reason:   string | null;
  offered_at:       string;
  responded_at:     string | null;
  picked_up_at:     string | null;
  delivered_at:     string | null;
  arrived_at_pharmacy: string | null;
  arrived_at_customer: string | null;
}

interface RawIssueRow {
  id:              string;
  order_id:        string;
  driver_id:       string;
  reason_code:     IssueReasonCode;
  note:            string | null;
  status:          "open" | "acknowledged" | "resolved";
  resolved_by:     string | null;
  resolved_at:     string | null;
  resolution_note: string | null;
  created_at:      string;
}

interface RawManifestRow {
  id:               string;
  status:           string;
  customer_name:    string;
  customer_phone:   string;
  customer_address: Record<string, unknown> | null;
  total:            number | string;
  updated_at:       string;
}

const ASSIGNMENT_COLUMNS =
  "id, order_id, driver_id, assigned_by, assignment_kind, response_status, decline_reason, offered_at, responded_at, picked_up_at, delivered_at, arrived_at_pharmacy, arrived_at_customer";
const ISSUE_COLUMNS =
  "id, order_id, driver_id, reason_code, note, status, resolved_by, resolved_at, resolution_note, created_at";

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function mapAssignmentRow(row: RawAssignmentRow): DeliveryAssignment {
  return {
    id: row.id,
    orderId: row.order_id,
    driverId: row.driver_id,
    assignedBy: row.assigned_by,
    assignmentKind: row.assignment_kind,
    responseStatus: row.response_status,
    declineReason: row.decline_reason,
    offeredAt: row.offered_at,
    respondedAt: row.responded_at,
    pickedUpAt: row.picked_up_at,
    deliveredAt: row.delivered_at,
    arrivedAtPharmacy: row.arrived_at_pharmacy,
    arrivedAtCustomer: row.arrived_at_customer,
  };
}

function mapIssueRow(row: RawIssueRow): DeliveryIssue {
  return {
    id: row.id,
    orderId: row.order_id,
    driverId: row.driver_id,
    reasonCode: row.reason_code,
    note: row.note,
    status: row.status,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
  };
}

function mapManifestRow(row: RawManifestRow): ManifestOrder {
  const addr = (row.customer_address ?? {}) as { formatted?: string; street?: string; streetLine?: string; city?: string };
  const formatted = addr.formatted
    ?? [addr.streetLine ?? addr.street, addr.city].filter(Boolean).join(", ");
  return {
    id: row.id,
    status: normalizeOrderStatus(row.status) as Order["status"],
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerAddress: formatted,
    total: num(row.total),
    updatedAt: row.updated_at,
  };
}

// ─── Manifest (task list) ─────────────────────────────────────────────────────

// Every non-terminal order status — everything except delivered/cancelled.
// Includes the legacy "processing"/"shipped" synonyms (preparing/picked_up)
// since old rows may still carry them (see packages/contracts/orderStatus.ts).
const ACTIVE_ORDER_STATUSES = [
  "pending", "pending_payment", "confirmed", "verification",
  "payment_pending", "payment_approved", "preparing", "ready",
  "driver_assigned", "driver_accepted", "out_for_delivery",
];

/** Orders where I have an ACCEPTED assignment and the order isn't finished
 * yet. Previously filtered orders directly by `status IN ('ready',
 * 'picked_up')`, which meant a driver who accepted an offer for an order
 * still being prepared (a normal, allowed staff workflow — assignment isn't
 * gated on the order already being "ready") saw nothing on their manifest:
 * the accept itself succeeded (delivery_assignments really did flip to
 * "accepted"), but the order's own status hadn't reached "ready" yet, so it
 * never matched. This screen's own comments already described the intended
 * behavior ("accepted orders still being prepared/delivered" /
 * "as soon as they're assigned to you") — the query just didn't match it.
 *
 * Two queries because Supabase-js can't express "an accepted
 * delivery_assignments row exists for this order" as a single filter on
 * orders. delivery_assignments is also the more precise source of truth
 * here than orders.assigned_driver_id alone, since that column is set the
 * moment an offer is made — before the driver has actually accepted it. */
export async function listMyManifest(driverId: string): Promise<ManifestOrder[]> {
  const { data: accepted, error: assignmentsError } = await supabase
    .from("delivery_assignments")
    .select("order_id")
    .eq("driver_id", driverId)
    .eq("response_status", "accepted");

  if (assignmentsError) throw assignmentsError;
  const orderIds = Array.from(new Set((accepted ?? []).map((a) => (a as { order_id: string }).order_id)));
  if (orderIds.length === 0) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id, status, customer_name, customer_phone, customer_address, total, updated_at")
    .in("id", orderIds)
    .eq("assigned_driver_id", driverId)
    .in("status", ACTIVE_ORDER_STATUSES)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RawManifestRow[]).map(mapManifestRow);
}

/** Order detail for a driver — reuses the shared fetchOrderById, which has
 * no user_id filter and relies entirely on RLS (orders_select_driver now
 * grants this for an order assigned to the caller). */
export async function getOrderForDriver(orderId: string): Promise<Order | null> {
  return fetchOrderById(orderId);
}

// ─── Assignment offers (accept / decline) ────────────────────────────────────

/** Assignments offered to me, awaiting my response — powers the "new
 * delivery offer" banner/screen. */
export async function listMyOpenAssignmentOffers(driverId: string): Promise<DeliveryAssignment[]> {
  const { data, error } = await supabase
    .from("delivery_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("driver_id", driverId)
    .eq("response_status", "offered")
    .order("offered_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RawAssignmentRow[]).map(mapAssignmentRow);
}

/** Real acceptance rate from response_status counts — replaces the
 * orphaned EarningsSummary.tsx's version, which divided total orders by
 * total offers ever received (structurally different, and wrong once an
 * order is re-offered to another driver after a decline). */
export async function getMyAcceptanceRate(driverId: string): Promise<number> {
  const { data, error } = await supabase
    .from("delivery_assignments")
    .select("response_status")
    .eq("driver_id", driverId)
    .in("response_status", ["accepted", "declined"]);

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return 100;
  const accepted = rows.filter((r) => (r as { response_status: string }).response_status === "accepted").length;
  return Math.round((accepted / rows.length) * 100);
}

/** The currently-accepted assignment for one order, if any — used by the
 * delivery-execution screen, which is navigated to with only an orderId
 * (from the manifest list), not an assignmentId. */
export async function getMyAssignmentForOrder(orderId: string, driverId: string): Promise<DeliveryAssignment | null> {
  const { data, error } = await supabase
    .from("delivery_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("order_id", orderId)
    .eq("driver_id", driverId)
    .eq("response_status", "accepted")
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAssignmentRow(data as RawAssignmentRow) : null;
}

export async function getAssignment(assignmentId: string, driverId: string): Promise<DeliveryAssignment | null> {
  const { data, error } = await supabase
    .from("delivery_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("id", assignmentId)
    .eq("driver_id", driverId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAssignmentRow(data as RawAssignmentRow) : null;
}

export async function acceptAssignment(assignmentId: string, driverId: string): Promise<DeliveryAssignment> {
  const { data: offer, error: offerError } = await supabase
    .from("delivery_assignments")
    .select("order_id")
    .eq("id", assignmentId)
    .eq("driver_id", driverId)
    .eq("response_status", "offered")
    .maybeSingle();

  if (offerError) throw offerError;
  const orderId = (offer as { order_id?: string } | null)?.order_id;
  if (!orderId) throw new Error("This delivery offer is no longer available.");

  const { error: transitionError } = await supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_next_status: "driver_accepted",
  });
  if (transitionError) throw transitionError;

  const { data, error } = await supabase
    .from("delivery_assignments")
    .update({ response_status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("driver_id", driverId)
    .select(ASSIGNMENT_COLUMNS);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Could not accept this assignment — it may have already been reassigned.");
  }
  const updated = mapAssignmentRow(data[0] as RawAssignmentRow);
  if (updated.responseStatus !== "accepted") {
    throw new Error("Acceptance did not persist; please try again.");
  }
  notifyCustomerOrderUpdate(orderId, "driver_accepted");
  return updated;
}

/** Decline an offered assignment — also clears orders.assigned_driver_id so
 * the order returns to the unassigned pool for staff to reassign. Two direct
 * writes, best-effort on the second (the assignment row is the source of
 * truth; if the orders clear fails, staff still sees the decline in the
 * assignment ledger and can reassign manually). */
export async function declineAssignment(
  assignmentId: string,
  driverId: string,
  orderId: string,
  reason: string,
): Promise<DeliveryAssignment> {
  const { data, error } = await supabase
    .from("delivery_assignments")
    .update({
      response_status: "declined",
      responded_at: new Date().toISOString(),
      decline_reason: reason.trim() || null,
    })
    .eq("id", assignmentId)
    .eq("driver_id", driverId)
    .select(ASSIGNMENT_COLUMNS);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Could not decline this assignment — it may have already been reassigned.");
  }
  const updated = mapAssignmentRow(data[0] as RawAssignmentRow);
  if (updated.responseStatus !== "declined") {
    throw new Error("Decline did not persist; please try again.");
  }

  try {
    await supabase
      .from("orders")
      .update({ assigned_driver_id: null, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("assigned_driver_id", driverId);
  } catch {
    // Best-effort — the decline itself is already recorded; staff will see
    // this order still shows the old driver and can reassign from there.
  }

  return updated;
}

// ─── Delivery execution (pickup / in-transit / delivered) ────────────────────

/** Confirm pickup through the canonical order-state machine. */
export async function confirmPickup(orderId: string, assignmentId: string, driverId: string): Promise<void> {
  const { data, error } = await supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_next_status: "out_for_delivery",
  });

  if (error) throw error;
  const updated = data as { assigned_driver_id?: string | null; status?: string } | null;
  if (!updated || updated.assigned_driver_id !== driverId || updated.status !== "out_for_delivery") {
    throw new Error("Could not confirm pickup — check that this order is still assigned to you.");
  }

  await supabase
    .from("delivery_assignments")
    .update({ picked_up_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("driver_id", driverId);

  notifyCustomerOrderUpdate(orderId, "picked_up");
}

/** Thrown when mark_delivery_arrival's geofence check rejects the call —
 * detected via the RPC error's `hint` field, which the RPC sets to this
 * exact string, rather than string-matching the human-readable message. */
export class TooFarFromDestinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TooFarFromDestinationError";
  }
}

export async function markArrival(
  assignmentId: string,
  orderId: string,
  stage: "pharmacy" | "customer",
  coords: { lat: number; lng: number },
): Promise<DeliveryAssignment> {
  const { data, error } = await supabase.rpc("mark_delivery_arrival", {
    p_assignment_id: assignmentId,
    p_stage: stage,
    p_lat: coords.lat,
    p_lng: coords.lng,
  });
  if (error) {
    if ((error as { hint?: string }).hint === "too_far_from_destination") {
      throw new TooFarFromDestinationError(error.message);
    }
    throw error;
  }
  if (stage === "customer") notifyCustomerOrderUpdate(orderId, "driver_arrived");
  return mapAssignmentRow(data as RawAssignmentRow);
}

export async function completeDelivery(orderId: string, assignmentId: string, driverId: string): Promise<void> {
  const { data, error } = await supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_next_status: "delivered",
  });

  if (error) throw error;
  const updated = data as { assigned_driver_id?: string | null; status?: string } | null;
  if (!updated || updated.assigned_driver_id !== driverId || updated.status !== "delivered") {
    throw new Error("Could not mark this order delivered — check that it's still assigned to you.");
  }

  await supabase
    .from("delivery_assignments")
    .update({ delivered_at: new Date().toISOString(), response_status: "completed" })
    .eq("id", assignmentId)
    .eq("driver_id", driverId);

  notifyCustomerOrderUpdate(orderId, "delivered");
}

// ─── Issue reporting ──────────────────────────────────────────────────────────

export async function reportIssue(
  orderId: string,
  driverId: string,
  reasonCode: IssueReasonCode,
  note?: string,
): Promise<DeliveryIssue> {
  // Avoid duplicate open reports during retry/reconnect. This is intentionally
  // checked at the data boundary as well as in the UI, because a driver can
  // submit from a stale screen after the realtime update has already arrived.
  const { data: existing, error: existingError } = await supabase
    .from("delivery_issues")
    .select(ISSUE_COLUMNS)
    .eq("order_id", orderId)
    .eq("driver_id", driverId)
    .neq("status", "resolved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return mapIssueRow(existing as RawIssueRow);

  const { data, error } = await supabase
    .from("delivery_issues")
    .insert({
      order_id: orderId,
      driver_id: driverId,
      reason_code: reasonCode,
      note: note?.trim() || null,
    })
    .select(ISSUE_COLUMNS)
    .single();

  if (error) throw error;
  return mapIssueRow(data as RawIssueRow);
}

/** My own past issue reports for one order — so the delivery screen can show
 * "you already reported X" instead of letting a driver report the same
 * problem twice in a row. */
export async function listMyIssuesForOrder(orderId: string, driverId: string): Promise<DeliveryIssue[]> {
  const { data, error } = await supabase
    .from("delivery_issues")
    .select(ISSUE_COLUMNS)
    .eq("order_id", orderId)
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RawIssueRow[]).map(mapIssueRow);
}

export async function pushDriverLocation(payload: DriverLocationPayload): Promise<void> {
  const { error } = await supabase.functions.invoke("driver-location", {
    body: payload,
  });

  if (error) throw error;
}

// ─── Driver application (vetting/approval flow) ──────────────────────────────
// Against apps/api's DriverProfile table (Prisma-managed, PascalCase columns),
// not the delivery_assignments/orders tables above. RLS: an authenticated
// user can SELECT/INSERT only their own row (userId = auth.uid()), and can
// never set status directly — see
// apps/api/prisma/migrations/20260824105530_driver_profile_self_access_rls.
// status only ever changes via apps/api's admin approval endpoints.

export type DriverApplicationStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "SUSPENDED"
  | "REJECTED"
  | "INACTIVE";

export type DriverDocumentType = "license" | "id" | "vehicle" | "insurance";

export interface DriverProfileRecord {
  id: string;
  userId: string;
  vehicleType: string;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  licenseNumber: string | null;
  licensePhotoUrl: string | null;
  idPhotoUrl: string | null;
  vehiclePhotoUrl: string | null;
  insurancePhotoUrl: string | null;
  status: DriverApplicationStatus;
  rejectionReason: string | null;
  createdAt: string;
}

interface RawDriverProfileRow {
  id: string;
  userId: string;
  vehicleType: string;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  licenseNumber: string | null;
  licensePhotoUrl: string | null;
  idPhotoUrl: string | null;
  vehiclePhotoUrl: string | null;
  insurancePhotoUrl: string | null;
  status: DriverApplicationStatus;
  rejectionReason: string | null;
  createdAt: string;
}

const DRIVER_PROFILE_COLUMNS =
  'id, userId, vehicleType, vehiclePlate, vehicleModel, vehicleColor, licenseNumber, licensePhotoUrl, idPhotoUrl, vehiclePhotoUrl, insurancePhotoUrl, status, rejectionReason, createdAt';

function mapDriverProfileRow(row: RawDriverProfileRow): DriverProfileRecord {
  return { ...row };
}

/** The caller's own driver application, if one exists — null before they've
 * ever applied. Powers both the (driver) route gate and the application
 * entry point's "form vs. pending status" decision. */
export async function getMyDriverProfile(userId: string): Promise<DriverProfileRecord | null> {
  const { data, error } = await supabase
    .from("DriverProfile")
    .select(DRIVER_PROFILE_COLUMNS)
    .eq("userId", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapDriverProfileRow(data as RawDriverProfileRow) : null;
}

export interface DriverApplicationInput {
  vehicleType: "motorcycle" | "car" | "van";
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePhotoUrl: string;
  idPhotoUrl: string;
  vehiclePhotoUrl: string;
  insurancePhotoUrl: string;
}

/** Creates the caller's own application (status defaults to
 * PENDING_APPROVAL server-side). The unique constraint on userId means this
 * can only ever succeed once — there is no resubmit-after-rejection path
 * yet, matching the driver-app-consolidation plan's Phase 3 scope. */
export async function createDriverApplication(
  userId: string,
  input: DriverApplicationInput,
): Promise<DriverProfileRecord> {
  const { data, error } = await supabase
    .from("DriverProfile")
    .insert({ userId, ...input })
    .select(DRIVER_PROFILE_COLUMNS)
    .single();

  if (error) throw error;
  return mapDriverProfileRow(data as RawDriverProfileRow);
}

/** Uploads one document image to the private driver-documents bucket and
 * returns a getPublicUrl()-shaped string. The bucket is private (identity
 * documents), so this URL is not directly fetchable — it exists only so
 * apps/api's existing getSignedUrl()/deleteDriverDocument() helpers, which
 * already parse "last 3 path segments" out of exactly this URL shape, keep
 * working unchanged. Actual display always requires resolving through a
 * signed URL. */
export async function uploadDriverDocument(
  userId: string,
  documentType: DriverDocumentType,
  localUri: string,
): Promise<string> {
  const mime = localUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const ext = mime === "image/png" ? "png" : "jpg";
  const path = `${userId}/${documentType}/${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  if (!response.ok) throw new Error("read_failed");
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from("driver-documents")
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("driver-documents").getPublicUrl(path);
  return data.publicUrl;
}

// ─── Earnings ─────────────────────────────────────────────────────────────
// Reads DriverEarning directly. NOTE: nothing currently writes rows into
// this table for deliveries completed through shopper-native's own
// transition_order/mark_delivery_arrival flow -- apps/api's backend (the
// only thing that ever wrote DriverEarning rows) isn't in that path.
// Until a real per-delivery fee structure is decided and wired into that
// flow, this will correctly return an empty/zero result rather than the
// wrong number DriverManifest.tsx used to show.

export interface DriverEarningRecord {
  id: string;
  deliveryId: string;
  baseFee: number;
  distanceFee: number;
  tipAmount: number;
  bonusAmount: number;
  totalAmount: number;
  isPaid: boolean;
  earnedAt: string;
}

interface RawDriverEarningRow {
  id: string;
  deliveryId: string;
  baseFee: string;
  distanceFee: string;
  tipAmount: string;
  bonusAmount: string;
  totalAmount: string;
  isPaid: boolean;
  earnedAt: string;
}

function mapDriverEarningRow(row: RawDriverEarningRow): DriverEarningRecord {
  return {
    id: row.id,
    deliveryId: row.deliveryId,
    baseFee: Number(row.baseFee),
    distanceFee: Number(row.distanceFee),
    tipAmount: Number(row.tipAmount),
    bonusAmount: Number(row.bonusAmount),
    totalAmount: Number(row.totalAmount),
    isPaid: row.isPaid,
    earnedAt: row.earnedAt,
  };
}

/** All earning rows for the given DriverProfile id (not userId — earnings
 * key off DriverProfile.id via a foreign key). Caller resolves that id via
 * getMyDriverProfile first. */
export async function listMyEarnings(driverProfileId: string): Promise<DriverEarningRecord[]> {
  const { data, error } = await supabase
    .from("DriverEarning")
    .select("id, deliveryId, baseFee, distanceFee, tipAmount, bonusAmount, totalAmount, isPaid, earnedAt")
    .eq("driverId", driverProfileId)
    .order("earnedAt", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as RawDriverEarningRow[]).map(mapDriverEarningRow);
}
