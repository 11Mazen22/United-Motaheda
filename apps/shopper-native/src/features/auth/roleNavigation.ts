import type { Role } from "./role";

export type AppExperience = "customer" | "driver" | "pharmacist";
export type RoleHomeRoute = "/(customer)/(tabs)" | "/(driver)" | "/(pharmacist)";
/** Guest/customer shell after sign-out (lazy auth — login lives under profile). */
export const SIGNED_OUT_HOME_ROUTE: RoleHomeRoute = "/(customer)/(tabs)";
/** Single routing authority — index.tsx reads the live server role and navigates once. */
export const AUTH_ROUTING_ENTRY = "/" as const;

/**
 * Keep role-to-experience routing in one place. Admins and managers use the
 * staff/pharmacist workspace in the native app; unknown roles fail closed to
 * the customer experience, matching normalizeRole().
 */
export function getAppExperience(role: Role | null | undefined): AppExperience {
  if (role === "driver") return "driver";
  if (role === "pharmacist" || role === "admin" || role === "manager") {
    return "pharmacist";
  }
  return "customer";
}

export function getRoleHomeRoute(role: Role | null | undefined): RoleHomeRoute {
  const experience = getAppExperience(role);
  if (experience === "driver") return "/(driver)";
  if (experience === "pharmacist") return "/(pharmacist)";
  return "/(customer)/(tabs)";
}

/** True when the signed-in user should leave the customer tab experience. */
export function shouldLeaveCustomerExperience(role: Role | null | undefined): boolean {
  return getAppExperience(role) !== "customer";
}

/** True when the signed-in user should leave the driver section. */
export function shouldLeaveDriverExperience(
  role: Role | null | undefined,
  hasLiveDriverProfile: boolean,
): boolean {
  return role !== "driver" || !hasLiveDriverProfile;
}

/** True when the signed-in user should leave the pharmacist section. */
export function shouldLeavePharmacistExperience(role: Role | null | undefined): boolean {
  const experience = getAppExperience(role);
  return experience !== "pharmacist";
}
