/**
 * Pharmacist Orders API — staff-scoped order queue operations.
 *
 * Security model:
 *   All reads are gated by RLS policies that grant pharmacist/admin/manager
 *   SELECT on orders (see supabase/migrations/20260827090000_pharmacist_backend_fixes.sql
 *   for the pharmacist grant specifically — branch-scoped once a pharmacist
 *   has a branch assigned, unscoped otherwise) and the transition_order RPC,
 *   which restricts a pharmacist to the pre-dispatch transitions only.
 *   All writes go through transition_order() — a SECURITY DEFINER RPC that
 *   validates both the role and the legal state-machine transition server-side.
 *   The pharmacist client never bypasses this.
 *
 * Data contract:
 *   Uses the same ORDERS_SELECT and rowToOrder patterns from
 *   features/orders/api.ts — extended with pharmacist-only columns
 *   (payment_proof_url, transfer_number, items).
 */

import { supabase } from "@/lib/supabase";
import { normalizeOrderStatus } from "@/stores/orders";
import type {
  PharmacistOrder,
  PharmacistOrderItem,
  PharmacistOrderStatus,
  PharmacistTransitionTarget,
  PharmacistDeliveryAssignment,
  OrderTimelineEvent,
  PharmacistDeliveryIssue,
  PharmacistReturnRequest,
} from "./types";
import { PHARMACIST_ACTIVE_STATUSES } from "./types";
import { parseOrderAddress, parseOrderZone, ORDER_LOCATION_SELECT, type OrderLocationRow } from "@/lib/orderAddress";

// ─── Raw DB row shapes ─────────────────────────────────────────────────────────

interface RawOrderItemRow {
  id:               number;
  product_id:       string;
  quantity:         number | string;
  unit_price:       number | string;
  line_total:       number | string;
  product_snapshot: Record<string, unknown>;
}

interface RawOrderRow extends OrderLocationRow {
  id:                string;
  user_id:           string | null;
  status:            string;
  customer_name:     string;
  customer_phone:    string;
  subtotal:          number | string;
  shipping_fee:      number | string;
  total:             number | string;
  discount_total:    number | string;
  note:              string;
  payment_method:    string | null;
  payment_status:    string;
  payment_proof_url: string | null;
  transfer_number:   string | null;
  created_at:        string;
  updated_at:        string;
  last_status_at:    string;
  order_items:       RawOrderItemRow[];
  order_prescriptions: Array<{
    prescription_id: string;
    prescriptions: { review_status: string } | null;
  }> | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

type SnapshotLike = { name?: unknown; name_ar?: unknown; name_en?: unknown; image_url?: unknown; code?: unknown };

function mapItem(row: RawOrderItemRow): PharmacistOrderItem {
  const snap = (row.product_snapshot ?? {}) as SnapshotLike;
  return {
    productId:  row.product_id,
    name:       String(snap.name_ar ?? snap.name_en ?? snap.name ?? ""),
    quantity:   num(row.quantity),
    unitPrice:  num(row.unit_price),
    lineTotal:  num(row.line_total),
    imageUrl:   snap.image_url ? String(snap.image_url) : undefined,
    code:       snap.code ? String(snap.code) : undefined,
  };
}

function mapOrder(row: RawOrderRow): PharmacistOrder {
  const parsed = parseOrderAddress(row);
  const zone   = parseOrderZone(row);
  const address = parsed.formatted || [parsed.street, parsed.city].filter(Boolean).join(", ");

  return {
    id:              row.id,
    status:          normalizeOrderStatus(row.status) as PharmacistOrderStatus,
    customerName:    row.customer_name,
    customerPhone:   row.customer_phone,
    customerAddress: address,
    building:        parsed.building,
    floor:           parsed.floor,
    apartment:       parsed.apartment,
    landmark:        parsed.landmark,
    lat:             parsed.lat,
    lng:             parsed.lng,
    branchId:        zone.branchId,
    zoneId:          zone.zoneId,
    zoneName:        zone.zoneName,
    subtotal:        num(row.subtotal),
    total:           num(row.total),
    discountTotal:   num(row.discount_total),
    shippingFee:     num(row.shipping_fee),
    note:            row.note ?? "",
    paymentMethod:   row.payment_method ?? null,
    paymentStatus:   row.payment_status ?? "pending",
    paymentProofUrl: row.payment_proof_url ?? null,
    transferNumber:  row.transfer_number ?? null,
    items:           (row.order_items ?? []).map(mapItem),
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    lastStatusAt:    row.last_status_at,
    ageMs:           Date.now() - Date.parse(row.created_at),
    linkedPrescriptions: (row.order_prescriptions ?? [])
      .filter((link) => link.prescriptions != null)
      .map((link) => ({
        id: link.prescription_id,
        reviewStatus: link.prescriptions!.review_status as PharmacistOrder["linkedPrescriptions"][number]["reviewStatus"],
      })),
  };
}

const ORDERS_SELECT = [
  "id", "user_id", "status", "customer_name", "customer_phone",
  ...ORDER_LOCATION_SELECT,
  "subtotal", "shipping_fee", "total", "discount_total",
  "note", "payment_method", "payment_status", "payment_proof_url",
  "transfer_number", "created_at", "updated_at", "last_status_at",
  "order_items(id,product_id,quantity,unit_price,line_total,product_snapshot)",
  "order_prescriptions(prescription_id,prescriptions(review_status))",
].join(",");

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the active order queue — all orders in a pharmacist-relevant status,
 * ordered by urgency: oldest (longest waiting) first.
 * RLS enforces pharmacist/admin/manager access.
 */
export async function listPharmacistOrderQueue(): Promise<PharmacistOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_SELECT)
    .in("status", PHARMACIST_ACTIVE_STATUSES)
    .order("last_status_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as RawOrderRow[]).map(mapOrder);
}

/**
 * Fetch a single order by ID — used by the order detail screen.
 * Returns null if not found (RLS will silently return nothing for
 * unauthorized access rather than throwing).
 */
export async function getPharmacistOrder(orderId: string): Promise<PharmacistOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapOrder(data as unknown as RawOrderRow) : null;
}

/**
 * Advance an order through the state machine via the transition_order() RPC.
 * The RPC enforces both role-level and state-machine rules server-side —
 * an illegal transition throws with SQLSTATE 22023.
 *
 * Returns the updated order row (the RPC returns the full orders row).
 */
export async function transitionOrder(
  orderId:    string,
  nextStatus: PharmacistTransitionTarget,
  reason?: string
): Promise<void> {
  if (nextStatus === "cancelled") {
    const { data, error } = await supabase.functions.invoke("cancel-order", {
      body: { orderId, reason: reason || "Pharmacist requested cancellation" },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return;
  }

  const { error } = await supabase.rpc("transition_order", {
    p_order_id:    orderId,
    p_next_status: nextStatus,
  });
  if (error) throw error;
}

/**
 * Fetch the most recent delivery handoff record for an order — powers the
 * order detail screen's "Driver" section. Returns null before a driver has
 * ever been offered the order.
 */
export async function getOrderDeliveryAssignment(orderId: string): Promise<PharmacistDeliveryAssignment | null> {
  const { data, error } = await supabase
    .from("delivery_assignments")
    .select("id, response_status, offered_at, responded_at, arrived_at_pharmacy, picked_up_at, arrived_at_customer, delivered_at")
    .eq("order_id", orderId)
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row = data as {
    id: string; response_status: string; offered_at: string; responded_at: string | null;
    arrived_at_pharmacy: string | null; picked_up_at: string | null;
    arrived_at_customer: string | null; delivered_at: string | null;
  };
  return {
    id: row.id,
    responseStatus: row.response_status as PharmacistDeliveryAssignment["responseStatus"],
    offeredAt: row.offered_at,
    respondedAt: row.responded_at,
    arrivedAtPharmacyAt: row.arrived_at_pharmacy,
    pickedUpAt: row.picked_up_at,
    arrivedAtCustomerAt: row.arrived_at_customer,
    deliveredAt: row.delivered_at,
  };
}

/**
 * The most recent unresolved delivery problem a driver reported against this
 * order (customer unreachable, wrong address, item damaged, etc.) — null
 * once resolved or if none was ever reported. Powers the order detail
 * screen's issue banner; resolving goes through resolve_delivery_issue()
 * (20260827120000), never a raw client UPDATE.
 */
export async function getActiveDeliveryIssue(orderId: string): Promise<PharmacistDeliveryIssue | null> {
  const { data, error } = await supabase
    .from("delivery_issues")
    .select("id, reason_code, note, status, created_at, resolved_at, resolution_note")
    .eq("order_id", orderId)
    .neq("status", "resolved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const row = data as {
    id: string; reason_code: string; note: string | null; status: string;
    created_at: string; resolved_at: string | null; resolution_note: string | null;
  };
  return {
    id: row.id,
    reasonCode: row.reason_code as PharmacistDeliveryIssue["reasonCode"],
    note: row.note,
    status: row.status as PharmacistDeliveryIssue["status"],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
  };
}

export async function resolveDeliveryIssue(issueId: string, resolutionNote: string): Promise<void> {
  const { error } = await supabase.rpc("resolve_delivery_issue", {
    p_issue_id: issueId,
    p_resolution_note: resolutionNote,
  });
  if (error) throw error;
}

/**
 * Whether this order has a return_requests row sitting in INSPECTION —
 * the one status ReturnInspectionScreen (app/(pharmacist)/return/[id].tsx)
 * actually knows how to act on (transition_return_status only allows
 * APPROVED_FOR_REFUND from INSPECTION or APPROVED). Existed with a fully
 * built screen and zero navigation entry point anywhere in the app before
 * this — a return could reach INSPECTION server-side with no way for a
 * pharmacist to discover or act on it.
 */
export async function getActiveReturnRequestId(orderId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("return_requests")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "INSPECTION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Appends a staff note to an order's internal log (order_notes, staff-only
 * visibility). A plain insert is safe here — unlike a status transition,
 * there's no server-side rule to validate, just an append-only record —
 * but RLS still enforces staff-only + author-must-be-self.
 */
export async function addOrderNote(orderId: string, body: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const authorId = auth.user?.id;
  if (!authorId) throw new Error("not_authenticated");
  const { error } = await supabase.from("order_notes").insert({
    order_id: orderId,
    author_id: authorId,
    body: body.trim(),
  });
  if (error) throw error;
}

/**
 * Full chronological order history — creation, assignment lifecycle, issues,
 * staff notes. Already built and pharmacist-accessible server-side
 * (admin_order_timeline, 20260715090000) but never called from this app.
 */
export async function getOrderTimeline(orderId: string): Promise<OrderTimelineEvent[]> {
  const { data, error } = await supabase.rpc("admin_order_timeline", { p_order_id: orderId });
  if (error) throw error;
  return ((data ?? []) as Array<{ event_at: string | null; event_type: string; actor_id: string | null; detail: Record<string, unknown> }>)
    .filter((r) => r.event_at != null)
    .map((r) => ({
      eventAt: r.event_at as string,
      eventType: r.event_type as OrderTimelineEvent["eventType"],
      actorId: r.actor_id,
      detail: r.detail ?? {},
    }));
}

/**
 * Fetch the most recently completed (delivered/cancelled) orders — feeds the
 * workbench's "Recently Completed" section, the one part of a pharmacist's
 * job that the old metric-cards-plus-tabs layout never showed at all.
 */
export async function getRecentlyCompletedOrders(limit = 8): Promise<PharmacistOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_SELECT)
    .in("status", ["delivered", "cancelled"])
    .order("last_status_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as unknown as RawOrderRow[]).map(mapOrder);
}

/**
 * Fetch every order placed on a given calendar date, regardless of status —
 * for revenue and hourly-volume analytics. usePharmacistOrderQueue() is
 * scoped to PHARMACIST_ACTIVE_STATUSES (pre-dispatch only), so an order
 * vanished from "today's revenue"/the hourly chart the instant it reached
 * driver_assigned, even though it was placed and prepared entirely within
 * the pharmacist's shift.
 */
export async function getTodayOrdersForAnalytics(dateISO: string): Promise<Array<{ total: number; createdAt: string }>> {
  const dayStart = `${dateISO}T00:00:00.000Z`;
  const dayEnd   = `${dateISO}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("orders")
    .select("total, created_at")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .neq("status", "cancelled");

  if (error) throw error;
  return ((data ?? []) as Array<{ total: number | string; created_at: string }>).map((r) => ({
    total: num(r.total),
    createdAt: r.created_at,
  }));
}

/**
 * Fetch completed orders for a given calendar date (for the dashboard's
 * "delivered today" and "cancelled today" counters).
 */
export async function getOrderCountsByDate(dateISO: string): Promise<{
  delivered: number;
  cancelled: number;
}> {
  const dayStart = `${dateISO}T00:00:00.000Z`;
  const dayEnd   = `${dateISO}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("orders")
    .select("id, status")
    .in("status", ["delivered", "cancelled"])
    .gte("last_status_at", dayStart)
    .lte("last_status_at", dayEnd);

  if (error) throw error;
  
  return {
    delivered: (data ?? []).filter(r => r.status === "delivered").length,
    cancelled: (data ?? []).filter(r => r.status === "cancelled").length,
  };
}

/**
 * Return requests sitting in INSPECTION -- the one status the app's
 * return-inspection screen (app/(pharmacist)/return/[id].tsx) actually
 * knows how to act on (transition_return_status only allows
 * APPROVED_FOR_REFUND from INSPECTION or APPROVED; a REQUESTED/
 * UNDER_REVIEW request needs a *different*, not-yet-built initial
 * admit/decline flow -- process-return's approve_request/reject_request
 * actions exist server-side with no UI anywhere, same gap this screen
 * itself was in before it got wired up). Scoped to just INSPECTION so
 * every row this returns is actually actionable, not a dead-end tap.
 *
 * Was broken before this fix: filtered on status = 'pending_review',
 * which isn't a value in the return_status enum at all -- every call
 * would have errored (unknown enum value) or returned nothing, and
 * return_items(product_id, quantity) selected two columns that don't
 * exist on that table (the real ones are order_item_id and
 * requested_quantity). Never caught because nothing called this yet --
 * see usePharmacistReturns().
 */
export async function listPendingReturns(): Promise<PharmacistReturnRequest[]> {
  const { data, error } = await supabase
    .from("return_requests")
    .select("id, order_id, status, reason, created_at, order:orders(customer_name, total), return_items(order_item_id)")
    .eq("status", "INSPECTION")
    .order("created_at", { ascending: true });

  if (error) throw error;

  type Row = {
    id: string; order_id: string; status: string; reason: string; created_at: string;
    order: { customer_name: string | null; total: number | string } | null;
    return_items: { order_item_id: number }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    status: row.status as PharmacistReturnRequest["status"],
    reason: row.reason,
    customerName: row.order?.customer_name ?? null,
    orderTotal: num(row.order?.total),
    itemCount: row.return_items?.length ?? 0,
    createdAt: row.created_at,
  }));
}
