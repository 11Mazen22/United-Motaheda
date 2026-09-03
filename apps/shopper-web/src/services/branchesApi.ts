import { getApiClient } from "@pharmacy/api-client";
import type { Branch } from "@pharmacy/contracts";

export type ApiBranch = Branch;

// ─── Real United Pharmacies branches (fallback when API is unreachable) ───────
//
// All 6 branches from the official branch listing.
// Coordinates and names match apps/shopper-native/src/features/delivery/branches/data.ts.

const FALLBACK_BRANCHES: Branch[] = [
  {
    id:          "gardenia",
    nameAr:      "صيدليات المتحدة - جاردينيا سيتي",
    nameEn:      "United Pharmacies - Gardenia City",
    governorate: "Cairo",
    area:        "القاهرة الجديدة",
    lat:         30.0827,
    lng:         31.3853,
    isActive:    true,
  },
  {
    id:          "maadi",
    nameAr:      "صيدليات المتحدة - المعادي",
    nameEn:      "United Pharmacies - Maadi",
    governorate: "Cairo",
    area:        "المعادي",
    lat:         30.0146,
    lng:         31.2824,
    isActive:    true,
  },
  {
    id:          "masakin-dhabbat",
    nameAr:      "صيدليات المتحدة - مساكن الضباط",
    nameEn:      "United Pharmacies - Masakin Al-Dabbat",
    governorate: "Cairo",
    area:        "مدينة نصر",
    lat:         30.0520,
    lng:         31.3550,
    isActive:    true,
  },
  {
    id:          "masakin-dhabbat-2",
    nameAr:      "صيدليات المتحدة - مساكن الضباط ٢",
    nameEn:      "United Pharmacies - Masakin Al-Dabbat 2",
    governorate: "Cairo",
    area:        "مدينة نصر",
    lat:         30.0525,
    lng:         31.3558,
    isActive:    true,
  },
  {
    id:          "ismailia-14",
    nameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٤",
    nameEn:      "United Pharmacies - Ismailia St. No. 14",
    governorate: "Cairo",
    area:        "مدينة نصر",
    lat:         30.0650,
    lng:         31.3780,
    isActive:    true,
  },
  {
    id:          "ismailia-13",
    nameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٣",
    nameEn:      "United Pharmacies - Ismailia St. No. 13",
    governorate: "Cairo",
    area:        "مدينة نصر",
    lat:         30.0655,
    lng:         31.3785,
    isActive:    true,
  },
];

export async function fetchBranches(): Promise<Branch[]> {
  try {
    const branches = await getApiClient().listBranches();
    return branches.length > 0 ? branches : FALLBACK_BRANCHES;
  } catch {
    return FALLBACK_BRANCHES;
  }
}

export { FALLBACK_BRANCHES };
