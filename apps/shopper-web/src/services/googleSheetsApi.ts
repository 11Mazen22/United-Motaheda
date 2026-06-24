import { z } from "zod";
import {
  normalizeOrderStatus as normalizeCanonicalOrderStatus,
  type OrderLifecycleStatus,
} from "../app/orders";
import {
  getCustomerOrders as getShopperCustomerOrders,
} from "./shopperOrdersApi";
import {
  assignDriver as assignManagedOrderDriver,
  listManagedOrders,
  updateManagedOrderStatus,
  type ManagedOrder,
} from "./logisticsApi";
import { normalizeTextEncoding, repairTextEncoding } from "../utils/textEncoding";
import {
  clearStoredAuthSession,
  getStoredSessionToken,
} from "../lib/authSession";

export type AppUserRole = "admin" | "customer";
export type LoginRole = "staff" | "customer";
export type OrderStatus =
  | "Pending"
  | "Processing"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";
export type StaffStatus = "Active" | "Inactive" | "Suspended";

export type AuthenticatedUser = {
  id: string;
  role: AppUserRole;
  fullName: string;
  phone: string;
  username?: string;
  email?: string;
  address?: string;
  created_at?: string;
  sessionToken?: string;
  sessionExpiresAt?: string;
  user_metadata?: {
    full_name?: string;
    phone?: string;
    address?: string;
  };
};

export type CustomerRegistrationPayload = {
  Full_Name: string;
  Phone: string;
  Password: string;
  Email: string;
  Address: string;
  Username?: string;
};

export type PendingCustomerRegistration = {
  phone: string;
  email: string;
  fullName: string;
  username?: string;
  status: "Pending";
  verificationRequired: boolean;
  created_at?: string;
};

export type VerifyCustomerOtpPayload = {
  Phone: string;
  OTP: string;
};

export type ResendCustomerOtpPayload = {
  Phone: string;
};

export type CustomerProfileUpdatePayload = {
  Full_Name: string;
  Phone: string;
  Email: string;
  Address: string;
  Current_Password?: string;
  New_Password?: string;
};

export type CreateOrderPayload = {
  customerPhone: string;
  customerName: string;
  address: string;
  city: string;
  street: string;
  note: string;
  itemCount: number;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  deliveryWindow: string;
  productCodes: string[] | string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  paymentMethod: "cod" | "instapay" | "vodafone" | "online" | "banquemisr";
  paymentLabel: string;
  requestPosMachine: boolean;
  totalPrice: number;
  assignmentToken?: string;
  quoteToken?: string;
  assignedPharmacyId?: string;
  assignedPharmacyName?: string;
};

export type CreateOrderResponse = {
  orderId: string;
  orderDate: string;
  status: string;
};

export type DashboardSeriesPoint = {
  day: string;
  label: string;
  orders: number;
  sales: number;
};

export type DashboardStats = {
  totalSales: number;
  totalOrders: number;
  newCustomers: number;
  lowStockItems: number;
  ordersByDay: DashboardSeriesPoint[];
};

export type AdminOrder = {
  id: string;
  customerPhone: string;
  customerName: string;
  customerAddress?: string;
  productCodes: string[];
  totalPrice: number;
  address: string;
  note: string;
  orderDate: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentLabel: string;
  requestPosMachine: boolean;
  assignedDriver?: string;
  assignedDriverId?: string;
};

export type ProductMutationPayload = {
  Code: string;
  Barcode?: string;
  Name: string;
  Name_Ar: string;
  Name_En: string;
  Price: number;
  Stock: number;
  Category: string;
  Category_Name: string;
  Category_Name_En: string;
  is_offer?: boolean;
  original_price?: number | null;
};

export type FastEntryProductPayload = {
  barcode: string;
  productName: string;
  imageBase64: string;
  capturedAt?: string;
  capturedBy?: string;
  costPrice?: number | null;
  sellingPrice?: number | null;
  discountPercent?: number | null;
  quantity?: number | null;
  stockAlert?: number | null;
};

export type FastEntryProductDraft = {
  id: string;
  barcode: string;
  productName: string;
  imageFileId: string;
  imageUrl: string;
  capturedAt: string;
  capturedBy: string;
  status: "Pending Review";
  created_at: string;
  costPrice: number | null;
  sellingPrice: number | null;
  discountPercent: number | null;
  quantity: number | null;
  stockAlert: number | null;
};

export type AdminProduct = {
  id: string;
  code: string;
  barcode: string;
  name: string;
  nameAr: string;
  nameEn: string;
  price: number;
  stock: number;
  category: string;
  categoryName: string;
  categoryNameEn: string;
  inStock: boolean;
};

export type CatalogResponse = {
  products: AdminProduct[];
  lastUpdated: string;
};

export type BarcodeLookupMatch = {
  id: string;
  barcode: string;
  productName: string;
  brand: string;
  category: string;
  imageUrl: string;
  source: string;
};

export type BarcodeLookupResponse = {
  barcode: string;
  found: boolean;
  matches: BarcodeLookupMatch[];
  searchedAt: string;
};

export type AddStaffPayload = {
  Full_Name: string;
  Username: string;
  Phone: string;
  Password: string;
  Email?: string;
  Role?: string;
  Status?: StaffStatus;
};

export type StaffMember = {
  id: string;
  fullName: string;
  username: string;
  role: string;
  phone: string;
  email: string;
  status: StaffStatus;
};

type ApiEnvelope = {
  success?: boolean;
  message?: string;
  data?: unknown;
  [key: string]: unknown;
};

type ApiRecord = Record<string, unknown>;
type GetRequestOptions = {
  cache?: boolean;
  force?: boolean;
  ttlMs?: number;
};
type CachedEnvelope = {
  envelope: ApiEnvelope;
  expiresAt: number;
};

const paymentMethodSchema = z.enum([
  "cod",
  "instapay",
  "vodafone",
  "online",
  "banquemisr",
]);

const orderItemSchema = z.object({
  productId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  price: z.number().finite().min(0),
});

const createOrderPayloadSchema = z.object({
  customerPhone: z.string().trim().regex(/^01[0125][0-9]{8}$/),
  customerName: z.string().trim().min(3),
  address: z.string().trim().min(8),
  city: z.string().trim().min(2),
  street: z.string().trim().min(4),
  note: z.string(),
  itemCount: z.number().int().positive(),
  subtotal: z.number().finite().positive(),
  tax: z.number().finite().min(0),
  deliveryFee: z.number().finite().min(0),
  deliveryWindow: z.string().trim().min(1),
  productCodes: z.union([z.array(z.string()), z.string()]),
  items: z.array(orderItemSchema).min(1),
  paymentMethod: paymentMethodSchema,
  paymentLabel: z.string().trim().min(1),
  requestPosMachine: z.boolean(),
  totalPrice: z.number().finite().positive(),
  assignmentToken: z.string().trim().optional(),
  quoteToken: z.string().trim().optional(),
  assignedPharmacyId: z.string().trim().optional(),
  assignedPharmacyName: z.string().trim().optional(),
});

const productMutationSchema = z.object({
  Code: z.string().trim().min(1),
  Barcode: z.string().trim().optional().default(""),
  Name: z.string().trim().min(1),
  Name_Ar: z.string().trim().min(1),
  Name_En: z.string().trim().min(1),
  Price: z.number().finite().min(0),
  Stock: z.number().finite().min(0),
  Category: z.string().trim().min(1),
  Category_Name: z.string().trim().min(1),
  Category_Name_En: z.string().trim().min(1),
});

const DEFAULT_GET_CACHE_TTL_MS = 45_000;
const responseCache = new Map<string, CachedEnvelope>();
const inFlightRequests = new Map<string, Promise<ApiEnvelope>>();
let compatibilityAdminOrdersCache: AdminOrder[] | null = null;
let compatibilityCustomerOrdersCache: AdminOrder[] | null = null;

function getApiBaseUrl() {
  const apiUrl = import.meta.env.VITE_GOOGLE_SHEETS_API_URL?.trim();

  if (!apiUrl) {
    throw new Error(
      "Missing VITE_GOOGLE_SHEETS_API_URL. Add the deployed API URL to .env.local.",
    );
  }

  return apiUrl;
}

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? repairTextEncoding(value).trim()
    : repairTextEncoding(String(value ?? "")).trim();
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(normalizeText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is ApiRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pickFirstString(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && normalizeText(value)) {
      return normalizeText(value);
    }
  }

  return "";
}

function pickFirstNumber(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && normalizeText(value)) {
      return normalizeNumber(value);
    }
  }

  return 0;
}

function pickFirstNullableNumber(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string" && !normalizeText(value)) {
      continue;
    }

    const parsed = normalizeNumber(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function pickFirstArray(record: ApiRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function createFallbackId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function buildCacheKey(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function getCachedEnvelope(cacheKey: string) {
  const cached = responseCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  return cached.envelope;
}

function setCachedEnvelope(
  cacheKey: string,
  envelope: ApiEnvelope,
  ttlMs = DEFAULT_GET_CACHE_TTL_MS,
) {
  responseCache.set(cacheKey, {
    envelope,
    expiresAt: Date.now() + ttlMs,
  });
}

function invalidateRequestCache(actions: string[]) {
  if (!actions.length) {
    responseCache.clear();
    inFlightRequests.clear();
    return;
  }

  const prefixes = actions.map((action) => `action=${action}`);

  for (const key of responseCache.keys()) {
    if (prefixes.some((prefix) => key.includes(prefix))) {
      responseCache.delete(key);
    }
  }

  for (const key of inFlightRequests.keys()) {
    if (prefixes.some((prefix) => key.includes(prefix))) {
      inFlightRequests.delete(key);
    }
  }
}

function readCachedRequest(params: Record<string, string>) {
  return getCachedEnvelope(buildCacheKey(params));
}

function slugify(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || createFallbackId("item");
}

function isAuthenticationFailureMessage(message: string) {
  const normalizedMessage = normalizeText(message);

  return normalizedMessage.includes("authentication required")
    || normalizedMessage.includes("session has expired")
    || normalizedMessage.includes("session is invalid")
    || normalizedMessage.includes("admin privileges required");
}

function withSessionParams(params: Record<string, string>) {
  const sessionToken = getStoredSessionToken();

  if (!sessionToken || params.sessionToken || params.Session_Token) {
    return params;
  }

  return {
    ...params,
    sessionToken,
  };
}

function withSessionData(data: ApiRecord) {
  const sessionToken = getStoredSessionToken();

  if (
    !sessionToken
    || Object.prototype.hasOwnProperty.call(data, "sessionToken")
    || Object.prototype.hasOwnProperty.call(data, "Session_Token")
  ) {
    return data;
  }

  return {
    ...data,
    Session_Token: sessionToken,
  };
}

async function parseEnvelope(response: Response) {
  const rawText = await response.text();

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(rawText || "The order service returned an invalid response.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("The order service response format is invalid.");
  }

  const envelope = parsed as ApiEnvelope;

  if (envelope.success === false) {
    const message = normalizeText(envelope.message) || "The order service request failed.";

    if (isAuthenticationFailureMessage(message)) {
      clearStoredAuthSession();
    }

    throw new Error(message);
  }

  return normalizeTextEncoding(envelope);
}

function unwrapRecord(envelope: ApiEnvelope) {
  const candidate = envelope.data;

  if (isRecord(candidate)) {
    return candidate;
  }

  return envelope as ApiRecord;
}

function unwrapArray(envelope: ApiEnvelope, fallbackKeys: string[] = []) {
  if (Array.isArray(envelope.data)) {
    return envelope.data.filter(isRecord);
  }

  const record = unwrapRecord(envelope);

  for (const key of fallbackKeys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

async function getRequest(
  params: Record<string, string>,
  {
    cache = true,
    force = false,
    ttlMs = DEFAULT_GET_CACHE_TTL_MS,
  }: GetRequestOptions = {},
) {
  const requestParams = withSessionParams(params);
  const url = new URL(getApiBaseUrl());
  const cacheKey = buildCacheKey(requestParams);

  Object.entries(requestParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  if (cache && !force) {
    const cached = getCachedEnvelope(cacheKey);

    if (cached) {
      return cached;
    }
  }

  const existingRequest = cache && !force ? inFlightRequests.get(cacheKey) : null;

  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch(url.toString(), { method: "GET" })
    .then((response) => parseEnvelope(response))
    .then((envelope) => {
      if (cache) {
        setCachedEnvelope(cacheKey, envelope, ttlMs);
      }

      return envelope;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  if (cache) {
    inFlightRequests.set(cacheKey, request);
  }

  return request;
}

async function postRequest(action: string, data: ApiRecord) {
  const requestData = sanitizeRequestData(withSessionData(data));
  const response = await fetch(getApiBaseUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Accept: "application/json,text/plain,*/*",
    },
    body: JSON.stringify({
      action,
      ...requestData,
    }),
  });

  return parseEnvelope(response);
}

function sanitizeRequestData(record: ApiRecord) {
  const sanitized: ApiRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    sanitized[key] = typeof value === "string" ? value.trim() : value;
  });
  return sanitized;
}

function mapCanonicalToLegacyOrderStatus(status: OrderLifecycleStatus): OrderStatus {
  // Map database status to UI OrderStatus
  if (status === "picked_up") {
    return "Out for Delivery";
  }

  if (status === "delivered") {
    return "Delivered";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "confirmed" || status === "preparing" || status === "ready") {
    return "Processing";
  }

  return "Pending";
}

function mapLegacyToCanonicalOrderStatus(status: OrderStatus): OrderLifecycleStatus {
  // Map UI status to database order_status enum values:
  // pending, confirmed, preparing, ready, picked_up, delivered, cancelled
  if (status === "Out for Delivery") {
    return "picked_up";
  }

  if (status === "Delivered") {
    return "delivered";
  }

  if (status === "Cancelled") {
    return "cancelled";
  }

  if (status === "Processing") {
    return "preparing";
  }

  return "pending";
}

function normalizeStaffStatus(value: string): StaffStatus {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "inactive") {
    return "Inactive";
  }

  if (normalized === "suspended" || normalized === "blocked" || normalized === "disabled") {
    return "Suspended";
  }

  return "Active";
}

function normalizeUser(record: ApiRecord, requestedRole: LoginRole, fallback?: Partial<AuthenticatedUser>) {
  const returnedRole = pickFirstString(record, ["role", "Role", "userRole"]);
  const role: AppUserRole = returnedRole.toLowerCase() === "admin" || requestedRole === "staff" ? "admin" : "customer";
  const phone = pickFirstString(record, ["phone", "Phone", "Customer_Phone"]) || fallback?.phone || "";
  const username = pickFirstString(record, ["username", "Username"]) || fallback?.username || "";
  const fullName = pickFirstString(record, ["fullName", "Full_Name", "full_name", "Name", "Customer_Name"]) || fallback?.fullName || "";
  const email = pickFirstString(record, ["email", "Email"]) || fallback?.email || "";
  const address = pickFirstString(record, ["address", "Address"]) || fallback?.address || "";
  const createdAt = pickFirstString(record, ["created_at", "Created_At", "createdAt"]) || fallback?.created_at || new Date().toISOString();

  return {
    id: pickFirstString(record, ["id", "ID", "userId", "User_ID"]) || `${role}-${phone || username || createFallbackId("user")}`,
    role,
    fullName,
    phone,
    username,
    email,
    address,
    created_at: createdAt,
    sessionToken: pickFirstString(record, ["sessionToken", "Session_Token"]) || fallback?.sessionToken || "",
    sessionExpiresAt: pickFirstString(record, ["sessionExpiresAt", "Session_Expires_At"]) || fallback?.sessionExpiresAt || "",
    user_metadata: {
      full_name: fullName,
      phone,
      address,
    },
  };
}

function normalizeDashboardPoint(record: ApiRecord): DashboardSeriesPoint {
  const day = pickFirstString(record, ["day", "Day", "date", "Date", "orderDate", "Order_Date"]) || new Date().toISOString().slice(0, 10);
  const label = pickFirstString(record, ["label", "Label"]) || day;

  return {
    day,
    label,
    orders: pickFirstNumber(record, ["orders", "Orders", "count", "Count", "totalOrders"]),
    sales: pickFirstNumber(record, ["sales", "Sales", "totalSales", "Total_Sales"]),
  };
}

function normalizeDashboardStats(record: ApiRecord) {
  const points = pickFirstArray(record, ["ordersByDay", "Orders_By_Day", "dailyOrders", "chart", "series"])
    .filter(isRecord)
    .map(normalizeDashboardPoint);

  return {
    totalSales: pickFirstNumber(record, ["totalSales", "Total_Sales", "sales"]),
    totalOrders: pickFirstNumber(record, ["totalOrders", "Total_Orders", "orders"]),
    newCustomers: pickFirstNumber(record, ["newCustomers", "New_Customers", "customers"]),
    lowStockItems: pickFirstNumber(record, ["lowStockItems", "Low_Stock_Items", "lowStock"]),
    ordersByDay: points,
  } satisfies DashboardStats;
}

function mapManagedOrderToAdminOrder(order: ManagedOrder): AdminOrder {
  return {
    id: order.id,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    customerAddress: order.customerAddress,
    productCodes: order.productCodes,
    totalPrice: order.totalPrice,
    address: order.customerAddress,
    note: order.note,
    orderDate: order.orderDate,
    status: mapCanonicalToLegacyOrderStatus(order.status),
    paymentMethod: "cod",
    paymentLabel: "",
    requestPosMachine: false,
    assignedDriver: order.assignedDriver || undefined,
    assignedDriverId: order.assignedDriverId || undefined,
  };
}

function applyAdminOrderCacheUpdate(normalizedOrder: AdminOrder) {
  compatibilityAdminOrdersCache = compatibilityAdminOrdersCache?.map((order) =>
    order.id === normalizedOrder.id ? normalizedOrder : order,
  ) ?? [normalizedOrder];

  return normalizedOrder;
}

function normalizeProduct(record: ApiRecord, fallback?: Partial<AdminProduct>) {
  const categoryName =
    pickFirstString(record, ["categoryName", "Category_Name", "category", "Category"]) ||
    fallback?.categoryName ||
    "General";
  const categoryNameEn =
    pickFirstString(record, ["categoryNameEn", "Category_Name_En"]) ||
    fallback?.categoryNameEn ||
    categoryName;
  const stock = pickFirstNumber(record, ["stock", "Stock"]) || fallback?.stock || 0;
  const code = pickFirstString(record, ["code", "Code"]) || fallback?.code || "";
  const nameAr =
    pickFirstString(record, ["nameAr", "Name_Ar", "name_ar"]) ||
    fallback?.nameAr ||
    pickFirstString(record, ["name", "Name"]) ||
    fallback?.name ||
    "";
  const nameEn =
    pickFirstString(record, ["nameEn", "Name_En", "name_en"]) ||
    fallback?.nameEn ||
    pickFirstString(record, ["name", "Name"]) ||
    fallback?.name ||
    "";
  const name = nameAr || nameEn || fallback?.name || "";

  return {
    id: pickFirstString(record, ["id", "ID"]) || fallback?.id || code || `${slugify(name)}-${createFallbackId("product")}`,
    code,
    barcode: pickFirstString(record, ["barcode", "Barcode"]) || fallback?.barcode || "",
    name,
    nameAr,
    nameEn,
    price: pickFirstNumber(record, ["price", "Price"]) || fallback?.price || 0,
    stock,
    category: pickFirstString(record, ["category", "Category"]) || fallback?.category || slugify(categoryName),
    categoryName,
    categoryNameEn,
    inStock: stock > 0,
  } satisfies AdminProduct;
}

function normalizeCatalogResponse(record: ApiRecord) {
  const products = pickFirstArray(record, ["products", "items", "rows"])
    .filter(isRecord)
    .map((entry) => normalizeProduct(entry));

  return {
    products,
    lastUpdated:
      pickFirstString(record, ["lastUpdated", "last_updated", "updatedAt", "Updated_At"]) ||
      new Date().toISOString(),
  } satisfies CatalogResponse;
}

function normalizeStaff(record: ApiRecord, fallback?: Partial<StaffMember>) {
  return {
    id: pickFirstString(record, ["id", "ID", "staffId", "Staff_ID"]) || fallback?.id || createFallbackId("staff"),
    fullName: pickFirstString(record, ["fullName", "Full_Name", "name", "Name"]) || fallback?.fullName || "",
    username: pickFirstString(record, ["username", "Username"]) || fallback?.username || "",
    role: pickFirstString(record, ["role", "Role"]) || fallback?.role || "Admin",
    phone: pickFirstString(record, ["phone", "Phone"]) || fallback?.phone || "",
    email: pickFirstString(record, ["email", "Email"]) || fallback?.email || "",
    status: normalizeStaffStatus(pickFirstString(record, ["status", "Status"]) || fallback?.status || "Active"),
  } satisfies StaffMember;
}

function normalizeFastEntryProductDraft(
  record: ApiRecord,
  fallback?: Partial<FastEntryProductDraft>,
) {
  const capturedAt =
    pickFirstString(record, ["capturedAt", "Captured_At", "createdAt", "Created_At"]) ||
    fallback?.capturedAt ||
    new Date().toISOString();

  return {
    id:
      pickFirstString(record, ["id", "entryId", "Entry_ID"]) ||
      fallback?.id ||
      createFallbackId("intake"),
    barcode:
      pickFirstString(record, ["barcode", "Barcode"]) ||
      fallback?.barcode ||
      "",
    productName:
      pickFirstString(record, ["productName", "Product_Name", "name", "Name"]) ||
      fallback?.productName ||
      "",
    imageFileId:
      pickFirstString(record, ["imageFileId", "Image_File_ID", "fileId"]) ||
      fallback?.imageFileId ||
      "",
    imageUrl:
      pickFirstString(record, ["imageUrl", "Image_Url", "fileUrl", "url"]) ||
      fallback?.imageUrl ||
      "",
    capturedAt,
    capturedBy:
      pickFirstString(record, ["capturedBy", "Captured_By", "operator", "Operator"]) ||
      fallback?.capturedBy ||
      "",
    status: "Pending Review",
    created_at:
      pickFirstString(record, ["created_at", "Created_At", "createdAt"]) ||
      fallback?.created_at ||
      capturedAt,
    costPrice:
      pickFirstNullableNumber(record, ["costPrice", "Cost_Price"]) ??
      fallback?.costPrice ??
      null,
    sellingPrice:
      pickFirstNullableNumber(record, ["sellingPrice", "Selling_Price"]) ??
      fallback?.sellingPrice ??
      null,
    discountPercent:
      pickFirstNullableNumber(record, ["discountPercent", "Discount_Percent"]) ??
      fallback?.discountPercent ??
      null,
    quantity:
      pickFirstNullableNumber(record, ["quantity", "Quantity"]) ??
      fallback?.quantity ??
      null,
    stockAlert:
      pickFirstNullableNumber(record, ["stockAlert", "Stock_Alert"]) ??
      fallback?.stockAlert ??
      null,
  } satisfies FastEntryProductDraft;
}

function normalizeBarcodeLookupMatch(
  record: ApiRecord,
  fallback?: Partial<BarcodeLookupMatch>,
) {
  const barcode =
    pickFirstString(record, ["barcode", "Barcode", "ean", "upc"]) ||
    fallback?.barcode ||
    "";

  return {
    id:
      pickFirstString(record, ["id", "ID"]) ||
      fallback?.id ||
      `${pickFirstString(record, ["source", "Source"]) || fallback?.source || "lookup"}-${barcode || createFallbackId("barcode")}`,
    barcode,
    productName:
      pickFirstString(record, ["productName", "Product_Name", "name", "Name", "title"]) ||
      fallback?.productName ||
      "",
    brand:
      pickFirstString(record, ["brand", "Brand", "brands", "Brands"]) ||
      fallback?.brand ||
      "",
    category:
      pickFirstString(record, ["category", "Category", "categoryName", "Category_Name"]) ||
      fallback?.category ||
      "",
    imageUrl:
      pickFirstString(record, ["imageUrl", "Image_Url", "image", "Image", "image_front_url"]) ||
      fallback?.imageUrl ||
      "",
    source:
      pickFirstString(record, ["source", "Source"]) ||
      fallback?.source ||
      "lookup",
  } satisfies BarcodeLookupMatch;
}

export async function login(identifier: string, password: string, role: LoginRole) {
  const envelope = await getRequest(
    {
      action: "login",
      usernameOrPhone: identifier.trim(),
      password,
      role,
    },
    { cache: false },
  );

  return normalizeUser(unwrapRecord(envelope), role);
}

export async function registerCustomer(payload: CustomerRegistrationPayload) {
  const data = {
    Phone: payload.Phone.trim(),
    Username: payload.Username?.trim() || "",
    Full_Name: payload.Full_Name.trim(),
    Password: payload.Password,
    Email: payload.Email.trim(),
    Address: payload.Address.trim(),
  };

  const envelope = await postRequest("register_customer", data);
  invalidateRequestCache(["get_dashboard_stats"]);
  const record = unwrapRecord(envelope);

  return {
    phone: pickFirstString(record, ["phone", "Phone"]) || data.Phone,
    email: pickFirstString(record, ["email", "Email"]) || data.Email,
    fullName: pickFirstString(record, ["fullName", "Full_Name", "full_name"]) || data.Full_Name,
    username: pickFirstString(record, ["username", "Username"]) || data.Username,
    status: "Pending",
    verificationRequired: record.verificationRequired !== false,
    created_at: pickFirstString(record, ["created_at", "Created_At", "createdAt"]) || new Date().toISOString(),
  } satisfies PendingCustomerRegistration;
}

export async function verifyOtp(payload: VerifyCustomerOtpPayload) {
  const data = {
    Phone: payload.Phone.trim(),
    OTP: payload.OTP.trim(),
  };
  const envelope = await postRequest("verify_otp", data);
  invalidateRequestCache(["get_dashboard_stats"]);

  return normalizeUser(unwrapRecord(envelope), "customer", {
    phone: data.Phone,
  });
}

export async function resendOtp(payload: ResendCustomerOtpPayload) {
  const data = {
    Phone: payload.Phone.trim(),
  };
  const envelope = await postRequest("resend_otp", data);
  const record = unwrapRecord(envelope);

  return {
    phone: pickFirstString(record, ["phone", "Phone"]) || data.Phone,
    email: pickFirstString(record, ["email", "Email"]),
    fullName: pickFirstString(record, ["fullName", "Full_Name", "full_name"]),
    username: pickFirstString(record, ["username", "Username"]),
    status: "Pending",
    verificationRequired: true,
    created_at: pickFirstString(record, ["created_at", "Created_At", "createdAt"]) || new Date().toISOString(),
  } satisfies PendingCustomerRegistration;
}

export async function updateCustomerProfile(payload: CustomerProfileUpdatePayload) {
  const data = {
    Full_Name: payload.Full_Name.trim(),
    Phone: payload.Phone.trim(),
    Email: payload.Email.trim(),
    Address: payload.Address.trim(),
    Current_Password: payload.Current_Password || "",
    New_Password: payload.New_Password || "",
  };
  const envelope = await postRequest("update_customer_profile", data);
  invalidateRequestCache(["get_dashboard_stats"]);

  return normalizeUser(unwrapRecord(envelope), "customer", {
    fullName: data.Full_Name,
    phone: data.Phone,
    email: data.Email,
    address: data.Address,
  });
}

export async function logoutSession() {
  try {
    await postRequest("logout", {});
  } catch {
    // Local sign-out should still succeed even if the remote session is already gone.
  }
}

export async function createOrder(payload: CreateOrderPayload) {
  const parsedPayload = createOrderPayloadSchema.parse(payload);
  const normalizedPhone = parsedPayload.customerPhone.trim();
  const normalizedProductCodes = (
    Array.isArray(parsedPayload.productCodes)
      ? parsedPayload.productCodes
      : [parsedPayload.productCodes]
  )
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
  const normalizedSubtotal = Number(parsedPayload.subtotal.toFixed(2));
  const normalizedTax = Number(parsedPayload.tax.toFixed(2));
  const normalizedDeliveryFee = Number(parsedPayload.deliveryFee.toFixed(2));
  const normalizedTotalPrice = Number(parsedPayload.totalPrice.toFixed(2));
  const expectedTotal = Number(
    (normalizedSubtotal + normalizedTax + normalizedDeliveryFee).toFixed(2),
  );

  if (Math.abs(expectedTotal - normalizedTotalPrice) > 0.51) {
    throw new Error("Order totals are inconsistent.");
  }

  const requestData = sanitizeRequestData(withSessionData({
    Customer_Phone: normalizedPhone,
    customerPhone: normalizedPhone,
    Phone: normalizedPhone,
    Customer_Name: parsedPayload.customerName.trim(),
    Product_Codes: normalizedProductCodes,
    productCodes: normalizedProductCodes,
    Codes: normalizedProductCodes,
    Items: parsedPayload.items,
    Item_Count: String(parsedPayload.itemCount),
    Subtotal: normalizedSubtotal.toFixed(2),
    Tax: normalizedTax.toFixed(2),
    Delivery_Fee: normalizedDeliveryFee.toFixed(2),
    Total_Price: normalizedTotalPrice.toFixed(2),
    totalPrice: normalizedTotalPrice.toFixed(2),
    TotalPrice: normalizedTotalPrice.toFixed(2),
    Delivery_Window: parsedPayload.deliveryWindow.trim(),
    Address: parsedPayload.address.trim(),
    City: parsedPayload.city.trim(),
    Street: parsedPayload.street.trim(),
    Note: parsedPayload.note.trim(),
    Payment_Method: parsedPayload.paymentMethod,
    Payment_Label: parsedPayload.paymentLabel.trim(),
    POS_Requested: parsedPayload.requestPosMachine,
    Assignment_Token: parsedPayload.assignmentToken?.trim() || "",
    Quote_Token: parsedPayload.quoteToken?.trim() || "",
    Assigned_Pharmacy_Id: parsedPayload.assignedPharmacyId?.trim() || "",
    Assigned_Pharmacy_Name: parsedPayload.assignedPharmacyName?.trim() || "",
    Order_Channel: "website",
  }));

  const response = await fetch(getApiBaseUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Accept: "application/json,text/plain,*/*",
    },
    body: JSON.stringify({
      action: "create_order",
      ...requestData,
    }),
  });
  const envelope = await parseEnvelope(response);
  invalidateRequestCache(["get_dashboard_stats", "get_orders_admin"]);
  const record = unwrapRecord(envelope);

  return {
    orderId: pickFirstString(record, ["orderId", "Order_ID", "id"]) || createFallbackId("ORD"),
    orderDate: pickFirstString(record, ["orderDate", "Order_Date", "createdAt"]) || new Date().toISOString(),
    status: pickFirstString(record, ["status", "Status"]) || "Pending",
  } satisfies CreateOrderResponse;
}

export async function getDashboardStats(force = false) {
  const envelope = await getRequest(
    {
      action: "get_dashboard_stats",
    },
    { force },
  );

  return normalizeDashboardStats(unwrapRecord(envelope));
}

export function getCachedDashboardStats() {
  const envelope = readCachedRequest({
    action: "get_dashboard_stats",
  });

  return envelope ? normalizeDashboardStats(unwrapRecord(envelope)) : null;
}

export async function getCatalog(_force = false) {
  const envelope = await postRequest("get_catalog", {});
  return normalizeCatalogResponse(unwrapRecord(envelope));
}

export function getCachedCatalog() {
  const envelope = readCachedRequest({
    action: "get_catalog",
  });

  return envelope ? normalizeCatalogResponse(unwrapRecord(envelope)) : null;
}

export async function getAdminOrders(_force = false) {
  const orders = await listManagedOrders();
  compatibilityAdminOrdersCache = orders.map(mapManagedOrderToAdminOrder);
  return compatibilityAdminOrdersCache;
}

export function getCachedAdminOrders() {
  return compatibilityAdminOrdersCache;
}

export async function getCustomerOrders(force = false) {
  const orders = await getShopperCustomerOrders(force);
  compatibilityCustomerOrdersCache = orders.map((order) => ({
    id: order.id,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    customerAddress: order.address,
    productCodes: order.productCodes,
    totalPrice: order.totalPrice,
    address: order.address,
    note: order.note,
    orderDate: order.orderDate,
    status: mapCanonicalToLegacyOrderStatus(normalizeCanonicalOrderStatus(order.status)),
    paymentMethod: "cod",
    paymentLabel: "",
    requestPosMachine: false,
  }));
  return compatibilityCustomerOrdersCache;
}

export function getCachedCustomerOrders() {
  return compatibilityCustomerOrdersCache;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const updatedOrder = await updateManagedOrderStatus(
    orderId.trim(),
    mapLegacyToCanonicalOrderStatus(status),
  );

  const normalizedOrder = mapManagedOrderToAdminOrder(updatedOrder);
  applyAdminOrderCacheUpdate(normalizedOrder);
  invalidateRequestCache(["get_dashboard_stats"]);

  return normalizedOrder;
}

export async function assignOrderDriver(orderId: string, driverId: string | null) {
  const updatedOrder = await assignManagedOrderDriver(orderId.trim(), driverId);
  const normalizedOrder = mapManagedOrderToAdminOrder(updatedOrder);
  applyAdminOrderCacheUpdate(normalizedOrder);
  invalidateRequestCache(["get_dashboard_stats"]);

  return normalizedOrder;
}

export async function getStaff(force = false) {
  const envelope = await getRequest(
    {
      action: "get_staff",
    },
    { force },
  );

  return unwrapArray(envelope, ["staff", "items", "rows"]).map((record) => normalizeStaff(record));
}

export function getCachedStaff() {
  const envelope = readCachedRequest({
    action: "get_staff",
  });

  return envelope
    ? unwrapArray(envelope, ["staff", "items", "rows"]).map((record) =>
        normalizeStaff(record),
      )
    : null;
}

export async function lookupBarcode(barcode: string) {
  const cleanedBarcode = barcode.trim();
  const envelope = await getRequest(
    {
      action: "lookup_barcode",
      barcode: cleanedBarcode,
    },
    { cache: false },
  );
  const record = unwrapRecord(envelope);
  const matches = pickFirstArray(record, ["matches", "items", "results"])
    .filter(isRecord)
    .map((entry) =>
      normalizeBarcodeLookupMatch(entry, {
        barcode: cleanedBarcode,
      }),
    );

  return {
    barcode:
      pickFirstString(record, ["barcode", "Barcode"]) || cleanedBarcode,
    found:
      typeof record.found === "boolean"
        ? record.found
        : matches.length > 0,
    matches,
    searchedAt:
      pickFirstString(record, ["searchedAt", "searched_at", "Searched_At"]) ||
      new Date().toISOString(),
  } satisfies BarcodeLookupResponse;
}

export async function addProduct(payload: ProductMutationPayload) {
  const parsedPayload = productMutationSchema.parse(payload);
  const fallbackCategory = parsedPayload.Category_Name.trim();
  const fallbackCategoryEn = parsedPayload.Category_Name_En.trim();
  const fallbackName = parsedPayload.Name_Ar.trim();
  const fallbackNameEn = parsedPayload.Name_En.trim();

  const envelope = await postRequest("add_product", {
    Code: parsedPayload.Code.trim(),
    Barcode: parsedPayload.Barcode?.trim() || "",
    Name: parsedPayload.Name.trim(),
    Name_Ar: fallbackName,
    Name_En: fallbackNameEn,
    Price: Number(parsedPayload.Price),
    Stock: Number(parsedPayload.Stock),
    Category: parsedPayload.Category.trim(),
    Category_Name: fallbackCategory,
    Category_Name_En: fallbackCategoryEn,
  });
  invalidateRequestCache(["get_dashboard_stats", "get_catalog"]);

  return normalizeProduct(unwrapRecord(envelope), {
    code: parsedPayload.Code.trim(),
    barcode: parsedPayload.Barcode?.trim() || "",
    name: fallbackName,
    nameAr: fallbackName,
    nameEn: fallbackNameEn,
    price: Number(parsedPayload.Price),
    stock: Number(parsedPayload.Stock),
    category: parsedPayload.Category.trim(),
    categoryName: fallbackCategory,
    categoryNameEn: fallbackCategoryEn,
    inStock: Number(parsedPayload.Stock) > 0,
  });
}

export async function submitFastEntryProduct(payload: FastEntryProductPayload) {
  const barcode = payload.barcode.trim();
  const productName = payload.productName.trim();
  const imageBase64 = payload.imageBase64.trim();
  const capturedAt = payload.capturedAt?.trim() || new Date().toISOString();
  const capturedBy = payload.capturedBy?.trim() || "";
  const costPrice = payload.costPrice ?? null;
  const sellingPrice = payload.sellingPrice ?? null;
  const discountPercent = payload.discountPercent ?? null;
  const quantity = payload.quantity ?? null;
  const stockAlert = payload.stockAlert ?? null;

  const envelope = await postRequest("submit_fast_entry_product", {
    Barcode: barcode,
    Product_Name: productName,
    Image_Base64: imageBase64,
    Captured_At: capturedAt,
    Captured_By: capturedBy,
    Cost_Price: costPrice,
    Selling_Price: sellingPrice,
    Discount_Percent: discountPercent,
    Quantity: quantity,
    Stock_Alert: stockAlert,
  });

  return normalizeFastEntryProductDraft(unwrapRecord(envelope), {
    barcode,
    productName,
    capturedAt,
    capturedBy,
    costPrice,
    sellingPrice,
    discountPercent,
    quantity,
    stockAlert,
  });
}

export async function updateProduct(payload: ProductMutationPayload) {
  const parsedPayload = productMutationSchema.parse(payload);
  const fallbackCategory = parsedPayload.Category_Name.trim();
  const fallbackCategoryEn = parsedPayload.Category_Name_En.trim();
  const fallbackName = parsedPayload.Name_Ar.trim();
  const fallbackNameEn = parsedPayload.Name_En.trim();

  const envelope = await postRequest("update_product", {
    Code: parsedPayload.Code.trim(),
    Barcode: parsedPayload.Barcode?.trim() || "",
    Name: parsedPayload.Name.trim(),
    Name_Ar: fallbackName,
    Name_En: fallbackNameEn,
    Price: Number(parsedPayload.Price),
    Stock: Number(parsedPayload.Stock),
    Category: parsedPayload.Category.trim(),
    Category_Name: fallbackCategory,
    Category_Name_En: fallbackCategoryEn,
  });
  invalidateRequestCache(["get_dashboard_stats", "get_catalog"]);

  return normalizeProduct(unwrapRecord(envelope), {
    code: parsedPayload.Code.trim(),
    barcode: parsedPayload.Barcode?.trim() || "",
    name: fallbackName,
    nameAr: fallbackName,
    nameEn: fallbackNameEn,
    price: Number(parsedPayload.Price),
    stock: Number(parsedPayload.Stock),
    category: parsedPayload.Category.trim(),
    categoryName: fallbackCategory,
    categoryNameEn: fallbackCategoryEn,
    inStock: Number(parsedPayload.Stock) > 0,
  });
}

export async function deleteProduct(code: string) {
  const envelope = await postRequest("delete_product", {
    Code: code.trim(),
  });
  invalidateRequestCache(["get_dashboard_stats", "get_catalog"]);

  return normalizeProduct(unwrapRecord(envelope), {
    code: code.trim(),
  });
}

export async function addStaff(payload: AddStaffPayload) {
  const envelope = await postRequest("add_staff", {
    Full_Name: payload.Full_Name.trim(),
    Username: payload.Username.trim(),
    Phone: payload.Phone.trim(),
    Password: payload.Password,
    Email: payload.Email?.trim() || "",
    Role: payload.Role?.trim() || "Admin",
    Status: payload.Status || "Active",
  });
  invalidateRequestCache(["get_dashboard_stats", "get_staff"]);

  return normalizeStaff(unwrapRecord(envelope), {
    fullName: payload.Full_Name.trim(),
    username: payload.Username.trim(),
    phone: payload.Phone.trim(),
    email: payload.Email?.trim() || "",
    role: payload.Role?.trim() || "Admin",
    status: payload.Status || "Active",
  });
}

export async function updateStaffStatus(staff: { id?: string; username?: string }, status: StaffStatus) {
  const envelope = await postRequest("update_staff_status", {
    Staff_ID: staff.id?.trim() || "",
    Username: staff.username?.trim() || "",
    Status: status,
  });
  invalidateRequestCache(["get_dashboard_stats", "get_staff"]);

  return normalizeStaff(unwrapRecord(envelope), {
    id: staff.id || "",
    username: staff.username || "",
    status,
  });
}

export async function prefetchAdminData(force = false) {
  await Promise.allSettled([
    getDashboardStats(force),
    getAdminOrders(force),
    getStaff(force),
  ]);
}

export type BulkProductPayload = {
  barcode: string;
  name_en: string;
  name_ar: string;
  category_en: string;
  category_ar: string;
  price: number;
  stock_quantity: number;
  is_variation: boolean;
};

export async function bulkAddProducts(products: BulkProductPayload[]) {
  try {
    // استخدم نفس دالة postRequest الموجودة في ملفك
    const response = await postRequest("bulk_add_products", {
      products: products
    });
    
    // تفريغ الكاش عشان الواجهة تقرأ الداتا الجديدة فوراً
    invalidateRequestCache(["get_catalog", "get_dashboard_stats"]);
    
    return response;
  } catch (error) {
    console.error("Error bulk adding products to Google Sheets:", error);
    throw error;
  }
}
