import { getSupabaseClient } from "../../lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
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
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminMetricCard,
  AdminPaginationBar,
  AdminSearchField,
  AdminSectionCard,
  AdminTableSkeleton,
  AdminTabBar,
  useDebouncedValue,
} from "./adminShared";
import PrescriptionReviewDialog, { type ReviewDialogTarget } from "./PrescriptionReviewDialog";
import {
  fetchPrescriptionCounts,
  fetchPrescriptions,
  fetchRefillRequests,
  reviewPrescription,
  reviewRefillRequest,
  type AdminPrescription,
  type AdminRefillRequest,
  type PrescriptionCounts,
  type PrescriptionReviewStatus,
  type RefillStatus,
  type ReviewPayload,
} from "../../services/adminPrescriptionsApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

type MainTab = "prescriptions" | "refills";
type RxStatusFilter = "all" | PrescriptionReviewStatus;
type RefillStatusFilter = "all" | RefillStatus;

const RX_STATUS_OPTIONS: Array<{ value: RxStatusFilter; labelAr: string; labelEn: string }> = [
  { value: "pending_review", labelAr: "قيد المراجعة", labelEn: "Pending Review" },
  { value: "approved",       labelAr: "موافق عليها",   labelEn: "Approved" },
  { value: "rejected",       labelAr: "مرفوضة",        labelEn: "Rejected" },
  { value: "all",            labelAr: "الكل",          labelEn: "All" },
];

const REFILL_STATUS_OPTIONS: Array<{ value: RefillStatusFilter; labelAr: string; labelEn: string }> = [
  { value: "pending",     labelAr: "قيد المراجعة", labelEn: "Pending Review" },
  { value: "preparing",   labelAr: "قيد التحضير",  labelEn: "Preparing" },
  { value: "ready",       labelAr: "جاهزة",        labelEn: "Ready" },
  { value: "on_the_way",  labelAr: "في الطريق",    labelEn: "On the Way" },
  { value: "delivered",   labelAr: "تم التسليم",   labelEn: "Delivered" },
  { value: "cancelled",   labelAr: "ملغاة",         labelEn: "Cancelled" },
  { value: "all",         labelAr: "الكل",          labelEn: "All" },
];

const SOURCE_LABEL: Record<string, { ar: string; en: string; cls: string }> = {
  manual:   { ar: "يدوي",  en: "Manual",   cls: "border-slate-200 bg-slate-50 text-slate-600" },
  scan:     { ar: "مسح",   en: "Scan",     cls: "border-sky-200 bg-sky-50 text-sky-700" },
  whatsapp: { ar: "واتساب", en: "WhatsApp", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

// ─── Status badges ────────────────────────────────────────────────────────────

function RxStatusBadge({ status, lang }: { status: PrescriptionReviewStatus; lang: "ar" | "en" }) {
  const cfg: Record<PrescriptionReviewStatus, { cls: string; ar: string; en: string }> = {
    pending_review: { cls: "border-amber-200 bg-amber-50 text-amber-700",   ar: "قيد المراجعة", en: "Pending Review" },
    approved:       { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", ar: "موافق عليها", en: "Approved" },
    rejected:       { cls: "border-rose-200 bg-rose-50 text-rose-700",      ar: "مرفوضة",       en: "Rejected" },
  };
  const c = cfg[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold", c.cls)}>
      {lang === "ar" ? c.ar : c.en}
    </span>
  );
}

function RefillStatusBadge({ status, lang }: { status: RefillStatus; lang: "ar" | "en" }) {
  const cfg: Record<RefillStatus, { cls: string; ar: string; en: string }> = {
    pending:     { cls: "border-amber-200 bg-amber-50 text-amber-700",     ar: "قيد المراجعة", en: "Pending Review" },
    preparing:   { cls: "border-teal-200 bg-teal-50 text-teal-700",       ar: "قيد التحضير",  en: "Preparing" },
    ready:       { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", ar: "جاهزة",     en: "Ready" },
    on_the_way:  { cls: "border-sky-200 bg-sky-50 text-sky-700",          ar: "في الطريق",   en: "On the Way" },
    delivered:   { cls: "border-emerald-200 bg-emerald-50 text-emerald-700", ar: "تم التسليم", en: "Delivered" },
    cancelled:   { cls: "border-rose-200 bg-rose-50 text-rose-700",        ar: "ملغاة",       en: "Cancelled" },
  };
  const c = cfg[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold", c.cls)}>
      {lang === "ar" ? c.ar : c.en}
    </span>
  );
}

function SourceBadge({ source, lang }: { source: string; lang: "ar" | "en" }) {
  const c = SOURCE_LABEL[source] ?? SOURCE_LABEL.manual;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", c.cls)}>
      {lang === "ar" ? c.ar : c.en}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrescriptionsManager() {
  const { lang } = useLanguage();
  const { user: adminUser } = useAuth();
  const isArabic = lang === "ar";

  const [mainTab, setMainTab] = useState<MainTab>("prescriptions");
  const [counts, setCounts] = useState<PrescriptionCounts>({
    pendingPrescriptions: 0, pendingRefills: 0, approvedToday: 0, rejectedToday: 0,
  });

  // ── Prescriptions tab state ──────────────────────────────────────────────
  const [rxItems, setRxItems] = useState<AdminPrescription[]>([]);
  const [rxTotal, setRxTotal] = useState(0);
  const [rxLoading, setRxLoading] = useState(true);
  const [rxError, setRxError] = useState("");
  const [rxStatusFilter, setRxStatusFilter] = useState<RxStatusFilter>("pending_review");
  const [rxRawSearch, setRxRawSearch] = useState("");
  const rxSearch = useDebouncedValue(rxRawSearch, 350);
  const [rxPage, setRxPage] = useState(1);

  // ── Refills tab state ────────────────────────────────────────────────────
  const [refillItems, setRefillItems] = useState<AdminRefillRequest[]>([]);
  const [refillTotal, setRefillTotal] = useState(0);
  const [refillLoading, setRefillLoading] = useState(true);
  const [refillError, setRefillError] = useState("");
  const [refillStatusFilter, setRefillStatusFilter] = useState<RefillStatusFilter>("pending");
  const [refillRawSearch, setRefillRawSearch] = useState("");
  const refillSearch = useDebouncedValue(refillRawSearch, 350);
  const [refillPage, setRefillPage] = useState(1);

  // ── Review dialog state ──────────────────────────────────────────────────
  const [reviewTarget, setReviewTarget] = useState<
    | { kind: "prescription"; item: AdminPrescription }
    | { kind: "refill"; item: AdminRefillRequest }
    | null
  >(null);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadCounts = useCallback(async () => {
    try {
      setCounts(await fetchPrescriptionCounts());
    } catch {
      // metrics are cosmetic — ignore
    }
  }, []);

  // AbortController + request-id refs guard against races between rapid
  // filter/page/search changes and stale responses overwriting fresher ones.
  const rxLoadController = useRef<AbortController | null>(null);
  const rxLatestRequestId = useRef(0);

  const loadPrescriptions = useCallback(async () => {
    if (rxLoadController.current) {
      rxLoadController.current.abort();
    }
    const controller = new AbortController();
    rxLoadController.current = controller;
    const requestId = ++rxLatestRequestId.current;

    setRxLoading(true);
    setRxError("");
    try {
      const result = await fetchPrescriptions({
        page: rxPage, perPage: ITEMS_PER_PAGE, search: rxSearch || undefined, statusFilter: rxStatusFilter,
        signal: controller.signal,
      });
      if (!controller.signal.aborted && requestId === rxLatestRequestId.current) {
        setRxItems(result.items);
        setRxTotal(result.total);
      }
    } catch (err) {
      if (!controller.signal.aborted && requestId === rxLatestRequestId.current) {
        setRxError(err instanceof Error ? err.message : "Failed to load prescriptions");
      }
    } finally {
      if (!controller.signal.aborted && requestId === rxLatestRequestId.current) {
        setRxLoading(false);
      }
    }
  }, [rxPage, rxSearch, rxStatusFilter]);

  const refillLoadController = useRef<AbortController | null>(null);
  const refillLatestRequestId = useRef(0);

  const loadRefills = useCallback(async () => {
    if (refillLoadController.current) {
      refillLoadController.current.abort();
    }
    const controller = new AbortController();
    refillLoadController.current = controller;
    const requestId = ++refillLatestRequestId.current;

    setRefillLoading(true);
    setRefillError("");
    try {
      const result = await fetchRefillRequests({
        page: refillPage, perPage: ITEMS_PER_PAGE, search: refillSearch || undefined, statusFilter: refillStatusFilter,
        signal: controller.signal,
      });
      if (!controller.signal.aborted && requestId === refillLatestRequestId.current) {
        setRefillItems(result.items);
        setRefillTotal(result.total);
      }
    } catch (err) {
      if (!controller.signal.aborted && requestId === refillLatestRequestId.current) {
        setRefillError(err instanceof Error ? err.message : "Failed to load refill requests");
      }
    } finally {
      if (!controller.signal.aborted && requestId === refillLatestRequestId.current) {
        setRefillLoading(false);
      }
    }
  }, [refillPage, refillSearch, refillStatusFilter]);

  useEffect(() => { void loadCounts(); }, [loadCounts]);
  useEffect(() => {
    void loadPrescriptions();
    return () => { rxLoadController.current?.abort(); };
  }, [loadPrescriptions]);
  useEffect(() => {
    void loadRefills();
    return () => { refillLoadController.current?.abort(); };
  }, [loadRefills]);
  useEffect(() => { setRxPage(1); }, [rxSearch, rxStatusFilter]);
  useEffect(() => { setRefillPage(1); }, [refillSearch, refillStatusFilter]);

  // ── Review dialog target builder ─────────────────────────────────────────
  const dialogTarget: ReviewDialogTarget | null = (() => {
    if (!reviewTarget) return null;
    if (reviewTarget.kind === "prescription") {
      const rx = reviewTarget.item;
        
      let imageUrl = null;
      if (rx.imagePath) {
        imageUrl = getSupabaseClient().storage.from("prescriptions").getPublicUrl(rx.imagePath).data.publicUrl;
      }

      return {
        title: rx.name,
        subtitle: `${rx.customerName} | ${rx.customerPhone}`,
        imageUrl,
        warning: rx.submissionSource === "whatsapp"
          ? (isArabic
            ? "هذه إشارة أن العميل سيرسل صورة عبر واتساب — لم يتم استلام أي صورة أو رقم بعد."
            : "This is just a heads-up the customer said they're sending a photo via WhatsApp — no photo or Rx number has actually arrived yet.")
          : rx.isControlled
          ? (isArabic ? "دواء خاضع للرقابة — يتطلب وصفة ورقية أصلية." : "Controlled substance — requires an original paper prescription.")
          : undefined,
        detailRows: [
          { label: isArabic ? "رقم الوصفة" : "Rx Number", value: rx.rxNumber ?? "—" },
          { label: isArabic ? "الجرعة" : "Dose", value: rx.dose || "—" },
          { label: isArabic ? "الطبيب" : "Doctor", value: rx.doctor || "—" },
          { label: isArabic ? "المصدر" : "Source", value: isArabic ? SOURCE_LABEL[rx.submissionSource]?.ar : SOURCE_LABEL[rx.submissionSource]?.en },
        ],
      };
    }
    const rf = reviewTarget.item;
    return {
      title: isArabic ? `إعادة صرف: ${rf.prescriptionName}` : `Refill: ${rf.prescriptionName}`,
      subtitle: `${rf.customerName} · ${rf.customerPhone}`,
      detailRows: [
        { label: isArabic ? "طريقة التوصيل" : "Delivery", value: rf.delivery },
      ],
    };
  })();

  // Optimistically patch (or, if the new status would fall outside the
  // current filter, remove) the reviewed row instead of doing a full list
  // reload. On failure, roll back to the pre-mutation snapshot and rethrow so
  // the review dialog's own error toast still fires.
  const applyPrescriptionReview = async (item: AdminPrescription, payload: ReviewPayload) => {
    const previousItems = rxItems;
    const previousTotal = rxTotal;
    const newStatus = payload.decision;
    const staysInView = rxStatusFilter === "all" || rxStatusFilter === newStatus;

    if (staysInView) {
      setRxItems((current) => current.map((rx) => (
        rx.id === item.id
          ? {
              ...rx,
              reviewStatus: newStatus,
              adminNotes: payload.adminNotes ?? null,
              rejectionReason: newStatus === "rejected" ? (payload.rejectionReason ?? null) : null,
            }
          : rx
      )));
    } else {
      setRxItems((current) => current.filter((rx) => rx.id !== item.id));
      setRxTotal((total) => Math.max(0, total - 1));
    }

    try {
      await reviewPrescription(item.id, item.userId, payload);
      void loadCounts();
    } catch (err) {
      setRxItems(previousItems);
      setRxTotal(previousTotal);
      throw err;
    }
  };

  const applyRefillReview = async (item: AdminRefillRequest, payload: ReviewPayload) => {
    const previousItems = refillItems;
    const previousTotal = refillTotal;
    const newStatus: RefillStatus = payload.decision === "approved" ? "preparing" : "cancelled";
    const staysInView = refillStatusFilter === "all" || refillStatusFilter === newStatus;

    if (staysInView) {
      setRefillItems((current) => current.map((rf) => (
        rf.id === item.id
          ? {
              ...rf,
              status: newStatus,
              adminNotes: payload.adminNotes ?? null,
              rejectionReason: newStatus === "cancelled" ? (payload.rejectionReason ?? null) : null,
            }
          : rf
      )));
    } else {
      setRefillItems((current) => current.filter((rf) => rf.id !== item.id));
      setRefillTotal((total) => Math.max(0, total - 1));
    }

    try {
      await reviewRefillRequest(item.id, item.userId, payload);
      void loadCounts();
    } catch (err) {
      setRefillItems(previousItems);
      setRefillTotal(previousTotal);
      throw err;
    }
  };

  const handleApprove = async (adminNotes?: string) => {
    if (!reviewTarget || !adminUser) return;
    const payload: ReviewPayload = { decision: "approved", adminId: adminUser.id, adminEmail: adminUser.email, adminNotes };
    if (reviewTarget.kind === "prescription") {
      await applyPrescriptionReview(reviewTarget.item, payload);
    } else {
      await applyRefillReview(reviewTarget.item, payload);
    }
  };

  const handleReject = async (rejectionReason: string, adminNotes?: string) => {
    if (!reviewTarget || !adminUser) return;
    const payload: ReviewPayload = { decision: "rejected", adminId: adminUser.id, adminEmail: adminUser.email, adminNotes, rejectionReason };
    if (reviewTarget.kind === "prescription") {
      await applyPrescriptionReview(reviewTarget.item, payload);
    } else {
      await applyRefillReview(reviewTarget.item, payload);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Metric cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label={isArabic ? "وصفات قيد المراجعة" : "Pending Prescriptions"}
          value={counts.pendingPrescriptions}
          icon={ClipboardDocumentListIcon}
          tone="amber"
          note={isArabic ? "بحاجة إلى مراجعة" : "Awaiting review"}
        />
        <AdminMetricCard
          label={isArabic ? "طلبات إعادة صرف قيد المراجعة" : "Pending Refills"}
          value={counts.pendingRefills}
          icon={TruckIcon}
          tone="sky"
          note={isArabic ? "بحاجة إلى مراجعة" : "Awaiting review"}
        />
        <AdminMetricCard
          label={isArabic ? "تمت الموافقة اليوم" : "Approved Today"}
          value={counts.approvedToday}
          icon={CheckBadgeIcon}
          tone="emerald"
        />
        <AdminMetricCard
          label={isArabic ? "مرفوضة اليوم" : "Rejected Today"}
          value={counts.rejectedToday}
          icon={XCircleIcon}
          tone="rose"
        />
      </div>

      {/* ── Main tabs ── */}
      <AdminTabBar
        tabs={[
          { key: "prescriptions", label: isArabic ? "الوصفات الطبية" : "Prescriptions", count: counts.pendingPrescriptions },
          { key: "refills", label: isArabic ? "طلبات إعادة الصرف" : "Refill Requests", count: counts.pendingRefills },
        ]}
        activeTab={mainTab}
        onChange={setMainTab}
      />

      {mainTab === "prescriptions" ? (
        <AdminSectionCard
          eyebrow={isArabic ? "مراجعة الوصفات" : "Prescription Review"}
          title={isArabic ? "الوصفات المُرسلة" : "Submitted Prescriptions"}
          description={isArabic ? "راجع وأكّد أو ارفض الوصفات المُرسلة من العملاء" : "Review and approve or reject prescriptions submitted by customers"}
          accent="amber"
          bodyClassName="p-0"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:px-6">
            <AdminSearchField
              value={rxRawSearch}
              onChange={setRxRawSearch}
              placeholder={isArabic ? "بحث بالاسم أو رقم الوصفة…" : "Search by name or Rx number…"}
              className="flex-1 min-w-0 max-w-sm"
            />
            <select
              value={rxStatusFilter}
              onChange={(e) => setRxStatusFilter(e.target.value as RxStatusFilter)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              {RX_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{isArabic ? o.labelAr : o.labelEn}</option>
              ))}
            </select>
          </div>

          {rxError && <div className="p-4"><AdminErrorBanner message={rxError} /></div>}

          {rxLoading ? (
            <div className="p-4"><AdminTableSkeleton rows={6} /></div>
          ) : rxItems.length === 0 ? (
            <div className="p-4">
              <AdminEmptyState
                title={isArabic ? "لا توجد وصفات" : "No prescriptions found"}
                description={isArabic ? "لا توجد نتائج مطابقة للفلاتر الحالية" : "No results match the current filters"}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "العميل" : "Customer"}</TableHead>
                  <TableHead>{isArabic ? "الدواء" : "Medication"}</TableHead>
                  <TableHead>{isArabic ? "رقم الوصفة" : "Rx Number"}</TableHead>
                  <TableHead>{isArabic ? "المصدر" : "Source"}</TableHead>
                  <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rxItems.map((rx) => (
                  <TableRow key={rx.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-800">{rx.customerName}</div>
                      <div className="text-xs text-slate-400" dir="ltr">{rx.customerPhone}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium text-slate-700">{rx.name}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{rx.rxNumber ?? "—"}</TableCell>
                    <TableCell><SourceBadge source={rx.submissionSource} lang={lang} /></TableCell>
                    <TableCell><RxStatusBadge status={rx.reviewStatus} lang={lang} /></TableCell>
                    <TableCell className="text-xs text-slate-400">{new Date(rx.addedAt).toLocaleDateString(isArabic ? "ar-EG" : "en-GB")}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setReviewTarget({ kind: "prescription", item: rx })}
                        className="inline-flex h-8 items-center rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-700 transition hover:bg-teal-100"
                      >
                        {isArabic ? "مراجعة" : "Review"}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <AdminPaginationBar
            currentPage={rxPage}
            totalPages={Math.max(1, Math.ceil(rxTotal / ITEMS_PER_PAGE))}
            totalItems={rxTotal}
            itemsPerPage={ITEMS_PER_PAGE}
            lang={lang}
            onPageChange={setRxPage}
          />
        </AdminSectionCard>
      ) : (
        <AdminSectionCard
          eyebrow={isArabic ? "مراجعة إعادة الصرف" : "Refill Review"}
          title={isArabic ? "طلبات إعادة الصرف" : "Refill Requests"}
          description={isArabic ? "راجع وأكّد أو ارفض طلبات إعادة صرف الأدوية" : "Review and approve or reject medication refill requests"}
          accent="sky"
          bodyClassName="p-0"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:px-6">
            <AdminSearchField
              value={refillRawSearch}
              onChange={setRefillRawSearch}
              placeholder={isArabic ? "بحث بالعميل أو الدواء…" : "Search by customer or medication…"}
              className="flex-1 min-w-0 max-w-sm"
            />
            <select
              value={refillStatusFilter}
              onChange={(e) => setRefillStatusFilter(e.target.value as RefillStatusFilter)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              {REFILL_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{isArabic ? o.labelAr : o.labelEn}</option>
              ))}
            </select>
          </div>

          {refillError && <div className="p-4"><AdminErrorBanner message={refillError} /></div>}

          {refillLoading ? (
            <div className="p-4"><AdminTableSkeleton rows={6} /></div>
          ) : refillItems.length === 0 ? (
            <div className="p-4">
              <AdminEmptyState
                title={isArabic ? "لا توجد طلبات" : "No refill requests found"}
                description={isArabic ? "لا توجد نتائج مطابقة للفلاتر الحالية" : "No results match the current filters"}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "العميل" : "Customer"}</TableHead>
                  <TableHead>{isArabic ? "الدواء" : "Medication"}</TableHead>
                  <TableHead>{isArabic ? "التوصيل" : "Delivery"}</TableHead>
                  <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {refillItems.map((rf) => (
                  <TableRow key={rf.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-800">{rf.customerName}</div>
                      <div className="text-xs text-slate-400" dir="ltr">{rf.customerPhone}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium text-slate-700">{rf.prescriptionName}</TableCell>
                    <TableCell className="text-sm text-slate-600">{rf.delivery}</TableCell>
                    <TableCell><RefillStatusBadge status={rf.status} lang={lang} /></TableCell>
                    <TableCell className="text-xs text-slate-400">{new Date(rf.placedAt).toLocaleDateString(isArabic ? "ar-EG" : "en-GB")}</TableCell>
                    <TableCell>
                      {rf.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() => setReviewTarget({ kind: "refill", item: rf })}
                          className="inline-flex h-8 items-center rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-700 transition hover:bg-teal-100"
                        >
                          {isArabic ? "مراجعة" : "Review"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <AdminPaginationBar
            currentPage={refillPage}
            totalPages={Math.max(1, Math.ceil(refillTotal / ITEMS_PER_PAGE))}
            totalItems={refillTotal}
            itemsPerPage={ITEMS_PER_PAGE}
            lang={lang}
            onPageChange={setRefillPage}
          />
        </AdminSectionCard>
      )}

      <PrescriptionReviewDialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        target={dialogTarget}
        onApprove={handleApprove}
        onReject={handleReject}
        lang={lang}
      />
    </div>
  );
}
