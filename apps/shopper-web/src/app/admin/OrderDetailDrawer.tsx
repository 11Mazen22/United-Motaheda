/**
 * OrderDetailDrawer.tsx
 *
 * The shared "single order, full story" surface for the admin panel.
 *
 * This is the shared “single order, full story” surface for the unified order
 * workspace. It shows customer context, the database-backed delivery timeline,
 * and append-only staff notes without creating another status-management path.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  PlusCircleIcon,
  TruckIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { cn } from "../components/UI";
import {
  addOrderNote,
  fetchOrderTimeline,
  type OrderTimelineEvent,
} from "../../services/orderTimelineApi";

export interface OrderDetailDrawerSummary {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  totalPrice: number;
  orderDate: string;
  paymentLabel: string;
  assignedDriver?: string;
  note?: string;
}

function formatCurrency(value: number, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string, lang: "ar" | "en"): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

const EVENT_META: Record<
  OrderTimelineEvent["type"],
  { icon: typeof ClipboardDocumentListIcon; tone: string; ar: string; en: string }
> = {
  order_created:         { icon: ClipboardDocumentListIcon, tone: "text-slate-500 bg-slate-100",  ar: "تم إنشاء الطلب",           en: "Order created" },
  assignment_offered:    { icon: TruckIcon,                 tone: "text-sky-600 bg-sky-100",      ar: "تم تعيين سائق",            en: "Driver assigned" },
  assignment_accepted:   { icon: CheckCircleIcon,            tone: "text-emerald-600 bg-emerald-100", ar: "قبل السائق التوصيل",   en: "Driver accepted" },
  assignment_declined:   { icon: ExclamationTriangleIcon,    tone: "text-rose-600 bg-rose-100",    ar: "رفض السائق التوصيل",       en: "Driver declined" },
  picked_up:             { icon: TruckIcon,                 tone: "text-violet-600 bg-violet-100", ar: "تم استلام الطلب للتوصيل", en: "Picked up for delivery" },
  delivered:              { icon: CheckCircleIcon,            tone: "text-emerald-600 bg-emerald-100", ar: "تم التسليم",           en: "Delivered" },
  assignment_superseded: { icon: TruckIcon,                 tone: "text-amber-600 bg-amber-100",  ar: "أُعيد تعيين السائق",       en: "Reassigned" },
  issue_reported:        { icon: ExclamationTriangleIcon,    tone: "text-rose-600 bg-rose-100",    ar: "بلّغ السائق عن مشكلة",     en: "Driver reported an issue" },
  issue_resolved:        { icon: CheckCircleIcon,            tone: "text-emerald-600 bg-emerald-100", ar: "تم حل المشكلة",         en: "Issue resolved" },
  note_added:            { icon: ChatBubbleLeftRightIcon,    tone: "text-teal-600 bg-teal-100",    ar: "ملاحظة داخلية",           en: "Internal note" },
};

function TimelineRow({ event, lang }: { event: OrderTimelineEvent; lang: "ar" | "en" }) {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;
  return (
    <li className="flex gap-3">
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 pb-4">
        <p className="text-sm font-bold text-slate-800">{lang === "ar" ? meta.ar : meta.en}</p>
        {event.type === "note_added" && typeof event.detail.body === "string" && (
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{event.detail.body}</p>
        )}
        {event.type === "issue_reported" && typeof event.detail.note === "string" && event.detail.note && (
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{event.detail.note}</p>
        )}
        {event.type === "assignment_declined" && typeof event.detail.declineReason === "string" && event.detail.declineReason && (
          <p className="mt-1 text-xs text-rose-600">{event.detail.declineReason}</p>
        )}
        <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDateTime(event.at, lang)}</p>
      </div>
    </li>
  );
}

export function OrderDetailDrawer({
  open,
  onClose,
  order,
  lang,
  statusBadge,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  order: OrderDetailDrawerSummary | null;
  lang: "ar" | "en";
  /** Pre-resolved status badge — the workspace owns status label/color logic,
   * matching the pattern established by AdminDetailDrawer's `statusBadge` prop. */
  statusBadge?: ReactNode;
  /** Extra action buttons (e.g. "Assign driver", "Verify payment") — the
   * caller owns which mutations are relevant to its own screen. */
  actions?: ReactNode;
}) {
  const { user } = useAuth();
  const isArabic = lang === "ar";
  const [timeline, setTimeline] = useState<OrderTimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!order?.id) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const events = await fetchOrderTimeline(order.id);
      if (requestId !== requestIdRef.current) return;
      setTimeline(events);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load timeline.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [order?.id]);

  useEffect(() => {
    if (open && order?.id) void reload();
    if (!open) setNoteDraft("");
  }, [open, order?.id, reload]);

  const handleAddNote = useCallback(async () => {
    if (!order?.id || !user?.id || !noteDraft.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      await addOrderNote(order.id, user.id, noteDraft);
      setNoteDraft("");
      toast.success(isArabic ? "تمت إضافة الملاحظة" : "Note added");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isArabic ? "تعذّرت إضافة الملاحظة" : "Could not add note"));
    } finally {
      setSubmittingNote(false);
    }
  }, [order?.id, user?.id, noteDraft, submittingNote, isArabic, reload]);

  const phoneDigits = order?.customerPhone.replace(/[^\d+]/g, "") ?? "";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {order && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-black text-white shadow-sm"
                  style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
                >
                  <UserCircleIcon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-base">{order.customerName || (isArabic ? "بدون اسم" : "No name")}</SheetTitle>
                  <SheetDescription className="truncate" dir="ltr">#{order.id.slice(0, 8).toUpperCase()}</SheetDescription>
                </div>
                {statusBadge && <div className="ms-auto">{statusBadge}</div>}
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {/* Quick contact actions */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${phoneDigits}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <PhoneIcon className="h-3.5 w-3.5 text-teal-600" />
                  {isArabic ? "اتصال" : "Call"}
                </a>
                <a
                  href={`https://wa.me/${phoneDigits.replace(/^0/, "20").replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              </div>

              {/* Order summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{isArabic ? "الإجمالي" : "Total"}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{formatCurrency(order.totalPrice, lang)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{isArabic ? "الدفع" : "Payment"}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{order.paymentLabel}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{isArabic ? "تاريخ الطلب" : "Placed"}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(order.orderDate, lang)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{isArabic ? "السائق" : "Driver"}</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-800">{order.assignedDriver || (isArabic ? "غير معيّن" : "Unassigned")}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{isArabic ? "العنوان" : "Address"}</p>
                <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-slate-700">
                  <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {order.customerAddress || "—"}
                </p>
              </div>

              {order.note && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-600">{isArabic ? "ملاحظة العميل" : "Customer note"}</p>
                  <p className="mt-1 text-sm font-semibold text-amber-800">{order.note}</p>
                </div>
              )}

              {/* Caller-owned actions (assign driver, verify payment, etc.) */}
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

              {/* Add note */}
              <div>
                <p className="mb-2 text-sm font-bold text-slate-800">{isArabic ? "إضافة ملاحظة داخلية" : "Add an internal note"}</p>
                <div className="flex gap-2">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={2}
                    placeholder={isArabic ? "ملاحظة تظهر لكل الفريق…" : "Visible to the whole team…"}
                    className="admin-input flex-1 resize-none rounded-xl border-slate-200 bg-white px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleAddNote();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddNote()}
                    disabled={!noteDraft.trim() || submittingNote}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-xl bg-teal-600 text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={isArabic ? "إرسال" : "Send"}
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <PlusCircleIcon className="h-4 w-4 text-slate-400" />
                  {isArabic ? "السجل الزمني للطلب" : "Order timeline"}
                </p>
                {error ? (
                  <p className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-600">{error}</p>
                ) : loading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex gap-3">
                        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                          <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-400">{isArabic ? "لا يوجد سجل بعد" : "No history yet"}</p>
                ) : (
                  <ol>
                    {timeline.map((event, idx) => (
                      <TimelineRow key={`${event.type}-${event.at}-${idx}`} event={event} lang={lang} />
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
