/**
 * adminShared.tsx
 * Centralised shared components for the admin system — v3 redesign.
 * Pure light mode: clean white backgrounds, refined shadows, professional typography.
 */

import {
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import {
  type ComponentType,
  type ReactNode,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
export { useDebouncedValue } from "../hooks/useDebouncedValue";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../components/UI";

// ─── Role types & helpers ──────────────────────────────────────────────────────

export type AdminRole =
  | "admin"
  | "manager"
  | "pharmacist"
  | "driver"
  | "customer";

export function hasPermission(
  userRole: AdminRole | undefined,
  allowedRoles: AdminRole[],
): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
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
  icon?: ComponentType<{ className?: string }>;
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
