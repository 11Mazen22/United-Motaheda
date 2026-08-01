/**
 * Branch domain types — single source of truth for delivery branches.
 *
 * Phase 4 (v1): branches are seeded as a static constant (see data.ts).
 * Phase 4.x:    branches table on Supabase; `fetchBranches()` swaps to a
 *               query against `public.branches`. Consumers don't change.
 */

export type Governorate = "Cairo";

/** Capability flags — additive, all optional, all default to true/false
 *  as appropriate so existing branch objects without these fields still work. */
export interface BranchCapabilities {
  /** True when this branch accepts delivery orders (default: true). */
  deliveryEnabled:         boolean;
  /** True when customers can walk in and collect from this branch. */
  pickupEnabled:           boolean;
  /** True when staff can dispense controlled/prescription medicines. */
  acceptsPrescriptions:    boolean;
  /** True when the branch has cold-chain storage for refrigerated medicines. */
  supportsRefrigeration:   boolean;
  /** True when the branch operates 24 hours. */
  is24h:                   boolean;
  /** True when this branch can handle emergency/urgent orders out of hours. */
  emergencyAvailable:      boolean;
}

export interface BranchHours {
  /** Human-readable hours in Arabic (e.g. "كل الأيام • من 9 صباحاً حتى 11 مساءً"). */
  ar: string;
  /** Human-readable hours in English. */
  en: string;
  /** Structured open/close for programmatic use (24-h "HH:MM" strings). */
  opens:  string;   // "09:00"
  closes: string;   // "23:00"
}

export interface Branch extends BranchCapabilities {
  id:                string;
  nameAr:            string;
  nameEn:            string;
  fullNameAr:        string;
  fullNameEn:        string;
  addressAr:         string;
  addressEn:         string;
  phones:            string[];
  hours:             BranchHours;
  /** Legacy flat strings — kept for backward compat; prefer `hours`. */
  hoursAr:           string;
  hoursEn:           string;
  /** WGS84 latitude. */
  lat:               number;
  /** WGS84 longitude. */
  lng:               number;
  /** Default map zoom level when this branch is focused. */
  mapZoom:           number;
  /** True for the flagship / main branch shown by default. */
  isPrimary:         boolean;
  governorate:       Governorate;
  /** Neighborhood/area display label. */
  area:              string;
  /** Optional pre-built Google Maps directions URL. */
  mapsDirectionsUrl?: string;
  /** Delivery radius in km — overrides DEFAULT_BRANCH_RADIUS_KM when set. */
  deliveryRadiusKm?: number;
}
