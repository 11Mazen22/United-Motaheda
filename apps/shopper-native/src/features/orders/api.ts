/**
 * Orders API — wraps public.orders + public.order_items.
 *
 * Items live in the order_items table (not the orders.items JSONB column,
 * which is a legacy artifact). Each order_items row has a product_snapshot
 * JSON that the Edge Function stores at creation time. When the snapshot is
 * empty ({}) we do a single batch lookup against the products table to
 * hydrate name + image_url so the UI always shows real product data.
 *
 * Extra columns (payment_proof_url, transfer_number) live on the orders
 * table in the live Supabase DB even though the Prisma schema is stale.
 * PostgREST returns them as long as the column exists on the table.
 *
 * The client NEVER inserts orders directly — that goes through the
 * create-order Edge Function.
 */

import { supabase } from "@/lib/supabase";
import { timed } from "@/lib/devTiming";
import type { Order, OrderItem, OrderStatus } from "@/stores/orders";

// ─── Raw row shapes ──────────────────────────────────────────────────────────

interface ProductSnapshot {
  name?:      string;
  name_ar?:   string;
  name_en?:   string;
  image_url?: string;
  code?:      string;
  price?:     number;
}

interface OrderItemRow {
  id:               number;
  product_id:       string;
  quantity:         number | string;
  unit_price:       number | string;
  line_total:       number | string;
  product_snapshot: Record<string, unknown>;
}

interface OrderRow {
  id:               string;
  user_id:          string | null;
  created_at:       string;
  status:           string;
  subtotal:         number | string;
  shipping_fee:     number | string;
  total:            number | string;
  discount_total:   number | string;
  tax_total:        number | string;
  note:             string;
  customer_name:    string;
  customer_phone:   string;
  customer_address: Record<string, unknown> | null;
  customer_lat:     number | null;
  customer_lng:     number | null;
  payment_method:   string | null;
  payment_status:   string;
  external_ref:     string | null;
  payment_proof_url: string | null;
  transfer_number:  string | null;
  qr_token:         string | null;
  order_items:      OrderItemRow[];
}

interface CustomerAddress {
  city?:            string;
  street?:          string;
  streetLine?:      string;
  building?:        string;
  buildingNumber?:  string;
  floor?:           string;
  apartmentNumber?: string;
  notes?:           string;
  formatted?:       string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function parseItemRows(rows: OrderItemRow[]): OrderItem[] {
  return (rows ?? []).map((row) => {
    const snap = (row.product_snapshot ?? {}) as ProductSnapshot;
    return {
      productId: row.product_id,
      name:      snap.name ?? snap.name_ar ?? snap.name_en ?? "",
      price:     num(row.unit_price),
      quantity:  num(row.quantity),
      imageUrl:  snap.image_url ?? undefined,
    };
  });
}

function rowToOrder(row: OrderRow): Order {
  const addr      = (row.customer_address ?? {}) as CustomerAddress;
  const city      = typeof addr.city === "string" ? addr.city : "";
  const street    =
    typeof addr.streetLine    === "string" ? addr.streetLine    :
    typeof addr.street        === "string" ? addr.street        : "";
  const building  =
    typeof addr.buildingNumber === "string" ? addr.buildingNumber :
    typeof addr.building       === "string" ? addr.building       : undefined;
  const floor     = typeof addr.floor    === "string" ? addr.floor    : undefined;
  const apartment = typeof addr.apartmentNumber === "string" ? addr.apartmentNumber : undefined;
  const formatted = typeof addr.formatted === "string" ? addr.formatted : undefined;

  return {
    id:            row.id,
    createdAt:     row.created_at,
    items:         parseItemRows(row.order_items ?? []),
    subtotal:      num(row.subtotal),
    delivery:      num(row.shipping_fee),
    total:         num(row.total),
    discountTotal: num(row.discount_total),
    taxTotal:      num(row.tax_total),
    address: {
      name:       row.customer_name,
      phone:      row.customer_phone,
      city,
      street,
      building,
      floor,
      apartment,
      formatted,
      notes:
        row.note ||
        (typeof addr.notes === "string" ? addr.notes : undefined),
    },
    customerLat:     row.customer_lat ?? null,
    customerLng:     row.customer_lng ?? null,
    status:          row.status as OrderStatus,
    paymentMethod:   row.payment_method   ?? null,
    paymentStatus:   row.payment_status   ?? "pending",
    externalRef:     row.external_ref     ?? null,
    paymentProofUrl: row.payment_proof_url ?? null,
    transferNumber:  row.transfer_number  ?? null,
    qrToken:         row.qr_token         ?? null,
  };
}

// ─── Supabase select string ──────────────────────────────────────────────────

const ORDERS_SELECT = [
  "id",
  "user_id",
  "created_at",
  "status",
  "subtotal",
  "shipping_fee",
  "total",
  "discount_total",
  "tax_total",
  "note",
  "customer_name",
  "customer_phone",
  "customer_address",
  "customer_lat",
  "customer_lng",
  "payment_method",
  "payment_status",
  "external_ref",
  "payment_proof_url",
  "transfer_number",
  "qr_token",
  "order_items(id,product_id,quantity,unit_price,line_total,product_snapshot)",
].join(",");

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchUserOrders(userId: string): Promise<Order[]> {
  const { data, error } = await timed(
    "orders:fetchUserOrders",
    () =>
      supabase
        .from("orders")
        .select(ORDERS_SELECT)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
  );

  if (error) throw error;
  const orders = ((data ?? []) as unknown as OrderRow[]).map(rowToOrder);
  return _hydrateImages(orders);
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await timed(
    "orders:fetchOrderById",
    () =>
      supabase
        .from("orders")
        .select(ORDERS_SELECT)
        .eq("id", orderId)
        .maybeSingle(),
  );

  if (error) throw error;
  if (!data) return null;
  const order = rowToOrder(data as unknown as OrderRow);
  const [hydrated] = await _hydrateImages([order]);
  return hydrated ?? null;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await timed(
    "orders:cancelOrder",
    () =>
      supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId),
  );
  if (error) throw error;
}

// ─── Image hydration ─────────────────────────────────────────────────────────

/**
 * For any order item whose product_snapshot had no image_url, fetch the
 * current image from the products table in one batched query.  This is a
 * best-effort enrichment — failures silently return the original orders.
 */
async function _hydrateImages(orders: Order[]): Promise<Order[]> {
  const missingIds = new Set<string>();
  for (const o of orders) {
    for (const item of o.items) {
      if (item.productId && !item.imageUrl) missingIds.add(item.productId);
    }
  }
  if (missingIds.size === 0) return orders;

  try {
    const { data } = await supabase
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
        if (item.imageUrl || !map.has(item.productId)) return item;
        const p = map.get(item.productId)!;
        return {
          ...item,
          name:     item.name || p.name,
          imageUrl: p.imageUrl,
        };
      }),
    }));
  } catch {
    return orders;
  }
}
