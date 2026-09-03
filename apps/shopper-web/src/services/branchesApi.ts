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
    lat:         30.0683587,
    lng:         31.3880317,
    isActive:    true,
  },
  {
    id:          "maadi",
    nameAr:      "صيدليات المتحدة - المعادي",
    nameEn:      "United Pharmacies - Maadi",
    governorate: "Cairo",
    area:        "المعادي",
    lat:         29.9776648,
    lng:         31.2842375,
    isActive:    true,
  },
  {
    id:          "masakin-dhabbat",
    nameAr:      "صيدليات المتحدة - مساكن الضباط",
    nameEn:      "United Pharmacies - Masakin Al-Dabbat",
    governorate: "Cairo",
    area:        "مدينة نصر",
    lat:         30.0482374,
    lng:         31.3909549,
    isActive:    true,
  },
  {
    id:          "masakin-dhabbat-2",
    nameAr:      "صيدليات المتحدة - مساكن الضباط ٢",
    nameEn:      "United Pharmacies - Masakin Al-Dabbat 2",
    governorate: "Cairo",
    area:        "مدينة نصر",
    lat:         30.0569117,
    lng:         31.4005032,
    isActive:    true,
  },
  {
    id:          "ismailia-14",
    nameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٤",
    nameEn:      "United Pharmacies - Ismailia St. No. 14",
    governorate: "Cairo",
    area:        "مدينة نصر",
    lat:         30.0495768,
    lng:         31.3882602,
    isActive:    true,
  },
  {
    id:          "ismailia-13",
    nameAr:      "صيدليات المتحدة - شارع الاسماعيليه ١٣",
    nameEn:      "United Pharmacies - Ismailia St. No. 13",
    governorate: "Cairo",
    area:        "مدينة نصر",
    lat:         30.0501768,
    lng:         31.3888602,
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
