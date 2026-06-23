// StaffManager.tsx – admin-only · light mode · full role management dropdown
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  PauseCircleIcon,
  PlusIcon,
  ShieldCheckIcon,
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
import { getSupabaseClient } from "../../lib/supabaseClient";
import { createStaffUserViaSuperAdmin } from "../../services/adminStaffApi";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffStatus = "Active" | "Inactive" | "Suspended";
type SupabaseRole = "admin" | "manager" | "pharmacist" | "driver" | "customer";
type Language = "ar" | "en";
type StatusFilter = "all" | StaffStatus;

interface StaffMember {
  id: string;
  fullName: string;
  username: string;
  phone: string;
  email: string;
  role: string;
  status: StaffStatus;
}

// New: restricted role type for creating staff members
type StaffRole = Exclude<SupabaseRole, "customer">; // "admin" | "manager" | "pharmacist" | "driver"

type StaffFormState = {
  fullName: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  role: StaffRole; // only staff roles allowed for new accounts
  status: StaffStatus;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 12;
const STAFF_STATUS_OPTIONS: StaffStatus[] = ["Active", "Inactive", "Suspended"];
const ROLES: { value: SupabaseRole; ar: string; en: string }[] = [
  { value: "admin", ar: "مدير النظام", en: "Admin" },
  { value: "manager", ar: "مشرف", en: "Manager" },
  { value: "pharmacist", ar: "صيدلي", en: "Pharmacist" },
  { value: "driver", ar: "سائق", en: "Driver" },
  { value: "customer", ar: "عميل", en: "Customer" },
];
// Staff-only roles for the creation form
const STAFF_ROLES = ROLES.filter(
  (r) => r.value !== "customer"
) as { value: StaffRole; ar: string; en: string }[];

const EMPTY_FORM: StaffFormState = {
  fullName: "",
  username: "",
  phone: "",
  email: "",
  password: "",
  role: "pharmacist", // default to pharmacist (non‑customer)
  status: "Active",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleLabel(role: string, lang: Language): string {
  const entry = ROLES.find((r) => r.value === role);
  return lang === "ar" ? (entry?.ar ?? role) : (entry?.en ?? role);
}

function getStatusClasses(status: StaffStatus) {
  if (status === "Inactive") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Suspended") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function translateStatus(status: StaffStatus, lang: Language) {
  if (status === "Inactive") return lang === "ar" ? "غير نشط" : "Inactive";
  if (status === "Suspended") return lang === "ar" ? "موقوف" : "Suspended";
  return lang === "ar" ? "نشط" : "Active";
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

// ─── RoleSelect component (dropdown) ──────────────────────────────────────────

const RoleSelect = memo(function RoleSelect({
  member,
  lang,
  disabled,
  onChange,
}: {
  member: StaffMember;
  lang: Language;
  disabled: boolean;
  onChange: (member: StaffMember, nextRole: SupabaseRole) => void;
}) {
  return (
    <select
      value={member.role}
      onChange={(e) => onChange(member, e.target.value as SupabaseRole)}
      disabled={disabled}
      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-all duration-150 hover:border-slate-300 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>
          {lang === "ar" ? r.ar : r.en}
        </option>
      ))}
    </select>
  );
});

// ─── StaffStatusBadge ─────────────────────────────────────────────────────────

const STATUS_DOT: Record<StaffStatus, string> = {
  Active:    "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]",
  Inactive:  "bg-amber-400",
  Suspended: "bg-rose-500",
};

const StaffStatusBadge = memo(function StaffStatusBadge({
  status,
  lang,
}: {
  status: StaffStatus;
  lang: Language;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
        getStatusClasses(status)
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {translateStatus(status, lang)}
    </span>
  );
});

// ─── StaffStatusSelect ────────────────────────────────────────────────────────

const StaffStatusSelect = memo(function StaffStatusSelect({
  member,
  lang,
  disabled,
  onChange,
}: {
  member: StaffMember;
  lang: Language;
  disabled: boolean;
  onChange: (member: StaffMember, next: StaffStatus) => void;
}) {
  return (
    <select
      value={member.status}
      onChange={(e) => onChange(member, e.target.value as StaffStatus)}
      disabled={disabled}
      className="h-9 min-w-[8rem] rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {STAFF_STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {translateStatus(s, lang)}
        </option>
      ))}
    </select>
  );
});

// ─── StaffTableRow ────────────────────────────────────────────────────────────

const StaffTableRow = memo(function StaffTableRow({
  member,
  lang,
  updatingStatus,
  updatingRole,
  onStatusChange,
  onRoleChange,
  canEdit,
}: {
  member: StaffMember;
  lang: Language;
  updatingStatus: boolean;
  updatingRole: boolean;
  onStatusChange: (m: StaffMember, next: StaffStatus) => void;
  onRoleChange: (m: StaffMember, next: SupabaseRole) => void;
  canEdit: boolean;
}) {
  return (
    <TableRow className="border-slate-100 transition-colors hover:bg-slate-50/60">
      <TableCell className="px-4 py-3 align-top">
        <div className="flex min-w-[14rem] items-center gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
          >
            {(member.fullName || member.username || "A")
              .slice(0, 1)
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">
              {member.fullName || (lang === "ar" ? "موظف" : "Staff member")}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-400">
              {member.email ||
                (lang === "ar" ? "بدون بريد إلكتروني" : "No email")}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 text-sm text-slate-600" dir="ltr">
        {member.username}
      </TableCell>
      <TableCell className="px-4 py-3">
        <RoleSelect
          member={member}
          lang={lang}
          disabled={!canEdit || updatingRole}
          onChange={canEdit ? onRoleChange : () => {}}
        />
      </TableCell>
      <TableCell className="px-4 py-3 text-sm text-slate-600" dir="ltr">
        {member.phone}
      </TableCell>
      <TableCell className="px-4 py-3">
        <StaffStatusBadge status={member.status} lang={lang} />
      </TableCell>
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StaffStatusSelect
            member={member}
            lang={lang}
            disabled={!canEdit || updatingStatus}
            onChange={canEdit ? onStatusChange : () => {}}
          />
          {updatingStatus && (
            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-teal-600" />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

// ─── StaffMobileCard ──────────────────────────────────────────────────────────

const StaffMobileCard = memo(function StaffMobileCard({
  member,
  lang,
  updatingStatus,
  updatingRole,
  onStatusChange,
  onRoleChange,
  canEdit,
}: {
  member: StaffMember;
  lang: Language;
  updatingStatus: boolean;
  updatingRole: boolean;
  onStatusChange: (m: StaffMember, next: StaffStatus) => void;
  onRoleChange: (m: StaffMember, next: SupabaseRole) => void;
  canEdit: boolean;
}) {
  const roleColor: Record<string, string> = {
    admin:      "#0E7E74", manager: "#0ea5e9", pharmacist: "#8b5cf6",
    driver:     "#f59e0b", customer: "#64748b",
  };
  const rc = roleColor[member.role] ?? "#64748b";

  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
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
              {(member.fullName || member.username || "A").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">
                {member.fullName || (lang === "ar" ? "موظف" : "Staff member")}
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-400" dir="ltr">
                {member.username}
              </p>
            </div>
          </div>
          <StaffStatusBadge status={member.status} lang={lang} />
        </div>

        <div className="mt-3 grid gap-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
              {lang === "ar" ? "صلاحية الوصول" : "Access level"}
            </p>
            <div className="mt-2">
              <RoleSelect
                member={member}
                lang={lang}
                disabled={!canEdit || updatingRole}
                onChange={canEdit ? onRoleChange : () => {}}
              />
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
              {lang === "ar" ? "الهاتف" : "Phone"}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-700" dir="ltr">
              {member.phone || "—"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <StaffStatusSelect
            member={member}
            lang={lang}
            disabled={!canEdit || updatingStatus}
            onChange={canEdit ? onStatusChange : () => {}}
          />
          {updatingStatus && (
            <ArrowPathIcon className="h-4 w-4 animate-spin text-teal-600" />
          )}
        </div>
      </div>
    </article>
  );
});

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-all focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffManager() {
  const { lang } = useLanguage();
  const { isAdmin } = useAuth();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState("");
  const [updatingRoleId, setUpdatingRoleId] = useState("");
  const [formError, setFormError] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  // ── Load staff ────────────────────────────────────────────────────────────────
  const loadStaff = useCallback(
    async (_force = false, isRefresh = false) => {
      if (!isAdmin) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;

        const mapped: StaffMember[] = (data ?? []).map(
          (p: Record<string, unknown>) => ({
            id: String(p.id ?? ""),
            fullName: String(p.full_name || ""),
            email: String(p.email || ""),
            phone: String(p.phone || ""),
            role: String(p.role || "customer"),
            status: (p.status as StaffStatus) || "Active",
            username: String(p.username || ""),
          })
        );

        setStaff(mapped);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to load staff.";
        setError(msg);
        toast.error(
          lang === "ar"
            ? "حدث خطأ أثناء جلب البيانات"
            : "Failed to fetch data"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, lang]
  );

  useEffect(() => {
    if (isAdmin) {
      void loadStaff(false, false);
    }
  }, [isAdmin, loadStaff]);

  const roleOptions = useMemo(
    () =>
      Array.from(new Set(staff.map((m) => m.role).filter(Boolean))).sort(),
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return [...staff]
      .filter((m) => {
        if (roleFilter !== "all" && m.role !== roleFilter) return false;
        if (statusFilter !== "all" && m.status !== statusFilter) return false;
        if (!q) return true;
        return [m.fullName, m.username, m.phone, m.role, m.status, m.email]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        a.fullName.localeCompare(b.fullName, lang === "ar" ? "ar" : "en")
      );
  }, [debouncedSearch, lang, roleFilter, staff, statusFilter]);

  const summary = useMemo(
    () => ({
      total: staff.length,
      active: staff.filter((m) => m.status === "Active").length,
      inactive: staff.filter((m) => m.status === "Inactive").length,
      suspended: staff.filter((m) => m.status === "Suspended").length,
    }),
    [staff]
  );

  const activeFilterCount = useMemo(
    () =>
      [
        Boolean(debouncedSearch),
        roleFilter !== "all",
        statusFilter !== "all",
      ].filter(Boolean).length,
    [debouncedSearch, roleFilter, statusFilter]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStaff.length / ITEMS_PER_PAGE)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStaff.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredStaff]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  }, []);

  const handleAddStaff = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (
        !form.fullName ||
        !form.username ||
        !form.password ||
        !form.email ||
        !form.phone
      ) {
        setFormError(
          lang === "ar" ? "جميع الحقول مطلوبة" : "All fields are required"
        );
        return;
      }
      setSubmitting(true);
      setFormError("");
      try {
        const result = await createStaffUserViaSuperAdmin({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          username: form.username,
          password: form.password,
          role: form.role, // now StaffRole, exactly what the API expects
          status: form.status,
        });

        toast.success(
          result.message ||
            (lang === "ar"
              ? "تم إضافة الموظف بنجاح"
              : "Staff member added successfully")
        );
        setDialogOpen(false);
        void loadStaff(true, false);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to add staff member.";
        setFormError(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [form, lang, loadStaff]
  );

  const handleStatusChange = useCallback(
    async (member: StaffMember, nextStatus: StaffStatus) => {
      if (member.status === nextStatus) return;
      const prev = member.status;
      setUpdatingStatusId(member.id);
      startTransition(() => {
        setStaff((cur) =>
          cur.map((m) =>
            m.id === member.id ? { ...m, status: nextStatus } : m
          )
        );
      });
      try {
        const supabase = getSupabaseClient();
        const { error: e } = await supabase
          .from("profiles")
          .update({ status: nextStatus })
          .eq("id", member.id);
        if (e) throw e;
        toast.success(
          lang === "ar"
            ? "تم تحديث الحالة بنجاح"
            : "Status updated successfully"
        );
      } catch (err: unknown) {
        startTransition(() => {
          setStaff((cur) =>
            cur.map((m) =>
              m.id === member.id ? { ...m, status: prev } : m
            )
          );
        });
        toast.error(
          lang === "ar" ? "فشل في تحديث الحالة" : "Failed to update status"
        );
      } finally {
        setUpdatingStatusId("");
      }
    },
    [lang]
  );

  const handleRoleChange = useCallback(
    async (member: StaffMember, nextRole: SupabaseRole) => {
      if (member.role === nextRole) return;
      const prev = member.role;
      setUpdatingRoleId(member.id);
      startTransition(() => {
        setStaff((cur) =>
          cur.map((m) =>
            m.id === member.id ? { ...m, role: nextRole } : m
          )
        );
      });
      try {
        const supabase = getSupabaseClient();
        const { error: e } = await supabase
          .from("profiles")
          .update({ role: nextRole })
          .eq("id", member.id);
        if (e) throw e;
        toast.success(
          lang === "ar"
            ? `تم تعيين ${member.fullName || "المستخدم"} كـ${getRoleLabel(nextRole, lang)}`
            : `${member.fullName || "User"} is now ${getRoleLabel(nextRole, lang)}`
        );
      } catch {
        startTransition(() => {
          setStaff((cur) =>
            cur.map((m) =>
              m.id === member.id ? { ...m, role: prev } : m
            )
          );
        });
        toast.error(
          lang === "ar" ? "فشل في تغيير الصلاحية" : "Failed to change role"
        );
      } finally {
        setUpdatingRoleId("");
      }
    },
    [lang]
  );

  if (!isAdmin) return <UnauthorizedMessage lang={lang} />;

  const isInitialLoading = loading && !staff.length;
  const thClass =
    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-5">
      <AdminErrorBanner message={error} />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCard
          label={lang === "ar" ? "إجمالي الموظفين" : "Total employees"}
          value={summary.total}
          note={
            lang === "ar"
              ? `${filteredStaff.length} بعد التصفية`
              : `${filteredStaff.length} after filters`
          }
          icon={UsersIcon}
          tone="slate"
        />
        <AdminMetricCard
          label={lang === "ar" ? "حسابات نشطة" : "Active access"}
          value={summary.active}
          note={lang === "ar" ? "يمكنها الدخول الآن" : "Can sign in right now"}
          icon={CheckBadgeIcon}
          tone="emerald"
        />
        <AdminMetricCard
          label={lang === "ar" ? "غير نشط" : "Inactive"}
          value={summary.inactive}
          note={
            lang === "ar" ? "بحاجة لمراجعة" : "Need operational review"
          }
          icon={PauseCircleIcon}
          tone="amber"
        />
        <AdminMetricCard
          label={lang === "ar" ? "موقوف" : "Suspended"}
          value={summary.suspended}
          note={
            lang === "ar" ? "تم إيقاف الوصول" : "Access is suspended"
          }
          icon={XCircleIcon}
          tone="rose"
        />
      </section>

      <AdminSectionCard
        eyebrow={lang === "ar" ? "إدارة الموظفين" : "Employees manager"}
        title={
          lang === "ar" ? "مركز إدارة الفريق" : "Team operations center"
        }
        description={
          lang === "ar"
            ? "مساحة موحدة لإضافة الحسابات الجديدة ومراجعة الأدوار وحالة الوصول."
            : "A unified workspace for onboarding accounts, reviewing roles, and updating access states."
        }
        bodyClassName="space-y-4 px-0 py-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!activeFilterCount}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {lang === "ar" ? "إعادة ضبط" : "Reset"}
            </button>
            <button
              type="button"
              onClick={() => void loadStaff(true, true)}
              disabled={refreshing}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowPathIcon className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {lang === "ar" ? "تحديث" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDialogOpen(true);
                setForm(EMPTY_FORM);
                setFormError("");
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              <PlusIcon className="h-4 w-4" />
              {lang === "ar" ? "إضافة موظف" : "Add employee"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 px-4 md:px-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(10rem,1fr))]">
              <div className="grid gap-1">
                <span className="text-xs font-medium text-slate-500">
                  {lang === "ar" ? "بحث سريع" : "Quick search"}
                </span>
                <AdminSearchField
                  value={search}
                  onChange={setSearch}
                  className="w-full"
                  placeholder={
                    lang === "ar"
                      ? "ابحث باسم الموظف أو البريد"
                      : "Search by name or email"
                  }
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
              >
                <option value="all">
                  {lang === "ar" ? "جميع الأدوار" : "All roles"}
                </option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {getRoleLabel(r, lang)}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
              >
                <option value="all">
                  {lang === "ar" ? "جميع الحالات" : "All statuses"}
                </option>
                <option value="Active">
                  {lang === "ar" ? "نشط" : "Active"}
                </option>
                <option value="Inactive">
                  {lang === "ar" ? "غير نشط" : "Inactive"}
                </option>
                <option value="Suspended">
                  {lang === "ar" ? "موقوف" : "Suspended"}
                </option>
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {filteredStaff.length}{" "}
                {lang === "ar" ? "موظف مطابق" : "matching employees"}
              </span>
              {activeFilterCount > 0 && (
                <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-600">
                  {activeFilterCount}{" "}
                  {lang === "ar" ? "فلاتر نشطة" : "active filters"}
                </span>
              )}
            </div>
          </div>

          {isInitialLoading ? (
            <AdminTableSkeleton rows={7} />
          ) : !paginatedStaff.length ? (
            <AdminEmptyState
              title={
                lang === "ar"
                  ? "لا يوجد موظفين مطابقين"
                  : "No matching employees"
              }
              description={
                lang === "ar"
                  ? "جرّب تعديل الفلاتر أو مسح البحث."
                  : "Try adjusting filters or clearing the search."
              }
            />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:hidden">
                {paginatedStaff.map((member) => (
                  <StaffMobileCard
                    key={member.id}
                    member={member}
                    lang={lang}
                    updatingStatus={updatingStatusId === member.id}
                    updatingRole={updatingRoleId === member.id}
                    onStatusChange={handleStatusChange}
                    onRoleChange={handleRoleChange}
                    canEdit
                  />
                ))}
              </div>
              <div className="hidden xl:block">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[60rem]">
                      <TableHeader>
                        <TableRow className="border-slate-100 bg-slate-50/60">
                          <TableHead className={thClass}>
                            {lang === "ar" ? "الموظف" : "Employee"}
                          </TableHead>
                          <TableHead className={thClass}>
                            {lang === "ar" ? "اسم المستخدم" : "Username"}
                          </TableHead>
                          <TableHead className={thClass}>
                            {lang === "ar" ? "الدور" : "Role"}
                          </TableHead>
                          <TableHead className={thClass}>
                            {lang === "ar" ? "الهاتف" : "Phone"}
                          </TableHead>
                          <TableHead className={thClass}>
                            {lang === "ar" ? "الحالة" : "Status"}
                          </TableHead>
                          <TableHead className={thClass}>
                            {lang === "ar" ? "إجراءات" : "Actions"}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedStaff.map((member) => (
                          <StaffTableRow
                            key={member.id}
                            member={member}
                            lang={lang}
                            updatingStatus={updatingStatusId === member.id}
                            updatingRole={updatingRoleId === member.id}
                            onStatusChange={handleStatusChange}
                            onRoleChange={handleRoleChange}
                            canEdit
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <AdminPaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredStaff.length}
          itemsPerPage={ITEMS_PER_PAGE}
          lang={lang}
          onPageChange={setCurrentPage}
        />
      </AdminSectionCard>

      {/* Add Staff Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-lg">
          <DialogHeader className="border-b border-slate-100 px-5 py-4">
            <DialogTitle className="text-lg font-bold text-slate-800">
              {lang === "ar" ? "إضافة موظف جديد" : "Add new employee"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {lang === "ar"
                ? "أدخل بيانات الموظف لإنشاء حساب جديد."
                : "Enter the employee details to create a new account."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddStaff} className="space-y-4 px-5 py-4">
            <FormField
              label={lang === "ar" ? "الاسم الكامل" : "Full name"}
              value={form.fullName}
              onChange={(v) => setForm((p) => ({ ...p, fullName: v }))}
              required
            />
            <FormField
              label={lang === "ar" ? "اسم المستخدم" : "Username"}
              value={form.username}
              onChange={(v) => setForm((p) => ({ ...p, username: v }))}
              required
            />
            <FormField
              label={lang === "ar" ? "البريد الإلكتروني" : "Email"}
              type="email"
              value={form.email}
              onChange={(v) => setForm((p) => ({ ...p, email: v }))}
              required
            />
            <FormField
              label={lang === "ar" ? "رقم الهاتف" : "Phone number"}
              type="tel"
              value={form.phone}
              onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
              required
            />
            <FormField
              label={lang === "ar" ? "كلمة المرور" : "Password"}
              type="password"
              value={form.password}
              onChange={(v) => setForm((p) => ({ ...p, password: v }))}
              required
            />

            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                {lang === "ar" ? "الدور" : "Role"}
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    role: e.target.value as StaffRole,
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {lang === "ar" ? r.ar : r.en}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                {lang === "ar" ? "الحالة" : "Status"}
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    status: e.target.value as StaffStatus,
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
              >
                <option value="Active">
                  {lang === "ar" ? "نشط" : "Active"}
                </option>
                <option value="Inactive">
                  {lang === "ar" ? "غير نشط" : "Inactive"}
                </option>
                <option value="Suspended">
                  {lang === "ar" ? "موقوف" : "Suspended"}
                </option>
              </select>
            </div>

            {formError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </p>
            )}

            <DialogFooter className="gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
              >
                {submitting && (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                )}
                {lang === "ar" ? "إضافة" : "Add"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}