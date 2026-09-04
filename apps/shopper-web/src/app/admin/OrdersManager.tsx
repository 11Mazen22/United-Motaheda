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
  EyeIcon,
  FunnelIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";

import { normalizeOrderStatus as normalizeCanonicalStatus } from "@pharmacy/contracts";
import {
  assignDriver,
  listDrivers,
  listOpenAssignments,
  reassignDriver,
  rankAvailableDrivers,
  type LogisticsProfile,
  type RankedDriverCandidate,
} from "../../services/logisticsApi";
import {
  fetchAdminOrders,
  adminUpdateOrderStatus,
  adminVerifyPayment,
  adminRejectPayment,
  type AdminOrder as SupabaseAdminOrder,
  type AdminOrderItem,
} from "../../services/adminOrdersApi";
import { cn } from "../components/UI";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
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
import {
  formatDate,
  formatDateOnly,
  isWithinSelectedDateRange,
} from "./adminDateFilters";
import { OrderDetailDrawer, type OrderDetailDrawerSummary } from "./OrderDetailDrawer";

type OrderStatus = "Pending" | "Processing" | "Out for Delivery" | "Delivered" | "Cancelled";
type Language = "ar" | "en";

// Presentation adapter for the Supabase order contract. This deliberately
// stays local so the workspace does not depend on the retired Sheets facade.
type AdminOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  productCodes: string[];
  totalPrice: number;
  address: string;
  note: string;
  orderDate: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentLabel: string;
  requestPosMachine: boolean;
  assignedDriver?: string;
  assignedDriverId?: string;
  paymentStatus: string;
  paymentProofUrl: string | null;
  transferNumber: string | null;
  items: AdminOrderItem[];
};

function supabaseToAdminOrder(o: SupabaseAdminOrder): WorkflowOrder {
  const addr = o.customerAddress as Record<string, string> | null;
  const formattedAddress =
    typeof addr?.formatted === "string"
      ? addr.formatted
      : [addr?.streetLine, addr?.city].filter(Boolean).join(", ");

  // Map every canonical DB status (see @pharmacy/contracts orderStatus.ts)
  // to the 5-bucket legacy Title-Case enum this screen displays. Buckets
  // confirmed/ready alongside their adjacent stage so nothing silently
  // falls back to "Pending" just because this screen predates them.
  //
  // verification/payment_pending/payment_approved/driver_assigned/
  // driver_accepted/out_for_delivery were previously missing here entirely
  // and fell through to the `?? "Pending"` default below — confirmed live
  // via transition_order's real state graph (supabase/migrations/
  // 20260827090000_pharmacist_backend_fixes.sql), which is what actually
  // produces these values. Worst case was out_for_delivery: an order with
  // a driver actively en route showed the exact same amber "Pending" badge
  // as a brand-new, untouched order. Note payment_pending (real, used by
  // transition_order) is a distinct value from pending_payment (legacy,
  // set by create-order before manual-payment orders reach verification) —
  // both map here, but they are not the same string.
  const statusMap: Record<string, OrderStatus> = {
    pending:           "Pending",
    pending_payment:   "Pending",
    confirmed:         "Pending",
    verification:      "Pending",
    payment_pending:   "Pending",
    processing:        "Processing",
    preparing:         "Processing",
    payment_approved:  "Processing",
    ready:             "Out for Delivery",
    shipped:           "Out for Delivery",
    picked_up:         "Out for Delivery",
    driver_assigned:   "Out for Delivery",
    driver_accepted:   "Out for Delivery",
    out_for_delivery:  "Out for Delivery",
    delivered:         "Delivered",
    cancelled:         "Cancelled",
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
      canonicalStatus: normalizeCanonicalStatus(o.status),
      assignmentStatus: undefined,
      // extended
    paymentStatus:   o.paymentStatus,
    paymentProofUrl: o.paymentProofUrl,
    transferNumber:  o.transferNumber,
    items:           o.items,
  };
}

function toDrawerSummary(order: AdminOrder): OrderDetailDrawerSummary {
  return {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress ?? order.address,
    totalPrice: order.totalPrice,
    orderDate: order.orderDate,
    paymentLabel: order.paymentLabel,
    assignedDriver: order.assignedDriver,
    note: order.note || undefined,
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
type WorkflowStage = "all" | "new" | "verification" | "payment" | "preparation" | "ready" | "assignment" | "accepted" | "out" | "delivered" | "cancelled" | "archived";

type WorkflowOrder = AdminOrder & {
  canonicalStatus: string;
  assignmentStatus?: "offered" | "accepted";
};

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

function getWorkflowStage(order: WorkflowOrder): WorkflowStage {
  if (order.status === "Cancelled") return "cancelled";
  if (order.status === "Delivered") return "delivered";
  if (order.canonicalStatus === "archived") return "archived";
  if (order.status === "Out for Delivery") return "out";
  if (order.assignmentStatus === "accepted") return "accepted";
  if (order.assignmentStatus === "offered" || order.assignedDriverId) return "assignment";
  if (order.canonicalStatus === "ready") return "ready";
  if (order.status === "Processing") return "preparation";
  if (order.paymentStatus === "pending_verification") return "payment";
  if (order.canonicalStatus === "confirmed" || order.canonicalStatus === "pending_payment") return "verification";
  return "new";
}

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
  onOpenDetail,
}: {
  order: WorkflowOrder;
  lang: Language;
  updating: boolean;
  onStatusChange: (order: AdminOrder, next: OrderStatus) => void;
  onOpenDetail: (order: WorkflowOrder) => void;
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
            <button
              type="button"
              onClick={() => onOpenDetail(order)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-teal-600"
              aria-label={lang === "ar" ? "عرض التفاصيل" : "View details"}
            >
              <EyeIcon className="h-4 w-4" />
            </button>
            <StatusSelect order={order} lang={lang} role="manager" disabled={updating} onChange={onStatusChange} />
          </div>
        </div>
      </div>
    </article>
  );
});

// ─── Payment status helpers ───────────────────────────────────────────────────

function getPaymentStatusBadge(status: string, lang: Language) {
  switch (status) {
    case "pending_verification":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]" />
          {lang === "ar" ? "بانتظار التحقق" : "Pending verification"}
        </span>
      );
    case "verified":
    case "paid":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
          <CheckCircleIcon className="h-3 w-3 text-emerald-500" />
          {lang === "ar" ? "تم التحقق" : "Verified"}
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700">
          <XCircleIcon className="h-3 w-3 text-rose-500" />
          {lang === "ar" ? "مرفوض" : "Rejected"}
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
  onOpenDetail,
}: {
  order:           WorkflowOrder;
  lang:            Language;
  updating:        boolean;
  onStatusChange:  (order: AdminOrder, next: OrderStatus) => void;
  onVerifyPayment: (orderId: string) => void;
  onRejectPayment: (orderId: string) => void;
  onOpenDetail:    (order: WorkflowOrder) => void;
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
            {getPaymentStatusBadge(order.paymentStatus, lang)}
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
            <button
              type="button"
              onClick={() => onOpenDetail(order)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-teal-600"
              aria-label={lang === "ar" ? "عرض التفاصيل" : "View details"}
            >
              <EyeIcon className="h-4 w-4" />
            </button>
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
  const authorized = ["admin", "manager"].includes(userRole);

  const [orders, setOrders] = useState<WorkflowOrder[]>([]);
  const [drivers, setDrivers] = useState<LogisticsProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [detailOrder, setDetailOrder] = useState<WorkflowOrder | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [activeTab, setActiveTab] = useState<WorkflowStage>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [pendingById, setPendingById] = useState<Record<string, true>>({});
  const [rankedDrivers, setRankedDrivers] = useState<RankedDriverCandidate[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const rankingOrderIdRef = useRef<string | null>(null);
  const firstLoadRef = useRef(true);
  const loadControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);

  const debouncedSearch = useDebouncedValue(search, 250);
  const hasInvalidCustomRange = datePreset === "custom" && Boolean(dateFrom && dateTo && dateFrom > dateTo);

  // `force` lets the manual refresh button interrupt an in-flight load and
  // start a fresh one; a non-forced call (e.g. the initial mount effect)
  // skips itself if a load is already running rather than firing a duplicate.
  const loadOrders = useCallback(async (force = false) => {
    if (loadControllerRef.current) {
      if (!force) return;
      loadControllerRef.current.abort();
    }
    const controller = new AbortController();
    loadControllerRef.current = controller;
    const requestId = ++latestRequestIdRef.current;

    if (!firstLoadRef.current) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      // The order API remains the canonical source; logistics enriches it with
      // driver availability and the current assignment state for this workspace.
      const [{ orders: fetched }, nextDrivers, assignments] = await Promise.all([
        fetchAdminOrders({ pageSize: 200, signal: controller.signal }),
        listDrivers(),
        listOpenAssignments(),
      ]);
      const driversById = new Map(nextDrivers.map((driver) => [driver.id, driver]));
      const assignmentsByOrder = new Map(assignments.map((assignment) => [assignment.orderId, assignment]));
      const mapped: WorkflowOrder[] = fetched.map((raw) => {
        const order = supabaseToAdminOrder(raw) as WorkflowOrder;
        const assignment = assignmentsByOrder.get(order.id);
        const driver = assignment ? driversById.get(assignment.driverId) : undefined;
        return {
          ...order,
          assignedDriverId: assignment?.driverId,
          assignedDriver: driver?.full_name,
          assignmentStatus: assignment?.responseStatus === "accepted" ? "accepted" : assignment ? "offered" : undefined,
        };
      });
      if (controller.signal.aborted || requestId !== latestRequestIdRef.current) return;
      startTransition(() => {
        setOrders(mapped);
        setDrivers(nextDrivers);
        setLoading(false);
        setRefreshing(false);
        firstLoadRef.current = false;
      });
    } catch (loadError) {
      if (controller.signal.aborted || requestId !== latestRequestIdRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load orders.");
      setLoading(false);
      setRefreshing(false);
    } finally {
      if (loadControllerRef.current === controller) {
        loadControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    return () => {
      loadControllerRef.current?.abort();
    };
  }, [loadOrders]);

  // Live sync: this was the page the "فشل تحديث الطلب" WebSocket/back-
  // forward-cache report came from -- an order edited from the native app,
  // another admin tab, or a driver accepting/declining an assignment
  // previously only showed up here after a manual refresh. Both tables feed
  // this view (delivery_assignments drives assignedDriver/assignmentStatus
  // above), so either changing re-runs the same loadOrders() the mount
  // effect and the manual refresh button already use.
  const refreshOrders = useCallback(() => void loadOrders(true), [loadOrders]);
  useRealtimeSync("orders", refreshOrders);
  useRealtimeSync("delivery_assignments", refreshOrders);

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

    // Map the display bucket back to the canonical order status written by
    // this workspace. The actual mutation is Supabase-native and uses the
    // same contract as the driver and shopper flows.
    //
    // "Out for Delivery" previously targeted "picked_up", which never
    // appears as a valid p_next_status in transition_order's real state
    // graph for ANY source status — selecting this option always failed
    // with invalid_order_transition, for every order, unconditionally.
    // out_for_delivery is the actual canonical value this bucket
    // represents; it now succeeds when the order is legitimately at
    // driver_accepted (the real precondition) and fails with a clear,
    // truthful error otherwise, instead of never working at all.
    const statusMapReverse: Record<OrderStatus, string> = {
      Pending:            "pending",
      Processing:         "preparing",
      "Out for Delivery": "out_for_delivery",
      Delivered:          "delivered",
      Cancelled:          "cancelled",
    };
    const supabaseStatus = statusMapReverse[nextStatus] as import("../../services/adminOrdersApi").AdminOrderStatus;

    const previousOrder = order;
    setRowPending(order.id, true);
    startTransition(() => {
      setOrders((current) => current.map((entry) => (
        entry.id === order.id ? { ...entry, status: nextStatus, canonicalStatus: statusMapReverse[nextStatus] } : entry
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
          entry.id === previousOrder.id ? previousOrder as WorkflowOrder : entry
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

  // Ranked driver candidates for whichever order the detail drawer is
  // currently showing. Re-fetched every time the drawer switches to a
  // different order; a stale-response guard (requestedOrderId check)
  // prevents a slow response for a previously-open order from overwriting
  // the ranking for the order the operator has since switched to.
  useEffect(() => {
    if (!detailOrder) {
      setRankedDrivers([]);
      return;
    }
    const requestedOrderId = detailOrder.id;
    rankingOrderIdRef.current = requestedOrderId;
    setRankingLoading(true);
    rankAvailableDrivers(requestedOrderId)
      .then((ranked) => {
        if (rankingOrderIdRef.current !== requestedOrderId) return;
        setRankedDrivers(ranked);
      })
      .finally(() => {
        if (rankingOrderIdRef.current === requestedOrderId) setRankingLoading(false);
      });
  }, [detailOrder?.id]);

  const handleDriverAssignment = useCallback(async (driverId: string) => {
    if (!detailOrder || !user?.id || pendingById[detailOrder.id]) return;
    const nextDriver = drivers.find((driver) => driver.id === driverId);
    if (!nextDriver) return;
    const previousOrder = detailOrder;
    setRowPending(detailOrder.id, true);
    const optimistic: WorkflowOrder = {
      ...detailOrder,
      assignedDriverId: driverId,
      assignedDriver: nextDriver.full_name,
      assignmentStatus: "offered",
    };
    setOrders((current) => current.map((order) => order.id === optimistic.id ? optimistic : order));
    setDetailOrder(optimistic);
    try {
      if (previousOrder.assignedDriverId && previousOrder.assignedDriverId !== driverId) {
        await reassignDriver(previousOrder.id, driverId, user.id);
      } else {
        await assignDriver(previousOrder.id, driverId, user.id);
      }
      toast.success(lang === "ar" ? "تم إرسال تعيين السائق" : "Driver assignment sent");
    } catch (assignmentError) {
      setOrders((current) => current.map((order) => order.id === previousOrder.id ? previousOrder : order));
      setDetailOrder(previousOrder);
      toast.error(assignmentError instanceof Error ? assignmentError.message : (lang === "ar" ? "تعذر تعيين السائق" : "Could not assign driver"));
    } finally {
      setRowPending(previousOrder.id, false);
    }
  }, [detailOrder, drivers, lang, pendingById, setRowPending, user?.id]);

  const filteredOrders = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const tabMatches = activeTab === "all" || getWorkflowStage(order) === activeTab;

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

  const summary = useMemo(() => {
    const counts = Object.fromEntries(([
      "new", "verification", "payment", "preparation", "ready", "assignment",
      "accepted", "out", "delivered", "cancelled", "archived",
    ] as WorkflowStage[]).map((stage) => [stage, orders.filter((order) => getWorkflowStage(order) === stage).length])) as Record<WorkflowStage, number>;
    return { total: orders.length, ...counts };
  }, [orders]);

  const tabs = useMemo(() => ([
    { key: "all", label: lang === "ar" ? "الكل" : "All", count: summary.total },
    { key: "new", label: lang === "ar" ? "طلبات جديدة" : "New orders", count: summary.new },
    { key: "verification", label: lang === "ar" ? "التحقق" : "Verification", count: summary.verification },
    { key: "payment", label: lang === "ar" ? "الدفع" : "Payment", count: summary.payment },
    { key: "preparation", label: lang === "ar" ? "التجهيز" : "Preparation", count: summary.preparation },
    { key: "ready", label: lang === "ar" ? "جاهز للاستلام" : "Ready", count: summary.ready },
    { key: "assignment", label: lang === "ar" ? "تعيين سائق" : "Driver assignment", count: summary.assignment },
    { key: "accepted", label: lang === "ar" ? "قبل السائق" : "Driver accepted", count: summary.accepted },
    { key: "out", label: lang === "ar" ? "قيد التوصيل" : "Out for delivery", count: summary.out },
    { key: "delivered", label: lang === "ar" ? "تم التسليم" : "Delivered", count: summary.delivered },
    { key: "cancelled", label: lang === "ar" ? "ملغي" : "Cancelled", count: summary.cancelled },
    { key: "archived", label: lang === "ar" ? "مؤرشف" : "Archived", count: summary.archived },
  ] satisfies Array<{ key: WorkflowStage; label: string; count: number }>), [lang, summary]);

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

  if (!authorized) return <AdminUnauthorized lang={lang} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label={lang === "ar" ? "إجمالي الطلبات" : "Total orders"} value={summary.total} icon={ClipboardDocumentListIcon} />
        <AdminMetricCard label={lang === "ar" ? "بانتظار الدفع" : "Payment review"} value={summary.payment} tone="amber" />
        <AdminMetricCard label={lang === "ar" ? "قيد التجهيز" : "In preparation"} value={summary.preparation} tone="violet" />
        <AdminMetricCard label={lang === "ar" ? "تعيين السائقين" : "Driver assignment"} value={summary.assignment + summary.accepted} icon={TruckIcon} tone="sky" />
        <AdminMetricCard label={lang === "ar" ? "تم التسليم" : "Delivered"} value={summary.delivered} icon={CheckCircleIcon} tone="emerald" />
      </div>

      <AdminErrorBanner message={error} />

      <AdminSectionCard
        eyebrow={lang === "ar" ? "مركز إدارة الطلبات" : "Order management workspace"}
        title={lang === "ar" ? "رحلة الطلب الكاملة" : "End-to-end order lifecycle"}
        description={lang === "ar" ? "مصدر واحد للحالة والدفع والتجهيز والتعيين والتسليم، مع إجراءات آمنة وتحديثات متفائلة قابلة للتراجع." : "One source of truth for verification, payment, preparation, dispatch, and delivery with safe, reversible optimistic updates."}
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
            onChange={(tab) => setActiveTab(tab as WorkflowStage)}
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
                    onOpenDetail={setDetailOrder}
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
                            onOpenDetail={setDetailOrder}
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

      <OrderDetailDrawer
        open={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        lang={lang}
        order={detailOrder ? toDrawerSummary(detailOrder) : null}
        statusBadge={detailOrder ? (
          <span className={cn("admin-badge", getStatusClasses(detailOrder.status))}>
            <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDot(detailOrder.status))} />
            {getStatusLabel(detailOrder.status, lang)}
          </span>
        ) : null}
        actions={detailOrder ? (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                {lang === "ar" ? "تعيين السائق" : "Driver assignment"}
              </p>
              {rankingLoading && rankedDrivers.length === 0 ? (
                <div className="flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-400">
                  {lang === "ar" ? "جارٍ ترتيب السائقين المتاحين…" : "Ranking available drivers…"}
                </div>
              ) : rankedDrivers.length > 0 ? (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pe-1">
                  {rankedDrivers.map((candidate, index) => {
                    const isRecommended = index === 0;
                    const isSelected = detailOrder.assignedDriverId === candidate.driverUserId;
                    return (
                      <button
                        key={candidate.driverUserId}
                        type="button"
                        disabled={Boolean(pendingById[detailOrder.id])}
                        onClick={() => void handleDriverAssignment(candidate.driverUserId)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start transition-colors disabled:opacity-50",
                          isSelected
                            ? "border-emerald-400 bg-emerald-50"
                            : isRecommended
                              ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50"
                              : "border-slate-200 bg-white hover:bg-slate-50",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-slate-700">{candidate.fullName}</span>
                            {isRecommended && (
                              <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                                {lang === "ar" ? "موصى به" : "Recommended"}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {candidate.distanceToBranchKm != null
                              ? (lang === "ar" ? `${candidate.distanceToBranchKm.toFixed(1)} كم من الفرع` : `${candidate.distanceToBranchKm.toFixed(1)} km from branch`)
                              : (lang === "ar" ? "الموقع غير متاح" : "Location unavailable")}
                            {" · "}
                            {candidate.activeDeliveries > 0
                              ? (lang === "ar" ? `${candidate.activeDeliveries} توصيلات نشطة` : `${candidate.activeDeliveries} active`)
                              : (lang === "ar" ? "بلا توصيلات نشطة" : "no active deliveries")}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{candidate.score}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  {lang === "ar" ? "لا يوجد سائقون متصلون مؤهلون الآن — اختر يدوياً من القائمة الكاملة." : "No eligible online drivers right now — pick manually from the full list."}
                </p>
              )}

              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-bold text-slate-400 hover:text-slate-600">
                  {lang === "ar" ? "كل السائقين (يدوي)" : "All drivers (manual)"}
                </summary>
                <select
                  value={detailOrder.assignedDriverId ?? ""}
                  disabled={Boolean(pendingById[detailOrder.id])}
                  onChange={(event) => {
                    if (event.target.value) void handleDriverAssignment(event.target.value);
                  }}
                  className="admin-input mt-1.5 h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  <option value="">{lang === "ar" ? "اختر سائقاً" : "Select a driver"}</option>
                  {drivers.filter((driver) => driver.is_active).map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                  ))}
                </select>
              </details>
              <p className="mt-1 text-xs text-slate-500">
                {detailOrder.assignmentStatus === "accepted"
                  ? (lang === "ar" ? "قبل السائق المهمة — تابع التقدم في الخط الزمني أدناه." : "Driver accepted — follow delivery progress in the timeline below.")
                  : detailOrder.assignmentStatus === "offered"
                    ? (lang === "ar" ? "بانتظار قبول السائق." : "Waiting for the driver to accept.")
                    : (lang === "ar" ? "سيظهر قبول السائق وتقدم التوصيل في الخط الزمني." : "Acceptance and delivery progress appear in the timeline.")}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                {lang === "ar" ? "تحديث مرحلة الطلب" : "Update order stage"}
              </p>
              <StatusSelect
                order={detailOrder}
                lang={lang}
                role={userRole}
                disabled={Boolean(pendingById[detailOrder.id])}
                onChange={handleStatusChange}
              />
            </div>
          </div>
        ) : null}
      />
    </div>
  );
}
