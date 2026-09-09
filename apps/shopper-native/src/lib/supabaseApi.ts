import { supabase } from "./supabase";

export interface SupabaseBranch {
  id: string;
  nameAr: string;
  nameEn: string;
  governorate: string;
  area: string;
  lat: number;
  lng: number;
  isActive: boolean;
}

export interface SupabaseDeliveryQuote {
  isDeliverable: boolean;
  cost: number | null;
  currency: string;
  eta: { minMinutes: number; maxMinutes: number } | null;
  branch: SupabaseBranch | null;
  distanceKm: number | null;
  zoneId: string | null;
  reasonCode: "OK" | "OUT_OF_CAIRO" | "OUT_OF_ZONE" | "NO_BRANCH";
  updatedAt: string;
  breakdown?: {
    baseFee: number;
    surgeMultiplier: number;
    freeDeliveryApplied: boolean;
  };
}

export interface SupabaseCartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export class SupabaseApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "SupabaseApiError";
  }
}

type DeliveryZoneRow = {
  branch_id: string;
  branch_name_ar: string;
  branch_name_en: string;
  zone_id: string;
  base_fee: number;
  effective_fee: number;
  distance_km: number;
};

function isDeliveryZoneRow(value: unknown): value is DeliveryZoneRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.branch_id === "string" &&
    typeof row.branch_name_ar === "string" &&
    typeof row.branch_name_en === "string" &&
    typeof row.zone_id === "string" &&
    typeof row.base_fee === "number" &&
    typeof row.effective_fee === "number" &&
    typeof row.distance_km === "number"
  );
}

export const supabaseApi = {
  async listBranches(): Promise<SupabaseBranch[]> {
    const { data, error } = await supabase
      .from("Branch")
      .select("id,nameAr,nameEn,governorate,area,lat,lng,isActive");

    if (error) {
      throw new SupabaseApiError(error.message, error.code);
    }

    return (data ?? []) as SupabaseBranch[];
  },

  async getDeliveryQuote(body: {
    coordinates: { lat: number; lng: number };
    cart: { items: SupabaseCartItem[]; itemCount: number; subtotal: number };
    requestedBranchId?: string;
  }): Promise<SupabaseDeliveryQuote> {
    const { data, error } = await supabase.rpc("resolve_delivery_zone", {
      p_lat: body.coordinates.lat,
      p_lng: body.coordinates.lng,
      p_subtotal: body.cart.subtotal,
    });

    if (error) {
      throw new SupabaseApiError(error.message, error.code);
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!isDeliveryZoneRow(row)) {
      return {
        isDeliverable: false,
        cost: null,
        currency: "EGP",
        eta: null,
        branch: null,
        distanceKm: null,
        zoneId: null,
        reasonCode: "OUT_OF_ZONE",
        updatedAt: new Date().toISOString(),
      };
    }

    const etaMinutes = Math.max(15, Math.round(row.distance_km * 7));
    return {
      isDeliverable: true,
      cost: row.effective_fee,
      currency: "EGP",
      eta: { minMinutes: etaMinutes, maxMinutes: etaMinutes + 15 },
      branch: {
        id: row.branch_id,
        nameAr: row.branch_name_ar,
        nameEn: row.branch_name_en,
        governorate: "Cairo",
        area: "Cairo",
        lat: body.coordinates.lat,
        lng: body.coordinates.lng,
        isActive: true,
      },
      distanceKm: row.distance_km,
      zoneId: row.zone_id,
      reasonCode: "OK",
      updatedAt: new Date().toISOString(),
      breakdown: {
        baseFee: row.base_fee,
        surgeMultiplier: row.base_fee > 0 ? row.effective_fee / row.base_fee : 1,
        freeDeliveryApplied: row.effective_fee === 0,
      },
    };
  },
};
