import type {
  CartSnapshot,
  Coordinates,
  LanguageCode,
  PharmacyAssignment,
  PharmacyBranch,
  SearchEnvelope,
  SearchResultItem,
  SearchSuggestion,
} from "@pharmacy/types";
import { fuzzyMatch, type FuzzySearchableFields } from "@pharmacy/fuzzy-search";
import { z } from "zod";
import {
  BranchSchema,
  DeliveryStatusSchema,
  type Branch,
  type DeliveryStatus,
} from "@pharmacy/contracts";

type SearchCatalogInput = {
  query: string;
  lang: LanguageCode;
  products: SearchResultItem[];
  signal?: AbortSignal;
};

type ResolveLocationInput = {
  coordinates: Coordinates;
  cart: CartSnapshot;
  label?: string;
};

type QuoteCheckoutInput = {
  coordinates: Coordinates;
  cart: CartSnapshot;
  label?: string;
  requestedBranchId?: string;
};

type ApiClientConfig = {
  baseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  searchApiBase?: string;
  defaultDeliveryFee?: number;
  branches?: PharmacyBranch[];
};

type ApiClient = {
  searchCatalog(input: SearchCatalogInput): Promise<SearchEnvelope>;
  resolveLocation(input: ResolveLocationInput): Promise<PharmacyAssignment>;
  quoteCheckout(input: QuoteCheckoutInput): Promise<DeliveryStatus>;
  listBranches(): Promise<Branch[]>;
};

const defaultConfig: Required<Pick<ApiClientConfig, "defaultDeliveryFee" | "branches">> = {
  defaultDeliveryFee: 10,
  branches: [],
};

let apiClientConfig: ApiClientConfig = { ...defaultConfig };

export function configureApiClient(config: ApiClientConfig) {
  apiClientConfig = {
    ...apiClientConfig,
    ...config,
    branches: config.branches ?? apiClientConfig.branches ?? defaultConfig.branches,
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function buildSupabaseRestUrl(path: string) {
  const baseUrl = apiClientConfig.supabaseUrl?.replace(/\/+$/, "");
  if (!baseUrl || !apiClientConfig.supabaseAnonKey) return null;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}/rest/v1${normalizedPath}`;
}

async function fetchSupabase<T>(
  path: string,
  init: RequestInit,
  dataSchema: import("zod").ZodType<T>,
): Promise<T> {
  const anonKey = apiClientConfig.supabaseAnonKey;
  const url = buildSupabaseRestUrl(path);
  if (!url || !anonKey) {
    throw new ApiClientError(
      "NO_SUPABASE_CONFIG",
      "Supabase configuration is not available for @pharmacy/api-client.",
    );
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await response.json()) as unknown;

  if (!response.ok) {
    throw new ApiClientError("SUPABASE_REQUEST_FAILED", "Supabase request failed.", json);
  }

  const parsed = dataSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiClientError("INVALID_RESPONSE", "Invalid Supabase response shape.", {
      issues: parsed.error.issues,
    });
  }

  return parsed.data;
}

function normalize(value: string | undefined | null) {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const token = key(item);
    if (seen.has(token)) {
      return false;
    }
    seen.add(token);
    return true;
  });
}

function buildVariation(value: string) {
  const trimmed = value.trim();
  return trimmed ? [{ type: trimmed }] : [];
}

function mapSuggestion(product: SearchResultItem): SearchSuggestion {
  return {
    productId: product.id,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    variations: buildVariation(product.categoryName),
  };
}

function queryMatch(product: SearchResultItem, needle: string) {
  const fields: FuzzySearchableFields = {
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    category: product.categoryName || product.categoryNameEn || product.category,
    code: product.code,
    barcode: product.barcode,
  };
  return fuzzyMatch(needle, fields);
}

function mapFacet(products: SearchResultItem[]) {
  const counts = new Map<string, number>();

  for (const product of products) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([id, count]) => ({
    id,
    label: products.find((product) => product.category === id)?.categoryNameEn
      || products.find((product) => product.category === id)?.categoryName
      || id,
    count,
  }));
}

function buildCollections(query: string, products: SearchResultItem[]) {
  if (!query.trim()) {
    return [];
  }

  return [
    {
      id: "query-match",
      title: `Query match: ${query.trim()}`,
      strategy: "query_match" as const,
      productIds: products.slice(0, 12).map((product) => product.id),
    },
  ];
}

function buildSearchEnvelope(query: string, products: SearchResultItem[]): SearchEnvelope {
  const normalizedQuery = normalize(query);
  const results = normalizedQuery
    ? uniqueBy(
        products.filter((product) => queryMatch(product, normalizedQuery)),
        (product) => product.id,
      )
    : products;

  return {
    query,
    suggestions: results.slice(0, 8).map(mapSuggestion),
    results,
    collections: buildCollections(query, results),
    facets: mapFacet(results),
    updatedAt: new Date().toISOString(),
  };
}

function haversineDistanceKm(start: Coordinates, end: Coordinates) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(end.lat - start.lat);
  const deltaLng = toRad(end.lng - start.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRad(start.lat))
      * Math.cos(toRad(end.lat))
      * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function buildEtaBand(distanceKm: number, loadFactor = 1) {
  const distanceMinutes = Math.max(10, Math.round(distanceKm * 7));
  const weighted = Math.round(distanceMinutes * Math.max(loadFactor, 1));
  return {
    minMinutes: weighted,
    maxMinutes: weighted + 15,
  };
}

function createToken(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

const client: ApiClient = {
  async searchCatalog({ query, products }) {
    return buildSearchEnvelope(query, products);
  },

  async listBranches() {
    if (apiClientConfig.supabaseUrl && apiClientConfig.supabaseAnonKey) {
      return fetchSupabase(
        "/Branch?select=id,nameAr,nameEn,governorate,area,lat,lng,isActive",
        { method: "GET" },
        BranchSchema.array(),
      );
    }

    // Fallback to locally configured branches (legacy).
    const branches = apiClientConfig.branches ?? defaultConfig.branches;
    return branches.map(
      (branch): Branch => ({
        id: branch.id,
        nameAr: branch.nameAr,
        nameEn: branch.nameEn,
        governorate: "Cairo",
        area: "Cairo",
        lat: branch.lat,
        lng: branch.lng,
        isActive: true,
      }),
    );
  },

  async resolveLocation({ coordinates }) {
    const branches = apiClientConfig.branches ?? defaultConfig.branches;

    if (!branches.length) {
      throw new Error("No pharmacy branches are configured for assignment.");
    }

    const nearest = [...branches]
      .map((branch) => ({
        branch,
        distanceKm: haversineDistanceKm(coordinates, {
          lat: branch.lat,
          lng: branch.lng,
        }),
      }))
      .sort((left, right) => left.distanceKm - right.distanceKm)[0];

    return {
      pharmacyId: nearest.branch.id,
      pharmacyName: nearest.branch.nameEn,
      distanceKm: Number(nearest.distanceKm.toFixed(2)),
      etaBand: buildEtaBand(nearest.distanceKm, nearest.branch.loadFactor),
      assignmentToken: createToken("assign"),
      reason: "nearest_available",
    };
  },

  async quoteCheckout(input) {
    if (apiClientConfig.supabaseUrl && apiClientConfig.supabaseAnonKey) {
      const rows = await fetchSupabase(
        "/rpc/resolve_delivery_zone",
        {
          method: "POST",
          body: JSON.stringify({
            p_lat: input.coordinates.lat,
            p_lng: input.coordinates.lng,
            p_subtotal: input.cart.subtotal,
          }),
        },
        z.array(
          z.object({
            branch_id: z.string(),
            branch_name_ar: z.string(),
            branch_name_en: z.string(),
            zone_id: z.string(),
            base_fee: z.number(),
            effective_fee: z.number(),
            distance_km: z.number(),
          }),
        ),
      );

      const row = rows[0];
      if (!row) {
        return {
          isDeliverable: false,
          cost: null,
          currency: "EGP",
          eta: null,
          branch: null,
          distanceKm: null,
          assignmentToken: null,
          quoteToken: null,
          zoneId: null,
          reasonCode: "OUT_OF_ZONE",
          updatedAt: new Date().toISOString(),
        };
      }

      const branch = {
        id: row.branch_id,
        nameAr: row.branch_name_ar,
        nameEn: row.branch_name_en,
        governorate: "Cairo" as const,
        area: "Cairo",
        lat: input.coordinates.lat,
        lng: input.coordinates.lng,
        isActive: true,
      };
      const etaMinutes = Math.max(15, Math.round(row.distance_km * 7));

      return DeliveryStatusSchema.parse({
        isDeliverable: true,
        cost: row.effective_fee,
        currency: "EGP",
        eta: { minMinutes: etaMinutes, maxMinutes: etaMinutes + 15 },
        branch,
        distanceKm: row.distance_km,
        assignmentToken: createToken("assign"),
        quoteToken: createToken("quote"),
        zoneId: row.zone_id,
        reasonCode: "OK",
        breakdown: {
          baseFee: row.base_fee,
          surgeMultiplier: row.base_fee > 0 ? row.effective_fee / row.base_fee : 1,
          freeDeliveryApplied: row.effective_fee === 0,
        },
        updatedAt: new Date().toISOString(),
      });
    }

    // Fallback: legacy (local) estimate to keep the UI functioning in dev.
    const assignment = await client.resolveLocation(input);
    const updatedAt = new Date().toISOString();
    const branches = apiClientConfig.branches ?? defaultConfig.branches;
    const matchedBranch = branches.find((branch) => branch.id === assignment.pharmacyId);

    return {
      isDeliverable: true,
      cost: apiClientConfig.defaultDeliveryFee ?? defaultConfig.defaultDeliveryFee,
      currency: "EGP",
      eta: assignment.etaBand,
      distanceKm: assignment.distanceKm,
      assignmentToken: assignment.assignmentToken,
      quoteToken: createToken("quote"),
      branch: {
        id: assignment.pharmacyId,
        nameAr: assignment.pharmacyName,
        nameEn: assignment.pharmacyName,
        governorate: "Cairo",
        area: "Cairo",
        lat: matchedBranch?.lat ?? input.coordinates.lat,
        lng: matchedBranch?.lng ?? input.coordinates.lng,
        isActive: true,
      },
      zoneId: null,
      reasonCode: "OK",
      updatedAt,
    };
  },
};

export function getApiClient() {
  return client;
}
