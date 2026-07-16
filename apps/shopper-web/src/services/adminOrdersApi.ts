/**
 * adminOrdersApi.ts — Supabase-native admin orders service.
 *
 * Replaces the googleSheetsApi / logisticsApi chain for the OrdersManager.
 * Queries public.orders joined with public.order_items to surface:
 *   - All order metadata (payment_proof_url, transfer_number, payment_status)
 *   - Per-line item data from product_snapshot + live product table fallback
 *   - Paginated listing suitable for the admin table
 */

import { getSupabaseClient } from "../lib/supabaseClient";
import { notifyOrderStatusChange, notifyPaymentStatusChange } from "./orderNotificationsApi";
import type { OrderStatus as AdminOrderStatus } from "@pharmacy/contracts";

// ─── Public types ─────────────────────────────────────────────────────────────

// Canonical definition + lifecycle doc lives in @pharmacy/contracts
// (packages/contracts/src/orderStatus.ts). "processing" and "shipped" are
// legacy synonyms of "preparing"/"picked_up" — still valid to read (the DB
// enum accepts both), but new code should write the canonical spelling.
export type { AdminOrderStatus };

export type AdminPaymentStatus =
  | "pending"
  | "pending_verification"
  | "verified"
  | "failed";

export type AdminOrderItem = {
  productId:  string;
  name:       string;
  imageUrl?:  string;
  quantity:   number;
  unitPrice:  number;
  lineTotal:  number;
};

export type AdminOrder = {
  id:              string;
  externalRef?:    string;
  createdAt:       string;
  status:          AdminOrderStatus;
  paymentMethod:   string | null;
  paymentStatus:   AdminPaymentStatus;
  paymentProofUrl: string | null;
  transferNumber:  string | null;
  customerName:    string;
  customerPhone:   string;
  customerAddress: Record<string, unknown> | null;
  note:            string;
  subtotal:        number;
  shipping:        number;
  discountTotal:   number;
  total:           number;
  items:           AdminOrderItem[];
};

export type AdminOrdersPage = {
  orders:     AdminOrder[];
  totalCount: number;
};

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface OrderItemRow {
  id:               number;
  product_id:       string;
  quantity:         string | number;
  unit_price:       string | number;
  line_total:       string | number;
  product_snapshot: Record<string, unknown>;
}

interface OrderRow {
  id:               string;
  external_ref:     string | null;
  created_at:       string;
  status:           string;
  payment_method:   string | null;
  payment_status:   string;
  payment_proof_url: string | null;
  transfer_number:  string | null;
  customer_name:    string;
  customer_phone:   string;
  customer_address: Record<string, unknown> | null;
  note:             string;
  subtotal:         string | number;
  shipping_fee:     string | number;
  discount_total:   string | number;
  total:            string | number;
  order_items:      OrderItemRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isFinite(n) ? n : 0;
}

function parseSnapshotName(snap: Record<string, unknown>): string {
  return (
    (snap.name as string | undefined) ??
    (snap.name_ar as string | undefined) ??
    (snap.name_en as string | undefined) ??
    ""
  );
}

function mapItems(rows: OrderItemRow[]): AdminOrderItem[] {
  return (rows ?? []).map((row) => ({
    productId: row.product_id,
    name:      parseSnapshotName(row.product_snapshot ?? {}),
    imageUrl:  (row.product_snapshot?.image_url as string | undefined) ?? undefined,
    quantity:  num(row.quantity),
    unitPrice: num(row.unit_price),
    lineTotal: num(row.line_total),
  }));
}

function mapRow(row: OrderRow): AdminOrder {
  return {
    id:              row.id,
    externalRef:     row.external_ref ?? undefined,
    createdAt:       row.created_at,
    status:          row.status as AdminOrderStatus,
    paymentMethod:   row.payment_method,
    paymentStatus:   (row.payment_status ?? "pending") as AdminPaymentStatus,
    paymentProofUrl: row.payment_proof_url,
    transferNumber:  row.transfer_number,
    customerName:    row.customer_name,
    customerPhone:   row.customer_phone,
    customerAddress: row.customer_address,
    note:            row.note ?? "",
    subtotal:        num(row.subtotal),
    shipping:        num(row.shipping_fee),
    discountTotal:   num(row.discount_total),
    total:           num(row.total),
    items:           mapItems(row.order_items),
  };
}

// Base order columns that the orders table is guaranteed to have.
const ORDERS_BASE_COLUMNS = [
  "id",
  "external_ref",
  "created_at",
  "status",
  "payment_method",
  "payment_status",
  "payment_proof_url",
  "transfer_number",
  "customer_name",
  "customer_phone",
  "customer_address",
  "note",
  "subtotal",
  "shipping_fee",
  "discount_total",
  "total",
];

// Two select strings: one with the order_items join, one without.
// We try the join first; if it 404s (relationship not declared in Supabase or
// table missing), we transparently retry without the join so the admin panel
// can still surface order metadata instead of failing outright.
const ORDERS_SELECT_WITH_ITEMS = [
  ...ORDERS_BASE_COLUMNS,
  "order_items(id,product_id,quantity,unit_price,line_total,product_snapshot)",
].join(",");

const ORDERS_SELECT_NO_ITEMS = ORDERS_BASE_COLUMNS.join(",");

// PostgREST returns code "PGRST200" for missing relationships and HTTP 404 for
// missing tables. The exact code depends on the Supabase version, so we treat
// the query as "join not available" whenever its message or code points at the
// embedded order_items join — and ALSO whenever the request returns 404, since
// the join's missing row is the overwhelmingly common cause of that here.
function isMissingRelationship(err: unknown): boolean {
  const e = err as { code?: string; message?: string; status?: number; details?: string; hint?: string } | null;
  if (!e) return false;
  if (e.code === "PGRST200" || e.code === "PGRST106") return true;
  if (e.status === 404 || e.status === 400) return true;
  const text = `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
  return text.includes("could not find a relationship")
      || text.includes("relation \"order_items\" does not exist")
      || text.includes("order_items")
      || text.includes("embedded resource");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FetchAdminOrdersArgs {
  page?:        number;
  pageSize?:    number;
  status?:      AdminOrderStatus | null;
  search?:      string;
  fromDate?:    string;
  toDate?:      string;
  signal?:      AbortSignal;
}

/** Fetch paginated orders for the admin table. */
export async function fetchAdminOrders(
  args: FetchAdminOrdersArgs = {},
): Promise<AdminOrdersPage> {
  const {
    page     = 1,
    pageSize = 20,
    status,
    search,
    fromDate,
    toDate,
    signal,
  } = args;

  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  const sb = getSupabaseClient();

  const buildQuery = (selectStr: string) => {
    let q = sb
      .from("orders")
      .select(selectStr, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) q = q.eq("status", status);

    if (search?.trim()) {
      const s = search.trim();
      q = q.or(
        `customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,id.ilike.%${s}%`,
      );
    }

    if (fromDate) q = q.gte("created_at", fromDate);
    if (toDate)   q = q.lte("created_at", toDate);

    if (signal) q = q.abortSignal(signal) as typeof q;

    return q;
  };

  // First attempt: include order_items join (the rich path).
  let { data, error, count } = await buildQuery(ORDERS_SELECT_WITH_ITEMS);

  // Fallback: retry without the join if the relationship/table is missing.
  if (error && isMissingRelationship(error)) {
    if (import.meta.env.DEV) {
      console.debug(
        "[adminOrdersApi] order_items join unavailable, retrying without it",
        error,
      );
    }
    ({ data, error, count } = await buildQuery(ORDERS_SELECT_NO_ITEMS));
  }

  if (error) throw error;

  const rows   = (data ?? []) as unknown as OrderRow[];
  let   orders = rows.map(mapRow);

  // Hydrate missing product names/images from live products table (no-op
  // when items are empty, so this is safe in the fallback path too).
  orders = await hydrateItems(orders);

  return { orders, totalCount: count ?? 0 };
}

/** Fetch a single order by ID with full item details. */
export async function fetchAdminOrderById(id: string): Promise<AdminOrder | null> {
  const sb = getSupabaseClient();
  const run = (selectStr: string) =>
    sb.from("orders").select(selectStr).eq("id", id).maybeSingle();

  let { data, error } = await run(ORDERS_SELECT_WITH_ITEMS);

  if (error && isMissingRelationship(error)) {
    ({ data, error } = await run(ORDERS_SELECT_NO_ITEMS));
  }

  if (error) throw error;
  if (!data) return null;

  const order = mapRow(data as unknown as OrderRow);
  const [hydrated] = await hydrateItems([order]);
  return hydrated ?? null;
}

/** Update order status (admin). */
export async function adminUpdateOrderStatus(
  orderId: string,
  status:  AdminOrderStatus,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("admin_transition_order", {
    p_order_id: orderId,
    p_next_status: status,
  });
  if (error) throw error;
  notifyOrderStatusChange(orderId, status);
}

/** Mark a manual payment as verified (admin review). */
export async function adminVerifyPayment(orderId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({ payment_status: "verified" })
    .eq("id", orderId);

  if (error) throw error;
  notifyPaymentStatusChange(orderId, "verified");
}

/** Reject / flag a payment as failed. */
export async function adminRejectPayment(
  orderId: string,
  reason?: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("orders")
    .update({
      payment_status: "failed",
      failure_reason: reason ?? "تم رفض الإيصال من قِبَل الإدارة",
    })
    .eq("id", orderId);

  if (error) throw error;
  notifyPaymentStatusChange(orderId, "rejected", reason);
}

// ─── Image hydration ──────────────────────────────────────────────────────────

async function hydrateItems(orders: AdminOrder[]): Promise<AdminOrder[]> {
  const missingIds = new Set<string>();
  for (const o of orders) {
    for (const item of o.items) {
      if (item.productId && (!item.name || !item.imageUrl)) {
        missingIds.add(item.productId);
      }
    }
  }
  if (missingIds.size === 0) return orders;

  try {
    const { data } = await getSupabaseClient()
      .from("products")
      .select('id, "Name_Ar", "Name_En", image_url')
      .in("id", Array.from(missingIds));

    if (!data?.length) return orders;

    const map = new Map<string, { name: string; imageUrl?: string }>();
    for (const p of data as Array<{
      id: string;
      Name_Ar?: string | null;
      Name_En?: string | null;
      image_url?: string | null;
    }>) {
      map.set(p.id, {
        name:     p.Name_Ar ?? p.Name_En ?? "",
        imageUrl: p.image_url ?? undefined,
      });
    }

    return orders.map((o) => ({
      ...o,
      items: o.items.map((item) => {
        const p = map.get(item.productId);
        if (!p) return item;
        return {
          ...item,
          name:     item.name || p.name,
          imageUrl: item.imageUrl ?? p.imageUrl,
        };
      }),
    }));
  } catch {
    return orders;
  }
}
