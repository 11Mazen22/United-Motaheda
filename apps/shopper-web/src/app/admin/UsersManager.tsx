import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  EllipsisVerticalIcon,
  FunnelIcon,
  LockClosedIcon,
  LockOpenIcon,
  ShieldCheckIcon,
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
import { toast } from "sonner";
import { ROLE_VALUES, ROLE_LABELS, type Role } from "@pharmacy/contracts";
import {
  AdminBulkActionBar,
  AdminConfirmDialog,
  AdminDetailDrawer,
  AdminEmptyState,
  AdminErrorBanner,
  AdminMetricCard,
  AdminPaginationBar,
  AdminSearchField,
  AdminSectionCard,
  AdminTableSkeleton,
  useDebouncedValue,
  type AdminDetailDrawerSummary,
} from "./adminShared";
import { SortIcon } from "./adminTableIcons";
import { buildSelfActionWarning } from "./adminSelfActionWarning";
import { useBulkSelection } from "../../hooks/useBulkSelection";
import { useDirectoryCounts } from "../../hooks/useDirectoryCounts";
import { useSortableColumn } from "../../hooks/useSortableColumn";
import { useAdminConfirmedAction } from "../../hooks/useAdminConfirmedAction";
import { useAdminBulkStatus } from "../../hooks/useAdminBulkStatus";
import SuspendDialog from "./SuspendDialog";
import DeleteUserDialog from "./DeleteUserDialog";
import {
  changeUserRole,
  changeUserStatus,
  deleteUserPermanently,
  fetchUsers,
  lockAccount,
  resetUserSessions,
  unlockAccount,
  unsuspendUser,
  type AdminUser,
  type DeleteUserPayload,
  type FetchUsersOptions,
} from "../../services/adminUsersApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserStatus = "Active" | "Inactive" | "Suspended";
type StatusFilter = "all" | UserStatus;
type RoleFilter = "all" | Role;
type SortField = "full_name" | "email" | "created_at" | "status" | "role";

// Role/lock/reset go through the generic AdminConfirmDialog (mirrors
// StaffManager's PendingAction shape). Suspend/unsuspend/delete keep using
// their existing bespoke dialogs (SuspendDialog/DeleteUserDialog/
// UnsuspendDialog) — those already have rich content and already work.
type PendingAction =
  | { kind: "role"; member: AdminUser; nextRole: Role }
  | { kind: "lock"; member: AdminUser; locked: boolean }
  | { kind: "reset"; member: AdminUser };

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const STATUS_TABS: Array<{ key: StatusFilter; labelAr: string; labelEn: string }> = [
  { key: "all",       labelAr: "الكل",      labelEn: "All"       },
  { key: "Active",    labelAr: "نشط",       labelEn: "Active"    },
  { key: "Suspended", labelAr: "معلق",      labelEn: "Suspended" },
  { key: "Inactive",  labelAr: "غير نشط",   labelEn: "Inactive"  },
];

const ROLE_OPTIONS: Array<{ value: RoleFilter; labelAr: string; labelEn: string }> = [
  { value: "all", labelAr: "جميع الأدوار", labelEn: "All Roles" },
  ...ROLE_VALUES.map((value) => ({
    value,
    labelAr: ROLE_LABELS[value].ar,
    labelEn: ROLE_LABELS[value].en,
  })),
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

const ROLE_BADGE_CLASS: Record<Role, string> = {
  admin:      "border-teal-200 bg-teal-50 text-teal-700",
  manager:    "border-violet-200 bg-violet-50 text-violet-700",
  pharmacist: "border-blue-200 bg-blue-50 text-blue-700",
  driver:     "border-sky-200 bg-sky-50 text-sky-700",
  customer:   "border-slate-200 bg-slate-50 text-slate-600",
};

function getRoleLabel(role: string, lang: "ar" | "en"): string {
  const r = (ROLE_LABELS[role as Role] ? role : "customer") as Role;
  return lang === "ar" ? ROLE_LABELS[r].ar : ROLE_LABELS[r].en;
}

function RoleBadge({ role, lang }: { role: string; lang: "ar" | "en" }) {
  const r = (ROLE_LABELS[role as Role] ? role : "customer") as Role;
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold", ROLE_BADGE_CLASS[r])}>
      {lang === "ar" ? ROLE_LABELS[r].ar : ROLE_LABELS[r].en}
    </span>
  );
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

  // ── Filter / sort state ──────────────────────────────────────────────────────
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 350);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter]     = useState<RoleFilter>("all");
  const { sortBy, sortDir, handleSort } = useSortableColumn<SortField>("created_at", "desc");
  const [page, setPage]       = useState(1);
  const listRequestId = useRef(0);

  // ── Selection state ──────────────────────────────────────────────────────────────
  const bulk = useBulkSelection(users, { excludeId: adminUser?.id ?? null });

  // ── Detail drawer + confirm-dialog state ─────────────────────────────────────────
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // ── Dialog state (existing bespoke dialogs — unchanged) ─────────────────────
  const [suspendTarget, setSuspendTarget]     = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget]       = useState<AdminUser | null>(null);
  const [unsuspendTarget, setUnsuspendTarget] = useState<AdminUser | null>(null);
  const [unsuspendLoading, setUnsuspendLoading] = useState(false);

  // ── Load users ──────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    const requestId = ++listRequestId.current;
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
      if (requestId !== listRequestId.current) return;
      setUsers(result.users);
      setTotal(result.total);
    } catch (err) {
      if (requestId !== listRequestId.current) return;
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      if (requestId === listRequestId.current) setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter, sortBy, sortDir]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, roleFilter, sortBy, sortDir]);
  useEffect(() => { bulk.clear(); }, [page, search, statusFilter, roleFilter, sortBy, sortDir, bulk.clear]);

  // ── Load counts (single aggregate RPC — replaces the old unfiltered
  // select('status') over the whole table, re-run after every mutation) ──────
  const { counts, reload: loadCounts, setCounts } = useDirectoryCounts("all");

  const refreshAll = useCallback(() => {
    startTransition(() => { void loadUsers(); void loadCounts(); });
  }, [loadUsers, loadCounts]);

  const handlePermanentDelete = useCallback(async (payload: DeleteUserPayload) => {
    const deletedUser = users.find((user) => user.id === payload.userId);
    if (!deletedUser) throw new Error("User is no longer present in this result set.");

    const previousUsers = users;
    const previousTotal = total;
    const previousCounts = counts;
    const previousDetailId = detailId;

    // Prevent an older search/filter request from restoring the row while the
    // transactional delete is still in flight.
    listRequestId.current += 1;
    setLoading(false);
    setUsers((current) => current.filter((user) => user.id !== payload.userId));
    setTotal((current) => Math.max(0, current - 1));
    setDetailId((current) => current === payload.userId ? null : current);
    setCounts((current) => ({
      ...current,
      total: Math.max(0, current.total - 1),
      active: Math.max(0, current.active - (deletedUser.status === "Active" ? 1 : 0)),
      suspended: Math.max(0, current.suspended - (deletedUser.status === "Suspended" ? 1 : 0)),
      inactive: Math.max(0, current.inactive - (deletedUser.status === "Inactive" ? 1 : 0)),
      staff: Math.max(0, current.staff - (deletedUser.role !== "customer" ? 1 : 0)),
      customers: Math.max(0, current.customers - (deletedUser.role === "customer" ? 1 : 0)),
      admins: Math.max(0, current.admins - (deletedUser.role === "admin" ? 1 : 0)),
      managers: Math.max(0, current.managers - (deletedUser.role === "manager" ? 1 : 0)),
      pharmacists: Math.max(0, current.pharmacists - (deletedUser.role === "pharmacist" ? 1 : 0)),
      drivers: Math.max(0, current.drivers - (deletedUser.role === "driver" ? 1 : 0)),
    }));

    try {
      await deleteUserPermanently(payload);
      void loadCounts();
      if (previousUsers.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        void loadUsers();
      }
    } catch (err) {
      setUsers(previousUsers);
      setTotal(previousTotal);
      setCounts(previousCounts);
      setDetailId(previousDetailId);
      void loadUsers();
      void loadCounts();
      throw err;
    }
  }, [users, total, counts, detailId, setCounts, loadCounts, page, loadUsers]);

  // ── Unsuspend ─────────────────────────────────────────────────────────────────
  const handleUnsuspendConfirm = async () => {
    if (!unsuspendTarget || !adminUser) return;
    setUnsuspendLoading(true);
    try {
      await unsuspendUser(unsuspendTarget.id, adminUser.id, adminUser.email);
      toast.success(isArabic ? `تم رفع تعليق ${unsuspendTarget.fullName}` : `Suspension removed for ${unsuspendTarget.fullName}`);
      setUnsuspendTarget(null);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unsuspend user");
    } finally {
      setUnsuspendLoading(false);
    }
  };

  // ── Confirmed mutations: role / lock / reset sessions ───────────────────
  const runConfirmedAction = useAdminConfirmedAction(isArabic);
  const handleConfirmedAction = useCallback(async () => {
    if (!pendingAction || !adminUser) return;
    const { kind } = pendingAction;
    await runConfirmedAction(async () => {
      if (kind === "role") {
        await changeUserRole(pendingAction.member.id, pendingAction.nextRole);
        toast.success(
          isArabic
            ? `تم تعيين ${pendingAction.member.fullName || "المستخدم"} كـ${getRoleLabel(pendingAction.nextRole, lang)}`
            : `${pendingAction.member.fullName || "User"} is now ${getRoleLabel(pendingAction.nextRole, lang)}`,
        );
      } else if (kind === "lock") {
        if (pendingAction.locked) await lockAccount(pendingAction.member.id);
        else await unlockAccount(pendingAction.member.id);
        toast.success(
          pendingAction.locked
            ? (isArabic ? "تم قفل الحساب" : "Account locked")
            : (isArabic ? "تم فتح قفل الحساب" : "Account unlocked"),
        );
      } else if (kind === "reset") {
        await resetUserSessions(pendingAction.member.id);
        toast.success(isArabic ? "تم إنهاء جميع الجلسات النشطة" : "All active sessions were reset");
      }
      refreshAll();
    });
  }, [pendingAction, adminUser, isArabic, lang, refreshAll, runConfirmedAction]);

  // ── Bulk status actions (status-only — see AdminBulkActionBar's own scope
  // note; role/lock/delete never get a bulk path) ───────────────────────
  const runBulkStatusUpdate = useAdminBulkStatus(isArabic);
  const runBulkStatus = useCallback(
    async (nextStatus: "Active" | "Inactive") => {
      if (!adminUser) return;
      const ids = Array.from(bulk.selected);
      await runBulkStatusUpdate(ids, (id) => changeUserStatus(id, nextStatus));
      bulk.clear();
      refreshAll();
    },
    [bulk.selected, bulk.clear, adminUser, refreshAll, runBulkStatusUpdate],
  );

  // ── Status tab counts ────────────────────────────────────────────────────────
  const tabCounts: Record<StatusFilter, number> = useMemo(() => ({
    all:       counts.total,
    Active:    counts.active,
    Suspended: counts.suspended,
    Inactive:  counts.inactive,
  }), [counts]);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const hasFilters = statusFilter !== "all" || roleFilter !== "all" || rawSearch.length > 0;

  const detailMember = users.find((u) => u.id === detailId) ?? null;
  const detailSummary: AdminDetailDrawerSummary | null = detailMember
    ? {
        id: detailMember.id,
        fullName: detailMember.fullName,
        email: detailMember.email,
        phone: detailMember.phone,
        role: detailMember.role,
        status: detailMember.status,
        createdAt: detailMember.createdAt,
      }
    : null;

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

        {/* ── Bulk action bar (status-only — activate/suspend) ── */}
        <AdminBulkActionBar
          selectedCount={bulk.count}
          lang={lang}
          onClear={bulk.clear}
          actions={[
            { key: "activate", label: isArabic ? "تنشيط" : "Activate", icon: CheckBadgeIcon, onClick: () => void runBulkStatus("Active") },
            { key: "deactivate", label: isArabic ? "إلغاء التنشيط" : "Deactivate", icon: UserCircleIcon, tone: "danger", onClick: () => void runBulkStatus("Inactive") },
          ]}
        />

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
                      checked={bulk.allSelected}
                      onChange={bulk.toggleAll}
                      className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                      aria-label={isArabic ? "تحديد الكل" : "Select all"}
                    />
                  </TableHead>

                  {/* User */}
                  <TableHead
                    className="min-w-[200px]"
                    aria-sort={sortBy === "full_name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("full_name")}
                      className="flex items-center gap-1.5 select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                    >
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {isArabic ? "المستخدم" : "User"}
                      </span>
                      <SortIcon active={sortBy === "full_name"} dir={sortDir} />
                    </button>
                  </TableHead>

                  {/* Role */}
                  <TableHead
                    className="hidden min-w-[110px] sm:table-cell"
                    aria-sort={sortBy === "role" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("role")}
                      className="flex items-center gap-1.5 select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                    >
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {isArabic ? "الدور" : "Role"}
                      </span>
                      <SortIcon active={sortBy === "role"} dir={sortDir} />
                    </button>
                  </TableHead>

                  {/* Status */}
                  <TableHead
                    className="min-w-[110px]"
                    aria-sort={sortBy === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("status")}
                      className="flex items-center gap-1.5 select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                    >
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {isArabic ? "الحالة" : "Status"}
                      </span>
                      <SortIcon active={sortBy === "status"} dir={sortDir} />
                    </button>
                  </TableHead>

                  {/* Phone */}
                  <TableHead className="hidden min-w-[130px] md:table-cell">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      {isArabic ? "الهاتف" : "Phone"}
                    </span>
                  </TableHead>

                  {/* Joined */}
                  <TableHead
                    className="hidden min-w-[120px] lg:table-cell"
                    aria-sort={sortBy === "created_at" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("created_at")}
                      className="flex items-center gap-1.5 select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                    >
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {isArabic ? "التسجيل" : "Joined"}
                      </span>
                      <SortIcon active={sortBy === "created_at"} dir={sortDir} />
                    </button>
                  </TableHead>

                  {/* Actions */}
                  <TableHead className="w-12 pe-4 text-end" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {users.map((u) => {
                  const selected = bulk.isSelected(u.id);
                  const isSelf = u.id === adminUser?.id;
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
                          disabled={isSelf}
                          onChange={() => bulk.toggle(u.id)}
                          className="h-4 w-4 rounded border-slate-300 accent-teal-600 disabled:opacity-30"
                          aria-label={u.fullName}
                        />
                      </TableCell>

                      {/* User info */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setDetailId(u.id)}
                          className="flex min-w-0 items-center gap-3 text-start"
                        >
                          <UserAvatar name={u.fullName} email={u.email} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {u.fullName || "—"}
                              {isSelf && <span className="ms-1.5 text-[10px] font-black text-teal-600">({isArabic ? "أنت" : "you"})</span>}
                            </p>
                            <p className="truncate text-xs text-slate-500" dir="ltr">
                              {u.email}
                            </p>
                          </div>
                        </button>
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
                              disabled={isSelf}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={isSelf
                                ? (isArabic ? "لا يمكن تعديل حسابك الحالي" : "Your current account cannot be modified here")
                                : (isArabic ? "الإجراءات" : "Actions")}
                            >
                              <EllipsisVerticalIcon className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {ROLE_VALUES.filter((r) => r !== u.role).map((r) => (
                              <DropdownMenuItem key={r} onClick={() => setPendingAction({ kind: "role", member: u, nextRole: r })}>
                                <ShieldCheckIcon className="h-4 w-4" />
                                {isArabic ? `تعيين كـ${ROLE_LABELS[r].ar}` : `Set as ${ROLE_LABELS[r].en}`}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
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
                            <DropdownMenuItem className="gap-2" onClick={() => setPendingAction({ kind: "lock", member: u, locked: true })}>
                              <LockClosedIcon className="h-4 w-4" />
                              {isArabic ? "قفل الحساب" : "Lock account"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => setPendingAction({ kind: "lock", member: u, locked: false })}>
                              <LockOpenIcon className="h-4 w-4" />
                              {isArabic ? "فتح القفل" : "Unlock account"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2" onClick={() => setPendingAction({ kind: "reset", member: u })}>
                              <ArrowPathIcon className="h-4 w-4" />
                              {isArabic ? "إعادة تعيين الجلسات" : "Reset sessions"}
                            </DropdownMenuItem>
                            {u.id !== adminUser?.id && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(u)}
                                  className="gap-2 text-red-600 focus:text-red-700"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                  {isArabic ? "حذف الحساب" : "Delete Account"}
                                </DropdownMenuItem>
                              </>
                            )}
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

      {/* ── Detail drawer ── */}
      <AdminDetailDrawer
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        summary={detailSummary}
        lang={lang}
        roleLabel={detailMember ? getRoleLabel(detailMember.role, lang) : ""}
        statusBadge={detailMember ? <StatusBadge status={detailMember.status} lang={lang} /> : null}
      />

      {/* ── Confirm dialog for role / lock / reset-sessions ── */}
      <AdminConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmedAction}
        lang={lang}
        tone={pendingAction?.kind === "lock" && pendingAction.locked ? "warning" : "info"}
        title={
          pendingAction?.kind === "role"
            ? (isArabic ? "تغيير الصلاحية" : "Change role")
            : pendingAction?.kind === "lock"
              ? (pendingAction.locked ? (isArabic ? "قفل الحساب" : "Lock account") : (isArabic ? "فتح قفل الحساب" : "Unlock account"))
              : (isArabic ? "إعادة تعيين الجلسات" : "Reset sessions")
        }
        description={
          pendingAction
            ? (() => {
                const isSelf = pendingAction.member.id === adminUser?.id;
                const selfWarning = buildSelfActionWarning(isArabic, isSelf);
                if (pendingAction.kind === "role") {
                  return (isArabic
                    ? `سيتم تعيين ${pendingAction.member.fullName || "المستخدم"} كـ${getRoleLabel(pendingAction.nextRole, lang)}.${selfWarning}`
                    : `${pendingAction.member.fullName || "This user"} will be set as ${getRoleLabel(pendingAction.nextRole, lang)}.${selfWarning}`);
                }
                if (pendingAction.kind === "lock") {
                  return pendingAction.locked
                    ? (isArabic ? `سيتم منع ${pendingAction.member.fullName || "المستخدم"} من تسجيل الدخول.${selfWarning}` : `${pendingAction.member.fullName || "This user"} will be blocked from signing in.${selfWarning}`)
                    : (isArabic ? `سيتمكن ${pendingAction.member.fullName || "المستخدم"} من تسجيل الدخول مجددًا.` : `${pendingAction.member.fullName || "This user"} will be able to sign in again.`);
                }
                return isArabic
                  ? `سيتم تسجيل خروج ${pendingAction.member.fullName || "المستخدم"} من كل الأجهزة فورًا.${selfWarning}`
                  : `${pendingAction.member.fullName || "This user"} will be signed out of every device immediately.${selfWarning}`;
              })()
            : ""
        }
      />

      {/* ── Existing bespoke dialogs (unchanged) ── */}
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
              refreshAll();
            }}
          />

          <DeleteUserDialog
            open={Boolean(deleteTarget)}
            user={deleteTarget}
            lang={lang}
            onDelete={handlePermanentDelete}
            onClose={() => setDeleteTarget(null)}
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
