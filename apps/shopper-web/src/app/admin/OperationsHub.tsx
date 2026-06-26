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
  assignOrderDriver,
  getAdminOrders,
  getStaff,
  updateOrderStatus,
} from "../../services/googleSheetsApi";
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
  onStatusChange,
  onDriverAssign,
}: {
  order: AdminOrder;
  drivers: StaffMember[];
  lang: Language;
  updatingId: string;
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
  onStatusChange,
  onDriverAssign,
}: {
  order: AdminOrder;
  drivers: StaffMember[];
  lang: Language;
  updatingId: string;
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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (force = false, silent = false) => {
    if (!silent) setRefreshing(true);
    setError("");
    try {
      const [ordersData, staffData] = await Promise.all([
        getAdminOrders(force),
        getStaff(force),
      ]);
      const driverList = staffData.filter((m) => m.role === "driver" && m.status === "Active");
      startTransition(() => {
        setOrders(ordersData);
        setDrivers(driverList);
        setLoading(false);
        setRefreshing(false);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data.";
      setError(msg);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false, false);
    pollingRef.current = setInterval(() => { void loadData(true, true); }, 60_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
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
    startTransition(() => {
      setOrders((cur) => cur.map((o) =>
        o.id === orderId
          ? { ...o, assignedDriverId: driverId || undefined, assignedDriver: driver?.fullName ?? undefined }
          : o,
      ));
    });
    try {
      const updatedOrder = await assignOrderDriver(orderId, driverId || null);
      startTransition(() => {
        setOrders((cur) => cur.map((o) => o.id === updatedOrder.id ? updatedOrder : o));
      });
      toast.success(driver
        ? lang === "ar" ? `تم تعيين ${driver.fullName} كسائق.` : `Driver ${driver.fullName} assigned.`
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
  }, [drivers, lang, orders]);

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
    </div>
  );
}
