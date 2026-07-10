/**
 * OperationsHub.tsx
 * Delivery operations board for manager and admin.
 * Roles: admin, manager only.
 */

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  TruckIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  type AdminOrder,
  type StaffMember,
  type DeliveryAssignment,
  type DeliveryIssue,
  assignOrderDriver,
  getAdminOrders,
  getOpenAssignments,
  getOpenIssues,
  reassignOrderDriver,
  resolveDeliveryIssue,
  updateOrderStatus,
} from "../../services/googleSheetsApi";
import { getSupabaseStaff } from "../../services/adminDashboardApi";
import { subscribeToOperationsBoard } from "../../services/logisticsRealtime";
import { cn } from "../components/UI";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminMetricCard,
  AdminSectionCard,
  AdminTableSkeleton,
  AdminUnauthorized,
  type AdminRole,
} from "./adminShared";

type Language = "ar" | "en";
type OrderStatus = AdminOrder["status"];
type TabKey = "all" | "pending" | "processing" | "out" | "delivered" | "cancelled";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  Pending: ["Processing", "Out for Delivery", "Cancelled"],
  Processing: ["Out for Delivery", "Cancelled"],
  "Out for Delivery": ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

function getStatusLabel(status: OrderStatus, lang: Language): string {
  const labels: Record<OrderStatus, [string, string]> = {
    Pending:             ["في الانتظار",    "Pending"],
    Processing:          ["قيد التجهيز",   "Processing"],
    "Out for Delivery":  ["خارج للتسليم",  "Out for Delivery"],
    Delivered:           ["تم التسليم",     "Delivered"],
    Cancelled:           ["ملغي",           "Cancelled"],
  };
  return lang === "ar" ? labels[status][0] : labels[status][1];
}

function getStatusClasses(status: OrderStatus): string {
  const classes: Record<OrderStatus, string> = {
    Pending:             "border-amber-200 bg-amber-50 text-amber-700",
    Processing:          "border-violet-200 bg-violet-50 text-violet-700",
    "Out for Delivery":  "border-sky-200 bg-sky-50 text-sky-700",
    Delivered:           "border-emerald-200 bg-emerald-50 text-emerald-700",
    Cancelled:           "border-rose-200 bg-rose-50 text-rose-700",
  };
  return classes[status];
}

function formatDate(value: string, lang: Language): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "short", timeStyle: "short",
  }).format(d);
}

// ─── Delivery workflow: assignment status + issues ────────────────────────────

const ISSUE_REASON_LABELS: Record<string, [string, string]> = {
  customer_unreachable: ["تعذّر الوصول للعميل", "Customer unreachable"],
  wrong_address:        ["عنوان غير صحيح",       "Wrong address"],
  customer_refused:     ["رفض العميل الاستلام",  "Customer refused"],
  item_damaged:         ["المنتج تالف",           "Item damaged"],
  item_missing:         ["منتج مفقود",            "Item missing"],
  access_issue:         ["تعذّر الوصول للموقع",    "Access issue"],
  vehicle_breakdown:    ["عطل في المركبة",         "Vehicle breakdown"],
  other:                ["أخرى",                  "Other"],
};

function getIssueReasonLabel(reasonCode: string, lang: Language): string {
  const entry = ISSUE_REASON_LABELS[reasonCode];
  if (!entry) return reasonCode;
  return lang === "ar" ? entry[0] : entry[1];
}

function getAssignmentStatusLabel(status: "offered" | "accepted", lang: Language): string {
  if (status === "accepted") return lang === "ar" ? "قبل السائق" : "Accepted";
  return lang === "ar" ? "بانتظار الرد" : "Awaiting response";
}

/** Minutes elapsed since an assignment was offered, color-escalating the
 * longer it sits unresolved — a purely visual signal for manual staff
 * reassignment (this app deliberately has no automatic reassignment timer). */
const AssignmentAgeBadge = memo(function AssignmentAgeBadge({
  status,
  offeredAt,
  lang,
  nowTick,
}: {
  status: "offered" | "accepted";
  offeredAt: string;
  lang: Language;
  nowTick: number;
}) {
  const offered = new Date(offeredAt).getTime();
  const minutes = Number.isNaN(offered) ? 0 : Math.max(0, Math.round((nowTick - offered) / 60_000));
  const ageLabel = minutes < 60
    ? (lang === "ar" ? `منذ ${minutes} د` : `${minutes}m ago`)
    : (lang === "ar" ? `منذ ${Math.round(minutes / 60)} س` : `${Math.round(minutes / 60)}h ago`);

  // Only "offered" (awaiting a response) escalates in urgency — an
  // "accepted" assignment isn't stuck waiting on anyone, so it stays neutral.
  const tone = status === "accepted"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : minutes < 15
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : minutes < 45
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700 animate-pulse";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold", tone)}>
      <ClockIcon className="h-3 w-3" />
      {getAssignmentStatusLabel(status, lang)} · {ageLabel}
    </span>
  );
});

// ─── DriverSelect component ───────────────────────────────────────────────────

const DriverSelect = memo(function DriverSelect({
  order,
  drivers,
  lang,
  disabled,
  onChange,
}: {
  order: AdminOrder;
  drivers: StaffMember[];
  lang: Language;
  disabled: boolean;
  onChange: (orderId: string, driverId: string) => void;
}) {
  return (
    <select
      value={order.assignedDriverId ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(order.id, e.target.value)}
      className="h-9 min-w-[9rem] rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={lang === "ar" ? "اختر سائقاً" : "Assign driver"}
    >
      <option value="">{lang === "ar" ? "بدون سائق" : "Unassigned"}</option>
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.fullName || d.username}
        </option>
      ))}
    </select>
  );
});

// ─── StatusSelect component ───────────────────────────────────────────────────

const StatusSelect = memo(function StatusSelect({
  order,
  lang,
  disabled,
  onChange,
}: {
  order: AdminOrder;
  lang: Language;
  disabled: boolean;
  onChange: (order: AdminOrder, next: OrderStatus) => void;
}) {
  // If payment was rejected, only allow cancellation
  const allowed = order.paymentStatus === "failed" && order.status !== "Cancelled"
    ? (["Cancelled"] as OrderStatus[])
    : (STATUS_FLOW[order.status] ?? []);
  if (allowed.length === 0) {
    return <span className="text-sm text-slate-600">{getStatusLabel(order.status, lang)}</span>;
  }
  return (
    <select
      value={order.status}
      disabled={disabled}
      onChange={(e) => onChange(order, e.target.value as OrderStatus)}
      className="h-9 min-w-[9rem] rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value={order.status}>{getStatusLabel(order.status, lang)}</option>
      {allowed.map((s) => (
        <option key={s} value={s}>{getStatusLabel(s, lang)}</option>
      ))}
    </select>
  );
});

// ─── OrderRow (desktop table row) ────────────────────────────────────────────

const OrderRow = memo(function OrderRow({
  order,
  drivers,
  lang,
  updatingId,
  nowTick,
  onStatusChange,
  onDriverAssign,
}: {
  order: AdminOrder;
  drivers: StaffMember[];
  lang: Language;
  updatingId: string;
  nowTick: number;
  onStatusChange: (order: AdminOrder, next: OrderStatus) => void;
  onDriverAssign: (orderId: string, driverId: string) => void;
}) {
  const busy = updatingId === order.id;
  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-700" dir="ltr">{order.id}</p>
        <p className="mt-0.5 text-xs text-slate-400">{formatDate(order.orderDate, lang)}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-slate-700">{order.customerName || "—"}</p>
        <p className="mt-0.5 text-xs text-slate-400" dir="ltr">{order.customerPhone}</p>
        {order.customerAddress && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{order.customerAddress}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium", getStatusClasses(order.status))}>
          {getStatusLabel(order.status, lang)}
        </span>
      </td>
      <td className="px-4 py-3">
        <DriverSelect
          order={order}
          drivers={drivers}
          lang={lang}
          disabled={busy}
          onChange={onDriverAssign}
        />
        {order.assignmentStatus && order.assignmentOfferedAt && (
          <div className="mt-1.5">
            <AssignmentAgeBadge
              status={order.assignmentStatus}
              offeredAt={order.assignmentOfferedAt}
              lang={lang}
              nowTick={nowTick}
            />
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {busy && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-teal-600" />}
          <StatusSelect
            order={order}
            lang={lang}
            disabled={busy}
            onChange={onStatusChange}
          />
        </div>
      </td>
    </tr>
  );
});

// ─── OrderCard (mobile) ──────────────────────────────────────────────────────

function getStatusAccent(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    Pending:            "#f59e0b",
    Processing:         "#8b5cf6",
    "Out for Delivery": "#0ea5e9",
    Delivered:          "#10b981",
    Cancelled:          "#f43f5e",
  };
  return map[status] ?? "#64748b";
}

const OrderCard = memo(function OrderCard({
  order,
  drivers,
  lang,
  updatingId,
  nowTick,
  onStatusChange,
  onDriverAssign,
}: {
  order: AdminOrder;
  drivers: StaffMember[];
  lang: Language;
  updatingId: string;
  nowTick: number;
  onStatusChange: (order: AdminOrder, next: OrderStatus) => void;
  onDriverAssign: (orderId: string, driverId: string) => void;
}) {
  const busy = updatingId === order.id;
  const accent = getStatusAccent(order.status);
  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
    >
      <div className="h-[3px]" style={{ background: accent }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {lang === "ar" ? "رقم الطلب" : "Order ID"}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900" dir="ltr">
              #{order.id.slice(-8).toUpperCase()}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-400">{formatDate(order.orderDate, lang)}</p>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", getStatusClasses(order.status))}>
            {getStatusLabel(order.status, lang)}
          </span>
        </div>
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
          <p className="text-sm font-bold text-slate-800">{order.customerName || "—"}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-400" dir="ltr">{order.customerPhone}</p>
        </div>
        <div className="mt-3 space-y-2.5">
          <div>
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
              {lang === "ar" ? "تعيين سائق" : "Assign driver"}
            </p>
            <DriverSelect
              order={order}
              drivers={drivers}
              lang={lang}
              disabled={busy}
              onChange={onDriverAssign}
            />
            {order.assignmentStatus && order.assignmentOfferedAt && (
              <div className="mt-1.5">
                <AssignmentAgeBadge
                  status={order.assignmentStatus}
                  offeredAt={order.assignmentOfferedAt}
                  lang={lang}
                  nowTick={nowTick}
                />
              </div>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
              {lang === "ar" ? "الحالة" : "Status"}
            </p>
            <div className="flex items-center gap-2">
              {busy && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-teal-600" />}
              <StatusSelect
                order={order}
                lang={lang}
                disabled={busy}
                onChange={onStatusChange}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OperationsHub() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const userRole = (user?.role ?? "customer") as AdminRole;

  // Only admin and manager can access
  if (!["admin", "manager"].includes(userRole)) {
    return <AdminUnauthorized lang={lang} />;
  }

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [drivers, setDrivers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [openIssues, setOpenIssues] = useState<DeliveryIssue[]>([]);
  const [resolvingIssueId, setResolvingIssueId] = useState("");
  const [expandedIssueId, setExpandedIssueId] = useState("");
  const [issueNoteDrafts, setIssueNoteDrafts] = useState<Record<string, string>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Merges the current open (offered/accepted) delivery_assignments row for
  // each order onto that order's AdminOrder record, so the elapsed-time
  // badge can render without a second per-order lookup anywhere downstream.
  const mergeAssignments = useCallback((baseOrders: AdminOrder[], assignments: DeliveryAssignment[]): AdminOrder[] => {
    const byOrderId = new Map<string, DeliveryAssignment>();
    for (const a of assignments) {
      // If more than one open row somehow exists for an order, keep the
      // most recently offered one — that's the one actually in play.
      const existing = byOrderId.get(a.orderId);
      if (!existing || new Date(a.offeredAt) > new Date(existing.offeredAt)) {
        byOrderId.set(a.orderId, a);
      }
    }
    return baseOrders.map((order) => {
      const assignment = byOrderId.get(order.id);
      if (!assignment) return order;
      return {
        ...order,
        assignmentStatus: assignment.responseStatus === "accepted" ? "accepted" : "offered",
        assignmentOfferedAt: assignment.offeredAt,
      };
    });
  }, []);

  const loadData = useCallback(async (force = false, silent = false) => {
    if (!silent) setRefreshing(true);
    setError("");
    try {
      const [ordersData, staffData, assignmentsData, issuesData] = await Promise.all([
        getAdminOrders(force),
        getSupabaseStaff(),
        getOpenAssignments().catch(() => [] as DeliveryAssignment[]),
        getOpenIssues().catch(() => [] as DeliveryIssue[]),
      ]);
      const driverList = staffData.filter((m) => m.role === "driver" && m.status === "Active");
      startTransition(() => {
        setOrders(mergeAssignments(ordersData, assignmentsData));
        setDrivers(driverList);
        setOpenIssues(issuesData);
        setLoading(false);
        setRefreshing(false);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data.";
      setError(msg);
      setLoading(false);
      setRefreshing(false);
    }
  }, [mergeAssignments]);

  useEffect(() => {
    void loadData(false, false);
    pollingRef.current = setInterval(() => { void loadData(true, true); }, 60_000);
    // Separate, lighter-weight tick just to re-render elapsed-time badges —
    // no network call, so this can run more often than the data poll.
    tickRef.current = setInterval(() => setNowTick(Date.now()), 30_000);

    // Realtime layer: an order/assignment/issue change anywhere triggers an
    // immediate silent refresh instead of waiting for the next 60s poll.
    // Debounced — a single reassignment writes 2-3 rows in quick succession,
    // and this shouldn't fire a burst of refetches for one user action.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToOperationsBoard(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { void loadData(true, true); }, 600);
    });

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [loadData]);

  const handleStatusChange = useCallback(async (order: AdminOrder, next: OrderStatus) => {
    if (order.status === next) return;
    if (!STATUS_FLOW[order.status]?.includes(next)) {
      toast.error(lang === "ar" ? "تغيير الحالة غير مسموح" : "Invalid status transition");
      return;
    }
    const previousOrder = order;
    setUpdatingId(order.id);
    startTransition(() => {
      setOrders((cur) => cur.map((o) => o.id === order.id ? { ...o, status: next } : o));
    });
    try {
      const updatedOrder = await updateOrderStatus(order.id, next);
      startTransition(() => {
        setOrders((cur) => cur.map((o) => o.id === updatedOrder.id ? updatedOrder : o));
      });
      toast.success(lang === "ar" ? `تم تحديث الحالة إلى "${getStatusLabel(next, lang)}"` : `Status updated to "${getStatusLabel(next, lang)}"`);
    } catch {
      startTransition(() => {
        setOrders((cur) => cur.map((o) => o.id === previousOrder.id ? previousOrder : o));
      });
      toast.error(lang === "ar" ? "فشل تحديث الحالة" : "Failed to update status");
    } finally {
      setUpdatingId("");
    }
  }, [lang]);

  const handleDriverAssign = useCallback(async (orderId: string, driverId: string) => {
    const previousOrder = orders.find((o) => o.id === orderId);
    if (!previousOrder) return;
    const prev = previousOrder.assignedDriverId ?? "";
    if (prev === driverId) return;
    setUpdatingId(orderId);
    const driver = drivers.find((d) => d.id === driverId);

    // If there's already an open (offered/accepted) assignment for this
    // order, this is a REASSIGNMENT, not a first-time assignment — route
    // through reassignDriver so the prior driver gets notified and the
    // assignment ledger records the supersede, instead of silently
    // overwriting assigned_driver_id with no trace of the change.
    const isReassignment = Boolean(previousOrder.assignmentStatus) && Boolean(prev) && Boolean(driverId);

    startTransition(() => {
      setOrders((cur) => cur.map((o) =>
        o.id === orderId
          ? {
              ...o,
              assignedDriverId: driverId || undefined,
              assignedDriver: driver?.fullName ?? undefined,
              assignmentStatus: driverId ? "offered" : undefined,
              assignmentOfferedAt: driverId ? new Date().toISOString() : undefined,
            }
          : o,
      ));
    });
    try {
      const updatedOrder = isReassignment && user?.id
        ? await reassignOrderDriver(orderId, driverId, user.id)
        : await assignOrderDriver(orderId, driverId || null, user?.id);
      startTransition(() => {
        setOrders((cur) => cur.map((o) => o.id === updatedOrder.id
          ? { ...updatedOrder, assignmentStatus: driverId ? "offered" : undefined, assignmentOfferedAt: driverId ? new Date().toISOString() : undefined }
          : o));
      });
      toast.success(driver
        ? (isReassignment
            ? (lang === "ar" ? `تمت إعادة الإسناد إلى ${driver.fullName}.` : `Reassigned to ${driver.fullName}.`)
            : (lang === "ar" ? `تم تعيين ${driver.fullName} كسائق.` : `Driver ${driver.fullName} assigned.`))
        : lang === "ar" ? "تم إلغاء تعيين السائق." : "Driver unassigned.");
    } catch {
      startTransition(() => {
        setOrders((cur) => cur.map((o) =>
          o.id === orderId ? previousOrder : o,
        ));
      });
      toast.error(lang === "ar" ? "فشل تعيين السائق" : "Failed to assign driver");
    } finally {
      setUpdatingId("");
    }
  }, [drivers, lang, orders, user?.id]);

  const handleResolveIssue = useCallback(async (issueId: string) => {
    if (!user?.id) return;
    setResolvingIssueId(issueId);
    try {
      await resolveDeliveryIssue(issueId, user.id, issueNoteDrafts[issueId]?.trim() || undefined);
      startTransition(() => {
        setOpenIssues((cur) => cur.filter((i) => i.id !== issueId));
      });
      setExpandedIssueId("");
      toast.success(lang === "ar" ? "تم تحديد المشكلة كمحلولة" : "Issue marked resolved");
    } catch {
      toast.error(lang === "ar" ? "فشل تحديث المشكلة" : "Failed to resolve issue");
    } finally {
      setResolvingIssueId("");
    }
  }, [issueNoteDrafts, lang, user?.id]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const tabOk =
        activeTab === "all"        ? true :
        activeTab === "pending"    ? o.status === "Pending" :
        activeTab === "processing" ? o.status === "Processing" :
        activeTab === "out"        ? o.status === "Out for Delivery" :
        activeTab === "delivered"  ? o.status === "Delivered" :
        activeTab === "cancelled"  ? o.status === "Cancelled" : true;
      const driverOk =
        driverFilter === "all" ? true :
        driverFilter === "none" ? !o.assignedDriverId :
        o.assignedDriverId === driverFilter;
      const textOk = searchText.trim() === "" ||
        o.id.toLowerCase().includes(searchText.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchText.toLowerCase()) ||
        o.customerPhone.includes(searchText) ||
        (o.customerAddress && o.customerAddress.toLowerCase().includes(searchText.toLowerCase()));
      return tabOk && driverOk && textOk;
    });
  }, [activeTab, driverFilter, orders, searchText]);

  const summary = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((o) => o.status === "Pending").length,
    processing: orders.filter((o) => o.status === "Processing").length,
    outForDelivery: orders.filter((o) => o.status === "Out for Delivery").length,
    delivered: orders.filter((o) => o.status === "Delivered").length,
    cancelled: orders.filter((o) => o.status === "Cancelled").length,
    unassigned: orders.filter((o) => !o.assignedDriverId && o.status !== "Delivered" && o.status !== "Cancelled").length,
  }), [orders]);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all",        label: lang === "ar" ? "الكل" : "All",              count: orders.length },
    { key: "pending",    label: lang === "ar" ? "في الانتظار" : "Pending",   count: summary.pending },
    { key: "processing", label: lang === "ar" ? "قيد التجهيز" : "Processing", count: summary.processing },
    { key: "out",        label: lang === "ar" ? "خارج للتسليم" : "Out",      count: summary.outForDelivery },
    { key: "delivered",  label: lang === "ar" ? "تم التسليم" : "Delivered",  count: summary.delivered },
    { key: "cancelled",  label: lang === "ar" ? "ملغي" : "Cancelled",        count: summary.cancelled },
  ];

  const thClass = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <AdminMetricCard
          label={lang === "ar" ? "إجمالي الطلبات" : "Total orders"}
          value={summary.total}
          icon={ClipboardDocumentListIcon}
          tone="slate"
        />
        <AdminMetricCard
          label={lang === "ar" ? "في الانتظار / تجهيز" : "Pending / Processing"}
          value={summary.pending + summary.processing}
          tone="amber"
        />
        <AdminMetricCard
          label={lang === "ar" ? "خارج للتسليم" : "Out for delivery"}
          value={summary.outForDelivery}
          icon={TruckIcon}
          tone="sky"
        />
        <AdminMetricCard
          label={lang === "ar" ? "تم التسليم" : "Delivered"}
          value={summary.delivered}
          icon={CheckCircleIcon}
          tone="emerald"
        />
        <AdminMetricCard
          label={lang === "ar" ? "غير مسند" : "Unassigned"}
          value={summary.unassigned}
          icon={UserCircleIcon}
          tone={summary.unassigned > 0 ? "rose" : "emerald"}
          note={summary.unassigned > 0
            ? lang === "ar" ? "طلبات تحتاج تعيين سائق" : "Orders need driver assignment"
            : lang === "ar" ? "جميع الطلبات مسندة" : "All active orders assigned"}
        />
      </div>

      <AdminErrorBanner message={error} />

      <AdminSectionCard
        eyebrow={lang === "ar" ? "مركز العمليات" : "Operations hub"}
        title={lang === "ar" ? "لوحة التسليم" : "Delivery board"}
        description={lang === "ar" ? "إدارة تعيين السائقين وتحديث حالات التسليم من مكان واحد." : "Manage driver assignments and delivery status updates from a single board."}
        bodyClassName="space-y-4 px-0 py-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="relative w-full sm:w-56">
              <MagnifyingGlassIcon className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={lang === "ar" ? "بحث برقم الطلب أو العميل..." : "Search order ID, customer..."}
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
              />
            </div>
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
            >
              <option value="all">{lang === "ar" ? "جميع السائقين" : "All drivers"}</option>
              <option value="none">{lang === "ar" ? "غير مسند" : "Unassigned"}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.fullName || d.username}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadData(true, false)}
              disabled={refreshing}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowPathIcon className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {lang === "ar" ? "تحديث" : "Refresh"}
            </button>
          </div>
        }
      >
        <div className="border-b border-slate-100 px-4">
          <div className="flex gap-1 overflow-x-auto pb-0" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "border-b-2 border-teal-500 bg-teal-50/60 text-teal-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium",
                    activeTab === tab.key ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-2 pt-3">
          {loading ? (
            <AdminTableSkeleton rows={7} />
          ) : filteredOrders.length === 0 ? (
            <AdminEmptyState
              title={lang === "ar" ? "لا توجد طلبات مطابقة" : "No matching orders"}
              description={lang === "ar" ? "جرّب تغيير التبويب أو فلتر السائق أو البحث." : "Try a different tab, driver filter, or search term."}
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
                {filteredOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    drivers={drivers}
                    lang={lang}
                    updatingId={updatingId}
                    nowTick={nowTick}
                    onStatusChange={handleStatusChange}
                    onDriverAssign={handleDriverAssign}
                  />
                ))}
              </div>
              <div className="hidden xl:block">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-[60rem] w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className={thClass}>{lang === "ar" ? "رقم الطلب" : "Order ID"}</th>
                          <th className={thClass}>{lang === "ar" ? "العميل" : "Customer"}</th>
                          <th className={thClass}>{lang === "ar" ? "الحالة" : "Status"}</th>
                          <th className={thClass}>{lang === "ar" ? "السائق" : "Driver"}</th>
                          <th className={thClass}>{lang === "ar" ? "تحديث الحالة" : "Update status"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((o) => (
                          <OrderRow
                            key={o.id}
                            order={o}
                            drivers={drivers}
                            lang={lang}
                            updatingId={updatingId}
                            nowTick={nowTick}
                            onStatusChange={handleStatusChange}
                            onDriverAssign={handleDriverAssign}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {drivers.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {lang === "ar" ? "حالة السائقين" : "Driver utilisation"}
            </p>
            <div className="flex flex-wrap gap-2">
              {drivers.map((d) => {
                const assigned = orders.filter(
                  (o) => o.assignedDriverId === d.id && o.status !== "Delivered" && o.status !== "Cancelled",
                ).length;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDriverFilter(driverFilter === d.id ? "all" : d.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      driverFilter === d.id
                        ? "border-teal-300 bg-teal-50 text-teal-700"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    <TruckIcon className="h-3 w-3" />
                    {d.fullName || d.username}
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium",
                        driverFilter === d.id ? "bg-teal-500 text-white" : "bg-slate-200 text-slate-500",
                      )}
                    >
                      {assigned}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </AdminSectionCard>

      <AdminSectionCard
        eyebrow={lang === "ar" ? "مشاكل التوصيل" : "Delivery issues"}
        title={lang === "ar" ? "مشاكل بلّغ عنها السائقون" : "Driver-reported issues"}
        description={lang === "ar"
          ? "مشاكل تحتاج مراجعة فريق العمليات — عنوان خاطئ، تعذّر الوصول للعميل، منتج تالف، وغيرها."
          : "Problems that need operations attention — wrong address, unreachable customer, damaged item, and similar."}
        bodyClassName="space-y-3 px-4 py-4"
      >
        {loading ? (
          <AdminTableSkeleton rows={2} />
        ) : openIssues.length === 0 ? (
          <AdminEmptyState
            title={lang === "ar" ? "لا توجد مشاكل مفتوحة" : "No open issues"}
            description={lang === "ar" ? "كل التوصيلات تسير دون مشاكل مُبلَّغ عنها." : "All deliveries are proceeding without any reported problems."}
          />
        ) : (
          <div className="space-y-2.5">
            {openIssues.map((issue) => {
              const driver = drivers.find((d) => d.id === issue.driverId);
              const order = orders.find((o) => o.id === issue.orderId);
              const reportedMinutesAgo = Math.max(0, Math.round((nowTick - new Date(issue.createdAt).getTime()) / 60_000));
              const ageLabel = reportedMinutesAgo < 60
                ? (lang === "ar" ? `منذ ${reportedMinutesAgo} د` : `${reportedMinutesAgo}m ago`)
                : (lang === "ar" ? `منذ ${Math.round(reportedMinutesAgo / 60)} س` : `${Math.round(reportedMinutesAgo / 60)}h ago`);
              const expanded = expandedIssueId === issue.id;
              const resolving = resolvingIssueId === issue.id;

              return (
                <div
                  key={issue.id}
                  className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-700">
                          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                          {getIssueReasonLabel(issue.reasonCode, lang)}
                        </span>
                        <span className="text-xs font-medium text-slate-400">{ageLabel}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-slate-700" dir="ltr">
                        {lang === "ar" ? "الطلب: " : "Order: "}{issue.orderId}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {lang === "ar" ? "السائق: " : "Driver: "}
                        {driver?.fullName || driver?.username || issue.driverId}
                        {order?.customerName ? ` · ${order.customerName}` : ""}
                      </p>
                      {issue.note && (
                        <p className="mt-1.5 rounded-md bg-white/70 px-2.5 py-1.5 text-xs text-slate-600">
                          {issue.note}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedIssueId(expanded ? "" : issue.id)}
                      disabled={resolving}
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      {lang === "ar" ? "حل المشكلة" : "Resolve"}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-3 border-t border-rose-100 pt-3">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {lang === "ar" ? "ملاحظة الحل (اختياري)" : "Resolution note (optional)"}
                      </label>
                      <textarea
                        value={issueNoteDrafts[issue.id] ?? ""}
                        onChange={(e) => setIssueNoteDrafts((cur) => ({ ...cur, [issue.id]: e.target.value }))}
                        rows={2}
                        placeholder={lang === "ar" ? "مثال: تواصلنا مع العميل وتم تحديد موعد جديد." : "e.g. Contacted the customer and rescheduled."}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedIssueId("")}
                          disabled={resolving}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          {lang === "ar" ? "إلغاء" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleResolveIssue(issue.id)}
                          disabled={resolving}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {resolving && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
                          {lang === "ar" ? "تأكيد الحل" : "Confirm resolved"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
