/**
 * Shared order-address parsing — the single implementation for turning an
 * `orders` row's location data into a structured address, used by customer,
 * driver, and pharmacist code alike.
 *
 * Before this file existed, three independent parsers did this (features/
 * orders/api.ts's rowToOrder, features/driver/api.ts's mapManifestRow, and
 * features/pharmacist/api/orders.ts's mapOrder) — two of the three silently
 * dropped lat/lng and the structured building/floor/apartment/landmark
 * fields, collapsing straight to a single formatted string.
 *
 * Prefers the real flat columns added in
 * supabase/migrations/20260826953000_reconcile_orders_and_add_delivery_zone.sql
 * (address_building, address_floor, address_apartment, address_landmark,
 * delivery_instructions, branch_id, zone_id, zone_name) — written by
 * create-order for every order placed since that migration — and falls back
 * to parsing the customer_address jsonb blob for older orders that predate
 * it, so this works uniformly across the whole order history.
 */

export interface ParsedOrderAddress {
  city: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  formatted?: string;
  notes?: string;
  lat: number | null;
  lng: number | null;
}

export interface ParsedOrderZone {
  branchId: string | null;
  zoneId: string | null;
  zoneName: string | null;
}

export interface OrderLocationRow {
  customer_address?: Record<string, unknown> | null;
  customer_lat?: number | string | null;
  customer_lng?: number | string | null;
  address_building?: string | null;
  address_floor?: string | null;
  address_apartment?: string | null;
  address_landmark?: string | null;
  delivery_instructions?: string | null;
  note?: string | null;
  branch_id?: string | null;
  zone_id?: string | null;
  zone_name?: string | null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

export function parseOrderAddress(row: OrderLocationRow): ParsedOrderAddress {
  const addr = (row.customer_address ?? {}) as Record<string, unknown>;

  return {
    city: str(addr.city) ?? "",
    street: str(addr.streetLine) ?? str(addr.street) ?? "",
    building: row.address_building ?? str(addr.buildingNumber) ?? str(addr.building),
    floor: row.address_floor ?? str(addr.floor),
    apartment: row.address_apartment ?? str(addr.apartmentNumber),
    landmark: row.address_landmark ?? str(addr.landmark),
    formatted: str(addr.formatted),
    notes: row.delivery_instructions ?? row.note ?? str(addr.notes),
    lat: num(row.customer_lat),
    lng: num(row.customer_lng),
  };
}

export function parseOrderZone(row: OrderLocationRow): ParsedOrderZone {
  return {
    branchId: row.branch_id ?? null,
    zoneId: row.zone_id ?? null,
    zoneName: row.zone_name ?? null,
  };
}

/** Select-list fragment covering every column parseOrderAddress/parseOrderZone
 *  read — spread this into each consumer's own select string so nothing
 *  needed for display silently goes unfetched again. */
export const ORDER_LOCATION_SELECT = [
  "customer_address",
  "customer_lat",
  "customer_lng",
  "address_building",
  "address_floor",
  "address_apartment",
  "address_landmark",
  "delivery_instructions",
  "branch_id",
  "zone_id",
  "zone_name",
] as const;
