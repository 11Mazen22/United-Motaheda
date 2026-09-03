/**
 * Branch seed data — authoritative source for all United Pharmacies branches.
 *
 * This file is the single source of truth for phones, hours, addresses,
 * names, and capability flags. The Railway API is queried at runtime only
 * to patch coordinates or isActive status — everything else comes from here.
 *
 * When a new branch opens:
 *   1. Add an entry here with full capability flags.
 *   2. Deploy the app update.
 *   3. Optionally add the branch to the Railway DB so it appears in the
 *      real-time quote engine.
 */

import type { Branch } from "./types";

// ─── Map embed URL builder ────────────────────────────────────────────────────

/**
 * Builds a Google Maps embed URL from coordinates.
 * Uses the iframe-compatible `output=embed` format — no API key required.
 * The same formula used by shopper-web's buildMapEmbedUrl.
 */
export function buildBranchMapEmbedUrl(lat: number, lng: number, zoom = 18): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&t=&ie=UTF8&iwloc=&output=embed`;
}

// ─── Shared constants ─────────────────────────────────────────────────────────

const OPENS  = "09:00";
const CLOSES = "23:00";

const HOURS_AR = "كل الأيام • من 9:00 صباحاً حتى 11:00 مساءً";
const HOURS_EN = "Every day • 9:00 AM – 11:00 PM";

const SHARED_HOURS = { ar: HOURS_AR, en: HOURS_EN, opens: OPENS, closes: CLOSES } as const;

// ─── Phone numbers ────────────────────────────────────────────────────────────

const GARDENIA_PHONE    = "01012255595";
const MAADI_PHONE       = "01061128400";
const DHABBAT_1_PHONE   = "01226898995";
const DHABBAT_2_PHONE   = "01090530095";
const ISMAILIA_14_PHONE = "01201967825";
const ISMAILIA_13_PHONE = "01090530095";
const WHATSAPP_LINE     = "01112343212";

// ─── Default capabilities ─────────────────────────────────────────────────────

const DEFAULT_CAPABILITIES = {
  deliveryEnabled:       true,
  pickupEnabled:         true,
  acceptsPrescriptions:  true,
  supportsRefrigeration: false,
  is24h:                 false,
  emergencyAvailable:    false,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const directionsUrl = (lat: number, lng: number): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;

// ─── Branch definitions ───────────────────────────────────────────────────────

export const BRANCHES: readonly Branch[] = [
  {
    ...DEFAULT_CAPABILITIES,
    id:              "gardenia",
    nameAr:          "جاردينيا سيتي",
    nameEn:          "Gardenia City",
    fullNameAr:      "صيدليات المتحدة - جاردينيا سيتي",
    fullNameEn:      "United Pharmacies - Gardenia City",
    addressAr:       "محل B1 مول CITY WALK كومباوند جاردينيا سيتي، القاهرة الجديدة",
    addressEn:       "Shop B1, City Walk Mall, Gardenia City Compound, New Cairo",
    phones:          [GARDENIA_PHONE, WHATSAPP_LINE],
    hours:           SHARED_HOURS,
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0827,
    lng:             31.3853,
    mapZoom:         18,
    isPrimary:       true,
    governorate:     "Cairo",
    area:            "القاهرة الجديدة",
    deliveryRadiusKm: 14,
    mapsDirectionsUrl: directionsUrl(30.0827, 31.3853),
  },
  {
    ...DEFAULT_CAPABILITIES,
    id:              "maadi",
    nameAr:          "المعادي",
    nameEn:          "Maadi",
    fullNameAr:      "صيدليات المتحدة - المعادي",
    fullNameEn:      "United Pharmacies - Maadi",
    addressAr:       "ش فلسطين، بندر مول، المعادي، القاهرة",
    addressEn:       "Palestine St., Bandar Mall, Maadi, Cairo",
    phones:          [MAADI_PHONE, WHATSAPP_LINE],
    hours:           SHARED_HOURS,
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0146,
    lng:             31.2824,
    mapZoom:         18,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "المعادي",
    mapsDirectionsUrl: directionsUrl(30.0146, 31.2824),
  },
  {
    ...DEFAULT_CAPABILITIES,
    id:              "masakin-dhabbat",
    nameAr:          "مساكن الضباط ١",
    nameEn:          "Masakin Al-Dabbat 1",
    fullNameAr:      "صيدليات المتحدة - مساكن الضباط ١",
    fullNameEn:      "United Pharmacies - Masakin Al-Dabbat 1",
    addressAr:       "عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق، مساكن الضباط، مدينة نصر",
    addressEn:       "Building 336, Fatima Al-Zahraa St., off Al-Mithaq St., Masakin Al-Dabbat, Nasr City",
    phones:          [DHABBAT_1_PHONE, WHATSAPP_LINE],
    hours:           SHARED_HOURS,
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.052,
    lng:             31.355,
    mapZoom:         18,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "مدينة نصر",
    mapsDirectionsUrl: directionsUrl(30.052, 31.355),
  },
  {
    ...DEFAULT_CAPABILITIES,
    id:              "masakin-dhabbat-2",
    nameAr:          "مساكن الضباط ٢",
    nameEn:          "Masakin Al-Dabbat 2",
    fullNameAr:      "صيدليات المتحدة - مساكن الضباط ٢",
    fullNameEn:      "United Pharmacies - Masakin Al-Dabbat 2",
    addressAr:       "عمارة 2004 شارع فاطمة الزهراء متفرع من الميثاق، الحي العاشر، مساكن الضباط، مدينة نصر",
    addressEn:       "Building 2004, Fatima Al-Zahraa St., off Al-Mithaq St., 10th District, Masakin Al-Dabbat, Nasr City",
    phones:          [DHABBAT_2_PHONE, WHATSAPP_LINE],
    hours:           SHARED_HOURS,
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0525,
    lng:             31.3558,
    mapZoom:         18,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "مدينة نصر",
    mapsDirectionsUrl: directionsUrl(30.0525, 31.3558),
  },
  {
    ...DEFAULT_CAPABILITIES,
    id:              "ismailia-14",
    nameAr:          "شارع الاسماعيليه - ١٤",
    nameEn:          "Ismailia St. – No. 14",
    fullNameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٤",
    fullNameEn:      "United Pharmacies - Ismailia St. No. 14",
    addressAr:       "١٤ ش الإسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
    addressEn:       "14 Ismailia St., off Al-Mithaq St., Zahraa Nasr City",
    phones:          [ISMAILIA_14_PHONE, WHATSAPP_LINE],
    hours:           SHARED_HOURS,
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.065,
    lng:             31.378,
    mapZoom:         18,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "مدينة نصر",
    mapsDirectionsUrl: directionsUrl(30.065, 31.378),
  },
  {
    ...DEFAULT_CAPABILITIES,
    id:              "ismailia-13",
    nameAr:          "شارع الاسماعيليه - ١٣",
    nameEn:          "Ismailia St. – No. 13",
    fullNameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٣",
    fullNameEn:      "United Pharmacies - Ismailia St. No. 13",
    addressAr:       "١٣ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
    addressEn:       "13 Ismailia St., off Al-Mithaq St., Zahraa Nasr City",
    phones:          [ISMAILIA_13_PHONE, WHATSAPP_LINE],
    hours:           SHARED_HOURS,
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0655,
    lng:             31.3785,
    mapZoom:         18,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "مدينة نصر",
    mapsDirectionsUrl: directionsUrl(30.0655, 31.3785),
  },
];

export const DELIVERY_BRANCHES = BRANCHES.filter((b) => b.deliveryEnabled);

export function findBranchById(id: string | null | undefined): Branch | null {
  if (!id) return null;
  return BRANCHES.find((b) => b.id === id) ?? null;
}

export function getPrimaryBranch(): Branch {
  return BRANCHES.find((b) => b.isPrimary) ?? BRANCHES[0];
}
