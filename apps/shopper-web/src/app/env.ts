function readStringEnv(key: string): string {
  // Cast to a plain index type so TypeScript allows dynamic bracket access.
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumberEnv(key: string, fallback: number): number {
  const value = readStringEnv(key);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ── Catalog CSV URL ──────────────────────────────────────────────────────────
// Retained for legacy reference only – the shopper catalog now fetches directly
// from Supabase. This URL is no longer used in the active data pipeline.
const catalogCsvUrl =
  readStringEnv("VITE_CATALOG_CSV_URL") ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRioq-Q9nxt-iM02Q-YM97_JHey29jt6C6go4FLJoSZbFQ2CY2hVrwmdC__tF7Cul91auH8L0ARutCQ/pub?gid=25643091&single=true&output=csv";

// Changed: googleSheetsApiUrl is retained for backward compat but is no longer
// required – the catalog now reads directly from the Supabase `products` table.
const googleSheetsApiUrl = readStringEnv("VITE_GOOGLE_SHEETS_API_URL");
const defaultSearchApi =
  typeof window !== "undefined" ? window.location.origin : "";

export const publicEnv = {
  catalogCsvUrl,
  googleSheetsApiUrl,
  apiBase: readStringEnv("VITE_API_BASE") || "https://pharmacyapi-production-e30d.up.railway.app",
  deliveryMinMinutes: readNumberEnv("VITE_DELIVERY_MIN_MINUTES", 15),
  deliveryMaxMinutes: readNumberEnv("VITE_DELIVERY_MAX_MINUTES", 30),
  shippingMatrixJson: readStringEnv("VITE_SHIPPING_MATRIX_JSON"),
  supabaseAnonKey:
    readStringEnv("VITE_SUPABASE_ANON_KEY") ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI",
  supabaseUrl:
    readStringEnv("VITE_SUPABASE_URL") ||
    "https://envoy-production-1cbe.up.railway.app",
  /** Base URL for search suggestions (falls back to current origin). */
  searchApiBase: readStringEnv("VITE_SEARCH_API_BASE") || defaultSearchApi,
  web3formsAccessKey: readStringEnv("VITE_WEB3FORMS_ACCESS_KEY"),
} as const;

export function getPublicEnvValidationErrors(): string[] {
  const errors: string[] = [];

  // Catalog CSV URL must be a valid URL.
  try {
    new URL(publicEnv.catalogCsvUrl);
  } catch {
    errors.push("VITE_CATALOG_CSV_URL must be a valid URL.");
  }

  // Delivery window sanity check.
  if (publicEnv.deliveryMinMinutes > publicEnv.deliveryMaxMinutes) {
    errors.push(
      "VITE_DELIVERY_MIN_MINUTES cannot exceed VITE_DELIVERY_MAX_MINUTES.",
    );
  }

  // Shipping matrix must be a valid JSON array when provided.
  if (publicEnv.shippingMatrixJson) {
    try {
      const parsed = JSON.parse(publicEnv.shippingMatrixJson);

      if (!Array.isArray(parsed)) {
        errors.push("VITE_SHIPPING_MATRIX_JSON must be a JSON array.");
      }
    } catch {
      errors.push("VITE_SHIPPING_MATRIX_JSON must be valid JSON.");
    }
  }

  // Changed: removed the VITE_GOOGLE_SHEETS_API_URL required-field check.
  // The shopper catalog now fetches products directly from Supabase, so the
  // Apps Script URL is no longer part of the critical configuration path.

  // Supabase: both vars must be provided together or not at all.
  if (Boolean(publicEnv.supabaseUrl) !== Boolean(publicEnv.supabaseAnonKey)) {
    errors.push(
      "Provide both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY together.",
    );
  }

  return errors;
}
