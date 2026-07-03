/**
 * Shared idempotency key generator — UUID-v4, no dashes, 32-char hex.
 * Non-cryptographic; uniqueness suffices for server-side replay protection.
 */
export function newIdempotencyKey(): string {
  let out = "";
  for (let i = 0; i < 32; i++) {
    if (i === 12) { out += "4"; continue; }
    if (i === 16) { out += ((Math.floor(Math.random() * 16) & 0x3) | 0x8).toString(16); continue; }
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}
