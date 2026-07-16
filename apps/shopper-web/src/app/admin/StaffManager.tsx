// StaffManager.tsx – admin-only · light mode · enterprise workforce management
import {
  startTransition,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  LockClosedIcon,
  LockOpenIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  UsersIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
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
import { cn } from "../components/UI";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { createStaffUserViaSuperAdmin } from "../../services/adminStaffApi";
import {
  changeUserRole,
  changeUserStatus,
  fetchLastSignInBatch,
  fetchUsers,
  lockAccount,
  unlockAccount,
  type AdminUser,
  type LastSignInInfo,
} from "../../services/adminUsersApi";
import { toast } from "sonner";
import {
  ROLE_VALUES,
  STAFF_ROLE_VALUES,
  ROLE_LABELS,
  type Role,
  type StaffRole,
} from "@pharmacy/contracts";
import {
  AdminBulkActionBar,
  AdminConfirmDialog,
  AdminDetailDrawer,
  AdminEmptyState,
  AdminErrorBanner,
  AdminFormField,
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

// ─── Types ────────────────────────────────────────────────────────────────────
// Role union/labels come from @pharmacy/contracts/src/role.ts (canonical).

type StaffStatus = "Active" | "Inactive" | "Suspended";
type NewStaffStatus = "Active" | "Inactive";
type Language = "ar" | "en";
type StatusFilter = "all" | StaffStatus;
type SortField = "full_name" | "role" | "status" | "created_at";

type StaffFormState = {
  fullName: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  role: StaffRole;
  status: NewStaffStatus;
};

type PendingAction =
  | { kind: "role"; member: AdminUser; nextRole: Role }
  | { kind: "status"; member: AdminUser; nextStatus: StaffStatus }
  | { kind: "lock"; member: AdminUser; locked: boolean };

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;
const ROLES: { value: Role; ar: string; en: string }[] = ROLE_VALUES.map((value) => ({
  value,
  ar: ROLE_LABELS[value].ar,
  en: ROLE_LABELS[value].en,
}));
const STAFF_ROLES: { value: StaffRole; ar: string; en: string }[] = STAFF_ROLE_VALUES.map(
  (value) => ({ value, ar: ROLE_LABELS[value].ar, en: ROLE_LABELS[value].en }),
);

const EMPTY_FORM: StaffFormState = {
  fullName: "",
  username: "",
  phone: "",
  email: "",
  password: "",
  role: "pharmacist",
  status: "Active",
};

const ROLE_ACCENT: Record<string, string> = {
  admin: "#0E7E74", manager: "#0ea5e9", pharmacist: "#8b5cf6", driver: "#f59e0b", customer: "#64748b",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleLabel(role: string, lang: Language): string {
  const entry = ROLES.find((r) => r.value === role);
  return lang === "ar" ? (entry?.ar ?? role) : (entry?.en ?? role);
}

function getStatusClasses(status: string) {
  if (status === "Inactive") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Suspended") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function translateStatus(status: string, lang: Language) {
  if (status === "Inactive") return lang === "ar" ? "غير نشط" : "Inactive";
  if (status === "Suspended") return lang === "ar" ? "موقوف" : "Suspended";
  return lang === "ar" ? "نشط" : "Active";
}

function fmtRelativeDate(iso: string | null | undefined, lang: Language): string {
  if (!iso) return lang === "ar" ? "لم يسجّل الدخول بعد" : "Never";
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ─── Unauthorised UI ──────────────────────────────────────────────────────────

function UnauthorizedMessage({ lang }: { lang: Language }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <ShieldCheckIcon className="h-10 w-10" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800">
        {lang === "ar" ? "غير مصرح" : "Unauthorized"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
        {lang === "ar"
          ? "إدارة الموظفين متاحة فقط للمدير (Admin)."
          : "Staff management is restricted to the system owner (Admin)."}
      </p>
    </div>
  );
}

// ─── Small presentational bits ────────────────────────────────────────────────

function RoleBadge({ role, lang }: { role: string; lang: Language }) {
  const rc = ROLE_ACCENT[role] ?? "#64748b";
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold"
      style={{ borderColor: `${rc}33`, backgroundColor: `${rc}14`, color: rc }}
    >
      {getRoleLabel(role, lang)}
    </span>
  );
}

function StatusBadge({ status, lang }: { status: string; lang: Language }) {
  const dot =
    status === "Suspended" ? "bg-rose-500" : status === "Inactive" ? "bg-amber-400" : "bg-emerald-500";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide", getStatusClasses(status))}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {translateStatus(status, lang)}
    </span>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffManager() {
  const { lang } = useLanguage();
  const { isAdmin, user: viewer } = useAuth();
  const isArabic = lang === "ar";

  // ── Data state ──────────────────────────────────────────────────────────────
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSignIn, setLastSignIn] = useState<Map<string, LastSignInInfo>>(new Map());

  // ── Filter / sort / page state ──────────────────────────────────────────────
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 250);
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { sortBy, sortDir, handleSort } = useSortableColumn<SortField>("created_at", "desc");
  const [page, setPage] = useState(1);

  // ── Selection / dialogs ─────────────────────────────────────────────────────
  const bulk = useBulkSelection(staff, { excludeId: viewer?.id ?? null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // ── Load staff (server-paginated, reuses adminUsersApi.fetchUsers) ─────────
  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchUsers({
        page,
        perPage: ITEMS_PER_PAGE,
        search: search || undefined,
        statusFilter,
        roleFilter: roleFilter === "all" ? [...STAFF_ROLE_VALUES] : roleFilter,
        sortBy,
        sortDir,
      });
      setStaff(result.users);
      setTotal(result.total);

      const ids = result.users.map((u) => u.id);
      if (ids.length > 0) {
        fetchLastSignInBatch(ids).then(setLastSignIn).catch(() => {});
      } else {
        setLastSignIn(new Map());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load staff.";
      setError(msg);
      toast.error(isArabic ? "حدث خطأ أثناء جلب البيانات" : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter, sortBy, sortDir, isArabic]);

  useEffect(() => { if (isAdmin) void loadStaff(); }, [isAdmin, loadStaff]);
  useEffect(() => { setPage(1); }, [search, statusFilter, roleFilter, sortBy, sortDir]);
  useEffect(() => { bulk.clear(); }, [page, search, statusFilter, roleFilter, sortBy, sortDir, bulk.clear]);

  // ── Staff-scoped summary counts (lightweight count-only queries, not a
  // full-table fetch) ─────────────────────────────────────────────────────────
  const { counts, reload: loadCounts } = useDirectoryCounts("staff", isAdmin);

  const refreshAll = useCallback(() => {
    startTransition(() => { void loadStaff(); void loadCounts(); });
  }, [loadStaff, loadCounts]);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const hasFilters = statusFilter !== "all" || roleFilter !== "all" || rawSearch.length > 0;
  const clearFilters = useCallback(() => {
    setRawSearch(""); setRoleFilter("all"); setStatusFilter("all");
  }, []);
  const passwordLength = form.password.length;

  // ── Add employee ─────────────────────────────────────────────────────────────
  const handleAddStaff = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form.fullName.trim() || !form.username.trim() || !form.password || !form.email.trim() || !form.phone.trim()) {
        setFormError(isArabic ? "جميع الحقول مطلوبة" : "All fields are required");
        return;
      }
      if (form.password.length < 8) {
        setFormError(isArabic ? "يجب ألا تقل كلمة المرور عن 8 أحرف" : "Password must be at least 8 characters");
        return;
      }
      setSubmitting(true);
      setFormError("");
      try {
        const result = await createStaffUserViaSuperAdmin({ ...form });
        toast.success(result.message || (isArabic ? "تم إضافة الموظف بنجاح" : "Staff member added successfully"));
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        refreshAll();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add staff member.";
        setFormError(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [form, isArabic, refreshAll],
  );

  // ── Confirmed mutations ──────────────────────────────────────────────────────
  const runConfirmedAction = useAdminConfirmedAction(isArabic);
  const handleConfirmedAction = useCallback(async () => {
    if (!pendingAction || !viewer) return;
    const { kind } = pendingAction;
    await runConfirmedAction(async () => {
      if (kind === "role") {
        await changeUserRole(pendingAction.member.id, pendingAction.nextRole);
        toast.success(
          isArabic
            ? `تم تعيين ${pendingAction.member.fullName || "المستخدم"} كـ${getRoleLabel(pendingAction.nextRole, lang)}`
            : `${pendingAction.member.fullName || "User"} is now ${getRoleLabel(pendingAction.nextRole, lang)}`,
        );
      } else if (kind === "status") {
        await changeUserStatus(pendingAction.member.id, pendingAction.nextStatus);
        toast.success(isArabic ? "تم تحديث الحالة بنجاح" : "Status updated successfully");
      } else if (kind === "lock") {
        if (pendingAction.locked) await lockAccount(pendingAction.member.id);
        else await unlockAccount(pendingAction.member.id);
        toast.success(
          pendingAction.locked
            ? (isArabic ? "تم قفل الحساب" : "Account locked")
            : (isArabic ? "تم فتح قفل الحساب" : "Account unlocked"),
        );
      }
      refreshAll();
    });
  }, [pendingAction, viewer, isArabic, lang, refreshAll, runConfirmedAction]);

  // ── Bulk status actions (never role/lock/delete — see AdminBulkActionBar's
  // own scope note) ────────────────────────────────────────────────────────────
  const runBulkStatusUpdate = useAdminBulkStatus(isArabic);
  const runBulkStatus = useCallback(
    async (nextStatus: StaffStatus) => {
      if (!viewer) return;
      const ids = Array.from(bulk.selected);
      await runBulkStatusUpdate(ids, (id) => changeUserStatus(id, nextStatus));
      bulk.clear();
      refreshAll();
    },
    [bulk.selected, bulk.clear, viewer, refreshAll, runBulkStatusUpdate],
  );

  if (!isAdmin) return <UnauthorizedMessage lang={lang} />;

  const detailMember = staff.find((m) => m.id === detailId) ?? null;
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

  const thClass = "text-xs font-black uppercase tracking-wide text-slate-500";
  const sortButtonClass = cn(thClass, "flex items-center gap-1.5 select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40");

  return (
    <div className="space-y-5">
      <AdminErrorBanner message={error} />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AdminMetricCard
          label={isArabic ? "إجمالي الموظفين" : "Total employees"}
          value={counts.total}
          icon={UsersIcon}
          tone="slate"
        />
        <AdminMetricCard
          label={isArabic ? "حسابات نشطة" : "Active access"}
          value={counts.active}
          note={isArabic ? "يمكنها الدخول الآن" : "Can sign in right now"}
          icon={CheckBadgeIcon}
          tone="emerald"
        />
        <AdminMetricCard
          label={isArabic ? "موقوف" : "Suspended"}
          value={counts.suspended}
          note={isArabic ? "تم إيقاف الوصول" : "Access is suspended"}
          icon={XCircleIcon}
          tone="rose"
        />
      </section>

      <AdminSectionCard
        eyebrow={isArabic ? "إدارة الموظفين" : "Employees manager"}
        title={isArabic ? "مركز إدارة الفريق" : "Team operations center"}
        description={
          isArabic
            ? "بحث وفرز وإدارة الأدوار والحالة والقفل مع سجل تدقيق كامل لكل إجراء."
            : "Search, sort, and manage roles, status, and account locks — every action is audit-logged."
        }
        bodyClassName="p-0"
        actions={
          <div className="flex flex-wrap gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                {isArabic ? "إعادة ضبط" : "Reset"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadStaff()}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowPathIcon className={cn("h-4 w-4", loading && "animate-spin")} />
              {isArabic ? "تحديث" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => { setDialogOpen(true); setForm(EMPTY_FORM); setFormError(""); }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              <PlusIcon className="h-4 w-4" />
              {isArabic ? "إضافة موظف" : "Add employee"}
            </button>
          </div>
        }
      >
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:px-6">
          <AdminSearchField
            value={rawSearch}
            onChange={setRawSearch}
            placeholder={isArabic ? "ابحث بالاسم أو البريد أو الهاتف…" : "Search by name, email, or phone…"}
            className="flex-1 min-w-0 max-w-sm"
          />
          <div className="flex shrink-0 items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "all" | Role)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">{isArabic ? "جميع الأدوار" : "All roles"}</option>
              {STAFF_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{isArabic ? r.ar : r.en}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">{isArabic ? "جميع الحالات" : "All statuses"}</option>
              <option value="Active">{isArabic ? "نشط" : "Active"}</option>
              <option value="Inactive">{isArabic ? "غير نشط" : "Inactive"}</option>
              <option value="Suspended">{isArabic ? "موقوف" : "Suspended"}</option>
            </select>
          </div>
        </div>

        <AdminBulkActionBar
          selectedCount={bulk.count}
          lang={lang}
          onClear={bulk.clear}
          actions={[
            { key: "activate", label: isArabic ? "تنشيط" : "Activate", icon: CheckBadgeIcon, onClick: () => void runBulkStatus("Active") },
            { key: "suspend", label: isArabic ? "تعليق" : "Suspend", icon: ShieldExclamationIcon, tone: "danger", onClick: () => void runBulkStatus("Suspended") },
          ]}
        />

        {loading ? (
          <div className="px-4 py-4 md:px-6"><AdminTableSkeleton rows={7} /></div>
        ) : !staff.length ? (
          <div className="px-4 py-6 md:px-6">
            <AdminEmptyState
              title={isArabic ? "لا يوجد موظفين مطابقين" : "No matching employees"}
              description={isArabic ? "جرّب تعديل الفلاتر أو مسح البحث." : "Try adjusting filters or clearing the search."}
            />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:hidden">
              {staff.map((member) => {
                const isSelf = member.id === viewer?.id;
                const rc = ROLE_ACCENT[member.role] ?? "#64748b";
                return (
                  <article
                    key={member.id}
                    onClick={() => setDetailId(member.id)}
                    className="relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
                  >
                    <div className="h-[3px]" style={{ background: rc }} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${rc}e0 0%, ${rc}99 100%)` }}
                          >
                            {(member.fullName || member.email || "?").slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {member.fullName || (isArabic ? "موظف" : "Staff member")}
                              {isSelf && <span className="ms-1.5 text-[10px] font-black text-teal-600">({isArabic ? "أنت" : "you"})</span>}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-medium text-slate-400" dir="ltr">{member.email}</p>
                          </div>
                        </div>
                        <StatusBadge status={member.status} lang={lang} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <RoleBadge role={member.role} lang={lang} />
                        <span className="text-[11px] text-slate-400">
                          {isArabic ? "آخر نشاط: " : "Last active: "}{fmtRelativeDate(lastSignIn.get(member.id)?.lastSignInAt, lang)}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden xl:block">
              <div className="overflow-x-auto">
                <Table className="min-w-[64rem]">
                  <TableHeader>
                    <TableRow className="border-slate-100 bg-slate-50/60">
                      <TableHead className="w-12 ps-4">
                        <input type="checkbox" checked={bulk.allSelected} onChange={bulk.toggleAll} className="h-4 w-4 rounded border-slate-300 accent-teal-600" aria-label={isArabic ? "تحديد الكل" : "Select all"} />
                      </TableHead>
                      <TableHead className="px-4 py-3" aria-sort={sortBy === "full_name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" onClick={() => handleSort("full_name")} className={sortButtonClass}>{isArabic ? "الموظف" : "Employee"}<SortIcon active={sortBy === "full_name"} dir={sortDir} /></button>
                      </TableHead>
                      <TableHead className="px-4 py-3" aria-sort={sortBy === "role" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" onClick={() => handleSort("role")} className={sortButtonClass}>{isArabic ? "الدور" : "Role"}<SortIcon active={sortBy === "role"} dir={sortDir} /></button>
                      </TableHead>
                      <TableHead className={cn(thClass, "px-4 py-3")}>{isArabic ? "الهاتف" : "Phone"}</TableHead>
                      <TableHead className="px-4 py-3" aria-sort={sortBy === "status" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" onClick={() => handleSort("status")} className={sortButtonClass}>{isArabic ? "الحالة" : "Status"}<SortIcon active={sortBy === "status"} dir={sortDir} /></button>
                      </TableHead>
                      <TableHead className={cn(thClass, "px-4 py-3")}>{isArabic ? "آخر نشاط" : "Last active"}</TableHead>
                      <TableHead className="px-4 py-3" aria-sort={sortBy === "created_at" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                        <button type="button" onClick={() => handleSort("created_at")} className={sortButtonClass}>{isArabic ? "الانضمام" : "Joined"}<SortIcon active={sortBy === "created_at"} dir={sortDir} /></button>
                      </TableHead>
                      <TableHead className="w-12 pe-4 text-end" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => {
                      const isSelf = member.id === viewer?.id;
                      return (
                        <TableRow key={member.id} className={cn("border-slate-100 transition-colors", bulk.isSelected(member.id) ? "bg-teal-50/60" : "hover:bg-slate-50/60")}>
                          <TableCell className="ps-4">
                            <input
                              type="checkbox"
                              checked={bulk.isSelected(member.id)}
                              disabled={isSelf}
                              onChange={() => bulk.toggle(member.id)}
                              className="h-4 w-4 rounded border-slate-300 accent-teal-600 disabled:opacity-30"
                              aria-label={member.fullName}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 align-top">
                            <button type="button" onClick={() => setDetailId(member.id)} className="flex min-w-[14rem] items-center gap-3 text-start">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm" style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}>
                                {(member.fullName || member.email || "A").slice(0, 1).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-800">
                                  {member.fullName || (isArabic ? "موظف" : "Staff member")}
                                  {isSelf && <span className="ms-1.5 text-[10px] font-black text-teal-600">({isArabic ? "أنت" : "you"})</span>}
                                </p>
                                <p className="mt-0.5 truncate text-xs font-medium text-slate-400" dir="ltr">{member.email}</p>
                              </div>
                            </button>
                          </TableCell>
                          <TableCell className="px-4 py-3"><RoleBadge role={member.role} lang={lang} /></TableCell>
                          <TableCell className="px-4 py-3 text-sm text-slate-600" dir="ltr">{member.phone}</TableCell>
                          <TableCell className="px-4 py-3"><StatusBadge status={member.status} lang={lang} /></TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-500">{fmtRelativeDate(lastSignIn.get(member.id)?.lastSignInAt, lang)}</TableCell>
                          <TableCell className="px-4 py-3 text-xs text-slate-500">{fmtRelativeDate(member.createdAt, lang)}</TableCell>
                          <TableCell className="pe-4 text-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700" aria-label={isArabic ? "الإجراءات" : "Actions"}>
                                  <EllipsisVerticalIcon className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                {STAFF_ROLES.filter((r) => r.value !== member.role).map((r) => (
                                  <DropdownMenuItem key={r.value} onClick={() => setPendingAction({ kind: "role", member, nextRole: r.value })}>
                                    {isArabic ? `تعيين كـ${r.ar}` : `Set as ${r.en}`}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                {member.status !== "Suspended" ? (
                                  <DropdownMenuItem className="gap-2 text-rose-600 focus:text-rose-700" onClick={() => setPendingAction({ kind: "status", member, nextStatus: "Suspended" })}>
                                    <ShieldExclamationIcon className="h-4 w-4" />{isArabic ? "تعليق الحساب" : "Suspend"}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem className="gap-2 text-emerald-700 focus:text-emerald-800" onClick={() => setPendingAction({ kind: "status", member, nextStatus: "Active" })}>
                                    <CheckBadgeIcon className="h-4 w-4" />{isArabic ? "تنشيط الحساب" : "Reactivate"}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="gap-2" onClick={() => setPendingAction({ kind: "lock", member, locked: true })}>
                                  <LockClosedIcon className="h-4 w-4" />{isArabic ? "قفل الحساب" : "Lock account"}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2" onClick={() => setPendingAction({ kind: "lock", member, locked: false })}>
                                  <LockOpenIcon className="h-4 w-4" />{isArabic ? "فتح القفل" : "Unlock account"}
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
            </div>
          </>
        )}

        {!loading && total > 0 && (
          <AdminPaginationBar currentPage={page} totalPages={totalPages} totalItems={total} itemsPerPage={ITEMS_PER_PAGE} lang={lang} onPageChange={setPage} />
        )}
      </AdminSectionCard>

      {/* Detail drawer */}
      <AdminDetailDrawer
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        summary={detailSummary}
        lang={lang}
        roleLabel={detailMember ? getRoleLabel(detailMember.role, lang) : ""}
        statusBadge={detailMember ? <StatusBadge status={detailMember.status} lang={lang} /> : null}
      />

      {/* Confirm dialog for role / status / lock changes */}
      <AdminConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmedAction}
        lang={lang}
        tone={pendingAction?.kind === "status" && pendingAction.nextStatus === "Suspended" ? "danger" : pendingAction?.kind === "lock" && pendingAction.locked ? "warning" : "info"}
        title={
          pendingAction?.kind === "role"
            ? (isArabic ? "تغيير الصلاحية" : "Change role")
            : pendingAction?.kind === "status"
              ? (isArabic ? "تغيير الحالة" : "Change status")
              : pendingAction?.kind === "lock" && pendingAction.locked
                ? (isArabic ? "قفل الحساب" : "Lock account")
                : (isArabic ? "فتح قفل الحساب" : "Unlock account")
        }
        description={
          pendingAction
            ? (() => {
                const isSelf = pendingAction.member.id === viewer?.id;
                const selfWarning = buildSelfActionWarning(isArabic, isSelf);
                if (pendingAction.kind === "role") {
                  return (isArabic
                    ? `سيتم تعيين ${pendingAction.member.fullName || "المستخدم"} كـ${getRoleLabel(pendingAction.nextRole, lang)}.${selfWarning}`
                    : `${pendingAction.member.fullName || "This user"} will be set as ${getRoleLabel(pendingAction.nextRole, lang)}.${selfWarning}`);
                }
                if (pendingAction.kind === "status") {
                  return (isArabic
                    ? `سيتم تغيير حالة ${pendingAction.member.fullName || "المستخدم"} إلى ${translateStatus(pendingAction.nextStatus, lang)}.${selfWarning}`
                    : `${pendingAction.member.fullName || "This user"}'s status will change to ${translateStatus(pendingAction.nextStatus, lang)}.${selfWarning}`);
                }
                return pendingAction.locked
                  ? (isArabic ? `سيتم منع ${pendingAction.member.fullName || "المستخدم"} من تسجيل الدخول.${selfWarning}` : `${pendingAction.member.fullName || "This user"} will be blocked from signing in.${selfWarning}`)
                  : (isArabic ? `سيتمكن ${pendingAction.member.fullName || "المستخدم"} من تسجيل الدخول مجددًا.` : `${pendingAction.member.fullName || "This user"} will be able to sign in again.`);
              })()
            : ""
        }
      />

      {/* Add Staff Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !submitting && setDialogOpen(open)}>
        <DialogContent
          className={cn(
            "flex max-h-[92vh] flex-col overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0_32px_80px_-24px_rgba(15,23,42,0.45)] sm:max-w-2xl lg:max-w-3xl",
            "[&_[data-slot=dialog-close]]:top-5 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:h-9 [&_[data-slot=dialog-close]]:w-9 [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-white/20 [&_[data-slot=dialog-close]]:bg-white/10 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:backdrop-blur-md [&_[data-slot=dialog-close]]:transition [&_[data-slot=dialog-close]]:hover:bg-white/20",
            isArabic
              ? "[&_[data-slot=dialog-close]]:left-5 [&_[data-slot=dialog-close]]:right-auto"
              : "[&_[data-slot=dialog-close]]:left-auto [&_[data-slot=dialog-close]]:right-5",
          )}
        >
          <DialogHeader className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-teal-900 to-teal-700 px-6 py-6 pe-16 text-start sm:px-8 sm:py-7 sm:pe-20 sm:text-start">
            <div
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.35) 1px, transparent 0)", backgroundSize: "22px 22px" }}
            />
            <div className="pointer-events-none absolute -start-20 -top-24 h-56 w-56 rounded-full bg-teal-400/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 end-10 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="relative flex items-center gap-5">
              <div className="relative hidden shrink-0 sm:block">
                <span className="absolute -inset-2 rounded-2xl border border-white/10" />
                <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-xl shadow-slate-950/20 backdrop-blur-md">
                  <PlusIcon className="h-7 w-7" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-teal-200/20 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-teal-50 backdrop-blur-sm">
                  <UsersIcon className="h-3.5 w-3.5" />
                  {isArabic ? "إدارة فريق العمل" : "Workforce management"}
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight text-white sm:text-[1.7rem]">
                  {isArabic ? "إضافة موظف جديد" : "Add new employee"}
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-teal-50/75">
                  {isArabic
                    ? "أنشئ حسابًا آمنًا وحدد صلاحيات الوصول الأولية للموظف. يمكن تعديل الصلاحيات لاحقًا."
                    : "Create a secure staff account and assign its initial access level. Permissions can be updated later."}
                </DialogDescription>
                <div className="mt-3 hidden items-center gap-1.5 text-[11px] font-bold text-white/70 sm:flex">
                  <ShieldCheckIcon className="h-3.5 w-3.5 text-teal-200" />
                  {isArabic ? "إجراء آمن وموثّق" : "Secure, audited action"}
                </div>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleAddStaff} className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">1</span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{isArabic ? "البيانات الأساسية" : "Employee information"}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {isArabic ? "البيانات الرسمية للموظف كما ستظهر في النظام." : "Official details for the employee, as they will appear in the system."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminFormField label={isArabic ? "الاسم الكامل" : "Full name"} value={form.fullName} onChange={(v) => setForm((p) => ({ ...p, fullName: v }))} required />
                  <AdminFormField label={isArabic ? "اسم المستخدم" : "Username"} value={form.username} onChange={(v) => setForm((p) => ({ ...p, username: v }))} required />
                  <AdminFormField label={isArabic ? "البريد الإلكتروني" : "Email address"} type="email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} required />
                  <AdminFormField label={isArabic ? "رقم الهاتف" : "Phone number"} type="tel" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} required />
                </div>
              </section>

              <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm shadow-slate-200/40 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-xs font-black text-teal-700">2</span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{isArabic ? "الأمان والصلاحيات" : "Security and access"}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {isArabic ? "كلمة مرور مؤقتة، والدور، وحالة الحساب عند الإنشاء." : "Temporary password, role, and starting account status."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <AdminFormField label={isArabic ? "كلمة المرور المؤقتة" : "Temporary password"} type="password" value={form.password} onChange={(v) => setForm((p) => ({ ...p, password: v }))} required />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        passwordLength >= 8 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700",
                      )}>
                        <ShieldCheckIcon className="h-3.5 w-3.5" />
                        {passwordLength >= 8
                          ? (isArabic ? "صالحة" : "Valid")
                          : (isArabic ? "8 أحرف على الأقل" : "At least 8 characters")}
                      </span>
                      <p className="text-xs text-slate-500">
                        {isArabic ? "شاركها عبر قناة آمنة." : "Share it through a secure channel."}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <label htmlFor="new-staff-role" className="text-sm font-semibold text-slate-700">{isArabic ? "الدور الوظيفي" : "Staff role"}<span className="ms-1 text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        id="new-staff-role"
                        value={form.role}
                        onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as StaffRole }))}
                        className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pe-11 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
                      >
                        {STAFF_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{isArabic ? r.ar : r.en}</option>
                        ))}
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <label htmlFor="new-staff-status" className="text-sm font-semibold text-slate-700">{isArabic ? "حالة الحساب" : "Account status"}<span className="ms-1 text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        id="new-staff-status"
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as NewStaffStatus }))}
                        className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pe-11 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
                      >
                        <option value="Active">{isArabic ? "نشط — يمكنه تسجيل الدخول" : "Active — can sign in"}</option>
                        <option value="Inactive">{isArabic ? "غير نشط — لا يمكنه الوصول" : "Inactive — access disabled"}</option>
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>
              </section>

              {formError && (
                <div role="alert" aria-live="polite" className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <XCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <DialogFooter className="shrink-0 flex-row items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
                className="inline-flex h-11 min-w-24 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isArabic ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-sm font-black text-white shadow-sm shadow-teal-200 transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
                {submitting
                  ? (isArabic ? "جارٍ إنشاء الحساب…" : "Creating account…")
                  : (isArabic ? "إنشاء حساب الموظف" : "Create employee")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
