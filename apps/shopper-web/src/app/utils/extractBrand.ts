/**
 * extractBrand.ts — Heuristic brand extraction from product names.
 *
 * The DB has no brand column, so we derive a brand-like token from the
 * English product name. Works well for pharma SKUs where the convention is
 * "BRAND_NAME DOSAGE FORM" (e.g. "ABILIFY 10 MG 10 TAB" → "ABILIFY").
 *
 * Heuristic:
 *   1. Split on whitespace
 *   2. Take the first 1-2 tokens that are NOT pure numbers,
 *      NOT pharma units (mg/ml/g/iu/tab/cap), NOT empty
 *   3. Stop after the first numeric token (dosage starts there)
 *   4. Fallback: first non-empty token
 */

const UNIT_TOKENS = new Set([
  // Pharma dosage units
  "mg", "ml", "g", "iu", "mcg", "kg",
  // Dosage forms
  "tab", "tabs", "tablet", "tablets",
  "cap", "caps", "capsule", "capsules",
  "amp", "ampoule", "ampoules",
  "vial", "vials",
  "syr", "syrup",
  "sus", "suspension",
  "drop", "drops",
  "cream", "ointment", "gel", "lotion",
  "patch", "patches",
  "sachet", "sachets",
  "spray", "foam", "powder", "soap", "solution", "emulsion",
  "serum", "tonic", "wash", "mask", "scrub", "balm", "oil",
  // Generic product-type words that are never brand names
  "brush", "loofah", "scissors", "shaving", "sponge", "towel",
  "drug", "generic", "face", "body", "hair", "hand", "eye", "lip",
  "baby", "men", "female",
  "+", "-",
]);

export function extractBrand(nameEn: string | undefined): string {
  if (!nameEn) return "";

  const tokens = nameEn
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\w+\-]/g, ""))
    .filter(Boolean);

  const brandTokens: string[] = [];
  for (const t of tokens) {
    // First numeric token → stop (dosage starts)
    if (/^\d/.test(t)) break;
    // Unit / form keywords → stop
    if (UNIT_TOKENS.has(t.toLowerCase())) break;
    brandTokens.push(t);
    if (brandTokens.length >= 2) break;
  }

  if (brandTokens.length === 0) {
    // Fallback: first alpha token that is also NOT a unit/form keyword.
    // Without the unit check we'd surface "ML" from "750 ML LOOFAH".
    const firstAlpha = tokens.find(
      (t) => /^[A-Za-z]/.test(t) && !UNIT_TOKENS.has(t.toLowerCase()),
    );
    return firstAlpha ?? "";
  }
  // Title-case the result for display
  return brandTokens
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(" ");
}

export function sameBrand(aNameEn: string | undefined, bNameEn: string | undefined): boolean {
  const a = extractBrand(aNameEn).toLowerCase();
  const b = extractBrand(bNameEn).toLowerCase();
  return a.length > 0 && a === b;
}
