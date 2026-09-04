import { abortTimeout } from "@/utils/timeout";
import { Platform } from "react-native";
import { MAPTILER_KEY } from "@/lib/maptilerConfig";

/**
 * MapTiler Geocoding API client, used in autocomplete mode.
 *
 * Returns address suggestions for a query string, biased to Egypt (Cairo).
 * Used in the address form drawer and checkout details step to replace
 * manual street text entry with auto-suggested structured addresses.
 *
 * Docs: https://docs.maptiler.com/cloud/api/geocoding/
 *
 * The same API key used for geocoding (geocoding.ts) is reused here —
 * MapTiler serves autocomplete and one-shot geocoding from the same
 * `/geocoding/{query}.json` endpoint, distinguished only by `autocomplete=true`.
 */

const BASE = "https://api.maptiler.com/geocoding";

// Cairo-area bounding box (west,south,east,north) — same box geocoding.ts
// uses, keeping search-box and map-geocode results consistent.
const CAIRO_BBOX = "30.70,29.78,31.90,30.28";

export interface PlacesSuggestion {
  /** Full formatted address string */
  formatted:    string;
  /** Street name only (for filling the street field) */
  street:       string | null;
  /** House number / building */
  houseNumber:  string | null;
  /** District / suburb */
  district:     string | null;
  /** City */
  city:         string | null;
  /** Latitude */
  lat:          number;
  /** Longitude */
  lng:          number;
  /** 0–1 confidence score */
  confidence:   number;
  /** MapTiler feature id — stable identifier */
  placeId:      string;
}

interface MapTilerFeature {
  id: string;
  place_name: string;
  place_type: string[];
  relevance?: number;
  center: [number, number]; // [lng, lat]
  text: string;
  context?: Array<{ id: string; text: string; kind?: string }>;
}

interface MapTilerGeocodingResponse {
  features: MapTilerFeature[];
}

/** In-memory cache for the current session — avoids re-fetching the same
 *  query string twice (e.g. user types then backspaces to the same text). */
const cache = new Map<string, PlacesSuggestion[]>();

/**
 * Fetch address autocomplete suggestions for `query`.
 *
 * - Returns up to `limit` (default 6) results
 * - Biased to Egypt + Cairo bounding box for local relevance
 * - Abortable via `signal`
 * - Returns empty array on any error (non-fatal — user falls back to manual entry)
 */
export async function fetchPlacesSuggestions(
  query:    string,
  options?: {
    limit?:  number;
    signal?: AbortSignal;
  },
): Promise<PlacesSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const cacheKey = `${q}|${options?.limit ?? 6}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      key:          MAPTILER_KEY,
      limit:        String(options?.limit ?? 6),
      language:     "ar",
      country:      "eg",
      bbox:         CAIRO_BBOX,
      autocomplete: "true",
    });

    const resp = await fetch(
      `${BASE}/${encodeURIComponent(q)}.json?${params.toString()}`,
      {
        signal: options?.signal ??
          (Platform.OS !== "web"
            ? abortTimeout(5_000)
            : undefined),
      },
    );

    if (!resp.ok) return [];

    const json = (await resp.json()) as MapTilerGeocodingResponse;
    const results: PlacesSuggestion[] = (json.features ?? []).map((f) => {
      const [lng, lat] = f.center ?? [];
      return {
        formatted:   f.place_name,
        street:      f.place_type?.[0] === "address" ? f.text : null,
        houseNumber: null,
        district:    f.context?.find((c) => c.kind === "place")?.text ?? null,
        city:        f.context?.find((c) => c.kind === "admin_area")?.text ?? null,
        lat,
        lng,
        confidence:  f.relevance ?? 0,
        placeId:     f.id,
      };
    }).filter((s) => s.lat != null && s.lng != null);

    cache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}
