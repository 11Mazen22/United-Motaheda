/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ── Google Sheets / Apps Script ─────────────────────────────────────────
  readonly VITE_GOOGLE_SHEETS_API_URL?: string;
  /** Published-CSV URL for the main product catalog tab. */
  readonly VITE_CATALOG_CSV_URL?: string;

  // ── Delivery configuration ───────────────────────────────────────────────
  readonly VITE_DELIVERY_MIN_MINUTES?: string;
  readonly VITE_DELIVERY_MAX_MINUTES?: string;

  // ── Shipping matrix (JSON array) ─────────────────────────────────────────
  readonly VITE_SHIPPING_MATRIX_JSON?: string;

  // ── Supabase ─────────────────────────────────────────────────────────────
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;

  // ── Search API ───────────────────────────────────────────────────────────
  /** Base URL for search-suggestion requests (falls back to window.location.origin). */
  readonly VITE_SEARCH_API_BASE?: string;

  // ── Third-party integrations ─────────────────────────────────────────────
  readonly VITE_WEB3FORMS_ACCESS_KEY?: string;

  // ── SEO ──────────────────────────────────────────────────────────────────
  readonly VITE_SITE_URL?: string;

  // ── Index signature – required so readStringEnv(key: string) can use
  //    bracket notation (import.meta.env[key]) without TypeScript errors. ──
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ── Static asset declarations ────────────────────────────────────────────────
declare module "*.png" {
  /** Resolved public URL of the PNG asset (Vite default). */
  const url: string;
  export default url;
}

declare module "*.jpg" {
  const url: string;
  export default url;
}

declare module "*.jpeg" {
  const url: string;
  export default url;
}

declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.webp" {
  const url: string;
  export default url;
}
