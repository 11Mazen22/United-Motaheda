/**
 * Single source of truth for the MapTiler API key.
 *
 * Replaces Geoapify (see git history) across geocoding, autocomplete, and
 * map tiles — same rationale that produced the old geoapifyConfig.ts: one
 * shared constant so a key rotation or provider swap never has to be
 * repeated across geocoding.ts, placesApi.ts, and LeafletMap.tsx separately.
 */
export const MAPTILER_KEY =
  process.env.EXPO_PUBLIC_MAPTILER_KEY ?? "QrLZWoUCSARVeuDA8fc1";
