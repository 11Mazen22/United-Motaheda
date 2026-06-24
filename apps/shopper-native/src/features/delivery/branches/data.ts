/**
 * Branch seed data — ported from shopper-web/src/app/data.ts.
 *
 * Five Cairo branches with WGS84 coordinates. Hours/phones come from the
 * web reference and should stay in sync. When this moves to Supabase, this
 * file becomes the offline fallback only.
 */

import type { Branch } from "./types";

const HOURS_AR = "كل الأيام • من 9:00 صباحاً حتى 11:00 مساءً";
const HOURS_EN = "Every day • 9:00 AM – 11:00 PM";

// Phone numbers from the official branch listing photo
const GARDENIA_PHONE    = "01012255595";
const MAADI_PHONE       = "01061128400";
const DHABBAT_1_PHONE   = "01226898995";
const DHABBAT_2_PHONE   = "01090530095";
const ISMAILIA_14_PHONE = "01201967825";
const ISMAILIA_13_PHONE = "01090530095";
const WHATSAPP_LINE     = "01112343212";

const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;

export const BRANCHES: readonly Branch[] = [
  {
    id:              "gardenia",
    nameAr:          "جاردينيا سيتي",
    nameEn:          "Gardenia City",
    fullNameAr:      "صيدليات المتحدة - جاردينيا سيتي",
    fullNameEn:      "United Pharmacies - Gardenia City",
    addressAr:       "محل B1 مول CITY WALK كومباوند جاردينيا سيتي",
    addressEn:       "Shop B1, City Walk Mall, Gardenia City Compound",
    phones:          [GARDENIA_PHONE, WHATSAPP_LINE],
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0827,
    lng:             31.3853,
    mapZoom:         16,
    isPrimary:       true,
    governorate:     "Cairo",
    area:            "القاهرة الجديدة",
    deliveryEnabled: true,
    mapsDirectionsUrl: directionsUrl(30.0827, 31.3853),
  },
  {
    id:              "maadi",
    nameAr:          "المعادي",
    nameEn:          "Maadi",
    fullNameAr:      "صيدليات المتحدة - المعادي",
    fullNameEn:      "United Pharmacies - Maadi",
    addressAr:       "ش فلسطين، بندر مول، المعادي، القاهرة",
    addressEn:       "Palestine St., Bandar Mall, Maadi, Cairo",
    phones:          [MAADI_PHONE, WHATSAPP_LINE],
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0146,
    lng:             31.2824,
    mapZoom:         17,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "المعادي",
    deliveryEnabled: true,
    mapsDirectionsUrl: directionsUrl(30.0146, 31.2824),
  },
  {
    id:              "masakin-dhabbat",
    nameAr:          "مساكن الضباط",
    nameEn:          "Masakin Al-Dabbat",
    fullNameAr:      "صيدليات المتحدة - مساكن الضباط",
    fullNameEn:      "United Pharmacies - Masakin Al-Dabbat",
    addressAr:       "عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق",
    addressEn:       "Building 336, Fatima Al-Zahraa St., off Al-Mithaq St.",
    phones:          [DHABBAT_1_PHONE, WHATSAPP_LINE],
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0520,
    lng:             31.3550,
    mapZoom:         17,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "مدينة نصر",
    deliveryEnabled: true,
    mapsDirectionsUrl: directionsUrl(30.0520, 31.3550),
  },
  {
    id:              "masakin-dhabbat-2",
    nameAr:          "مساكن الضباط ٢",
    nameEn:          "Masakin Al-Dabbat 2",
    fullNameAr:      "صيدليات المتحدة - مساكن الضباط ٢",
    fullNameEn:      "United Pharmacies - Masakin Al-Dabbat 2",
    addressAr:       "عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق",
    addressEn:       "Building 336, Fatima Al-Zahraa St., off Al-Mithaq St.",
    phones:          [DHABBAT_2_PHONE, WHATSAPP_LINE],
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0521,
    lng:             31.3551,
    mapZoom:         17,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "مدينة نصر",
    deliveryEnabled: true,
    mapsDirectionsUrl: directionsUrl(30.0521, 31.3551),
  },
  {
    id:              "ismailia-14",
    nameAr:          "شارع الاسماعيليه - ١٤",
    nameEn:          "Ismailia St. – No. 14",
    fullNameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٤",
    fullNameEn:      "United Pharmacies - Ismailia St. No. 14",
    addressAr:       "١٤ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
    addressEn:       "14 Ismailia St., off Al-Mithaq St., Zahraa Nasr City",
    phones:          [ISMAILIA_14_PHONE, WHATSAPP_LINE],
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0650,
    lng:             31.3780,
    mapZoom:         16,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "مدينة نصر",
    deliveryEnabled: true,
    mapsDirectionsUrl: directionsUrl(30.0650, 31.3780),
  },
  {
    id:              "ismailia-13",
    nameAr:          "شارع الاسماعيليه - ١٣",
    nameEn:          "Ismailia St. – No. 13",
    fullNameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٣",
    fullNameEn:      "United Pharmacies - Ismailia St. No. 13",
    addressAr:       "١٣ ش الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر",
    addressEn:       "13 Ismailia St., off Al-Mithaq St., Zahraa Nasr City",
    phones:          [ISMAILIA_13_PHONE, WHATSAPP_LINE],
    hoursAr:         HOURS_AR,
    hoursEn:         HOURS_EN,
    lat:             30.0655,
    lng:             31.3785,
    mapZoom:         16,
    isPrimary:       false,
    governorate:     "Cairo",
    area:            "مدينة نصر",
    deliveryEnabled: true,
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
