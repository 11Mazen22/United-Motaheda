/**
 * Accounts created without a display name (e.g. straight email sign-up)
 * otherwise show a generic "User" placeholder everywhere a name is
 * rendered. Derive something real from the email's local part instead
 * ("edrakmaze@..." -> "Edrakmaze") so it reads as "no name set yet"
 * rather than broken.
 */
export function displayNameFromEmail(email: string | null | undefined): string | null {
  const local = email?.split("@")[0];
  if (!local) return null;
  return local
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ") || null;
}
