import { abortTimeout } from "@/utils/timeout";
import { MAPTILER_KEY } from "@/lib/maptilerConfig";

/**
 *
 * Used when saving a delivery address so coordinates are stored
 * and fed into the Railway /delivery/quote zone-polygon engine.
 *
 * Docs: https://docs.maptiler.com/cloud/api/geocoding/
 */

const BASE = "https://api.maptiler.com/geocoding";

// Cairo-area bounding box (west,south,east,north) — same box the old
// Geoapify integration used (`rect:30.70,29.78,31.90,30.28`), reordered to
// MapTiler's minLon,minLat,maxLon,maxLat convention. Narrows results to the
// app's actual delivery area instead of letting a bare place name like
// "gardenia" resolve to Brazil — confirmed live via curl.
const CAIRO_BBOX = "30.70,29.78,31.90,30.28";

export interface GeocodedCoords {
  lat: number;
  lng: number;
  confidence: number; // 0–1, lower = less reliable
}

interface MapTilerFeature {
  place_name: string;
  place_type: string[];
  relevance?: number;
  center: [number, number]; // [lng, lat]
  text: string;
  context?: Array<{ id: string; text: string; kind?: string }>;
}

interface MapTilerResponse {
  features: MapTilerFeature[];
}

/**
 * Geocode a structured delivery address.
 *
 * Two-stage strategy for Egyptian addresses:
 *   Stage 1 — full text search (street + building + district + city).
 *             Most precise; works when MapTiler has the street indexed.
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
}): Promise<GeocodedCoords | null> {
  // Stage 1 — full address free-text (no type restriction)
  const stage1 = await _geocodeText(
    [params.street, params.building, params.district, params.city]
      .filter(Boolean)
      .join(" "),
  );
  if (stage1) return stage1;

  // Stage 2 — district + city only (coarser but almost always succeeds)
  const stage2 = await _geocodeText(
    [params.district, params.city].filter(Boolean).join(" "),
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

/**
 * Reverse-geocode GPS coordinates ("where am I") into a structured Egyptian
 * address. Used by "Use current location" instead of (or as a richer
 * upgrade over) the OS's on-device reverse geocoder — MapTiler's index is
 * current for Egyptian streets/districts and returns Arabic-language
 * results matching the rest of the address form.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodedAddress | null> {
  try {
    const query = new URLSearchParams({
      language: "ar",
      key:      MAPTILER_KEY,
    });
    const res = await fetch(`${BASE}/${lng},${lat}.json?${query.toString()}`, {
      signal: abortTimeout(8_000) as unknown as never,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as MapTilerResponse;
    const feature = json.features?.[0];
    if (!feature) return null;

    return {
      formatted:  feature.place_name ?? "",
      street:     extractStreet(feature),
      district:   extractDistrict(feature),
      city:       extractCity(feature),
      confidence: feature.relevance ?? 0,
    };
  } catch {
    return null;
  }
}

async function _geocodeText(text: string): Promise<GeocodedCoords | null> {
  if (!text.trim()) return null;
  try {
    const query = new URLSearchParams({
      language: "ar",
      country:  "eg",
      bbox:     CAIRO_BBOX,
      limit:    "1",
      key:      MAPTILER_KEY,
    });
    const res = await fetch(`${BASE}/${encodeURIComponent(text)}.json?${query.toString()}`, {
      signal: abortTimeout(8_000) as unknown as never,
    });
    if (!res.ok) return null;

    const json = (await res.json()) as MapTilerResponse;
    const feature = json.features?.[0];
    if (!feature) return null;

    const [lng, lat] = feature.center ?? [];
    if (lat == null || lng == null) return null;

    return { lat, lng, confidence: feature.relevance ?? 0 };
  } catch {
    return null;
  }
}

/** `place_type: ["address"]` results are street-level; anything else has no
 *  reliable street name in MapTiler's Egypt data. */
function extractStreet(feature: MapTilerFeature): string | null {
  return feature.place_type?.[0] === "address" ? feature.text : null;
}

/** The `place`-kind context entry (neighbourhood/suburb/locality) is the
 *  closest equivalent to Geoapify's `district`. Deliberately not "any entry
 *  that isn't admin_area" — confirmed live that some context entries (a
 *  postal code, a river, the continent) carry no `kind` at all or a
 *  non-place kind, and a negative filter matches those by accident (a
 *  Nasr City search came back with district = "Africa", the continent
 *  entry, since it has no `kind` field and so isn't "admin_area" either). */
function extractDistrict(feature: MapTilerFeature): string | null {
  return feature.context?.find((c) => c.kind === "place")?.text ?? null;
}

/** The nearest `admin_area` context entry is the governorate — same
 *  governorate-level granularity the old Geoapify `city` field used. */
function extractCity(feature: MapTilerFeature): string | null {
  return feature.context?.find((c) => c.kind === "admin_area")?.text ?? null;
}
