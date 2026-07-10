/**
 * adminShared.tsx
 * Centralised shared components for the admin system — v3 redesign.
 * Pure light mode: clean white backgrounds, refined shadows, professional typography.
 */

import {
  ArrowPathIcon,
  CheckBadgeIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LockClosedIcon,
  LockOpenIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
export { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { cn } from "../components/UI";
import type { Role } from "@pharmacy/contracts";
import {
  fetchAuditLog,
  fetchLastSignInBatch,
  getSuspensionHistory,
  type AuditLogEntry,
  type LastSignInInfo,
} from "../../services/adminUsersApi";
import { hasRolePermission } from "@pharmacy/contracts";

// ─── Role types & helpers ──────────────────────────────────────────────────────
// Canonical definition lives in @pharmacy/contracts/src/role.ts — re-exported
// here as AdminRole/hasPermission so every existing importer in this admin
// panel keeps working unchanged.

export type { Role as AdminRole };

export function hasPermission(
  userRole: Role | undefined,
  allowedRoles: Role[],
): boolean {
  return hasRolePermission(userRole, allowedRoles);
}

// ─── AdminUnauthorized ────────────────────────────────────────────────────────

export function AdminUnauthorized({
  lang = "en",
  message,
}: {
  lang?: "ar" | "en";
  message?: string;
}) {
  const navigate = useNavigate();
  const defaultMsg =
    lang === "ar"
      ? "ليس لديك الصلاحية للوصول إلى هذه الصفحة."
      : "You don't have permission to access this page.";

  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-8">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-50 shadow-sm ring-1 ring-slate-200">
          <ShieldExclamationIcon className="h-11 w-11 text-slate-400" />
        </div>
      </div>

      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        {lang === "ar" ? "وصول مرفوض" : "Access Denied"}
      </div>

      <h2 className="text-3xl font-bold tracking-tight text-slate-800">
        {lang === "ar" ? "غير مصرح" : "Unauthorized"}
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-7 text-slate-500">
        {message ?? defaultMsg}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 active:scale-95"
        >
          {lang === "ar" ? "لوحة التحكم" : "Go to Dashboard"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95"
        >
          {lang === "ar" ? "العودة للمتجر" : "Back to Store"}
        </button>
      </div>
    </div>
  );
}

// ─── AdminRoleGuard ───────────────────────────────────────────────────────────

export function AdminRoleGuard({
  userRole,
  allowedRoles,
  lang = "en",
  fallback,
  children,
}: {
  userRole: AdminRole | undefined;
  allowedRoles: AdminRole[];
  lang?: "ar" | "en";
  fallback?: ReactNode;
  children: ReactNode;
}) {
  if (!hasPermission(userRole, allowedRoles)) {
    return <>{fallback ?? <AdminUnauthorized lang={lang} />}</>;
  }
  return <>{children}</>;
}

// ─── AdminPageShell ───────────────────────────────────────────────────────────

export function AdminPageShell({
  userRole,
  allowedRoles,
  lang = "en",
  children,
}: {
  userRole: AdminRole | undefined;
  allowedRoles: AdminRole[];
  lang?: "ar" | "en";
  children: ReactNode;
}) {
  return (
    <AdminRoleGuard userRole={userRole} allowedRoles={allowedRoles} lang={lang}>
      {children}
    </AdminRoleGuard>
  );
}

// ─── Pagination helper ────────────────────────────────────────────────────────

function buildPaginationItems(
  currentPage: number,
  totalPages: number,
): (number | string)[] {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "end-ellipsis", totalPages];
  if (currentPage >= totalPages - 3)
    return [
      1, "start-ellipsis",
      totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1,
      totalPages,
    ];
  return [
    1, "start-ellipsis",
    currentPage - 1, currentPage, currentPage + 1,
    "end-ellipsis", totalPages,
  ];
}

// ─── AdminErrorBanner ─────────────────────────────────────────────────────────

export function AdminErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
        <ExclamationCircleIcon className="h-3.5 w-3.5 text-red-500" />
      </div>
      <p className="text-sm font-medium text-red-700">{message}</p>
    </div>
  );
}

// ─── AdminMetricCard ──────────────────────────────────────────────────────────

interface ToneConfig {
  gradient: string;
  iconBg: string;
  iconShadow: string;
  iconColor: string;
  valueColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  barColor: string;
  glowColor: string;
}

const METRIC_TONES: Record<string, ToneConfig> = {
  slate:   { gradient: "from-slate-600 to-slate-700",   iconBg: "rgba(100,116,139,0.12)", iconShadow: "rgba(100,116,139,0.3)",  iconColor: "#475569", valueColor: "#1e293b", badgeBg: "#f8fafc", badgeText: "#64748b", badgeBorder: "#e2e8f0", barColor: "#64748b",  glowColor: "rgba(100,116,139,0.08)" },
  teal:    { gradient: "from-teal-600 to-emerald-700",  iconBg: "rgba(14,126,116,0.12)",  iconShadow: "rgba(14,126,116,0.35)", iconColor: "#0E7E74", valueColor: "#134e4a", badgeBg: "#f0fdfa", badgeText: "#0f766e", badgeBorder: "#99f6e4", barColor: "#0E7E74",  glowColor: "rgba(14,126,116,0.06)"  },
  blue:    { gradient: "from-blue-600 to-indigo-700",   iconBg: "rgba(59,130,246,0.12)",  iconShadow: "rgba(59,130,246,0.3)",  iconColor: "#2563eb", valueColor: "#1e3a8a", badgeBg: "#eff6ff", badgeText: "#1d4ed8", badgeBorder: "#93c5fd", barColor: "#3b82f6",  glowColor: "rgba(59,130,246,0.06)"  },
  amber:   { gradient: "from-amber-500 to-orange-600",  iconBg: "rgba(245,158,11,0.12)",  iconShadow: "rgba(245,158,11,0.3)",  iconColor: "#d97706", valueColor: "#78350f", badgeBg: "#fffbeb", badgeText: "#b45309", badgeBorder: "#fcd34d", barColor: "#f59e0b",  glowColor: "rgba(245,158,11,0.06)"  },
  emerald: { gradient: "from-emerald-600 to-green-700", iconBg: "rgba(16,185,129,0.12)",  iconShadow: "rgba(16,185,129,0.3)",  iconColor: "#059669", valueColor: "#14532d", badgeBg: "#ecfdf5", badgeText: "#047857", badgeBorder: "#6ee7b7", barColor: "#10b981",  glowColor: "rgba(16,185,129,0.06)"  },
  rose:    { gradient: "from-rose-600 to-pink-700",     iconBg: "rgba(244,63,94,0.12)",   iconShadow: "rgba(244,63,94,0.3)",   iconColor: "#e11d48", valueColor: "#881337", badgeBg: "#fff1f2", badgeText: "#be123c", badgeBorder: "#fda4af", barColor: "#f43f5e",  glowColor: "rgba(244,63,94,0.06)"   },
  violet:  { gradient: "from-violet-600 to-purple-700", iconBg: "rgba(139,92,246,0.12)",  iconShadow: "rgba(139,92,246,0.3)",  iconColor: "#7c3aed", valueColor: "#3b0764", badgeBg: "#f5f3ff", badgeText: "#6d28d9", badgeBorder: "#c4b5fd", barColor: "#8b5cf6",  glowColor: "rgba(139,92,246,0.06)"  },
  sky:     { gradient: "from-sky-500 to-cyan-600",      iconBg: "rgba(14,165,233,0.12)",  iconShadow: "rgba(14,165,233,0.3)",  iconColor: "#0284c7", valueColor: "#0c4a6e", badgeBg: "#f0f9ff", badgeText: "#0369a1", badgeBorder: "#7dd3fc", barColor: "#0ea5e9",  glowColor: "rgba(14,165,233,0.06)"  },
  purple:  { gradient: "from-purple-600 to-fuchsia-700",iconBg: "rgba(168,85,247,0.12)",  iconShadow: "rgba(168,85,247,0.3)",  iconColor: "#9333ea", valueColor: "#4a044e", badgeBg: "#fdf4ff", badgeText: "#7e22ce", badgeBorder: "#d8b4fe", barColor: "#a855f7",  glowColor: "rgba(168,85,247,0.06)"  },
};

export function AdminMetricCard({
  label,
  value,
  note,
  trend,
  icon: Icon,
  tone = "slate",
  className,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  trend?: string;
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>;
  tone?: "slate" | "teal" | "blue" | "amber" | "emerald" | "rose" | "violet" | "sky" | "purple" | string;
  className?: string;
}) {
  const resolvedKey = Object.keys(METRIC_TONES).find((k) => tone.startsWith(k)) ?? "slate";
  const t = METRIC_TONES[resolvedKey];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        className,
      )}
      style={{ boxShadow: `0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)` }}
    >
      {/* Top accent bar with gradient */}
      <div
        className={cn("absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r", t.gradient)}
      />

      {/* Ambient background glow from accent */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: `radial-gradient(ellipse 80% 60% at 10% 0%, ${t.glowColor}, transparent)` }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            {label}
          </p>
          {Icon && (
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: t.iconBg, boxShadow: `0 4px 12px ${t.iconShadow}` }}
            >
              <Icon className="h-5 w-5" style={{ color: t.iconColor }} />
            </span>
          )}
        </div>

        <p className="mt-3 text-3xl font-black tracking-tight" style={{ color: t.valueColor }}>
          {value}
        </p>

        {note && (
          <p className="mt-1 text-sm font-medium text-slate-400">{note}</p>
        )}

        {trend && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold"
            style={{ backgroundColor: t.badgeBg, color: t.badgeText, borderColor: t.badgeBorder }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.barColor }} />
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AdminSectionCard ─────────────────────────────────────────────────────────

export function AdminSectionCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  accent = "teal",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: "teal" | "blue" | "amber" | "violet" | "rose" | "sky";
}) {
  const accentColors = {
    teal:   { bar: "#0E7E74", label: "#0f766e", dot: "#0E7E74" },
    blue:   { bar: "#3b82f6", label: "#1d4ed8", dot: "#3b82f6" },
    amber:  { bar: "#f59e0b", label: "#b45309", dot: "#f59e0b" },
    violet: { bar: "#8b5cf6", label: "#6d28d9", dot: "#8b5cf6" },
    rose:   { bar: "#f43f5e", label: "#be123c", dot: "#f43f5e" },
    sky:    { bar: "#0ea5e9", label: "#0369a1", dot: "#0ea5e9" },
  };
  const ac = accentColors[accent] ?? accentColors.teal;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
    >
      <div
        className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6"
        style={{ borderColor: "rgba(0,0,0,0.05)", backgroundColor: "rgba(248,250,252,0.6)" }}
      >
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 inline-flex items-center gap-2">
              <span className="h-1 w-5 rounded-full" style={{ backgroundColor: ac.bar }} />
              <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: ac.label }}>
                {eyebrow}
              </p>
            </div>
          )}
          <h3 className="text-lg font-black tracking-tight text-slate-800">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-sm font-medium text-slate-500">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      <div className={cn("px-4 py-4 md:px-6 md:py-5", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

// ─── AdminSearchField ─────────────────────────────────────────────────────────

export function AdminSearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <MagnifyingGlassIcon className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-10 w-full rounded-lg border border-slate-200 bg-white ps-9 pe-3",
          "text-sm text-slate-700 outline-none",
          "placeholder:text-slate-400",
          "transition-all duration-150",
          "focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10",
        )}
      />
    </div>
  );
}

// ─── AdminTableSkeleton ───────────────────────────────────────────────────────

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-white p-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32 rounded-full bg-slate-100" />
              <Skeleton className="h-3 w-48 rounded-full bg-slate-100" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 shrink-0 rounded-md bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ─── AdminEmptyState ──────────────────────────────────────────────────────────

export function AdminEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-slate-200 bg-slate-50/30 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white">
        <svg
          className="h-6 w-6 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.75 7.5h16.5M12 3h.008v.008H12V3z"
          />
        </svg>
      </div>

      <p className="text-base font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

// ─── AdminPaginationBar ───────────────────────────────────────────────────────

export function AdminPaginationBar({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  lang,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  lang: "ar" | "en";
  onPageChange: (page: number) => void;
}) {
  const items = useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );
  const start = totalItems ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const end = totalItems ? Math.min(currentPage * itemsPerPage, totalItems) : 0;

  if (totalItems <= 0) return null;

  const btnBase = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50";
  const btnActive = "border-teal-500 bg-teal-50 text-teal-700";

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <p className="text-xs text-slate-500">
        {lang === "ar"
          ? `عرض ${start}–${end} من ${totalItems}`
          : `Showing ${start}–${end} of ${totalItems}`}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={btnBase}
        >
          {lang === "ar" ? "قبل" : "Prev"}
        </button>
        {items.map((item, idx) =>
          typeof item !== "number" ? (
            <span
              key={`${item}-${idx}`}
              className="inline-flex h-8 w-8 items-center justify-center text-sm text-slate-400"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === currentPage ? "page" : undefined}
              className={cn(btnBase, item === currentPage && btnActive)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={btnBase}
        >
          {lang === "ar" ? "بعد" : "Next"}
        </button>
      </div>
    </div>
  );
}

// ─── AdminTabBar ──────────────────────────────────────────────────────────────

export function AdminTabBar<T extends string>({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto", className)} role="tablist">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-bold transition-colors",
              active
                ? "border-teal-200 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black",
                  active ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── AdminFilterChip ──────────────────────────────────────────────────────────

export function AdminFilterChip({
  label,
  onRemove,
  tone = "slate",
}: {
  label: string;
  onRemove?: () => void;
  tone?: "slate" | "teal" | "amber" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  } as const;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold", tones[tone])}>
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/5 text-current transition-colors hover:bg-black/10"
          aria-label={label}
        >
          ×
        </button>
      )}
    </span>
  );
}

// ─── AdminFormField ───────────────────────────────────────────────────────────

export function AdminFormField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  dir,
  readOnly,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  readOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ms-1 text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        dir={dir}
        readOnly={readOnly}
        disabled={disabled}
        className={cn(
          "h-10 w-full rounded-lg border border-slate-200 bg-white px-3",
          "text-sm text-slate-700 outline-none",
          "transition-all duration-150",
          "placeholder:text-slate-400",
          "focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10",
          "read-only:bg-slate-50 read-only:text-slate-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
    </div>
  );
}

// ─── AdminConfirmDialog ───────────────────────────────────────────────────────
// Generic confirm shell for every new simple admin action (role change,
// lock/unlock, reset sessions, activate/deactivate). Does NOT replace
// SuspendDialog/DeleteUserDialog — those have rich bespoke content (policy
// picker, duration type) and already work; rewriting them would be pure
// risk for no gain. This is the target for anything that's just
// "are you sure?" plus an optional type-to-confirm safeguard.

const CONFIRM_TONE = {
  danger:  { icon: ExclamationTriangleIcon, iconBg: "bg-rose-100",   iconColor: "text-rose-600",   btn: "bg-rose-600 hover:bg-rose-700" },
  warning: { icon: ExclamationTriangleIcon, iconBg: "bg-amber-100",  iconColor: "text-amber-600",  btn: "bg-amber-600 hover:bg-amber-700" },
  info:    { icon: InformationCircleIcon,   iconBg: "bg-teal-100",   iconColor: "text-teal-700",   btn: "bg-teal-600 hover:bg-teal-700" },
} as const;

export function AdminConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  tone = "info",
  confirmLabel,
  cancelLabel,
  typeToConfirmText,
  lang = "en",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: ReactNode;
  tone?: "danger" | "warning" | "info";
  confirmLabel?: string;
  cancelLabel?: string;
  /** If set, the confirm button stays disabled until the user types this
   * exact string — mirrors DeleteUserDialog's type-to-confirm safeguard. */
  typeToConfirmText?: string;
  lang?: "ar" | "en";
}) {
  const isArabic = lang === "ar";
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const t = CONFIRM_TONE[tone];
  const Icon = t.icon;

  useEffect(() => {
    if (!open) { setTyped(""); setLoading(false); }
  }, [open]);

  const canConfirm = !typeToConfirmText || typed.trim() === typeToConfirmText;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", t.iconBg)}>
              <Icon className={cn("h-5 w-5", t.iconColor)} />
            </span>
            <DialogTitle className="text-lg font-black text-slate-900">{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm text-slate-600">{description}</DialogDescription>
        </DialogHeader>

        {typeToConfirmText && (
          <div className="pt-1">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              {isArabic
                ? `اكتب "${typeToConfirmText}" للتأكيد`
                : `Type "${typeToConfirmText}" to confirm`}
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelLabel ?? (isArabic ? "إلغاء" : "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm || loading}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
              t.btn,
            )}
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {confirmLabel ?? (isArabic ? "تأكيد" : "Confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AdminAuditTimeline ───────────────────────────────────────────────────────
// Renders public.admin_audit_log rows (via fetchAuditLog) — this table was
// write-only before this redesign; nothing anywhere read it.

const AUDIT_ACTION_META: Record<string, { ar: string; en: string; icon: ComponentType<{ className?: string }>; tone: string }> = {
  change_role:     { ar: "تغيير الصلاحية",   en: "Role changed",        icon: ShieldCheckIcon,        tone: "text-teal-700 bg-teal-100" },
  change_status:   { ar: "تغيير الحالة",     en: "Status changed",      icon: ArrowPathIcon,          tone: "text-blue-700 bg-blue-100" },
  suspend_user:     { ar: "تعليق الحساب",     en: "Account suspended",   icon: ShieldExclamationIcon,  tone: "text-rose-700 bg-rose-100" },
  unsuspend_user:   { ar: "رفع التعليق",      en: "Suspension removed",  icon: CheckBadgeIcon,         tone: "text-emerald-700 bg-emerald-100" },
  delete_user:      { ar: "حذف الحساب",       en: "Account deleted",     icon: TrashIcon,              tone: "text-red-700 bg-red-100" },
  lock_account:     { ar: "قفل الحساب",       en: "Account locked",      icon: LockClosedIcon,         tone: "text-amber-700 bg-amber-100" },
  unlock_account:   { ar: "فتح قفل الحساب",   en: "Account unlocked",    icon: LockOpenIcon,           tone: "text-emerald-700 bg-emerald-100" },
  reset_sessions:   { ar: "إعادة تعيين الجلسات", en: "Sessions reset",  icon: ArrowPathIcon,           tone: "text-blue-700 bg-blue-100" },
  create_staff:     { ar: "إضافة موظف",       en: "Staff created",      icon: UserPlusIcon,           tone: "text-teal-700 bg-teal-100" },
};

function getAuditActionMeta(action: string) {
  return (
    AUDIT_ACTION_META[action] ?? {
      ar: action, en: action, icon: InformationCircleIcon, tone: "text-slate-700 bg-slate-100",
    }
  );
}

export function AdminAuditTimeline({
  entries,
  lang,
  loading,
  emptyLabel,
}: {
  entries: AuditLogEntry[];
  lang: "ar" | "en";
  loading?: boolean;
  emptyLabel?: string;
}) {
  const isArabic = lang === "ar";

  if (loading) return <AdminTableSkeleton rows={3} />;

  if (!entries.length) {
    return (
      <AdminEmptyState
        title={emptyLabel ?? (isArabic ? "لا يوجد سجل بعد" : "No history yet")}
      />
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const meta = getAuditActionMeta(entry.action);
        const Icon = meta.icon;
        const details = entry.details;
        return (
          <li key={entry.id} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3">
            <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.tone)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-bold text-slate-800">{isArabic ? meta.ar : meta.en}</p>
                <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <ClockIcon className="h-3 w-3" />
                  {new Date(entry.createdAt).toLocaleString(isArabic ? "ar-EG" : "en-GB", {
                    dateStyle: "medium", timeStyle: "short",
                  })}
                </div>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {isArabic ? "بواسطة" : "by"} {entry.adminName}
              </p>
              {details && Object.keys(details).length > 0 && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-400 hover:text-slate-600">
                    {isArabic ? "تفاصيل إضافية" : "Details"}
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── AdminBulkActionBar ───────────────────────────────────────────────────────
// Wires a selection count to real bulk mutations. Deliberately status-only
// actions (activate/deactivate/suspend/restore) — no bulk role-change, no
// bulk lock, no bulk delete: high-consequence, low-value complexity for the
// account volumes this admin panel manages today.

export interface AdminBulkAction {
  key: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "default" | "danger";
  onClick: () => void;
}

export function AdminBulkActionBar({
  selectedCount,
  actions,
  onClear,
  lang,
}: {
  selectedCount: number;
  actions: AdminBulkAction[];
  onClear: () => void;
  lang: "ar" | "en";
}) {
  if (selectedCount <= 0) return null;
  const isArabic = lang === "ar";

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-teal-50 px-4 py-2.5 md:px-6">
      <span className="text-sm font-bold text-teal-700">
        {isArabic ? `${selectedCount} محدد` : `${selectedCount} selected`}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              onClick={a.onClick}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition",
                a.tone === "danger"
                  ? "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                  : "border-teal-200 bg-white text-teal-700 hover:bg-teal-50",
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {a.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {isArabic ? "إلغاء التحديد" : "Deselect"}
        </button>
      </div>
    </div>
  );
}

// ─── AdminDetailDrawer ────────────────────────────────────────────────────────
// Smart side-panel keyed by userId — owns its own fetch of the data the
// caller's list view doesn't already have (last-sign-in/verification, audit
// history, suspension history). Both StaffManager and UsersManager render
// one line each to get the same rich detail view; this is the mechanism
// that ends duplicated per-page detail logic.

export interface AdminDetailDrawerSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  createdAt?: string;
}

export function AdminDetailDrawer({
  open,
  onClose,
  summary,
  lang,
  roleLabel,
  statusBadge,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  summary: AdminDetailDrawerSummary | null;
  lang: "ar" | "en";
  /** Pre-resolved role label — the caller already owns role-label logic
   * (StaffManager/UsersManager each have their own canonical-role-aware
   * label lookup), so this stays presentational rather than re-deriving it. */
  roleLabel: string;
  /** Pre-rendered status badge (color/label already resolved by caller). */
  statusBadge?: ReactNode;
  /** Row of action buttons (change role, suspend, lock, etc.) — the caller
   * owns which actions are available and their handlers. */
  actions?: ReactNode;
}) {
  const isArabic = lang === "ar";
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [lastSignIn, setLastSignIn] = useState<LastSignInInfo | undefined>(undefined);
  const [suspensionHistory, setSuspensionHistory] = useState<Awaited<ReturnType<typeof getSuspensionHistory>>>([]);

  useEffect(() => {
    if (!open || !summary?.id) return;
    let cancelled = false;
    setAuditLoading(true);

    void (async () => {
      try {
        const [auditResult, signInMap, suspensions] = await Promise.all([
          fetchAuditLog(summary.id, { page: 1, perPage: 10 }),
          fetchLastSignInBatch([summary.id]),
          getSuspensionHistory(summary.id).catch(() => []),
        ]);
        if (cancelled) return;
        setAuditEntries(auditResult.entries);
        setLastSignIn(signInMap.get(summary.id));
        setSuspensionHistory(suspensions);
      } catch {
        // Detail panel is supplementary — a fetch failure here shouldn't
        // block the rest of the admin page.
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, summary?.id]);

  if (!summary) return null;

  const fmtDate = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString(isArabic ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" })
      : (isArabic ? "لم يسجّل الدخول بعد" : "Never signed in");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-black text-white shadow-sm"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              {(summary.fullName || summary.email || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">{summary.fullName || (isArabic ? "بدون اسم" : "No name")}</SheetTitle>
              <SheetDescription className="truncate" dir="ltr">{summary.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {/* Identity summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {isArabic ? "الدور" : "Role"}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">{roleLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {isArabic ? "الحالة" : "Status"}
              </p>
              <div className="mt-1">{statusBadge}</div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {isArabic ? "الهاتف" : "Phone"}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800" dir="ltr">{summary.phone || "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {isArabic ? "تاريخ الانضمام" : "Joined"}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">{fmtDate(summary.createdAt)}</p>
            </div>
          </div>

          {/* Activity */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              {isArabic ? "آخر نشاط" : "Activity"}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800">{fmtDate(lastSignIn?.lastSignInAt)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {lastSignIn?.emailConfirmedAt
                ? (isArabic ? "البريد الإلكتروني موثّق" : "Email verified")
                : (isArabic ? "البريد الإلكتروني غير موثّق" : "Email not verified")}
            </p>
          </div>

          {/* Actions */}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

          {/* Suspension history */}
          {suspensionHistory.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-800">
                {isArabic ? "سجل التعليق" : "Suspension history"}
              </p>
              <ol className="space-y-2">
                {suspensionHistory.map((s) => (
                  <li key={s.id} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                    <p className="text-xs font-bold text-rose-700">{s.reasonCodes.join(", ")}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{fmtDate(s.suspendedAt)}</p>
                    {s.adminNotes && <p className="mt-1 text-xs text-slate-600">{s.adminNotes}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Audit history */}
          <div>
            <p className="mb-2 text-sm font-bold text-slate-800">
              {isArabic ? "سجل التدقيق" : "Audit history"}
            </p>
            <AdminAuditTimeline entries={auditEntries} lang={lang} loading={auditLoading} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
