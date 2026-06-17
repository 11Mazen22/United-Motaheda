/**
 * Geoapify geocoding — converts a structured address to lat/lng.
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
 * Returns null if no reliable result is found.
 */
export async function geocodeAddress(params: {
  street:   string;
  building: string;
  district: string;
  city:     string;
  country?: string;
}): Promise<GeocodedCoords | null> {
  try {
    const query = new URLSearchParams({
      street:   `${params.street} ${params.building}`.trim(),
      district: params.district,
      city:     params.city,
      country:  params.country ?? "Egypt",
      lang:     "ar",
      limit:    "1",
      type:     "street",
      apiKey:   GEOAPIFY_KEY,
    });

    const res = await fetch(`${BASE}?${query.toString()}`, {
      signal: AbortSignal.timeout(6_000) as any,
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
