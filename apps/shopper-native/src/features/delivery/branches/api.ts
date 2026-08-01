/**
 * Branches API service.
 *
 * Strategy: the static BRANCHES seed in data.ts is the authoritative source
 * for phone numbers, hours, full addresses, and display names — this data
 * only changes when branches physically change, so it belongs in the app
 * bundle, not fetched on every launch.
 *
 * The Railway backend is queried for two things only:
 *   1. `isActive` — whether a branch is temporarily closed
 *   2. Coordinates — if Railway has corrected coords, use them
 *
 * Any branch in the Railway response that is NOT in the static seed is
 * silently ignored — we never display branches we haven't curated.
 * Any branch in the static seed that is NOT in the Railway response retains
 * its static data and is treated as active (fail-open).
 *
 * This means branch cards always show correct phones/hours/addresses even
 * when the Railway API is slow, returns incomplete data, or is unreachable.
 */

import { railwayApi } from "@/lib/railwayApi";
import { BRANCHES } from "./data";
import type { Branch } from "./types";

interface RailwayPatch {
  id:       string;
  lat?:     number;
  lng?:     number;
  isActive: boolean;
}

function applyRailwayPatch(staticBranch: Branch, patch: RailwayPatch): Branch {
  return {
    ...staticBranch,
    // Update coordinates only if Railway provides valid ones
    lat: Number.isFinite(patch.lat) ? (patch.lat as number) : staticBranch.lat,
    lng: Number.isFinite(patch.lng) ? (patch.lng as number) : staticBranch.lng,
    // Railway can mark a branch inactive (e.g. temporarily closed)
    deliveryEnabled: staticBranch.deliveryEnabled && patch.isActive,
  };
}

export async function fetchBranches(): Promise<Branch[]> {
  try {
    const rows = await railwayApi.listBranches();
    if (!rows?.length) return [...BRANCHES];

    // Build a lookup map from Railway response
    const patchById = new Map<string, RailwayPatch>();
    for (const row of rows) {
      patchById.set(row.id, {
        id:       row.id,
        lat:      row.lat,
        lng:      row.lng,
        isActive: row.isActive ?? true,
      });
    }

    // Merge Railway patches into static branches — static data wins for
    // phones, addresses, hours, names
    return BRANCHES.map((staticBranch) => {
      const patch = patchById.get(staticBranch.id);
      if (!patch) return staticBranch; // not in Railway → use static as-is
      return applyRailwayPatch(staticBranch, patch);
    });
  } catch {
    // Railway unreachable → use static seed so the UI never blocks
    return [...BRANCHES];
  }
}
