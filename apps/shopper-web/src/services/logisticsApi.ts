import {
  FunctionsFetchError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import {
  normalizeOrderStatus,
  type OrderLifecycleStatus,
} from "../app/orders";
import { getSupabaseClient } from "../lib/supabaseClient";
import { notifyDriverAssigned, notifyOrderStatusChange } from "./orderNotificationsApi";

export type LogisticsRole = "manager" | "pharmacist" | "driver" | "admin" | "customer";
export type LogisticsOrderStatus = OrderLifecycleStatus;

export type PermissionResolution = {
  permission_key: string;
  allowed: boolean;
};

export type LogisticsProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: LogisticsRole;
  is_active: boolean;
};

export type LogisticsOrder = {
  id: string;
  external_ref: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: Record<string, unknown>;
  customer_lat?: number | null;
  customer_lng?: number | null;
  status: LogisticsOrderStatus;
  assigned_driver_id: string | null;
  updated_at: string;
  created_at?: string | null;
  note?: string | null;
  total: number;
  qr_token?: string | null;
  order_items?: Array<{
    product_id: string | null;
    quantity: number | null;
    product_snapshot?: Record<string, unknown> | null;
  }>;
};

export type DriverManifestOrder = LogisticsOrder & {
  qr_token: string;
};

export type ManagedOrder = {
  id: string;
  externalRef: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  rawCustomerAddress: Record<string, unknown>;
  customerLat: number | null;
  customerLng: number | null;
  status: LogisticsOrderStatus;
  assignedDriverId: string | null;
  assignedDriver: string;
  orderDate: string;
  updatedAt: string;
  totalPrice: number;
  note: string;
  productCodes: string[];
  qrToken?: string;
};

export type TrackingConnectionState =
  | "token_live"
  | "order_lookup_fallback"
  | "network_fallback";

export type TrackingSnapshot = {
  order: {
    id: string;
    status: LogisticsOrderStatus;
    destination: Record<string, unknown>;
    customer_lat: number | null;
    customer_lng: number | null;
  };
  driver: {
    first_name: string;
    phone: string;
  } | null;
  location: {
    lat: number;
    lng: number;
    captured_at: string;
  } | null;
  connection: {
    state: TrackingConnectionState;
    usedToken: boolean;
    refreshedAt: string;
  };
};

type RawOpsOrderRow = {
  id: string;
  external_ref: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: Record<string, unknown> | null;
  customer_lat: number | null;
  customer_lng: number | null;
  status: string | null;
  assigned_driver_id: string | null;
  updated_at: string | null;
  created_at: string | null;
  note: string | null;
  total: number | string | null;
  qr_token?: string | null;
  order_items?: Array<{
    product_id: string | null;
    quantity: number | null;
    product_snapshot?: Record<string, unknown> | null;
  }> | null;
};

export type BatchScanPayload = {
  session_id: string;
  device_id?: string;
  scans: Array<{ code: string; scanned_at?: string }>;
};

export type DriverLocationPayload = {
  driver_id: string;
  order_id: string;
  lat: number;
  lng: number;
  accuracy_meters?: number;
  speed_kmh?: number;
  heading?: number;
  battery_level?: number;
  captured_at?: string;
};

function normalizeNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAddress(address: Record<string, unknown> | null | undefined): string {
  const candidate = address ?? {};

  if (typeof candidate.formatted === "string" && candidate.formatted.trim()) {
    return candidate.formatted.trim();
  }

  const streetLine =
    typeof candidate.streetLine === "string"
      ? candidate.streetLine.trim()
      : "";
  const city =
    typeof candidate.city === "string"
      ? candidate.city.trim()
      : "";

  return [streetLine, city].filter(Boolean).join(", ");
}

function extractProductCodes(
  orderItems: RawOpsOrderRow["order_items"] | LogisticsOrder["order_items"],
): string[] {
  return (orderItems ?? []).flatMap((item) => {
    const quantity = Math.max(1, item.quantity ?? 1);
    const snapshotCode =
      typeof item.product_snapshot?.code === "string"
        ? item.product_snapshot.code
        : null;
    const code = snapshotCode ?? item.product_id ?? "";

    return code ? Array.from<string>({ length: quantity }).fill(code) : [];
  });
}

function mapRawOrderRow(row: RawOpsOrderRow): LogisticsOrder {
  return {
    id: row.id,
    external_ref: row.external_ref,
    customer_name: row.customer_name ?? "",
    customer_phone: row.customer_phone ?? "",
    customer_address: row.customer_address ?? {},
    customer_lat: row.customer_lat ?? null,
    customer_lng: row.customer_lng ?? null,
    status: normalizeOrderStatus(row.status),
    assigned_driver_id: row.assigned_driver_id,
    updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    created_at: row.created_at ?? row.updated_at ?? null,
    note: row.note ?? "",
    total: normalizeNumber(row.total),
    qr_token: row.qr_token ?? null,
    order_items: row.order_items ?? [],
  };
}

function mapToManagedOrder(
  order: LogisticsOrder,
  driversById: Map<string, LogisticsProfile>,
): ManagedOrder {
  return {
    id: order.id,
    externalRef: order.external_ref,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerAddress: formatAddress(order.customer_address),
    rawCustomerAddress: order.customer_address ?? {},
    customerLat: order.customer_lat ?? null,
    customerLng: order.customer_lng ?? null,
    status: normalizeOrderStatus(order.status),
    assignedDriverId: order.assigned_driver_id,
    assignedDriver:
      order.assigned_driver_id
        ? driversById.get(order.assigned_driver_id)?.full_name ?? ""
        : "",
    orderDate: order.created_at ?? order.updated_at,
    updatedAt: order.updated_at,
    totalPrice: normalizeNumber(order.total),
    note: order.note ?? "",
    productCodes: extractProductCodes(order.order_items),
    qrToken: order.qr_token ?? undefined,
  };
}

export async function resolvePermissions() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("resolve-permissions");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? {
    profile: null,
    permissions: [],
  }) as {
    profile: LogisticsProfile | null;
    permissions: PermissionResolution[];
  };
}

export async function listOpsOrders() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, external_ref, customer_name, customer_phone, customer_address, customer_lat, customer_lng, status, assigned_driver_id, updated_at, created_at, note, total, qr_token",
    )
    .order("updated_at", { ascending: false })
    .limit(120);

  if (error) {
    throw new Error(error.message);
  }

  const orders = (data ?? []) as RawOpsOrderRow[];

  // Fetch line items for every order in ONE batched query (not one query per
  // order — that was a real N+1: up to 120 round-trips per board load).
  // Still tolerant of the order_items table being unavailable (404/400 from
  // PostgREST when the table doesn't exist or RLS blocks selects) — without
  // this fallback the whole ops board would fail even though the orders
  // rows themselves are fine.
  const itemsByOrderId = new Map<string, RawOpsOrderRow["order_items"]>();
  if (orders.length > 0) {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select("order_id, product_id, quantity, product_snapshot")
        .in("order_id", orders.map((o) => o.id));
      if (!itemsErr) {
        for (const item of (items ?? []) as Array<{ order_id: string } & NonNullable<RawOpsOrderRow["order_items"]>[number]>) {
          const list = itemsByOrderId.get(item.order_id) ?? [];
          list.push(item);
          itemsByOrderId.set(item.order_id, list);
        }
      }
    } catch {
      // order_items unavailable — orders still render, just without line items.
    }
  }

  const ordersWithItems = orders.map((order) => ({
    ...order,
    order_items: itemsByOrderId.get(order.id) ?? [],
  }));

  return ordersWithItems.map(mapRawOrderRow);
}

export async function listDrivers() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, status")
    .eq("role", "driver")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<LogisticsProfile & { status?: string | null }>).map((driver) => ({
    id: driver.id,
    full_name: driver.full_name,
    phone: driver.phone,
    role: driver.role,
    is_active: driver.status ? driver.status === "Active" : true,
  }));
}

export async function listRoleTemplates() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("role_templates")
    .select("role, permission_key, allowed")
    .order("role", { ascending: true })
    .order("permission_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listIntegrationEvents() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("integration_events")
    .select("id, event_type, aggregate_type, aggregate_id, occurred_at, processed_at, error_message")
    .order("occurred_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function assignDriver(orderId: string, driverId: string | null) {
  const supabase = getSupabaseClient();

  // Previously this called the `assign-driver` Edge Function, which often
  // isn't deployed on this Supabase project. The UI then optimistically
  // displays "Driver assigned" and immediately receives back garbage from
  // the missing function, leaving the assignment in an inconsistent state.
  //
  // Direct UPDATE with `.select()` is more reliable: PostgREST returns the
  // rows it actually mutated, so we can detect RLS denials (empty array) and
  // raise a real error instead of pretending the assignment succeeded.
  const { data, error } = await supabase
    .from("orders")
    .update({
      assigned_driver_id: driverId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select(
      "id, external_ref, customer_name, customer_phone, customer_address, customer_lat, customer_lng, status, assigned_driver_id, updated_at, created_at, note, total, qr_token",
    );

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error(
      "Driver assignment was not applied. Check that your role can update orders (RLS).",
    );
  }

  const updatedRow = data[0] as RawOpsOrderRow;
  if ((updatedRow.assigned_driver_id ?? null) !== (driverId ?? null)) {
    throw new Error("Driver did not persist; the database returned the previous value.");
  }

  if (driverId) {
    notifyDriverAssigned(orderId, driverId);
  }

  // Fetch line items and the driver list so the caller can build a
  // ManagedOrder identical to what updateManagedOrderStatus returns.
  let items: Array<{ product_id: string | null; quantity: number | null; product_snapshot?: Record<string, unknown> | null }> = [];
  try {
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("product_id, quantity, product_snapshot")
      .eq("order_id", orderId);
    items = itemsData ?? [];
  } catch {
    items = [];
  }

  const drivers = await listDrivers();
  const driversById = new Map(drivers.map((d) => [d.id, d]));
  const orderWithItems = { ...updatedRow, order_items: items } as RawOpsOrderRow;
  return mapToManagedOrder(mapRawOrderRow(orderWithItems), driversById);
}

export async function listManagedOrders(options?: {
  role?: LogisticsRole;
  userId?: string;
}): Promise<ManagedOrder[]> {
  const [orders, drivers] = await Promise.all([
    listOpsOrders(),
    listDrivers(),
  ]);

  const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
  const role = options?.role;
  const userId = options?.userId?.trim();

  return orders
    .filter((order) => !(role === "driver" && userId && order.assigned_driver_id !== userId))
    .map((order) => mapToManagedOrder(order, driversById));
}

export async function updateManagedOrderStatus(
  orderId: string,
  nextStatus: LogisticsOrderStatus,
): Promise<ManagedOrder> {
  const supabase = getSupabaseClient();
  const normalizedStatus = normalizeOrderStatus(nextStatus);

  // Step 1: Update the row AND ask PostgREST to return the modified row.
  //
  // Critically we need `.select()` here. Without it, an RLS policy that
  // silently denies the UPDATE leaves no rows changed but also returns no
  // error — the request looks like a success, and the follow-up SELECT in
  // step 2 returns the unchanged row, so the UI replaces the optimistic
  // status with the OLD value. The user sees "تم التحديث" toast but the
  // status stays "في الانتظار". That's the exact bug reported.
  //
  // With `.select()` PostgREST returns the rows it actually mutated. If the
  // array comes back empty, the update was blocked (or the id is wrong) and
  // we throw so the caller can revert the optimistic state.
  const { data: updatedRows, error: updateError } = await supabase
    .from("orders")
    .update({
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select(
      "id, external_ref, customer_name, customer_phone, customer_address, customer_lat, customer_lng, status, assigned_driver_id, updated_at, created_at, note, total, qr_token",
    );

  if (updateError) {
    throw new Error(updateError.message || "Unable to update the order status.");
  }

  if (!updatedRows || updatedRows.length === 0) {
    // RLS blocked the update silently, or no row matched. Either way the
    // status was NOT changed — surface a real error so the UI reverts.
    throw new Error(
      "Status update was not applied. Check that your role can update orders (RLS).",
    );
  }

  // Defensive verification: the row we got back should reflect the new status.
  // If it doesn't, the UPDATE was effectively a no-op (e.g. RLS row visible
  // but write blocked) and we must NOT pretend it succeeded.
  const updatedRow = updatedRows[0] as RawOpsOrderRow;
  if (normalizeOrderStatus(updatedRow.status) !== normalizedStatus) {
    throw new Error("Status did not persist; the database returned the previous value.");
  }

  notifyOrderStatusChange(orderId, normalizedStatus);

  // Step 2: Fetch line items separately (tolerant of order_items missing).
  let items: Array<{ product_id: string | null; quantity: number | null; product_snapshot?: Record<string, unknown> | null }> = [];
  try {
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("product_id, quantity, product_snapshot")
      .eq("order_id", orderId);
    items = itemsData ?? [];
  } catch {
    items = [];
  }

  const orderWithItems = { ...updatedRow, order_items: items } as RawOpsOrderRow;
  const drivers = await listDrivers();
  const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
  return mapToManagedOrder(mapRawOrderRow(orderWithItems), driversById);
}

export async function listDriverManifest(driverId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, external_ref, customer_name, customer_phone, customer_address, customer_lat, customer_lng, status, assigned_driver_id, updated_at, created_at, note, total, qr_token")
    .eq("assigned_driver_id", driverId)
    .in("status", ["ready", "picked_up", "delivered"])
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const orders = (data ?? []) as RawOpsOrderRow[];

  // Fetch order items for every order in ONE batched query (not one query
  // per order in the driver's manifest).
  const itemsByOrderId = new Map<string, RawOpsOrderRow["order_items"]>();
  if (orders.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, product_id, quantity, product_snapshot")
      .in("order_id", orders.map((o) => o.id));
    for (const item of (items ?? []) as Array<{ order_id: string } & NonNullable<RawOpsOrderRow["order_items"]>[number]>) {
      const list = itemsByOrderId.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrderId.set(item.order_id, list);
    }
  }

  const ordersWithItems = orders.map((order) => ({
    ...order,
    order_items: itemsByOrderId.get(order.id) ?? [],
  }));

  return ordersWithItems.map((row) => {
    const mapped = mapRawOrderRow(row);
    return {
      ...mapped,
      qr_token: mapped.qr_token ?? "",
    };
  });
}

export async function commitDriverBatchScan(payload: BatchScanPayload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("driver-batch-scan", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    updated: Array<{ order_id: string; status: LogisticsOrderStatus }>;
    rejected: Array<{ code: string; reason: string }>;
  };
}

export async function pushDriverLocation(payload: DriverLocationPayload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("driver-location", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as { ok: boolean };
}

async function fetchTrackingSnapshotByOrderId(orderId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, customer_address, customer_lat, customer_lng")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to retrieve order tracking information.");
  }

  if (!data) {
    throw new Error("Tracking information is unavailable for this order.");
  }

  return {
    order: {
      id: data.id,
      status: (data.status as LogisticsOrderStatus) ?? "pending",
      destination: data.customer_address ?? {},
      customer_lat: data.customer_lat ?? null,
      customer_lng: data.customer_lng ?? null,
    },
    driver: null,
    location: null,
    connection: {
      state: "order_lookup_fallback" as const,
      usedToken: false,
      refreshedAt: new Date().toISOString(),
    },
  } satisfies TrackingSnapshot;
}

export async function fetchTrackingSnapshot(orderId: string, token: string): Promise<TrackingSnapshot> {
  const supabase = getSupabaseClient();

  if (!token) {
    return fetchTrackingSnapshotByOrderId(orderId);
  }

  try {
    const { data, error } = await supabase.functions.invoke("track-order", {
      body: {
        order_id: orderId,
        token,
      },
    });

    if (error) {
      throw error;
    }

    const payload = data as Omit<TrackingSnapshot, "connection">;
    return {
      ...payload,
      order: {
        ...payload.order,
        status: normalizeOrderStatus(payload.order.status),
      },
      connection: {
        state: "token_live",
        usedToken: true,
        refreshedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      const fallback = await fetchTrackingSnapshotByOrderId(orderId);
      return {
        ...fallback,
        connection: {
          state: "network_fallback",
          usedToken: Boolean(token),
          refreshedAt: new Date().toISOString(),
        },
      };
    }

    throw error instanceof Error ? error : new Error("Unable to load tracking details.");
  }
}
