import { abortTimeout } from "@/utils/timeout";

/**
 *
 * Used when saving a delivery address so coordinates are stored
 * and fed into the Railway /delivery/quote zone-polygon engine.
 *
 * Docs: https://apidocs.geoapify.com/docs/geocoding/forward-geocoding
 */

const GEOAPIFY_KEY =
  process.env.EXPO_PUBLIC_GEOAPIFY_KEY ?? "c6beba954a794cb49263d1679e4bc8bf";

const BASE = "https://api.geoapify.com/v1/geocode/search";

export interface GeocodedCoords {
  lat: number;
  lng: number;
  confidence: number; // 0–1, lower = less reliable
}

interface GeoapifyFeature {
  geometry: { coordinates: [number, number] }; // [lng, lat]
  properties: {
    lat: number;
    lon: number;
    confidence?: number;
  };
}

interface GeoapifyResponse {
  features: GeoapifyFeature[];
}

/**
 * Geocode a structured delivery address.
 *
 * Two-stage strategy for Egyptian addresses:
 *   Stage 1 — full text search (street + building + district + city).
 *             Most precise; works when Geoapify has the street indexed.
 *   Stage 2 — district + city fallback. Less precise but returns a valid
 *             map centre so the card shows a real map tile instead of the
 *             animated placeholder. Confidence is flagged low so callers
 *             can choose to display a different pin style if needed.
 *
 * Returns null only when both stages fail (network error, unknown city, etc.)
 */
export async function geocodeAddress(params: {
  street:   string;
  building: string;
  district: string;
  city:     string;
  country?: string;
}): Promise<GeocodedCoords | null> {
  const country = params.country ?? "Egypt";

  // Stage 1 — full address free-text (no type restriction)
  const stage1 = await _geocodeText(
    [params.street, params.building, params.district, params.city]
      .filter(Boolean)
      .join(" "),
    country,
  );
  if (stage1) return stage1;

  // Stage 2 — district + city only (coarser but almost always succeeds)
  const stage2 = await _geocodeText(
    [params.district, params.city].filter(Boolean).join(" "),
    country,
  );
  return stage2 ? { ...stage2, confidence: Math.min(stage2.confidence, 0.4) } : null;
}

export interface ReverseGeocodedAddress {
  formatted: string;
  street:    string | null;
  district:  string | null;
  city:      string | null;
  confidence: number;
}

const REVERSE_BASE = "https://api.geoapify.com/v1/geocode/reverse";

/**
 * Reverse-geocode GPS coordinates ("where am I") into a structured Egyptian
 * address. Used by "Use current location" instead of (or as a richer
 * upgrade over) the OS's on-device reverse geocoder — Geoapify's index is
 * more current for Egyptian streets/districts and returns Arabic-language
 * results matching the rest of the address form.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodedAddress | null> {
  try {
    const query = new URLSearchParams({
      lat:    String(lat),
      lon:    String(lng),
      lang:   "ar",
      apiKey: GEOAPIFY_KEY,
    });
    const res = await fetch(`${REVERSE_BASE}?${query.toString()}`, {
      signal: abortTimeout(8_000) as unknown as never,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as GeoapifyResponse;
    const feature = json.features?.[0];
    if (!feature) return null;

    const p = feature.properties as GeoapifyFeature["properties"] & {
      formatted?: string;
      street?: string;
      suburb?: string;
      district?: string;
      city?: string;
    };

    return {
      formatted:  p.formatted ?? "",
      street:     p.street ?? null,
      district:   p.suburb ?? p.district ?? null,
      city:       p.city ?? null,
      confidence: p.confidence ?? 0,
    };
  } catch {
    return null;
  }
}

async function _geocodeText(text: string, country: string): Promise<GeocodedCoords | null> {
  try {
    const query = new URLSearchParams({
      text,
      country,
      lang:   "ar",
      limit:  "1",
      apiKey: GEOAPIFY_KEY,
    });
    const res = await fetch(`${BASE}?${query.toString()}`, {

      signal: abortTimeout(8_000) as unknown as never,

    });
    if (!res.ok) return null;

    const json = (await res.json()) as GeoapifyResponse;
    const feature = json.features?.[0];
    if (!feature) return null;

    const { lat, lon, confidence = 0 } = feature.properties;
    if (!lat || !lon) return null;

    return { lat, lng: lon, confidence };
  } catch {
    return null;
  }
}
