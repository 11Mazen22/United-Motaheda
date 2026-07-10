/**
 * role.ts — canonical application role model, single source of truth.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The 5-value role union (admin/manager/pharmacist/driver/customer) was
 * hand-duplicated across at least four places before this file existed:
 * the Postgres `app_role` enum (the real source of truth — this file does
 * not change it, only mirrors it), `AdminRole` in
 * apps/shopper-web/src/app/admin/adminShared.tsx, `SupabaseRole` in
 * StaffManager.tsx, and inline unions in UsersManager.tsx / adminUsersApi.ts.
 * This is the one place the set, its labels, and its hierarchy are defined.
 *
 * Unlike orderStatus.ts, this is deliberately NOT a transitions graph — a
 * role isn't a staged lifecycle an account moves through in one direction;
 * it's a flat set plus a rank used for "X and above" checks.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RANK MODEL — read this before using roleAtLeast()
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * admin > manager > {pharmacist, driver} > customer
 *
 * pharmacist and driver are deliberately equal rank, NOT ordered relative to
 * each other. Nothing in this app today expresses "pharmacist and above"
 * as implying driver access, or vice versa — the existing route guards
 * (AdminRouteProtection.tsx's PharmacistAndAbove vs. DriverOnly/OrdersAccess)
 * are hand-written explicit allow-lists specifically because pharmacist and
 * driver are separate specialties, not points on a single line. `roleAtLeast`
 * is only meaningful for comparisons against admin/manager/customer — any
 * new route gating pharmacist and/or driver access should use
 * `hasRolePermission(role, [...])` with an explicit list, exactly like every
 * existing route guard does, not a rank comparison.
 *
 * The database's own has_permission() is just is_manager() under the hood
 * (see database/20260705_fix_has_permission_rbac_crash.sql) — there is no
 * per-action permission matrix anywhere in this system today, so this file
 * does not invent one. hasRolePermission is a bare allow-list check, the
 * same power as the hasPermission() it replaces, just centralized.
 */

export const ROLE_VALUES = ["admin", "manager", "pharmacist", "driver", "customer"] as const;
export type Role = (typeof ROLE_VALUES)[number];

/** Every role except customer — the roles StaffManager onboards/manages. */
export const STAFF_ROLE_VALUES = ["admin", "manager", "pharmacist", "driver"] as const;
export type StaffRole = (typeof STAFF_ROLE_VALUES)[number];

export function isRole(value: string): value is Role {
  return (ROLE_VALUES as readonly string[]).includes(value);
}

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLE_VALUES as readonly string[]).includes(value);
}

/** Normalizes any raw role string to a known Role. Unknown/empty input
 * defaults to "customer" — never throws, since this runs on data from an
 * external source (matches normalizeOrderStatus's defensive shape). */
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

/** See the rank-model note above before using this outside the
 * admin/manager/customer spine. */
export const ROLE_RANK: Record<Role, number> = {
  customer: 0,
  driver: 1,
  pharmacist: 1,
  manager: 2,
  admin: 3,
};

export function roleAtLeast(role: Role | string | undefined | null, minimum: Role): boolean {
  if (!role || !isRole(role)) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Named role-group constants — single source for every "X and above" list
 * that used to be hand-typed per call site. */
export const ADMIN_ONLY_ROLES: readonly Role[] = ["admin"];
export const MANAGER_AND_ABOVE_ROLES: readonly Role[] = ["admin", "manager"];
export const PHARMACIST_AND_ABOVE_ROLES: readonly Role[] = ["admin", "manager", "pharmacist"];
export const STAFF_ROLES_LIST: readonly Role[] = ["admin", "manager", "pharmacist", "driver"];

export function hasRolePermission(
  role: Role | string | undefined | null,
  allowed: readonly Role[],
): boolean {
  if (!role) return false;
  return (allowed as readonly string[]).includes(role);
}
