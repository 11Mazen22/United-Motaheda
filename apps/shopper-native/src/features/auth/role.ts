// Full canonical set (see packages/contracts/src/role.ts for the shared
// role model doc, rank rules, and reasoning — not imported directly here to
// avoid wiring this Expo app into the npm workspace's Metro resolution,
// same convention already used for order status in src/stores/orders.ts).
// Keep this file in sync by hand with packages/contracts/src/role.ts.

export const ROLE_VALUES = ["admin", "manager", "pharmacist", "driver", "customer"] as const;
export type Role = (typeof ROLE_VALUES)[number];

export function isRole(value: string): value is Role {
  return (ROLE_VALUES as readonly string[]).includes(value);
}

/** Normalizes any raw role string to a known Role. Unknown/empty input
 * defaults to "customer" — never throws, since this runs on data from an
 * external source. */
export function normalizeRole(value: string | null | undefined): Role {
  const v = String(value ?? "").trim().toLowerCase();
  return isRole(v) ? v : "customer";
}

export const ROLE_LABELS: Record<Role, { ar: string; en: string }> = {
  admin: { ar: "مدير النظام", en: "Admin" },
  manager: { ar: "مشرف", en: "Manager" },
  pharmacist: { ar: "صيدلي", en: "Pharmacist" },
  driver: { ar: "سائق", en: "Driver" },
  customer: { ar: "عميل", en: "Customer" },
};

export function getRoleLabel(role: Role, lang: "ar" | "en"): string {
  return ROLE_LABELS[role][lang];
}
