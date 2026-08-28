/**
 * Safe locale-aware date formatting for prescription timestamps. Guards
 * against a missing/malformed value producing the literal string
 * "Invalid Date" -- confirmed live on real prescription cards before
 * PharmacistPrescription.addedAt was actually populated by the mapper.
 */
export function formatRxDate(iso: string | undefined | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale);
}

export function formatRxDateTime(iso: string | undefined | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale);
}
