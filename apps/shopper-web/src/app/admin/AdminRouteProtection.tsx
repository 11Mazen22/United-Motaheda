import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  ADMIN_ONLY_ROLES,
  MANAGER_AND_ABOVE_ROLES,
  PHARMACIST_AND_ABOVE_ROLES,
  STAFF_ROLES_LIST,
} from "@pharmacy/contracts";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { type AdminRole, AdminUnauthorized, hasPermission } from "./adminShared";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdminRouteProtectionProps {
  allowedRoles: AdminRole[];
  redirectTo?: string | false;
  children: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminRouteProtection({
  allowedRoles,
  redirectTo = "/admin",
  children,
}: AdminRouteProtectionProps) {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = (user.role ?? "customer") as AdminRole;

  if (userRole === "customer") {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(userRole, allowedRoles)) {
    if (redirectTo === false) {
      return <AdminUnauthorized lang={lang} />;
    }
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function AdminOnly({ children }: { children: ReactNode }) {
  return <AdminRouteProtection allowedRoles={[...ADMIN_ONLY_ROLES]}>{children}</AdminRouteProtection>;
}

export function ManagerAndAbove({ children }: { children: ReactNode }) {
  return <AdminRouteProtection allowedRoles={[...MANAGER_AND_ABOVE_ROLES]}>{children}</AdminRouteProtection>;
}

export function PharmacistAndAbove({ children }: { children: ReactNode }) {
  return <AdminRouteProtection allowedRoles={[...PHARMACIST_AND_ABOVE_ROLES]}>{children}</AdminRouteProtection>;
}

export function StaffOnly({ children }: { children: ReactNode }) {
  return <AdminRouteProtection allowedRoles={[...STAFF_ROLES_LIST]}>{children}</AdminRouteProtection>;
}

export function DriverOnly({ children }: { children: ReactNode }) {
  return <AdminRouteProtection allowedRoles={["driver"]} redirectTo="/admin/orders">{children}</AdminRouteProtection>;
}

/** New: Orders page access (admin, manager, driver only) */
export function OrdersAccess({ children }: { children: ReactNode }) {
  return <AdminRouteProtection allowedRoles={["admin", "manager", "driver"]}>{children}</AdminRouteProtection>;
}