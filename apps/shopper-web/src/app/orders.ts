/**
 * orders.ts – United Pharmacies · Canonical browser-side order state
 *
 * Responsibilities:
 *  • Canonical shopper/admin-friendly order status normalization
 *  • Shared local storage for remote order snapshots and locally persisted orders
 *  • Sync metadata for stale/offline UI states
 *  • Queue storage for future offline-safe order mutations
 *  • Backward-compatible helpers already consumed by shopper pages
 *
 * OrderLifecycleStatus / normalizeOrderStatus are re-exports of the single
 * canonical order-status module (packages/contracts/src/orderStatus.ts) —
 * kept under their original names here so existing importers across this
 * app don't need to change. See that file for the full lifecycle doc.
 */

import {
  type CanonicalOrderStatus,
  normalizeOrderStatus as normalizeCanonicalStatus,
} from "@pharmacy/contracts";

const ORDER_HISTORY_KEY = "united-pharmacies-orders-v2";
const ORDER_CACHE_META_KEY = "united-pharmacies-orders-meta-v2";
const ORDER_MUTATION_QUEUE_KEY = "united-pharmacies-order-mutations-v1";

const MAX_STORED_ORDERS = 75;
const CACHE_TTL_MS = 5 * 60 * 1000;

export type OrderLifecycleStatus = CanonicalOrderStatus;

export type OrderSource = "remote" | "local_pending" | "queued_mutation";
export type OrderSyncState = "synced" | "stale" | "saving" | "queued" | "failed";

export type StoredOrderItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
};

export type StoredOrder = {
  id: string;
  createdAt: string;
  status: OrderLifecycleStatus;
  fullName: string;
  phone: string;
  city: string;
  street: string;
  address: string;
  note: string;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  itemCount: number;
  items: StoredOrderItem[];
  source: OrderSource;
  syncState: OrderSyncState;
  lastSyncedAt: string | null;
  lastError: string | null;
  qrToken?: string;
};

export type RemoteOrderSnapshot = {
  id: string;
  customerPhone: string;
  customerName: string;
  address: string;
  note: string;
  totalPrice: number;
  orderDate: string;
  status: string;
  productCodes: string[];
  qrToken?: string;
};

export type CacheMeta = {
  lastSyncedAt: string | null;
  lastOnlineAt: string | null;
};

export type StoredOrdersSnapshot = {
  orders: StoredOrder[];
  meta: CacheMeta;
  queuedMutationCount: number;
};

export type QueuedOrderMutation = {
  id: string;
  orderId: string;
  type: "status_update";
  nextStatus: OrderLifecycleStatus;
  queuedAt: string;
  attempts: number;
  customerPhone?: string;
};

type OrderDraft = Omit<
  StoredOrder,
  | "id"
  | "createdAt"
  | "status"
  | "itemCount"
  | "source"
  | "syncState"
  | "lastSyncedAt"
  | "lastError"
>;
type OrderOverrides = Partial<
  Pick<
    StoredOrder,
    | "id"
    | "createdAt"
    | "source"
    | "syncState"
    | "lastSyncedAt"
    | "lastError"
    | "qrToken"
  >
> & {
  status?: string;
};

function normalizeNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return fallback;
}

function sortOrders(orders: StoredOrder[]): StoredOrder[] {
  return [...orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function dedupeOrders(orders: StoredOrder[]): StoredOrder[] {
  const byId = new Map<string, StoredOrder>();

  for (const order of sortOrders(orders)) {
    if (!order.id.trim()) continue;
    if (!byId.has(order.id)) {
      byId.set(order.id, order);
    }
  }

  return Array.from(byId.values()).slice(0, MAX_STORED_ORDERS);
}

function normalizeStoredItem(value: unknown): StoredOrderItem | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<StoredOrderItem>;
  const productId = typeof candidate.productId === "string" ? candidate.productId.trim() : "";
  if (!productId) return null;

  return {
    productId,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : productId,
    quantity: Math.max(1, Math.trunc(normalizeNumber(candidate.quantity) || 1)),
    price: Math.max(0, normalizeNumber(candidate.price)),
  };
}

export function normalizeOrderStatus(value: unknown): OrderLifecycleStatus {
  return normalizeCanonicalStatus(typeof value === "string" ? value : String(value ?? ""));
}

function normalizeSource(value: unknown): OrderSource {
  return value === "local_pending" || value === "queued_mutation" ? value : "remote";
}

function normalizeSyncState(value: unknown): OrderSyncState {
  return value === "stale"
    || value === "saving"
    || value === "queued"
    || value === "failed"
    ? value
    : "synced";
}

function normalizeStoredOrder(value: unknown): StoredOrder | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<StoredOrder> & Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  if (!id) return null;

  const items = Array.isArray(candidate.items)
    ? candidate.items.map(normalizeStoredItem).filter((item): item is StoredOrderItem => item !== null)
    : [];

  const createdAt = normalizeDate(candidate.createdAt);
  const total = Math.max(0, normalizeNumber(candidate.total));

  return {
    id,
    createdAt,
    status: normalizeOrderStatus(candidate.status),
    fullName: typeof candidate.fullName === "string" ? candidate.fullName : "",
    phone: typeof candidate.phone === "string" ? candidate.phone : "",
    city: typeof candidate.city === "string" ? candidate.city : "",
    street: typeof candidate.street === "string" ? candidate.street : "",
    address: typeof candidate.address === "string" ? candidate.address : "",
    note: typeof candidate.note === "string" ? candidate.note : "",
    subtotal: Math.max(0, normalizeNumber(candidate.subtotal)),
    tax: Math.max(0, normalizeNumber(candidate.tax)),
    shipping: Math.max(0, normalizeNumber(candidate.shipping)),
    discount: Math.max(0, normalizeNumber(candidate.discount)),
    total,
    itemCount: Math.max(
      items.reduce((count, item) => count + item.quantity, 0),
      Math.trunc(normalizeNumber(candidate.itemCount) || 0),
    ),
    items,
    source: normalizeSource(candidate.source),
    syncState: normalizeSyncState(candidate.syncState),
    lastSyncedAt:
      typeof candidate.lastSyncedAt === "string" && candidate.lastSyncedAt.trim()
        ? normalizeDate(candidate.lastSyncedAt, candidate.lastSyncedAt)
        : null,
    lastError: typeof candidate.lastError === "string" && candidate.lastError.trim()
      ? candidate.lastError
      : null,
    qrToken: typeof candidate.qrToken === "string" && candidate.qrToken.trim() ? candidate.qrToken : undefined,
  };
}

function isQueuedOrderMutation(value: unknown): value is QueuedOrderMutation {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<QueuedOrderMutation>;
  return (
    typeof candidate.id === "string"
    && typeof candidate.orderId === "string"
    && candidate.type === "status_update"
    && typeof candidate.queuedAt === "string"
  );
}

function createOrderId(createdAt: Date): string {
  const year = createdAt.getFullYear();
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const day = String(createdAt.getDate()).padStart(2, "0");
  const hours = String(createdAt.getHours()).padStart(2, "0");
  const minutes = String(createdAt.getMinutes()).padStart(2, "0");
  const seconds = String(createdAt.getSeconds()).padStart(2, "0");
  return `ORD-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function readCacheMeta(): CacheMeta {
  if (typeof window === "undefined") {
    return { lastSyncedAt: null, lastOnlineAt: null };
  }

  try {
    const raw = window.localStorage.getItem(ORDER_CACHE_META_KEY);
    if (!raw) {
      return { lastSyncedAt: null, lastOnlineAt: null };
    }

    const parsed = JSON.parse(raw) as Partial<CacheMeta>;
    return {
      lastSyncedAt:
        typeof parsed.lastSyncedAt === "string" && parsed.lastSyncedAt.trim()
          ? normalizeDate(parsed.lastSyncedAt, parsed.lastSyncedAt)
          : null,
      lastOnlineAt:
        typeof parsed.lastOnlineAt === "string" && parsed.lastOnlineAt.trim()
          ? normalizeDate(parsed.lastOnlineAt, parsed.lastOnlineAt)
          : null,
    };
  } catch {
    return { lastSyncedAt: null, lastOnlineAt: null };
  }
}

function writeCacheMeta(meta: CacheMeta): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ORDER_CACHE_META_KEY, JSON.stringify(meta));
  } catch {
    // Fail silently
  }
}

function readMutationQueue(): QueuedOrderMutation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(ORDER_MUTATION_QUEUE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown[];
    return parsed.filter(isQueuedOrderMutation).map((mutation) => ({
      ...mutation,
      nextStatus: normalizeOrderStatus(mutation.nextStatus),
      attempts: Math.max(0, Math.trunc(normalizeNumber(mutation.attempts))),
    }));
  } catch {
    return [];
  }
}

function writeMutationQueue(queue: QueuedOrderMutation[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ORDER_MUTATION_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Fail silently
  }
}

function readFromStorage(): StoredOrder[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(ORDER_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown[];
    return dedupeOrders(
      parsed
        .map(normalizeStoredOrder)
        .filter((order): order is StoredOrder => order !== null),
    );
  } catch {
    return [];
  }
}

function writeToStorage(orders: StoredOrder[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(dedupeOrders(orders)));
  } catch {
    // Quota exceeded or private browsing – fail silently
  }
}

function replaceStoredOrders(
  updater: (current: StoredOrder[]) => StoredOrder[],
): StoredOrder[] {
  const nextOrders = dedupeOrders(updater(readFromStorage()));
  writeToStorage(nextOrders);
  return nextOrders;
}

export function toRemoteOrderSnapshot(order: StoredOrder): RemoteOrderSnapshot {
  return {
    id: order.id,
    customerPhone: order.phone,
    customerName: order.fullName,
    address: order.address,
    note: order.note,
    totalPrice: order.total,
    orderDate: order.createdAt,
    status: order.status,
    productCodes: order.items.flatMap((item) =>
      Array.from({ length: Math.max(1, item.quantity) }, () => item.productId),
    ),
    qrToken: order.qrToken,
  };
}

export function mapRemoteOrderToStoredOrder(
  remoteOrder: RemoteOrderSnapshot,
  existingOrder?: StoredOrder | null,
): StoredOrder {
  const productCodes = remoteOrder.productCodes.filter(Boolean);

  return {
    id: remoteOrder.id,
    createdAt: normalizeDate(remoteOrder.orderDate),
    status: normalizeOrderStatus(remoteOrder.status),
    fullName: remoteOrder.customerName,
    phone: remoteOrder.customerPhone,
    city: existingOrder?.city ?? "",
    street: existingOrder?.street ?? "",
    address: remoteOrder.address,
    note: remoteOrder.note,
    subtotal: remoteOrder.totalPrice,
    tax: existingOrder?.tax ?? 0,
    shipping: existingOrder?.shipping ?? 0,
    discount: existingOrder?.discount ?? 0,
    total: remoteOrder.totalPrice,
    itemCount: productCodes.length || existingOrder?.itemCount || 0,
    items: productCodes.length > 0
      ? productCodes.map((code) => ({
          productId: code,
          name: code,
          quantity: 1,
          price: 0,
        }))
      : (existingOrder?.items ?? []),
    source: "remote",
    syncState:
      existingOrder?.syncState === "queued" || existingOrder?.syncState === "saving"
        ? existingOrder.syncState
        : "synced",
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
    qrToken: remoteOrder.qrToken ?? existingOrder?.qrToken,
  };
}

export function readOrders(): StoredOrder[] {
  return readFromStorage();
}

export function readOrdersByCustomerPhone(customerPhone: string): StoredOrder[] {
  const phone = customerPhone.trim();
  return readFromStorage().filter((order) => order.phone.trim() === phone);
}

export function readStoredOrdersSnapshot(customerPhone?: string): StoredOrdersSnapshot {
  const orders = customerPhone
    ? readOrdersByCustomerPhone(customerPhone)
    : readFromStorage();

  return {
    orders,
    meta: readCacheMeta(),
    queuedMutationCount: customerPhone
      ? readMutationQueue().filter((mutation) => mutation.customerPhone?.trim() === customerPhone.trim()).length
      : readMutationQueue().length,
  };
}

export function readQueuedOrderMutations(customerPhone?: string): QueuedOrderMutation[] {
  const queue = readMutationQueue();
  if (!customerPhone) {
    return queue;
  }

  const normalizedPhone = customerPhone.trim();
  return queue.filter((mutation) => mutation.customerPhone?.trim() === normalizedPhone);
}

export function queueOrderStatusMutation(
  orderId: string,
  nextStatus: OrderLifecycleStatus,
  options: { customerPhone?: string; attempts?: number } = {},
): QueuedOrderMutation {
  const queue = readMutationQueue().filter(
    (mutation) => !(mutation.orderId === orderId && mutation.type === "status_update"),
  );

  const nextMutation: QueuedOrderMutation = {
    id: `mutation-${orderId}-${Date.now()}`,
    orderId,
    type: "status_update",
    nextStatus,
    queuedAt: new Date().toISOString(),
    attempts: Math.max(0, options.attempts ?? 0),
    customerPhone: options.customerPhone?.trim() || undefined,
  };

  queue.unshift(nextMutation);
  writeMutationQueue(queue);

  setOrderSyncState(orderId, "queued");
  updateStoredOrderStatus(orderId, nextStatus);

  return nextMutation;
}

export function removeQueuedOrderMutation(orderId: string): void {
  writeMutationQueue(readMutationQueue().filter((mutation) => mutation.orderId !== orderId));
}

export function appendOrder(
  orderDraft: OrderDraft,
  overrides: OrderOverrides = {},
): StoredOrder {
  const createdAtValue = overrides.createdAt ? new Date(overrides.createdAt) : new Date();
  const createdAt = Number.isNaN(createdAtValue.getTime()) ? new Date() : createdAtValue;
  const status = normalizeOrderStatus(overrides.status ?? "pending");

  const nextOrder: StoredOrder = {
    ...orderDraft,
    id: overrides.id ?? createOrderId(createdAt),
    createdAt: overrides.createdAt ?? createdAt.toISOString(),
    status,
    itemCount: orderDraft.items.reduce((acc, item) => acc + Math.max(1, item.quantity), 0),
    source: overrides.source ?? "remote",
    syncState: overrides.syncState ?? "synced",
    lastSyncedAt: overrides.lastSyncedAt ?? new Date().toISOString(),
    lastError: overrides.lastError ?? null,
    qrToken: overrides.qrToken,
  };

  replaceStoredOrders((current) => [nextOrder, ...current]);

  if (nextOrder.syncState === "synced") {
    writeCacheMeta({
      ...readCacheMeta(),
      lastOnlineAt: new Date().toISOString(),
      lastSyncedAt: nextOrder.lastSyncedAt,
    });
  }

  return nextOrder;
}

export function updateStoredOrderStatus(
  orderId: string,
  nextStatus: string,
): boolean {
  let updated = false;

  replaceStoredOrders((orders) =>
    orders.map((order) => {
      if (order.id !== orderId) {
        return order;
      }

      updated = true;
      return {
        ...order,
        status: normalizeOrderStatus(nextStatus),
      };
    }),
  );

  return updated;
}

export function setOrderSyncState(
  orderId: string,
  syncState: OrderSyncState,
  lastError: string | null = null,
): boolean {
  let updated = false;

  replaceStoredOrders((orders) =>
    orders.map((order) => {
      if (order.id !== orderId) {
        return order;
      }

      updated = true;
      return {
        ...order,
        syncState,
        lastError,
        lastSyncedAt:
          syncState === "synced" ? new Date().toISOString() : order.lastSyncedAt,
      };
    }),
  );

  return updated;
}

export function markOrdersStale(customerPhone?: string): StoredOrder[] {
  const normalizedPhone = customerPhone?.trim();

  return replaceStoredOrders((orders) =>
    orders.map((order) =>
      !normalizedPhone || order.phone.trim() === normalizedPhone
        ? {
            ...order,
            syncState:
              order.syncState === "queued" || order.syncState === "saving"
                ? order.syncState
                : "stale",
          }
        : order,
    ),
  );
}

export function getCachedRemoteOrderSnapshots(customerPhone?: string): RemoteOrderSnapshot[] {
  const orders = customerPhone
    ? readOrdersByCustomerPhone(customerPhone)
    : readFromStorage();

  return orders.map(toRemoteOrderSnapshot);
}

export function isOrderCacheStale(): boolean {
  const { lastSyncedAt } = readCacheMeta();
  if (!lastSyncedAt) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() > CACHE_TTL_MS;
}

export function syncRemoteOrders(
  remoteOrders: RemoteOrderSnapshot[],
  customerPhone?: string,
): StoredOrder[] {
  const normalizedPhone = customerPhone?.trim() ?? "";
  const existingOrders = readFromStorage();
  const existingById = new Map(existingOrders.map((order) => [order.id, order]));
  const nextSyncedAt = new Date().toISOString();

  const remoteIds = new Set(remoteOrders.map((order) => order.id));

  const mappedRemoteOrders = remoteOrders.map((remoteOrder) =>
    mapRemoteOrderToStoredOrder(remoteOrder, existingById.get(remoteOrder.id)),
  );

  const preservedOrders = existingOrders.filter((order) => {
    if (remoteIds.has(order.id)) {
      return false;
    }

    if (!normalizedPhone) {
      return true;
    }

    if (order.phone.trim() !== normalizedPhone) {
      return true;
    }

    return order.source !== "remote";
  });

  const nextOrders = replaceStoredOrders(() => [...mappedRemoteOrders, ...preservedOrders]);

  writeCacheMeta({
    lastSyncedAt: nextSyncedAt,
    lastOnlineAt: nextSyncedAt,
  });

  return normalizedPhone
    ? nextOrders.filter((order) => order.phone.trim() === normalizedPhone)
    : nextOrders;
}

export function clearOrderHistory(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(ORDER_HISTORY_KEY);
    window.localStorage.removeItem(ORDER_CACHE_META_KEY);
    window.localStorage.removeItem(ORDER_MUTATION_QUEUE_KEY);
  } catch {
    // Fail silently
  }
}
