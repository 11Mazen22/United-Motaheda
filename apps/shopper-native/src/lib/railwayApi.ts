/**
 * Railway API client — shared NestJS backend
 *
 * Connects the native app to the same Railway server used by the web app,
 * so delivery quotes and orders are 100% consistent across platforms.
 *
 * Base URL: https://pharmacyapi-production-e30d.up.railway.app
 */

const RAILWAY_BASE_URL = "https://pharmacyapi-production-e30d.up.railway.app";
const DEFAULT_TIMEOUT_MS = 15_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RailwayBranch {
  id:          string;
  nameAr:      string;
  nameEn:      string;
  governorate: string;
  area:        string;
  lat:         number;
  lng:         number;
  isActive:    boolean;
}

export interface RailwayDeliveryQuote {
  isDeliverable: boolean;
  cost:          number | null;
  currency:      string;
  eta:           { minMinutes: number; maxMinutes: number } | null;
  branch:        RailwayBranch | null;
  distanceKm:    number | null;
  zoneId:        string | null;
  reasonCode:    "OK" | "OUT_OF_CAIRO" | "OUT_OF_ZONE" | "NO_BRANCH";
  updatedAt:     string;
  breakdown?: {
    baseFee:              number;
    surgeMultiplier:      number;
    freeDeliveryApplied:  boolean;
  };
}

export interface RailwayCartItem {
  productId: string;
  name:      string;
  quantity:  number;
  unitPrice: number;
}

export interface RailwayCreateOrderRequest {
  idempotencyKey:   string;
  customerName:     string;
  customerPhone:    string;
  address:          Record<string, unknown>;
  note?:            string;
  coordinates:      { lat: number; lng: number };
  branchId?:        string;
  cart:             { items: RailwayCartItem[]; subtotal: number };
  expectedPricing:  {
    subtotal:    number;
    discount:    number;
    tax:         number;
    deliveryFee: number;
    total:       number;
  };
  paymentMethod: string;
}

export interface RailwayCreateOrderResponse {
  orderId:   string;
  createdAt: string;
  status:    string;
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class RailwayApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: "TIMEOUT" | "NETWORK" | "SERVER" | "UNKNOWN",
  ) {
    super(message);
    this.name = "RailwayApiError";
  }
}

// ─── HTTP core ────────────────────────────────────────────────────────────────

async function railwayFetch<T>(
  path:      string,
  options:   RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${RAILWAY_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal as any,
      headers: {
        "Content-Type": "application/json",
        Accept:         "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      let message = `خطأ في الخادم: ${response.status}`;
      try {
        const body = (await response.json()) as any;
        message = body?.message ?? body?.error ?? message;
      } catch { /* non-JSON body */ }
      throw new RailwayApiError(message, response.status, "SERVER");
    }

    const json = (await response.json()) as any;
    return (json?.data ?? json) as T;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof RailwayApiError) throw err;
    if (err instanceof Error && (err.name === "AbortError" || err.message === "Aborted")) {
      throw new RailwayApiError("انتهت مهلة الاتصال", undefined, "TIMEOUT");
    }
    throw new RailwayApiError(
      err instanceof Error ? err.message : "خطأ في الشبكة",
      undefined,
      "NETWORK",
    );
  }
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const railwayApi = {
  /** List active branches (same DB as web). */
  listBranches: () =>
    railwayFetch<RailwayBranch[]>("/branches"),

  /** Real delivery quote — zone-polygon engine on Railway server. */
  getDeliveryQuote: (body: {
    coordinates:        { lat: number; lng: number };
    cart:               { items: RailwayCartItem[]; itemCount: number; subtotal: number };
    requestedBranchId?: string;
  }) =>
    railwayFetch<RailwayDeliveryQuote>("/delivery/quote", {
      method: "POST",
      body:   JSON.stringify(body),
    }),

  /** Create order via Railway backend. */
  createOrder: (body: RailwayCreateOrderRequest) =>
    railwayFetch<RailwayCreateOrderResponse>("/orders", {
      method: "POST",
      body:   JSON.stringify(body),
    }),

  /** AI pharmacist consultation — API key lives on the Railway server only. */
  pharmacistChat: (
    message:             string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  ) =>
    railwayFetch<{ reply: string }>("/pharmacist/chat", {
      method: "POST",
      body:   JSON.stringify({ message, conversationHistory }),
    }, 35_000),
};
