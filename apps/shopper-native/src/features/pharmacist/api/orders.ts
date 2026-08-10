/**
 * Pharmacist Orders API — staff-scoped order queue operations.
 *
 * Security model:
 *   All reads are gated by RLS policies that grant pharmacist/admin/manager
 *   SELECT on orders (see database/20260709_driver_orders_select_access.sql
 *   and the transition_order RPC which already includes 'pharmacist').
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
} from "./types";
import { PHARMACIST_ACTIVE_STATUSES } from "./types";

// ─── Raw DB row shapes ─────────────────────────────────────────────────────────

interface RawOrderItemRow {
  id:               number;
  product_id:       string;
  quantity:         number | string;
  unit_price:       number | string;
  line_total:       number | string;
  product_snapshot: Record<string, unknown>;
}

interface RawOrderRow {
  id:                string;
  user_id:           string | null;
  status:            string;
  customer_name:     string;
  customer_phone:    string;
  customer_address:  Record<string, unknown> | null;
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
  const addr = (row.customer_address ?? {}) as {
    formatted?: string; street?: string; streetLine?: string; city?: string;
  };
  const address =
    addr.formatted ??
    [addr.streetLine ?? addr.street, addr.city].filter(Boolean).join(", ") ??
    "";

  return {
    id:              row.id,
    status:          normalizeOrderStatus(row.status) as PharmacistOrderStatus,
    customerName:    row.customer_name,
    customerPhone:   row.customer_phone,
    customerAddress: address,
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
  };
}

const ORDERS_SELECT = [
  "id", "user_id", "status", "customer_name", "customer_phone",
  "customer_address", "subtotal", "shipping_fee", "total", "discount_total",
  "note", "payment_method", "payment_status", "payment_proof_url",
  "transfer_number", "created_at", "updated_at", "last_status_at",
  "order_items(id,product_id,quantity,unit_price,line_total,product_snapshot)",
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
): Promise<void> {
  const { error } = await supabase.rpc("transition_order", {
    p_order_id:    orderId,
    p_next_status: nextStatus,
  });
  if (error) throw error;
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
  const rows = (data ?? []) as Array<{ status: string }>;
  return {
    delivered: rows.filter((r) => r.status === "delivered").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
  };
}
