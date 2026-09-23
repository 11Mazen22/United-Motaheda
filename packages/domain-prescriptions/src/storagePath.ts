/** Private `prescriptions` bucket id — keep in sync with Supabase migrations. */
export const PRESCRIPTION_IMAGE_BUCKET = "prescriptions";

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
 * Normalize `prescriptions.image_path` values for storage API calls.
 * Handles legacy/full URLs and accidental bucket-prefix duplication.
 */
export function normalizePrescriptionStoragePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    const marker = "/storage/v1/object/";
    const idx = trimmed.indexOf(marker);
    if (idx >= 0) {
      const tail = trimmed.slice(idx + marker.length);
      const publicPrefix = `public/${PRESCRIPTION_IMAGE_BUCKET}/`;
      const signedPrefix = `sign/${PRESCRIPTION_IMAGE_BUCKET}/`;
      const authPrefix = `authenticated/${PRESCRIPTION_IMAGE_BUCKET}/`;
      if (tail.startsWith(publicPrefix)) return validateObjectPath(tail.slice(publicPrefix.length));
      if (tail.startsWith(signedPrefix)) return validateObjectPath(tail.slice(signedPrefix.length));
      if (tail.startsWith(authPrefix)) return validateObjectPath(tail.slice(authPrefix.length));
    }
    const loose = trimmed.match(/\/prescriptions\/([^?]+)/i);
    if (loose?.[1]) return validateObjectPath(loose[1]);
    return "";
  }

  const bucketPrefix = `${PRESCRIPTION_IMAGE_BUCKET}/`;
  if (trimmed.startsWith(bucketPrefix)) return validateObjectPath(trimmed.slice(bucketPrefix.length));

  return validateObjectPath(trimmed);
}
