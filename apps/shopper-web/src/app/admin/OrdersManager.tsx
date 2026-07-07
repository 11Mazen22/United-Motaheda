/**
 * OrdersManager.tsx
 * Macro-level order operations list for admin and manager roles.
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
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  FunnelIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  type AdminOrder as LegacyAdminOrder,
  type OrderStatus as ApiOrderStatus,
} from "../../services/googleSheetsApi";
import { normalizeOrderStatus as normalizeCanonicalStatus } from "@pharmacy/contracts";
import {
  fetchAdminOrders,
  adminUpdateOrderStatus,
  adminVerifyPayment,
  adminRejectPayment,
  type AdminOrder as SupabaseAdminOrder,
  type AdminOrderItem,
} from "../../services/adminOrdersApi";
import { cn } from "../components/UI";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminFilterChip,
  AdminMetricCard,
  AdminPaginationBar,
  AdminSearchField,
  AdminSectionCard,
  AdminTabBar,
  AdminTableSkeleton,
  AdminUnauthorized,
  type AdminRole,
  useDebouncedValue,
} from "./adminShared";

type OrderStatus = ApiOrderStatus;
type Language = "ar" | "en";

// Bridge: adapt SupabaseAdminOrder to the legacy AdminOrder shape so the
// existing table / card components continue working while we progressively
// upgrade the UI.
type AdminOrder = LegacyAdminOrder & {
  // Extended fields from the Supabase query
  paymentStatus:   string;
  paymentProofUrl: string | null;
  transferNumber:  string | null;
  items:           AdminOrderItem[];
};

function supabaseToAdminOrder(o: SupabaseAdminOrder): AdminOrder {
  const addr = o.customerAddress as Record<string, string> | null;
  const formattedAddress =
    typeof addr?.formatted === "string"
      ? addr.formatted
      : [addr?.streetLine, addr?.city].filter(Boolean).join(", ");

  // Map every canonical DB status (see @pharmacy/contracts orderStatus.ts)
  // to the 5-bucket legacy Title-Case enum this screen displays. Buckets
  // confirmed/ready alongside their adjacent stage so nothing silently
  // falls back to "Pending" just because this screen predates them.
  const statusMap: Record<string, OrderStatus> = {
    pending:         "Pending",
    pending_payment: "Pending",
    confirmed:       "Pending",
    processing:      "Processing",
    preparing:       "Processing",
    ready:           "Out for Delivery",
    shipped:         "Out for Delivery",
    picked_up:       "Out for Delivery",
    delivered:       "Delivered",
    cancelled:       "Cancelled",
  };

  return {
    id:              o.id,
    customerName:    o.customerName,
    customerPhone:   o.customerPhone,
    customerAddress: formattedAddress,
    productCodes:    o.items.map((i) => i.productId),
    totalPrice:      o.total,
    address:         formattedAddress,
    note:            o.note,
    orderDate:       o.createdAt,
    status:          statusMap[normalizeCanonicalStatus(o.status)] ?? "Pending",
    paymentMethod:   o.paymentMethod ?? "cod",
    paymentLabel:    getPaymentLabel(o.paymentMethod),
    requestPosMachine: false,
    assignedDriver:  undefined,
    assignedDriverId: undefined,
    // extended
    paymentStatus:   o.paymentStatus,
    paymentProofUrl: o.paymentProofUrl,
    transferNumber:  o.transferNumber,
    items:           o.items,
  };
}

function getPaymentLabel(method: string | null): string {
  switch (method) {
    case "cod":           return "الدفع عند الاستلام";
    case "vodafone":
    case "vodafone_cash": return "فودافون كاش";
    case "instapay":      return "إنستاباي";
    default:              return method ?? "—";
  }
}
type DatePreset = "all" | "today" | "last7" | "last30" | "custom";
type TabKey = "all" | "pending" | "processing" | "out" | "delivered" | "cancelled";

const ORDER_STATUSES: OrderStatus[] = [
  "Pending",
  "Processing",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const ITEMS_PER_PAGE = 15;

function getStatusLabel(status: OrderStatus, lang: Language): string {
  const map: Record<OrderStatus, [string, string]> = {
    Pending: ["في الانتظار", "Pending"],
    Processing: ["قيد التجهيز", "Processing"],
    "Out for Delivery": ["خارج للتسليم", "Out for Delivery"],
    Delivered: ["تم التسليم", "Delivered"],
    Cancelled: ["ملغي", "Cancelled"],
  };
  return lang === "ar" ? map[status][0] : map[status][1];
}

function getStatusClasses(status: OrderStatus): string {
  if (status === "Delivered") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Out for Delivery") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "Processing") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getStatusDot(status: OrderStatus): string {
  if (status === "Delivered") return "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]";
  if (status === "Cancelled") return "bg-rose-500";
  if (status === "Out for Delivery") return "bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.7)]";
  if (status === "Processing") return "bg-violet-500";
  return "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)]";
}

function formatCurrency(value: number, lang: Language): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
  }).format(date);
}

function getPresetRange(preset: Exclude<DatePreset, "custom" | "all">) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (preset === "last7") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "last30") {
    start.setDate(start.getDate() - 29);
  }

  return { start, end };
}

function isWithinSelectedDateRange(orderDate: string, preset: DatePreset, dateFrom: string, dateTo: string) {
  const value = new Date(orderDate);
  if (Number.isNaN(value.getTime())) return false;

  if (preset === "all") return true;

  if (preset === "today" || preset === "last7" || preset === "last30") {
    const { start, end } = getPresetRange(preset);
    return value >= start && value <= end;
  }

  if (preset === "custom") {
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      if (value < start) return false;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (value > end) return false;
    }
  }

  return true;
}

function allowedNextStatuses(current: OrderStatus, role: AdminRole, paymentStatus?: string): OrderStatus[] {
  if (role === "driver") {
    return current === "Out for Delivery" ? ["Delivered"] : [];
  }
  // Failed payment — only cancellation is valid
  if (paymentStatus === "failed" && current !== "Cancelled") {
    return ["Cancelled"];
  }
  return ORDER_STATUSES.filter((status) => status !== current);
}

const StatusSelect = memo(function StatusSelect({
  order,
  lang,
  role,
  disabled,
  onChange,
}: {
  order: AdminOrder;
  lang: Language;
  role: AdminRole;
  disabled: boolean;
  onChange: (order: AdminOrder, next: OrderStatus) => void;
}) {
  const options = allowedNextStatuses(order.status, role, order.paymentStatus);
  if (!options.length) {
    return (
      <span className={cn("admin-badge", getStatusClasses(order.status))}>
        <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDot(order.status))} />
        {getStatusLabel(order.status, lang)}
      </span>
    );
  }

  return (
    <select
      value={order.status}
      disabled={disabled}
      onChange={(event) => onChange(order, event.target.value as OrderStatus)}
      className="admin-input h-10 min-w-[11rem] rounded-[1rem] border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
      aria-label={lang === "ar" ? "تغيير الحالة" : "Change status"}
    >
      <option value={order.status} disabled>{getStatusLabel(order.status, lang)}</option>
      {options.map((status) => (
        <option key={status} value={status}>{getStatusLabel(status, lang)}</option>
      ))}
    </select>
  );
});

function getStatusAccentColor(status: OrderStatus): string {
  if (status === "Delivered") return "#10b981";
  if (status === "Cancelled") return "#f43f5e";
  if (status === "Out for Delivery") return "#0ea5e9";
  if (status === "Processing") return "#8b5cf6";
  return "#f59e0b";
}

const OrderCard = memo(function OrderCard({
  order,
  lang,
  updating,
  onStatusChange,
}: {
  order: AdminOrder;
  lang: Language;
  updating: boolean;
  onStatusChange: (order: AdminOrder, next: OrderStatus) => void;
}) {
  const accent = getStatusAccentColor(order.status);
  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
    >
      {/* Status accent top bar */}
      <div className="h-[3px]" style={{ background: accent }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{lang === "ar" ? "رقم الطلب" : "Order ID"}</p>
            <p className="mt-1 truncate text-sm font-bold text-slate-900" dir="ltr">#{order.id.slice(-8).toUpperCase()}</p>
          </div>
          <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold", getStatusClasses(order.status))}>
            <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDot(order.status))} />
            {getStatusLabel(order.status, lang)}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
          <p className="text-sm font-bold text-slate-900">{order.customerName || (lang === "ar" ? "عميل" : "Customer")}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500" dir="ltr">{order.customerPhone}</p>
          {order.customerAddress && <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{order.customerAddress}</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-black text-slate-950">{formatCurrency(order.totalPrice, lang)}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatDate(order.orderDate, lang)}</p>
            {order.assignedDriver && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                <TruckIcon className="h-3 w-3 text-sky-500" />
                {order.assignedDriver}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {updating && <ArrowPathIcon className="h-4 w-4 animate-spin text-teal-600" />}
            <StatusSelect order={order} lang={lang} role="manager" disabled={updating} onChange={onStatusChange} />
          </div>
        </div>
      </div>
    </article>
  );
});

// ─── Payment status helpers ───────────────────────────────────────────────────

function getPaymentStatusBadge(status: string) {
  switch (status) {
    case "pending_verification":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]" />
          بانتظار التحقق
        </span>
      );
    case "verified":
    case "paid":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
          <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
          تم التحقق
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">
          <XCircleIcon className="h-3 w-3 text-rose-500" />
          مرفوض
        </span>
      );
    default:
      return null;
  }
}

// ─── Expandable order table row ───────────────────────────────────────────────

const OrderTableRow = memo(function OrderTableRow({
  order,
  lang,
  updating,
  onStatusChange,
  onVerifyPayment,
  onRejectPayment,
}: {
  order:           AdminOrder;
  lang:            Language;
  updating:        boolean;
  onStatusChange:  (order: AdminOrder, next: OrderStatus) => void;
  onVerifyPayment: (orderId: string) => void;
  onRejectPayment: (orderId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const hasProof    = Boolean(order.paymentProofUrl);
  const isManual    = order.paymentMethod !== "cod" && order.paymentMethod !== "";
  const needsReview = isManual && order.paymentStatus === "pending_verification";

  return (
    <>
      <tr
        className={cn(
          "border-b border-slate-100 transition-colors hover:bg-slate-50/60 cursor-pointer",
          expanded && "bg-slate-50/80",
        )}
        onClick={() => setExpanded((v) => !v)}>
        {/* Order ID */}
        <td className="px-5 py-4">
          <p className="text-sm font-bold text-slate-900" dir="ltr">
            #{order.id.slice(-8).toUpperCase()}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400" dir="ltr">{order.id}</p>
        </td>

        {/* Customer */}
        <td className="px-5 py-4">
          <p className="text-sm font-bold text-slate-900">{order.customerName || "—"}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500" dir="ltr">{order.customerPhone}</p>
        </td>

        {/* Items preview */}
        <td className="px-5 py-4">
          {order.items.length > 0 ? (
            <div className="flex items-center gap-2">
              {order.items.slice(0, 3).map((item) => (
                item.imageUrl ? (
                  <img
                    key={item.productId}
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-8 w-8 rounded-md border border-slate-100 object-contain bg-white"
                  />
                ) : (
                  <div key={item.productId} className="h-8 w-8 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400">💊</span>
                  </div>
                )
              ))}
              {order.items.length > 3 && (
                <span className="text-xs font-semibold text-slate-400">+{order.items.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>

        {/* Status */}
        <td className="px-5 py-4">
          <span className={cn("admin-badge", getStatusClasses(order.status))}>
            <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDot(order.status))} />
            {getStatusLabel(order.status, lang)}
          </span>
        </td>

        {/* Payment */}
        <td className="px-5 py-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-700">{order.paymentLabel}</span>
            {getPaymentStatusBadge(order.paymentStatus)}
          </div>
        </td>

        {/* Total */}
        <td className="px-5 py-4 text-sm font-bold text-slate-900">
          {formatCurrency(order.totalPrice, lang)}
        </td>

        {/* Date */}
        <td className="px-5 py-4 text-xs font-semibold text-slate-500">
          {formatDate(order.orderDate, lang)}
        </td>

        {/* Actions */}
        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {updating && <ArrowPathIcon className="h-4 w-4 animate-spin text-teal-600" />}
            <StatusSelect order={order} lang={lang} role="manager" disabled={updating} onChange={onStatusChange} />
          </div>
        </td>
      </tr>

      {/* ── Expanded panel ──────────────────────────────────────────────── */}
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={8} className="px-6 py-5">
            <div className="grid gap-6 sm:grid-cols-2">

              {/* Items list */}
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  {lang === "ar" ? "المنتجات" : "Items"}
                </p>
                {order.items.length === 0 ? (
                  <p className="text-xs text-slate-400">{lang === "ar" ? "لا توجد منتجات" : "No items"}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {order.items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-10 w-10 rounded-md border border-slate-100 object-contain"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center text-lg">💊</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900" dir="rtl">
                            {item.name || (lang === "ar" ? "منتج" : "Product")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {lang === "ar" ? "الكمية" : "Qty"}: {item.quantity} × {formatCurrency(item.unitPrice, lang)}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{formatCurrency(item.lineTotal, lang)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment proof */}
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  {lang === "ar" ? "الدفع والإيصال" : "Payment & Proof"}
                </p>

                {order.transferNumber && (
                  <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">{lang === "ar" ? "رقم المُرسِل" : "Transfer number"}</p>
                    <p className="mt-1 text-sm font-bold text-slate-900" dir="ltr">{order.transferNumber}</p>
                  </div>
                )}

                {hasProof ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setProofOpen(true)}
                      className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <img
                        src={order.paymentProofUrl!}
                        alt="payment proof"
                        className="h-36 w-full object-cover"
                      />
                      <p className="py-2 text-center text-xs font-bold text-slate-600">
                        {lang === "ar" ? "انقر لتكبير الإيصال" : "Click to enlarge"}
                      </p>
                    </button>

                    {needsReview && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onVerifyPayment(order.id)}
                          className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">
                          ✓ {lang === "ar" ? "قبول الدفع" : "Verify Payment"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectPayment(order.id)}
                          className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 transition-colors">
                          ✗ {lang === "ar" ? "رفض الدفع" : "Reject Payment"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : isManual ? (
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-700">
                      {lang === "ar" ? "لم يُرفع إيصال الدفع بعد" : "No payment proof uploaded yet"}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-100 bg-white px-4 py-3">
                    <p className="text-xs text-slate-400">
                      {lang === "ar" ? "الدفع عند الاستلام — لا يوجد إيصال" : "Cash on delivery — no proof required"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* ── Proof image lightbox ─────────────────────────────────────────── */}
      {proofOpen && order.paymentProofUrl && (
        <tr>
          <td colSpan={8}>
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => setProofOpen(false)}>
              <div className="relative max-h-[90vh] max-w-[90vw] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <img
                  src={order.paymentProofUrl}
                  alt="payment proof"
                  className="max-h-[85vh] max-w-[88vw] object-contain"
                />
                <button
                  type="button"
                  onClick={() => setProofOpen(false)}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
                  ✕
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

export default function OrdersManager() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const userRole = (user?.role ?? "customer") as AdminRole;

  if (!["admin", "manager"].includes(userRole)) {
    return <AdminUnauthorized lang={lang} />;
  }

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [pendingById, setPendingById] = useState<Record<string, true>>({});
  const firstLoadRef = useRef(true);

  const debouncedSearch = useDebouncedValue(search, 250);
  const hasInvalidCustomRange = datePreset === "custom" && Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const loadOrders = useCallback(async (_force = false) => {
    if (!firstLoadRef.current) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      // Fetch all pages in one call (pageSize=200 covers most volumes).
      const { orders: fetched } = await fetchAdminOrders({ pageSize: 200 });
      const mapped = fetched.map(supabaseToAdminOrder);
      startTransition(() => {
        setOrders(mapped);
        setLoading(false);
        setRefreshing(false);
        firstLoadRef.current = false;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load orders.");
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const setRowPending = useCallback((orderId: string, value: boolean) => {
    setPendingById((current) => {
      if (value) {
        return { ...current, [orderId]: true };
      }
      const next = { ...current };
      delete next[orderId];
      return next;
    });
  }, []);

  const handleStatusChange = useCallback(async (order: AdminOrder, nextStatus: OrderStatus) => {
    if (order.status === nextStatus || pendingById[order.id]) return;

    // Map legacy capitalized UI status → canonical DB status. Targets the
    // same spellings as the Operations Hub (mapLegacyToCanonicalOrderStatus
    // in googleSheetsApi.ts) so both admin screens write identical values
    // for the same action instead of two different strings for one state.
    const statusMapReverse: Record<OrderStatus, string> = {
      Pending:            "pending",
      Processing:         "preparing",
      "Out for Delivery": "picked_up",
      Delivered:          "delivered",
      Cancelled:          "cancelled",
    };
    const supabaseStatus = statusMapReverse[nextStatus] as import("../../services/adminOrdersApi").AdminOrderStatus;

    const previousOrder = order;
    setRowPending(order.id, true);
    startTransition(() => {
      setOrders((current) => current.map((entry) => (
        entry.id === order.id ? { ...entry, status: nextStatus } : entry
      )));
    });

    try {
      await adminUpdateOrderStatus(order.id, supabaseStatus);
      toast.success(
        lang === "ar"
          ? `تم تحديث حالة الطلب إلى "${getStatusLabel(nextStatus, lang)}"`
          : `Order status updated to "${getStatusLabel(nextStatus, lang)}"`,
      );
    } catch {
      startTransition(() => {
        setOrders((current) => current.map((entry) => (
          entry.id === previousOrder.id ? previousOrder : entry
        )));
      });
      toast.error(lang === "ar" ? "فشل تحديث حالة الطلب" : "Failed to update order status");
    } finally {
      setRowPending(order.id, false);
    }
  }, [lang, pendingById, setRowPending]);

  const handleVerifyPayment = useCallback(async (orderId: string) => {
    if (pendingById[orderId]) return;
    const previousOrder = orders.find((o) => o.id === orderId);
    if (!previousOrder) return;

    setRowPending(orderId, true);
    startTransition(() => {
      setOrders((current) => current.map((entry) =>
        entry.id === orderId ? { ...entry, paymentStatus: "verified" } : entry,
      ));
    });

    try {
      await adminVerifyPayment(orderId);
      toast.success(lang === "ar" ? "تم قبول الدفع بنجاح" : "Payment verified successfully");
    } catch {
      startTransition(() => {
        setOrders((current) => current.map((entry) =>
          entry.id === orderId ? previousOrder : entry,
        ));
      });
      toast.error(lang === "ar" ? "فشل قبول الدفع" : "Failed to verify payment");
    } finally {
      setRowPending(orderId, false);
    }
  }, [lang, orders, pendingById, setRowPending]);

  const handleRejectPayment = useCallback(async (orderId: string) => {
    if (pendingById[orderId]) return;
    const previousOrder = orders.find((o) => o.id === orderId);
    if (!previousOrder) return;

    setRowPending(orderId, true);
    startTransition(() => {
      setOrders((current) => current.map((entry) =>
        entry.id === orderId ? { ...entry, paymentStatus: "failed" } : entry,
      ));
    });

    try {
      await adminRejectPayment(orderId);
      toast.success(lang === "ar" ? "تم رفض الدفع" : "Payment rejected");
    } catch {
      startTransition(() => {
        setOrders((current) => current.map((entry) =>
          entry.id === orderId ? previousOrder : entry,
        ));
      });
      toast.error(lang === "ar" ? "فشل رفض الدفع" : "Failed to reject payment");
    } finally {
      setRowPending(orderId, false);
    }
  }, [lang, orders, pendingById, setRowPending]);

  const filteredOrders = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const tabMatches =
        activeTab === "all"        ? true :
        activeTab === "pending"    ? order.status === "Pending" :
        activeTab === "processing" ? order.status === "Processing" :
        activeTab === "out"        ? order.status === "Out for Delivery" :
        activeTab === "delivered"  ? order.status === "Delivered" :
        order.status === "Cancelled";

      if (!tabMatches) return false;
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (hasInvalidCustomRange) return false;
      if (!isWithinSelectedDateRange(order.orderDate, datePreset, dateFrom, dateTo)) return false;
      if (!query) return true;

      return [
        order.id,
        order.customerName,
        order.customerPhone,
        order.customerAddress,
        order.assignedDriver,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeTab, dateFrom, datePreset, dateTo, debouncedSearch, hasInvalidCustomRange, orders, statusFilter]);

  const summary = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => order.status === "Pending").length,
    processing: orders.filter((order) => order.status === "Processing").length,
    out: orders.filter((order) => order.status === "Out for Delivery").length,
    delivered: orders.filter((order) => order.status === "Delivered").length,
    cancelled: orders.filter((order) => order.status === "Cancelled").length,
  }), [orders]);

  const tabs = useMemo(() => ([
    { key: "all",        label: lang === "ar" ? "الكل" : "All",              count: summary.total },
    { key: "pending",    label: lang === "ar" ? "في الانتظار" : "Pending",   count: summary.pending },
    { key: "processing", label: lang === "ar" ? "قيد التجهيز" : "Processing", count: summary.processing },
    { key: "out",        label: lang === "ar" ? "خارج للتسليم" : "Out for delivery", count: summary.out },
    { key: "delivered",  label: lang === "ar" ? "تم التسليم" : "Delivered",  count: summary.delivered },
    { key: "cancelled",  label: lang === "ar" ? "ملغي" : "Cancelled",        count: summary.cancelled },
  ] satisfies Array<{ key: TabKey; label: string; count: number }>), [lang, summary]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearch, dateFrom, datePreset, dateTo, statusFilter]);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredOrders]);

  const hasActiveFilters = activeTab !== "all"
    || debouncedSearch !== ""
    || statusFilter !== "all"
    || datePreset !== "all"
    || dateFrom !== ""
    || dateTo !== "";

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setActiveTab("all");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
  }, []);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; tone?: "teal" | "amber" | "rose"; onRemove: () => void }> = [];

    if (activeTab !== "all") {
      chips.push({
        key: "tab",
        label: tabs.find((tab) => tab.key === activeTab)?.label ?? "",
        tone: "teal",
        onRemove: () => setActiveTab("all"),
      });
    }

    if (debouncedSearch) {
      chips.push({
        key: "search",
        label: lang === "ar" ? `بحث: ${debouncedSearch}` : `Search: ${debouncedSearch}`,
        tone: "teal",
        onRemove: () => setSearch(""),
      });
    }

    if (statusFilter !== "all") {
      chips.push({
        key: "status",
        label: `${lang === "ar" ? "الحالة" : "Status"}: ${getStatusLabel(statusFilter, lang)}`,
        tone: "amber",
        onRemove: () => setStatusFilter("all"),
      });
    }

    if (datePreset === "today" || datePreset === "last7" || datePreset === "last30") {
      const labelMap = {
        today: lang === "ar" ? "اليوم" : "Today",
        last7: lang === "ar" ? "آخر 7 أيام" : "Last 7 days",
        last30: lang === "ar" ? "آخر 30 يومًا" : "Last 30 days",
      } as const;
      chips.push({
        key: "preset",
        label: `${lang === "ar" ? "التاريخ" : "Date"}: ${labelMap[datePreset]}`,
        tone: "amber",
        onRemove: () => setDatePreset("all"),
      });
    }

    if (datePreset === "custom" && (dateFrom || dateTo)) {
      chips.push({
        key: "custom-date",
        label: lang === "ar"
          ? `نطاق مخصص: ${dateFrom ? formatDateOnly(dateFrom, lang) : "…"} - ${dateTo ? formatDateOnly(dateTo, lang) : "…"}`
          : `Custom range: ${dateFrom ? formatDateOnly(dateFrom, lang) : "…"} - ${dateTo ? formatDateOnly(dateTo, lang) : "…"}`,
        tone: hasInvalidCustomRange ? "rose" : "amber",
        onRemove: () => {
          setDatePreset("all");
          setDateFrom("");
          setDateTo("");
        },
      });
    }

    return chips;
  }, [activeTab, dateFrom, datePreset, dateTo, debouncedSearch, hasInvalidCustomRange, lang, statusFilter, tabs]);

  const thClass = "px-5 py-3.5 text-start text-xs font-black uppercase tracking-[0.18em] text-slate-500";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label={lang === "ar" ? "إجمالي الطلبات" : "Total orders"} value={summary.total} icon={ClipboardDocumentListIcon} />
        <AdminMetricCard label={lang === "ar" ? "في الانتظار" : "Pending"} value={summary.pending} tone="amber" />
        <AdminMetricCard label={lang === "ar" ? "قيد التجهيز" : "Processing"} value={summary.processing} tone="violet" />
        <AdminMetricCard label={lang === "ar" ? "خارج للتسليم" : "Out for delivery"} value={summary.out} icon={TruckIcon} tone="sky" />
        <AdminMetricCard label={lang === "ar" ? "تم التسليم" : "Delivered"} value={summary.delivered} icon={CheckCircleIcon} tone="emerald" />
      </div>

      <AdminErrorBanner message={error} />

      <AdminSectionCard
        eyebrow={lang === "ar" ? "إدارة الطلبات" : "Order management"}
        title={lang === "ar" ? "قائمة الطلبات" : "Orders list"}
        description={lang === "ar" ? "عرض تشغيلي واسع للطلبات مع تبويبات حالات وتصفية تاريخية وتحديث متفائل آمن." : "A broad operational order list with status tabs, date filtering, and safe optimistic updates."}
        bodyClassName="space-y-5 px-0 py-0"
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-[1.2rem] border px-4 text-sm font-bold transition-colors",
                showFilters ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <FunnelIcon className="h-4 w-4" />
              {lang === "ar" ? "الفلاتر" : "Filters"}
              {hasActiveFilters && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">!</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => void loadOrders(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <ArrowPathIcon className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {lang === "ar" ? "تحديث" : "Refresh"}
            </button>
          </div>
        )}
      >
        <div className="border-b border-slate-100 px-4 pt-4 md:px-6">
          <AdminTabBar
            tabs={tabs}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as TabKey)}
            className="pb-4"
          />
        </div>

        {showFilters && (
          <div className="border-b border-slate-100 px-4 py-4 md:px-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AdminSearchField
                value={search}
                onChange={setSearch}
                placeholder={lang === "ar" ? "ابحث بالرقم أو الاسم أو الهاتف" : "Search by ID, name, or phone"}
                className="w-full sm:min-w-0"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")}
                className="admin-input h-11 rounded-[1.2rem] border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                <option value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>{getStatusLabel(status, lang)}</option>
                ))}
              </select>
              <select
                value={datePreset}
                onChange={(event) => {
                  const nextPreset = event.target.value as DatePreset;
                  setDatePreset(nextPreset);
                  if (nextPreset !== "custom") {
                    setDateFrom("");
                    setDateTo("");
                  }
                }}
                className="admin-input h-11 rounded-[1.2rem] border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                <option value="all">{lang === "ar" ? "كل التواريخ" : "All dates"}</option>
                <option value="today">{lang === "ar" ? "اليوم" : "Today"}</option>
                <option value="last7">{lang === "ar" ? "آخر 7 أيام" : "Last 7 days"}</option>
                <option value="last30">{lang === "ar" ? "آخر 30 يومًا" : "Last 30 days"}</option>
                <option value="custom">{lang === "ar" ? "نطاق مخصص" : "Custom range"}</option>
              </select>
              <div className="inline-flex items-center gap-2 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
                <CalendarDaysIcon className="h-4 w-4 text-teal-500" />
                {filteredOrders.length} {lang === "ar" ? "طلب مطابق" : "matching orders"}
              </div>
            </div>

            {datePreset === "custom" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="admin-input h-11 rounded-[1.2rem] border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  aria-label={lang === "ar" ? "من تاريخ" : "Date from"}
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="admin-input h-11 rounded-[1.2rem] border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  aria-label={lang === "ar" ? "إلى تاريخ" : "Date to"}
                />
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <AdminFilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} tone={chip.tone} />
              ))}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
                >
                  <XCircleIcon className="h-3.5 w-3.5" />
                  {lang === "ar" ? "مسح الكل" : "Clear all"}
                </button>
              )}
            </div>

            {hasInvalidCustomRange && (
              <p className="mt-3 text-sm font-semibold text-rose-600">
                {lang === "ar" ? "تاريخ البداية يجب أن يسبق تاريخ النهاية." : "The start date must be before the end date."}
              </p>
            )}
          </div>
        )}

        <div className="px-4 pb-2 pt-4 md:px-6">
          {loading ? (
            <AdminTableSkeleton rows={8} />
          ) : paginatedOrders.length === 0 ? (
            <AdminEmptyState
              title={lang === "ar" ? "لا توجد طلبات مطابقة" : "No matching orders"}
              description={lang === "ar" ? "جرّب تغيير التبويب أو الفلاتر أو عبارة البحث." : "Try a different tab, filter, or search term."}
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
                {paginatedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    lang={lang}
                    updating={Boolean(pendingById[order.id])}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>

              <div className="hidden xl:block">
                <div className="overflow-hidden rounded-[1.6rem] border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="admin-table w-full min-w-[62rem]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70">
                          <th className={thClass}>{lang === "ar" ? "رقم الطلب" : "Order ID"}</th>
                          <th className={thClass}>{lang === "ar" ? "العميل" : "Customer"}</th>
                          <th className={thClass}>{lang === "ar" ? "المنتجات" : "Items"}</th>
                          <th className={thClass}>{lang === "ar" ? "الحالة" : "Status"}</th>
                          <th className={thClass}>{lang === "ar" ? "الدفع" : "Payment"}</th>
                          <th className={thClass}>{lang === "ar" ? "الإجمالي" : "Total"}</th>
                          <th className={thClass}>{lang === "ar" ? "التاريخ" : "Date"}</th>
                          <th className={thClass}>{lang === "ar" ? "إجراء" : "Action"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedOrders.map((order) => (
                          <OrderTableRow
                            key={order.id}
                            order={order}
                            lang={lang}
                            updating={Boolean(pendingById[order.id])}
                            onStatusChange={handleStatusChange}
                            onVerifyPayment={handleVerifyPayment}
                            onRejectPayment={handleRejectPayment}
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

        <AdminPaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredOrders.length}
          itemsPerPage={ITEMS_PER_PAGE}
          lang={lang}
          onPageChange={setCurrentPage}
        />
      </AdminSectionCard>
    </div>
  );
}
