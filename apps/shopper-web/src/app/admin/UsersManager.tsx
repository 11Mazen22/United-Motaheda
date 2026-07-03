import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowsUpDownIcon,
  CheckBadgeIcon,
  EllipsisVerticalIcon,
  FunnelIcon,
  ShieldExclamationIcon,
  TrashIcon,
  UserCircleIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "../components/UI";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { toast } from "sonner";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminMetricCard,
  AdminPaginationBar,
  AdminSearchField,
  AdminSectionCard,
  AdminTableSkeleton,
  useDebouncedValue,
} from "./adminShared";
import SuspendDialog from "./SuspendDialog";
import DeleteUserDialog from "./DeleteUserDialog";
import {
  fetchUsers,
  unsuspendUser,
  type AdminUser,
  type FetchUsersOptions,
} from "../../services/adminUsersApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "Active" | "Inactive" | "Suspended";
type RoleFilter = "all" | "customer" | "admin" | "manager" | "pharmacist" | "driver";
type SortField = "full_name" | "email" | "created_at" | "status" | "role";

interface UserCounts {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const STATUS_TABS: Array<{ key: StatusFilter; labelAr: string; labelEn: string }> = [
  { key: "all",       labelAr: "الكل",      labelEn: "All"       },
  { key: "Active",    labelAr: "نشط",       labelEn: "Active"    },
  { key: "Suspended", labelAr: "معلق",      labelEn: "Suspended" },
  { key: "Inactive",  labelAr: "غير نشط",   labelEn: "Inactive"  },
];

const ROLE_OPTIONS: Array<{ value: RoleFilter; labelAr: string; labelEn: string }> = [
  { value: "all",         labelAr: "جميع الأدوار",  labelEn: "All Roles"   },
  { value: "customer",    labelAr: "عميل",           labelEn: "Customer"    },
  { value: "admin",       labelAr: "مدير النظام",   labelEn: "Admin"       },
  { value: "manager",     labelAr: "مشرف",           labelEn: "Manager"     },
  { value: "pharmacist",  labelAr: "صيدلي",          labelEn: "Pharmacist"  },
  { value: "driver",      labelAr: "سائق",           labelEn: "Driver"      },
];

// ─── Avatar helper ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#0E7E74", "#0EA5E9", "#6366F1", "#F59E0B",
  "#EC4899", "#8B5CF6", "#10B981", "#EF4444",
];

function getAvatarColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function UserAvatar({ name, email = "", size = "md" }: { name: string; email?: string; size?: "sm" | "md" }) {
  const display = name || email;
  const initials = display
    ? display.split(name ? " " : "@").slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("").slice(0, 2)
    : "?";
  const color = getAvatarColor(display || "?");
  const cls = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg font-black text-white shadow-sm", cls)}
      style={{ backgroundColor: color }}
    >
      {initials || "?"}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, lang }: { status: string; lang: "ar" | "en" }) {
  const cfg: Record<string, { cls: string; labelAr: string; labelEn: string; dot: string }> = {
    Active:    { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", labelAr: "نشط",     labelEn: "Active"    },
    Inactive:  { cls: "border-amber-200 bg-amber-50 text-amber-700",       dot: "bg-amber-400",   labelAr: "غير نشط", labelEn: "Inactive"  },
    Suspended: { cls: "border-rose-200 bg-rose-50 text-rose-700",          dot: "bg-rose-500",    labelAr: "معلق",    labelEn: "Suspended" },
  };
  const { cls, dot, labelAr, labelEn } = cfg[status] ?? cfg.Inactive;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {lang === "ar" ? labelAr : labelEn}
    </span>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role, lang }: { role: string; lang: "ar" | "en" }) {
  const cfg: Record<string, { cls: string; labelAr: string; labelEn: string }> = {
    admin:      { cls: "border-teal-200 bg-teal-50 text-teal-700",       labelAr: "مدير",   labelEn: "Admin"      },
    manager:    { cls: "border-violet-200 bg-violet-50 text-violet-700", labelAr: "مشرف",   labelEn: "Manager"    },
    pharmacist: { cls: "border-blue-200 bg-blue-50 text-blue-700",       labelAr: "صيدلي",  labelEn: "Pharmacist" },
    driver:     { cls: "border-sky-200 bg-sky-50 text-sky-700",          labelAr: "سائق",   labelEn: "Driver"     },
    customer:   { cls: "border-slate-200 bg-slate-50 text-slate-600",    labelAr: "عميل",   labelEn: "Customer"   },
  };
  const { cls, labelAr, labelEn } = cfg[role] ?? cfg.customer;
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold", cls)}>
      {lang === "ar" ? labelAr : labelEn}
    </span>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowsUpDownIcon className="h-3.5 w-3.5 text-slate-300" />;
  return dir === "asc"
    ? <ArrowUpIcon className="h-3.5 w-3.5 text-teal-600" />
    : <ArrowDownIcon className="h-3.5 w-3.5 text-teal-600" />;
}

// ─── Unsuspend confirm dialog ─────────────────────────────────────────────────

function UnsuspendDialog({
  open,
  user,
  lang,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  user: AdminUser | null;
  lang: "ar" | "en";
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isArabic = lang === "ar";
  if (!user) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900">
            {isArabic ? "رفع التعليق" : "Remove Suspension"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            {isArabic
              ? `هل أنت متأكد من رفع تعليق حساب ${user.fullName}؟ سيتمكن من تسجيل الدخول فور تنفيذ هذا الإجراء.`
              : `Confirm removing suspension from ${user.fullName}? They will be able to sign in immediately after.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isArabic ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition"
            style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {isArabic ? "رفع التعليق" : "Remove Suspension"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UsersManager() {
  const { lang }  = useLanguage();
  const { user: adminUser } = useAuth();
  const isArabic  = lang === "ar";

  // ── Data state ──────────────────────────────────────────────────────────────
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [counts, setCounts]     = useState<UserCounts>({ total: 0, active: 0, suspended: 0, inactive: 0 });

  // ── Filter / sort state ─────────────────────────────────────────────────────
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 350);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter]     = useState<RoleFilter>("all");
  const [sortBy, setSortBy]   = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage]       = useState(1);

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Dialog state ────────────────────────────────────────────────────────────
  const [suspendTarget, setSuspendTarget]     = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget]       = useState<AdminUser | null>(null);
  const [unsuspendTarget, setUnsuspendTarget] = useState<AdminUser | null>(null);
  const [unsuspendLoading, setUnsuspendLoading] = useState(false);

  // ── Load users ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const opts: FetchUsersOptions = {
        page,
        perPage: ITEMS_PER_PAGE,
        search: search || undefined,
        statusFilter,
        roleFilter,
        sortBy,
        sortDir,
      };
      const result = await fetchUsers(opts);
      setUsers(result.users);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter, sortBy, sortDir]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, roleFilter, sortBy, sortDir]);

  // ── Load counts ─────────────────────────────────────────────────────────────
  const loadCounts = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("profiles")
        .select("status");
      if (data) {
        const active    = data.filter((r) => r.status === "Active").length;
        const suspended = data.filter((r) => r.status === "Suspended").length;
        const inactive  = data.filter((r) => r.status === "Inactive").length;
        setCounts({ total: data.length, active, suspended, inactive });
      }
    } catch {
      // counts are cosmetic — ignore errors
    }
  }, []);

  useEffect(() => { void loadCounts(); }, [loadCounts]);

  // ── Sort toggle ─────────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  // ── Selection ───────────────────────────────────────────────────────────────
  const allSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) users.forEach((u) => next.delete(u.id));
      else users.forEach((u) => next.add(u.id));
      return next;
    });
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // ── Unsuspend ────────────────────────────────────────────────────────────────
  const handleUnsuspendConfirm = async () => {
    if (!unsuspendTarget || !adminUser) return;
    setUnsuspendLoading(true);
    try {
      await unsuspendUser(unsuspendTarget.id, adminUser.id, adminUser.email);
      toast.success(isArabic ? `تم رفع تعليق ${unsuspendTarget.fullName}` : `Suspension removed for ${unsuspendTarget.fullName}`);
      setUnsuspendTarget(null);
      startTransition(() => { void loadUsers(); void loadCounts(); });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unsuspend user");
    } finally {
      setUnsuspendLoading(false);
    }
  };

  // ── Status tab counts ────────────────────────────────────────────────────────
  const tabCounts: Record<StatusFilter, number> = useMemo(() => ({
    all:       counts.total,
    Active:    counts.active,
    Suspended: counts.suspended,
    Inactive:  counts.inactive,
  }), [counts]);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const hasFilters = statusFilter !== "all" || roleFilter !== "all" || rawSearch.length > 0;

  return (
    <div className="space-y-6">

      {/* ── Metric cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label={isArabic ? "إجمالي المستخدمين" : "Total Users"}
          value={counts.total}
          icon={UsersIcon}
          tone="teal"
          note={isArabic ? "جميع الحسابات" : "All accounts"}
        />
        <AdminMetricCard
          label={isArabic ? "نشط" : "Active"}
          value={counts.active}
          icon={CheckBadgeIcon}
          tone="emerald"
          trend={isArabic ? "حسابات نشطة" : "Active accounts"}
        />
        <AdminMetricCard
          label={isArabic ? "معلق" : "Suspended"}
          value={counts.suspended}
          icon={ShieldExclamationIcon}
          tone="rose"
          trend={isArabic ? "تحتاج مراجعة" : "Needs review"}
        />
        <AdminMetricCard
          label={isArabic ? "غير نشط" : "Inactive"}
          value={counts.inactive}
          icon={UserCircleIcon}
          tone="amber"
        />
      </div>

      {/* ── Users table card ── */}
      <AdminSectionCard
        eyebrow={isArabic ? "إدارة المستخدمين" : "User Management"}
        title={isArabic ? "جميع المستخدمين" : "All Users"}
        description={isArabic ? "إدارة حسابات العملاء والموظفين والصلاحيات" : "Manage customer and staff accounts, roles, and permissions"}
        accent="violet"
        bodyClassName="p-0"
        actions={
          hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setRawSearch("");
                setStatusFilter("all");
                setRoleFilter("all");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              {isArabic ? "مسح الفلاتر" : "Clear filters"}
            </button>
          ) : undefined
        }
      >
        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:px-6">
          <AdminSearchField
            value={rawSearch}
            onChange={(v) => setRawSearch(v)}
            placeholder={isArabic ? "بحث بالاسم أو البريد أو الهاتف…" : "Search by name, email, or phone…"}
            className="flex-1 min-w-0 max-w-sm"
          />
          <div className="flex shrink-0 items-center gap-2">
            <FunnelIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="h-9 rounded-lg border border-slate-200 bg-white pe-3 ps-3 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {isArabic ? r.labelAr : r.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Status tabs ── */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 py-2.5 md:px-6">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            const count = tabCounts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors",
                  active
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {isArabic ? tab.labelAr : tab.labelEn}
                {count > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-black",
                      active ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Bulk action bar ── */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 border-b border-slate-100 bg-violet-50 px-4 py-2.5 md:px-6">
            <span className="text-sm font-bold text-violet-700">
              {isArabic ? `${selectedIds.size} محدد` : `${selectedIds.size} selected`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-600 hover:bg-violet-50"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
                {isArabic ? "إلغاء التحديد" : "Deselect"}
              </button>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="px-4 py-3 md:px-6">
            <AdminErrorBanner message={error} />
          </div>
        )}

        {/* ── Table ── */}
        {loading ? (
          <div className="px-4 py-4 md:px-6">
            <AdminTableSkeleton rows={8} />
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 py-6 md:px-6">
            <AdminEmptyState
              title={isArabic ? "لا يوجد مستخدمون" : "No users found"}
              description={
                hasFilters
                  ? (isArabic ? "جرب تغيير معايير البحث أو الفلاتر" : "Try adjusting your search or filters")
                  : (isArabic ? "لم يتم العثور على أي مستخدمين بعد" : "No users have been found yet")
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  {/* Checkbox */}
                  <TableHead className="w-12 ps-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                      aria-label={isArabic ? "تحديد الكل" : "Select all"}
                    />
                  </TableHead>

                  {/* User */}
                  <TableHead
                    className="min-w-[200px] cursor-pointer select-none"
                    onClick={() => handleSort("full_name")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {isArabic ? "المستخدم" : "User"}
                      </span>
                      <SortIcon active={sortBy === "full_name"} dir={sortDir} />
                    </div>
                  </TableHead>

                  {/* Role */}
                  <TableHead className="hidden min-w-[110px] sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {isArabic ? "الدور" : "Role"}
                      </span>
                    </div>
                  </TableHead>

                  {/* Status */}
                  <TableHead
                    className="min-w-[110px] cursor-pointer select-none"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {isArabic ? "الحالة" : "Status"}
                      </span>
                      <SortIcon active={sortBy === "status"} dir={sortDir} />
                    </div>
                  </TableHead>

                  {/* Phone */}
                  <TableHead className="hidden min-w-[130px] md:table-cell">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      {isArabic ? "الهاتف" : "Phone"}
                    </span>
                  </TableHead>

                  {/* Joined */}
                  <TableHead
                    className="hidden min-w-[120px] cursor-pointer select-none lg:table-cell"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {isArabic ? "التسجيل" : "Joined"}
                      </span>
                      <SortIcon active={sortBy === "created_at"} dir={sortDir} />
                    </div>
                  </TableHead>

                  {/* Actions */}
                  <TableHead className="w-12 pe-4 text-end" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.map((u) => {
                  const selected = selectedIds.has(u.id);
                  const joinedDate = u.createdAt
                    ? new Intl.DateTimeFormat(isArabic ? "ar-EG" : "en-EG", {
                        year: "numeric", month: "short", day: "numeric",
                      }).format(new Date(u.createdAt))
                    : "—";

                  return (
                    <TableRow
                      key={u.id}
                      className={cn(
                        "transition-colors",
                        selected ? "bg-violet-50/60" : "hover:bg-slate-50/50",
                      )}
                    >
                      {/* Checkbox */}
                      <TableCell className="ps-4">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(u.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                          aria-label={u.fullName}
                        />
                      </TableCell>

                      {/* User info */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.fullName} email={u.email} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {u.fullName || "—"}
                            </p>
                            <p className="truncate text-xs text-slate-500" dir="ltr">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell className="hidden sm:table-cell">
                        <RoleBadge role={u.role} lang={lang} />
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="space-y-1">
                          <StatusBadge status={u.status} lang={lang} />
                          {u.status === "Suspended" && u.suspensionInfo && (
                            <p className="text-[10px] text-slate-400">
                              {u.suspensionInfo.reasonCodes.slice(0, 2).join(", ")}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Phone */}
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-slate-600" dir="ltr">
                          {u.phone || "—"}
                        </span>
                      </TableCell>

                      {/* Joined */}
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-slate-500">{joinedDate}</span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pe-4 text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                              aria-label={isArabic ? "الإجراءات" : "Actions"}
                            >
                              <EllipsisVerticalIcon className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {u.status !== "Suspended" ? (
                              <DropdownMenuItem
                                onClick={() => setSuspendTarget(u)}
                                className="gap-2 text-rose-600 focus:text-rose-700"
                              >
                                <ShieldExclamationIcon className="h-4 w-4" />
                                {isArabic ? "تعليق الحساب" : "Suspend"}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setUnsuspendTarget(u)}
                                className="gap-2 text-emerald-700 focus:text-emerald-800"
                              >
                                <CheckBadgeIcon className="h-4 w-4" />
                                {isArabic ? "رفع التعليق" : "Unsuspend"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(u)}
                              className="gap-2 text-red-600 focus:text-red-700"
                            >
                              <TrashIcon className="h-4 w-4" />
                              {isArabic ? "حذف الحساب" : "Delete Account"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && total > 0 && (
          <AdminPaginationBar
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={ITEMS_PER_PAGE}
            lang={lang}
            onPageChange={setPage}
          />
        )}
      </AdminSectionCard>

      {/* ── Dialogs ── */}
      {adminUser && (
        <>
          <SuspendDialog
            open={Boolean(suspendTarget)}
            user={suspendTarget}
            adminId={adminUser.id}
            adminEmail={adminUser.email}
            lang={lang}
            onClose={() => setSuspendTarget(null)}
            onSuccess={() => {
              setSuspendTarget(null);
              startTransition(() => { void loadUsers(); void loadCounts(); });
            }}
          />

          <DeleteUserDialog
            open={Boolean(deleteTarget)}
            user={deleteTarget}
            adminId={adminUser.id}
            adminEmail={adminUser.email}
            lang={lang}
            onClose={() => setDeleteTarget(null)}
            onSuccess={() => {
              setDeleteTarget(null);
              startTransition(() => { void loadUsers(); void loadCounts(); });
            }}
          />

          <UnsuspendDialog
            open={Boolean(unsuspendTarget)}
            user={unsuspendTarget}
            lang={lang}
            loading={unsuspendLoading}
            onConfirm={handleUnsuspendConfirm}
            onClose={() => setUnsuspendTarget(null)}
          />
        </>
      )}
    </div>
  );
}
