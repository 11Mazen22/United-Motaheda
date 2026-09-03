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
import { abortTimeout } from "@/utils/timeout";
import { readLocalFileAsBlob } from "@/lib/readLocalFileAsBlob";
import { fetchOrderById } from "@/features/orders/api";
import { normalizeOrderStatus, type Order, type OrderItem } from "@/stores/orders";
import { notifyCustomerOrderUpdate } from "./customerNotify";
import { parseOrderAddress, parseOrderZone, ORDER_LOCATION_SELECT, type OrderLocationRow } from "@/lib/orderAddress";

export type { Order, OrderItem };

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssignmentResponseStatus = "offered" | "accepted" | "declined" | "superseded" | "completed";

export interface DeliveryAssignment {
  id:             string;
  orderId:        string;
  driverId:       string;
  assignedBy:     string | null;
  assignmentKind: "assigned" | "reassigned" | "return_pickup";
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
  photoUrl:       string | null;
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
 * for the task-list screen without fetching every line item up front.
 * Carries the accepted assignment's own id/milestones directly (joined in
 * listMyManifest) so a list row can decide its own next action without a
 * second per-row query — see OrderCardNew, which used to fire
 * useMyAssignmentForOrder per card just to learn these same three
 * timestamps. */
export interface ManifestOrder {
  id:              string;
  status:          Order["status"];
  customerName:    string;
  customerPhone:   string;
  customerAddress: string;
  building?:       string;
  floor?:          string;
  apartment?:      string;
  landmark?:       string;
  lat:             number | null;
  lng:             number | null;
  branchId:        string | null;
  zoneId:          string | null;
  zoneName:        string | null;
  total:           number;
  paymentMethod:   string | null;
  updatedAt:       string;
  assignmentId:       string;
  assignmentKind?:    string;
  pickedUpAt:         string | null;
  arrivedAtPharmacy:  string | null;
  arrivedAtCustomer:  string | null;
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
  photo_url:       string | null;
  status:          "open" | "acknowledged" | "resolved";
  resolved_by:     string | null;
  resolved_at:     string | null;
  resolution_note: string | null;
  created_at:      string;
}

interface RawManifestRow extends OrderLocationRow {
  id:               string;
  status:           string;
  customer_name:    string;
  customer_phone:   string;
  total:            number | string;
  payment_method:   string | null;
  updated_at:       string;
}

interface ManifestAssignmentInfo {
  id:               string;
  assignmentKind?:  string;
  pickedUpAt:       string | null;
  arrivedAtPharmacy: string | null;
  arrivedAtCustomer: string | null;
}

const ASSIGNMENT_COLUMNS =
  "id, order_id, driver_id, assigned_by, assignment_kind, response_status, decline_reason, offered_at, responded_at, picked_up_at, delivered_at, arrived_at_pharmacy, arrived_at_customer";
const ISSUE_COLUMNS =
  "id, order_id, driver_id, reason_code, note, photo_url, status, resolved_by, resolved_at, resolution_note, created_at";

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
    photoUrl: row.photo_url,
    status: row.status,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
  };
}

function mapManifestRow(row: RawManifestRow, assignment: ManifestAssignmentInfo): ManifestOrder {
  const parsed = parseOrderAddress(row);
  const zone   = parseOrderZone(row);
  const formatted = parsed.formatted
    ?? [parsed.street, parsed.city].filter(Boolean).join(", ");
  return {
    id: row.id,
    status: normalizeOrderStatus(row.status) as Order["status"],
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerAddress: formatted,
    building: parsed.building,
    floor: parsed.floor,
    apartment: parsed.apartment,
    landmark: parsed.landmark,
    lat: parsed.lat,
    lng: parsed.lng,
    branchId: zone.branchId,
    zoneId: zone.zoneId,
    zoneName: zone.zoneName,
    total: num(row.total),
    paymentMethod: row.payment_method,
    updatedAt: row.updated_at,
    assignmentId: assignment.id,
    assignmentKind: assignment.assignmentKind,
    pickedUpAt: assignment.pickedUpAt,
    arrivedAtPharmacy: assignment.arrivedAtPharmacy,
    arrivedAtCustomer: assignment.arrivedAtCustomer,
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
    .select("id, order_id, assignment_kind, picked_up_at, arrived_at_pharmacy, arrived_at_customer")
    .eq("driver_id", driverId)
    .eq("response_status", "accepted")
    .is("delivered_at", null); // Don't fetch already delivered assignments!

  if (assignmentsError) throw assignmentsError;
  const assignmentByOrderId = new Map<string, ManifestAssignmentInfo>();
  for (const row of (accepted ?? []) as Array<{ id: string; order_id: string; assignment_kind: string; picked_up_at: string | null; arrived_at_pharmacy: string | null; arrived_at_customer: string | null }>) {
    assignmentByOrderId.set(row.order_id, {
      id: row.id,
      assignmentKind: row.assignment_kind,
      pickedUpAt: row.picked_up_at,
      arrivedAtPharmacy: row.arrived_at_pharmacy,
      arrivedAtCustomer: row.arrived_at_customer,
    });
  }
  const orderIds = Array.from(assignmentByOrderId.keys());
  if (orderIds.length === 0) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(`id, status, customer_name, customer_phone, total, payment_method, updated_at, ${ORDER_LOCATION_SELECT.join(",")}`)
    .in("id", orderIds)
    .eq("assigned_driver_id", driverId)
    .in("status", [...ACTIVE_ORDER_STATUSES, "delivered"])
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as RawManifestRow[])
    .map((row) => {
      const assignment = assignmentByOrderId.get(row.id);
      // Guaranteed present — orderIds above came from this exact map's keys.
      return mapManifestRow(row, assignment!);
    });
}

/** Order detail for a driver — reuses the shared fetchOrderById, which has
 * no user_id filter and relies entirely on RLS (orders_select_driver now
 * grants this for an order assigned to the caller). */
export async function getOrderForDriver(orderId: string): Promise<Order | null> {
  return fetchOrderById(orderId);
}

// ─── Assignment offers (accept / decline) ────────────────────────────────────

/** An offer plus enough real order context for the driver to actually
 * decide whether to accept it — zone, pickup branch, destination area, and
 * the real order total (used as the fee estimate, same value
 * resolve_delivery_zone/checkout already priced). Previously
 * listMyOpenAssignmentOffers returned only the bare assignment row, so the
 * offers screen had nothing to show but an order-id and a static
 * "Estimated fee" label with no value next to it — orders.assigned_driver_id
 * is already set at offer time (assignDriver() sets it before the driver
 * ever responds), so orders_select_driver RLS already permits this join;
 * no new grant is required. */
export interface AssignmentOffer extends DeliveryAssignment {
  zoneName: string | null;
  branchId: string | null;
  destinationArea: string | null;
  total: number;
  /** Already fetched via ORDER_LOCATION_SELECT for every offer preview, but
   *  previously dropped on the floor before reaching this type -- the offers
   *  screen had everything it needed to show a real distance and showed
   *  none. */
  customerLat: number | null;
  customerLng: number | null;
}

interface RawOfferOrderRow extends OrderLocationRow {
  id: string;
  total: number | string;
}

/** Assignments offered to me, awaiting my response — powers the "new
 * delivery offer" banner/screen. */
export async function listMyOpenAssignmentOffers(driverId: string): Promise<AssignmentOffer[]> {
  const { data, error } = await supabase
    .from("delivery_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("driver_id", driverId)
    .eq("response_status", "offered")
    .order("offered_at", { ascending: false });

  if (error) throw error;
  const assignments = ((data ?? []) as RawAssignmentRow[]).map(mapAssignmentRow);
  if (assignments.length === 0) return [];

  const orderIds = Array.from(new Set(assignments.map((a) => a.orderId)));
  const { data: orderRows, error: orderError } = await supabase
    .from("orders")
    .select(`id, total, ${ORDER_LOCATION_SELECT.join(",")}`)
    .in("id", orderIds);
  if (orderError) throw orderError;

  const previewByOrderId = new Map<string, {
    zoneName: string | null; branchId: string | null; destinationArea: string | null; total: number;
    customerLat: number | null; customerLng: number | null;
  }>();
  for (const row of (orderRows ?? []) as unknown as RawOfferOrderRow[]) {
    const parsed = parseOrderAddress(row);
    const zone = parseOrderZone(row);
    previewByOrderId.set(row.id, {
      zoneName: zone.zoneName,
      branchId: zone.branchId,
      destinationArea: parsed.city || null,
      total: num(row.total),
      customerLat: row.customer_lat != null ? num(row.customer_lat) : null,
      customerLng: row.customer_lng != null ? num(row.customer_lng) : null,
    });
  }

  return assignments.map((a) => ({
    ...a,
    zoneName: previewByOrderId.get(a.orderId)?.zoneName ?? null,
    branchId: previewByOrderId.get(a.orderId)?.branchId ?? null,
    destinationArea: previewByOrderId.get(a.orderId)?.destinationArea ?? null,
    total: previewByOrderId.get(a.orderId)?.total ?? 0,
    customerLat: previewByOrderId.get(a.orderId)?.customerLat ?? null,
    customerLng: previewByOrderId.get(a.orderId)?.customerLng ?? null,
  }));
}

/** Real acceptance rate from response_status counts — replaces the
 * orphaned EarningsSummary.tsx's version, which divided total orders by
 * total offers ever received (structurally different, and wrong once an
 * order is re-offered to another driver after a decline). */
/** Returns null when the driver has no accepted/declined history yet --
 * distinct from an actual 100%. A brand-new driver silently showing
 * "Acceptance 100%" reads as fabricated data; callers should render the
 * null case as "no data yet" (e.g. "—" or a "new driver" label). */
export async function getMyAcceptanceRate(driverId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("delivery_assignments")
    .select("response_status")
    .eq("driver_id", driverId)
    .in("response_status", ["accepted", "declined"]);

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return null;
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

/** Accepts an offered assignment through driver_accept_assignment — a
 * single SECURITY DEFINER RPC that transitions the order AND updates
 * delivery_assignments.response_status atomically, rather than the two
 * separate client writes this used to be. Those could fall out of sync on
 * a crash between them (order at driver_accepted, assignment still
 * "offered") with no way to self-heal on retry — the same class of bug
 * declineAssignment's own driver_decline_assignment RPC already existed
 * to avoid. */
export async function acceptAssignment(assignmentId: string): Promise<DeliveryAssignment> {
  const { data, error } = await supabase.rpc("driver_accept_assignment", {
    p_assignment_id: assignmentId,
  });

  if (error) throw error;
  const updated = mapAssignmentRow(data as RawAssignmentRow);
  notifyCustomerOrderUpdate(updated.orderId, "driver_accepted");
  return updated;
}

/** Decline an offered assignment. Goes through driver_decline_assignment —
 * a single SECURITY DEFINER RPC that both records the decline and clears
 * orders.assigned_driver_id atomically, rather than two separate client
 * writes (the second of which had no confirmed RLS grant to ever succeed —
 * no tracked migration grants the driver role an UPDATE policy on orders). */
export async function declineAssignment(
  assignmentId: string,
  reason: string,
): Promise<DeliveryAssignment> {
  const { data, error } = await supabase.rpc("driver_decline_assignment", {
    p_assignment_id: assignmentId,
    p_reason: reason.trim() || null,
  });

  if (error) throw error;
  return mapAssignmentRow(data as RawAssignmentRow);
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

export async function completeDelivery(orderId: string, assignmentId: string, driverId: string, assignmentKind: string = "delivery"): Promise<void> {
  if (assignmentKind === "return_pickup") {
    // For returns, we don't transition the order status. We complete the return request.
    const { data: request } = await supabase
      .from("return_requests")
      .select("id")
      .eq("order_id", orderId)
      .not("status", "in", '("completed","rejected")') // not completed or rejected
      .limit(1)
      .maybeSingle();

    if (!request) throw new Error("Could not find the return request for this order.");

    const { data, error } = await supabase.functions.invoke("process-return", {
      body: { requestId: request.id, action: "complete" },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await supabase
      .from("delivery_assignments")
      .update({ delivered_at: new Date().toISOString(), response_status: "completed" })
      .eq("id", assignmentId)
      .eq("driver_id", driverId);

    return;
  }

  // Normal delivery
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
  photoUrl?: string,
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
      photo_url: photoUrl ?? null,
    })
    .select(ISSUE_COLUMNS)
    .single();

  if (error) throw error;
  return mapIssueRow(data as RawIssueRow);
}

/** Uploads one photo to the private delivery-issue-photos bucket
 * ({driver_id}/{order_id}/{timestamp}.jpg — see
 * 20260827010000_delivery_issue_photos.sql for the matching RLS) and
 * returns its storage path (not a public URL — the bucket is private;
 * staff resolve it through a signed URL when reviewing the report). */
export async function uploadIssuePhoto(driverId: string, orderId: string, localUri: string): Promise<string> {
  const mime = localUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const ext = mime === "image/png" ? "png" : "jpg";
  const path = `${driverId}/${orderId}/${Date.now()}.${ext}`;

  const blob = await readLocalFileAsBlob(localUri);

  const { error } = await supabase.storage
    .from("delivery-issue-photos")
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw error;

  return path;
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
  isOnline: boolean;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: string | null;
  rating: number;
  totalDeliveries: number;
  completionRate: number;
  totalEarnings: number;
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
  isOnline: boolean;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: string | null;
  rating: number;
  totalDeliveries: number;
  completionRate: number;
  totalEarnings: number | string;
}

const DRIVER_PROFILE_COLUMNS =
  'id, userId, vehicleType, vehiclePlate, vehicleModel, vehicleColor, licenseNumber, licensePhotoUrl, idPhotoUrl, vehiclePhotoUrl, insurancePhotoUrl, status, rejectionReason, createdAt, isOnline, currentLat, currentLng, lastLocationAt, rating, totalDeliveries, completionRate, totalEarnings';

function mapDriverProfileRow(row: RawDriverProfileRow): DriverProfileRecord {
  return { ...row, totalEarnings: num(row.totalEarnings) };
}

/** Toggle online/offline (+ optional last-known position) via the
 * column-safe set_driver_availability RPC — DriverProfile has no general
 * UPDATE policy on purpose (status/vehicle/document fields must not be
 * self-editable), so this is the one narrow, safe exception. */
export async function setDriverAvailability(
  isOnline: boolean,
  coords?: { lat: number; lng: number },
): Promise<Pick<DriverProfileRecord, "isOnline" | "currentLat" | "currentLng" | "lastLocationAt">> {
  const { data, error } = await supabase.rpc("set_driver_availability", {
    p_is_online: isOnline,
    p_lat: coords?.lat ?? null,
    p_lng: coords?.lng ?? null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    isOnline: boolean; currentLat: number | null; currentLng: number | null; lastLocationAt: string | null;
  };
  return { isOnline: row.isOnline, currentLat: row.currentLat, currentLng: row.currentLng, lastLocationAt: row.lastLocationAt };
}

/** The caller's own driver application, if one exists — null before they've
 * ever applied. Powers both the (driver) route gate and the application
 * entry point's "form vs. pending status" decision. */
export async function getMyDriverProfile(userId: string): Promise<DriverProfileRecord | null> {
  // (driver)/_layout.tsx blocks its ENTIRE section behind this query's
  // isLoading — a plain fetch with no timeout can hang on a bad connection
  // for as long as the OS/browser's own TCP timeout takes (can be a minute
  // or more), which means the whole driver app just looks permanently
  // stuck with no visible error. Same bounded-request fix as lib/geocoding.ts.
  // 20s (not the original 10s): confirmed live that a real approved driver
  // account was hitting this timeout on a normal connection -- this is a
  // simple indexed single-row lookup (userId is @unique), so the slowness is
  // connection/pooler latency, not the query itself; 10s was cutting off
  // requests that would have succeeded a few seconds later.
  const { data, error } = await supabase
    .from("DriverProfile")
    .select(DRIVER_PROFILE_COLUMNS)
    .eq("userId", userId)
    .abortSignal(abortTimeout(20_000))
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

  const blob = await readLocalFileAsBlob(localUri);

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
