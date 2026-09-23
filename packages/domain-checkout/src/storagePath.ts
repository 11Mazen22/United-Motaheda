/** Private `receipts` bucket id — keep in sync with Supabase migrations. */
export const RECEIPTS_BUCKET = "receipts";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function validateObjectPath(value: string): string {
  const path = safeDecode(value)
    .split(/[?#]/, 1)[0]
    ?.replace(/^\/+/, "")
    .trim() ?? "";

  if (!path || path.includes("\\") || path.includes("\0")) return "";
  if (path.split("/").some((segment) => !segment || segment === "." || segment === "..")) return "";
  return path;
}

/**
 * Normalize `orders.payment_proof_url` values for storage API calls.
 * Same shape as @pharmacy/domain-prescriptions's normalizePrescriptionStoragePath
 * -- handles legacy/full URLs and accidental bucket-prefix duplication. A
 * value that isn't a recognizable object reference for this bucket (e.g. an
 * external test/placeholder URL) normalizes to "" rather than throwing, so
 * callers can render an explicit "unavailable" state instead of crashing.
 */
export function normalizeReceiptStoragePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    const marker = "/storage/v1/object/";
    const idx = trimmed.indexOf(marker);
    if (idx >= 0) {
      const tail = trimmed.slice(idx + marker.length);
      const publicPrefix = `public/${RECEIPTS_BUCKET}/`;
      const signedPrefix = `sign/${RECEIPTS_BUCKET}/`;
      const authPrefix = `authenticated/${RECEIPTS_BUCKET}/`;
      if (tail.startsWith(publicPrefix)) return validateObjectPath(tail.slice(publicPrefix.length));
      if (tail.startsWith(signedPrefix)) return validateObjectPath(tail.slice(signedPrefix.length));
      if (tail.startsWith(authPrefix)) return validateObjectPath(tail.slice(authPrefix.length));
    }
    const loose = trimmed.match(/\/receipts\/([^?]+)/i);
    if (loose?.[1]) return validateObjectPath(loose[1]);
    return "";
  }

  const bucketPrefix = `${RECEIPTS_BUCKET}/`;
  if (trimmed.startsWith(bucketPrefix)) return validateObjectPath(trimmed.slice(bucketPrefix.length));

  return validateObjectPath(trimmed);
}
