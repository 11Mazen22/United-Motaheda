import { abortTimeout } from "@/utils/timeout";
import { Platform } from "react-native";

/**
 * Geoapify Places Autocomplete API client.
 *
 * Returns address suggestions for a query string, biased to Egypt (Cairo).
 * Used in the address form drawer and checkout details step to replace
 * manual street text entry with auto-suggested structured addresses.
 *
 * Docs: https://apidocs.geoapify.com/docs/geocoding/address-autocomplete
 *
 * The same API key used for geocoding is reused here — both geocoding
 * and autocomplete are part of the same Geoapify plan.
 */

const GEOAPIFY_KEY =
  process.env.EXPO_PUBLIC_GEOAPIFY_KEY ?? "c6beba954a794cb49263d1679e4bc8bf";

const AUTOCOMPLETE_BASE =
  "https://api.geoapify.com/v1/geocode/autocomplete";

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
  /** Geoapify place_id — stable identifier */
  placeId:      string;
}

interface GeoapifyFeature {
  properties: {
    formatted:    string;
    street?:      string;
    housenumber?: string;
    suburb?:      string;
    district?:    string;
    city?:        string;
    lat:          number;
    lon:          number;
    confidence?:  number;
    place_id:     string;
  };
}

interface GeoapifyAutocompleteResponse {
  features: GeoapifyFeature[];
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
      text:      q,
      apiKey:    GEOAPIFY_KEY,
      limit:     String(options?.limit ?? 6),
      lang:      "ar",
      // Bias to Cairo bounding box: SW 29.78,30.70 → NE 30.28,31.90
      bias:      "rect:30.70,29.78,31.90,30.28",
      filter:    "countrycode:eg",
    });

    const resp = await fetch(
      `${AUTOCOMPLETE_BASE}?${params.toString()}`,
      {
        signal: options?.signal ??
          (Platform.OS !== "web"
            ? abortTimeout(5_000)
            : undefined),
      },
    );

    if (!resp.ok) return [];

    const json = (await resp.json()) as GeoapifyAutocompleteResponse;
    const results: PlacesSuggestion[] = (json.features ?? []).map((f) => ({
      formatted:   f.properties.formatted,
      street:      f.properties.street ?? null,
      houseNumber: f.properties.housenumber ?? null,
      district:    f.properties.suburb ?? f.properties.district ?? null,
      city:        f.properties.city ?? null,
      lat:         f.properties.lat,
      lng:         f.properties.lon,
      confidence:  f.properties.confidence ?? 0,
      placeId:     f.properties.place_id,
    }));

    cache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}
