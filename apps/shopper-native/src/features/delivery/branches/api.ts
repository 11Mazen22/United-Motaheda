/**
 * Branches API service.
 *
 * Strategy: the static BRANCHES seed in data.ts is the authoritative source
 * for phone numbers, hours, full addresses, and display names — this data
 * only changes when branches physically change, so it belongs in the app
 * bundle, not fetched on every launch.
 *
 * Supabase is queried for two things only:
 *   1. `isActive` — whether a branch is temporarily closed
 *   2. Coordinates — if Supabase has corrected coords, use them
 *
 * Any branch in the Supabase response that is NOT in the static seed is
 * silently ignored — we never display branches we haven't curated.
 * Any branch in the static seed that is NOT in the Supabase response retains
 * its static data and is treated as active (fail-open).
 *
 * This means branch cards always show correct phones/hours/addresses even
 * when the Supabase API is slow, returns incomplete data, or is unreachable.
 */

import { supabaseApi } from "@/lib/supabaseApi";
import { BRANCHES } from "./data";
import type { Branch } from "./types";

interface SupabasePatch {
  id:       string;
  lat?:     number;
  lng?:     number;
  isActive: boolean;
}

function applySupabasePatch(staticBranch: Branch, patch: SupabasePatch): Branch {
  return {
    ...staticBranch,
    // Update coordinates only if Supabase provides valid ones
    lat: Number.isFinite(patch.lat) ? (patch.lat as number) : staticBranch.lat,
    lng: Number.isFinite(patch.lng) ? (patch.lng as number) : staticBranch.lng,
    // Supabase can mark a branch inactive (e.g. temporarily closed)
    deliveryEnabled: staticBranch.deliveryEnabled && patch.isActive,
  };
}

export async function fetchBranches(): Promise<Branch[]> {
  try {
    const rows = await supabaseApi.listBranches();
    if (!rows?.length) return [...BRANCHES];

    // Build a lookup map from Supabase response
    const patchById = new Map<string, SupabasePatch>();
    for (const row of rows) {
      patchById.set(row.id, {
        id:       row.id,
        lat:      row.lat,
        lng:      row.lng,
        isActive: row.isActive ?? true,
      });
    }

    // Merge Supabase patches into static branches — static data wins for
    // phones, addresses, hours, names
    return BRANCHES.map((staticBranch) => {
      const patch = patchById.get(staticBranch.id);
      if (!patch) return staticBranch; // not in Supabase → use static as-is
      return applySupabasePatch(staticBranch, patch);
    });
  } catch {
    // Supabase unreachable → use static seed so the UI never blocks
    return [...BRANCHES];
  }
}
