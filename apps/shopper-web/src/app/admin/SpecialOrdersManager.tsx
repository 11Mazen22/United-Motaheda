/**
 * SpecialOrdersManager.tsx – Real-time special order intake with admin-system parity.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  FunnelIcon,
  PhoneIcon,
  QueueListIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getSupabaseClient } from "../../lib/supabaseClient";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminFilterChip,
  AdminMetricCard,
  AdminSearchField,
  AdminSectionCard,
  AdminTabBar,
  AdminTableSkeleton,
  AdminUnauthorized,
  useDebouncedValue,
} from "./adminShared";
import { cn } from "../components/UI";
import {
  formatDate,
  formatDateOnly,
  isWithinSelectedDateRange,
} from "./adminDateFilters";

/* ─── Types ─────────────────────────────────────────────────── */

export type SpecialOrderRequest = {
  id: string;
  product_name: string;
  requester_name: string;
  requester_phone: string;
  requester_email: string | null;
  notes: string | null;
  quantity: string | null;
  status: "submitted" | "reviewing" | "fulfilled" | "cancelled";
  created_at: string;
  updated_at: string;
};

type DatePreset = "all" | "today" | "last7" | "last30" | "custom";
type TabKey = "all" | "submitted" | "reviewing" | "fulfilled" | "cancelled";

/* ─── Pure helpers ───────────────────────────────────────────── */

function getStatusLabel(status: SpecialOrderRequest["status"], lang: "ar" | "en") {
  const map: Record<SpecialOrderRequest["status"], [string, string]> = {
    submitted: ["جديد", "New"],
    reviewing: ["قيد المراجعة", "Reviewing"],
    fulfilled: ["تم التنفيذ", "Fulfilled"],
    cancelled: ["ملغي", "Cancelled"],
  };
  return lang === "ar" ? map[status][0] : map[status][1];
}

function getStatusClasses(status: SpecialOrderRequest["status"]): string {
  const map: Record<SpecialOrderRequest["status"], string> = {
    submitted: "border-amber-200/80 bg-amber-50 text-amber-700",
    reviewing: "border-sky-200/80 bg-sky-50 text-sky-700",
    fulfilled: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    cancelled: "border-slate-200 bg-slate-100 text-slate-500",
  };
  return map[status];
}

function getStatusDot(status: SpecialOrderRequest["status"]): string {
  const map: Record<SpecialOrderRequest["status"], string> = {
    submitted: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]",
    reviewing: "bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)]",
    fulfilled: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]",
    cancelled: "bg-slate-400",
  };
  return map[status];
}

function getStatusAccentColor(status: SpecialOrderRequest["status"]): string {
  const accentColorMap: Record<SpecialOrderRequest["status"], string> = {
    submitted: "#f59e0b",
    reviewing: "#0ea5e9",
    fulfilled: "#10b981",
    cancelled: "#94a3b8",
  };
  return accentColorMap[status];
}

/* ─── Main Component ─────────────────────────────── */
/* ─── Main Component ─────────────────────────────────────────── */

export default function SpecialOrdersManager() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const userRole = user?.role ?? "customer";
  const authorized = ["admin", "manager", "pharmacist"].includes(userRole);

  // ── State ──────────────────────────────────────────────────
  const [requests, setRequests] = useState<SpecialOrderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tableMissing, setTableMissing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [realtimeState, setRealtimeState] = useState<"connecting" | "live">("connecting");

  // Use a ref (not state) for first-load tracking — keeps loadRequests stable.
  const firstLoadRef = useRef(true);
  const tableMissingRef = useRef(false);
  const loadControllerRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef(0);

  const debouncedSearch = useDebouncedValue(search, 250);
  const hasInvalidCustomRange =
    datePreset === "custom" && Boolean(dateFrom && dateTo && dateFrom > dateTo);

  // ── Data fetching ────────────────────────────────
  const loadRequests = useCallback(async (force = false) => {
    // Skip if table is known-missing and this isn't a forced retry.
    if (tableMissingRef.current && !force) return;

    if (loadControllerRef.current) {
      loadControllerRef.current.abort();
    }
    const controller = new AbortController();
    loadControllerRef.current = controller;
    const requestId = ++latestRequestIdRef.current;

    if (firstLoadRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");

    const supabase = getSupabaseClient();

    try {
      const { data, error: supabaseError } = await supabase
        .from("special_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal);

      if (controller.signal.aborted || requestId !== latestRequestIdRef.current) return;

      if (supabaseError) {
        if (
          supabaseError.message.includes("Could not find the table") ||
          supabaseError.message.includes("relation")
        ) {
          tableMissingRef.current = true;
          setTableMissing(true);
          setRequests([]);
        } else {
          setError(
            lang === "ar"
              ? `تعذر تحميل طلبات النواقص: ${supabaseError.message}`
              : `Unable to load special orders: ${supabaseError.message}`,
          );
        }
      } else {
        tableMissingRef.current = false;
        setTableMissing(false);
        setRequests((data as SpecialOrderRequest[]) ?? []);
      }
    } catch {
      if (controller.signal.aborted || requestId !== latestRequestIdRef.current) return;
      setError(
        lang === "ar"
          ? "حدث خطأ أثناء تحميل طلبات النواقص"
          : "Error loading special orders",
      );
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        firstLoadRef.current = false;
      }
      if (loadControllerRef.current === controller) {
        loadControllerRef.current = null;
      }
    }
  }, [lang]);

  useEffect(() => {
    void loadRequests();
    return () => {
      loadControllerRef.current?.abort();
    };
  }, [loadRequests]);

  // ── Realtime subscription ──────────────────────────────────
  useEffect(() => {
    // Only subscribe once first load has completed and table exists.
    if (firstLoadRef.current || tableMissing) return;

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("special_orders_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "special_orders" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [payload.new as SpecialOrderRequest, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((r) =>
                r.id === (payload.new as SpecialOrderRequest).id
                  ? (payload.new as SpecialOrderRequest)
                  : r,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) =>
              prev.filter((r) => r.id !== (payload.old as { id: string }).id),
            );
          }
        },
      )
      .subscribe((status) => {
        setRealtimeState(status === "SUBSCRIBED" ? "live" : "connecting");
      });

    return () => {
      setRealtimeState("connecting");
      void supabase.removeChannel(channel);
    };
  }, [loading, tableMissing]);

  // ── Derived data ───────────────────────────────────────────
  const filteredRequests = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return requests.filter((r) => {
      if (activeTab !== "all" && r.status !== activeTab) return false;
      if (hasInvalidCustomRange) return false;
      if (!isWithinSelectedDateRange(r.created_at, datePreset, dateFrom, dateTo)) return false;
      if (!query) return true;
      return [r.product_name, r.requester_name, r.requester_phone, r.requester_email, r.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeTab, dateFrom, datePreset, dateTo, debouncedSearch, hasInvalidCustomRange, requests]);

  const summary = useMemo(
    () => ({
      total: requests.length,
      submitted: requests.filter((r) => r.status === "submitted").length,
      reviewing: requests.filter((r) => r.status === "reviewing").length,
      fulfilled: requests.filter((r) => r.status === "fulfilled").length,
      cancelled: requests.filter((r) => r.status === "cancelled").length,
    }),
    [requests],
  );

  const tabs = useMemo(
    () =>
      [
        { key: "all", label: lang === "ar" ? "الكل" : "All", count: summary.total },
        { key: "submitted", label: lang === "ar" ? "جديد" : "New", count: summary.submitted },
        { key: "reviewing", label: lang === "ar" ? "قيد المراجعة" : "Reviewing", count: summary.reviewing },
        { key: "fulfilled", label: lang === "ar" ? "تم التنفيذ" : "Fulfilled", count: summary.fulfilled },
        { key: "cancelled", label: lang === "ar" ? "ملغي" : "Cancelled", count: summary.cancelled },
      ] satisfies Array<{ key: TabKey; label: string; count: number }>,
    [lang, summary],
  );

  const hasActiveFilters =
    activeTab !== "all" ||
    debouncedSearch !== "" ||
    datePreset !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearFilters = useCallback(() => {
    setSearch("");
    setActiveTab("all");
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
  }, []);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      tone?: "teal" | "amber" | "rose";
      onRemove: () => void;
    }> = [];

    if (activeTab !== "all") {
      chips.push({
        key: "tab",
        label: tabs.find((t) => t.key === activeTab)?.label ?? "",
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
        label:
          lang === "ar"
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
  }, [activeTab, dateFrom, datePreset, dateTo, debouncedSearch, hasInvalidCustomRange, lang, tabs]);

  // ── Render ─────────────────────────────────────────────────
  if (!authorized) return <AdminUnauthorized lang={lang} />;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label={lang === "ar" ? "إجمالي الطلبات" : "Total requests"}
          value={summary.total}
          note={
            tableMissing
              ? lang === "ar"
                ? "الجدول غير موجود"
                : "Table not available"
              : lang === "ar"
                ? "طلبات النواقص المحفوظة"
                : "Saved special-order requests"
          }
          icon={QueueListIcon}
        />
        <AdminMetricCard
          label={lang === "ar" ? "طلبات جديدة" : "New requests"}
          value={summary.submitted}
          icon={ClipboardDocumentListIcon}
          tone="amber"
        />
        <AdminMetricCard
          label={lang === "ar" ? "قيد المراجعة" : "Under review"}
          value={summary.reviewing}
          icon={PhoneIcon}
          tone="sky"
        />
        <AdminMetricCard
          label={lang === "ar" ? "تم التنفيذ" : "Fulfilled"}
          value={summary.fulfilled}
          tone="emerald"
        />
      </div>

      <AdminErrorBanner
        message={
          tableMissing
            ? lang === "ar"
              ? "ميزة طلبات النواقص غير متاحة حالياً — جدول البيانات المطلوب غير موجود. هذا ليس معناه عدم وجود طلبات، بل أن الميزة نفسها معطّلة. يرجى التواصل مع الدعم الفني."
              : "Special orders isn't available right now — the required database table is missing. This does not mean there are no requests; the feature itself is disabled. Please contact technical support."
            : error
        }
      />

      <AdminSectionCard
        eyebrow={lang === "ar" ? "طلبات النواقص" : "Special orders"}
        title={lang === "ar" ? "متابعة الطلبات الخاصة" : "Special order intake"}
        description={
          tableMissing
            ? lang === "ar"
              ? "جدول الطلبات الخاصة غير موجود في قاعدة البيانات. يرجى إنشائه أولاً."
              : "The special orders table is not available in the database. Please create it first."
            : lang === "ar"
              ? "عرض موحد لطلبات العملاء التي تحتاج مراجعة أو تواصل."
              : "A single queue for customer special-order requests that need review or follow-up."
        }
        bodyClassName="space-y-5 px-0 py-0"
        actions={
          !tableMissing && (
            <div className="flex flex-wrap gap-2">
              {/* Filters toggle — matches OrdersManager pattern */}
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-[1.2rem] border px-4 text-sm font-bold transition-colors",
                  showFilters
                    ? "border-teal-200 bg-teal-50 text-teal-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                <FunnelIcon className="h-4 w-4" />
                {lang === "ar" ? "الفلاتر" : "Filters"}
                {hasActiveFilters && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                    !
                  </span>
                )}
              </button>

              {/* Manual refresh */}
              <button
                type="button"
                onClick={() => void loadRequests(true)}
                disabled={refreshing}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                <ArrowPathIcon className={cn("h-4 w-4", refreshing && "animate-spin")} />
                {lang === "ar" ? "تحديث" : "Refresh"}
              </button>

              {/* Realtime indicator */}
              <span
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-[1.2rem] border px-4 text-sm font-bold",
                  realtimeState === "live"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    realtimeState === "live" ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
                {realtimeState === "live"
                  ? lang === "ar"
                    ? "مباشر"
                    : "Live"
                  : lang === "ar"
                    ? "جاري الاتصال"
                    : "Connecting"}
              </span>
            </div>
          )
        }
      >
        {/* Tab bar — always visible when table exists */}
        {!tableMissing && (
          <div className="border-b border-slate-100 px-4 pt-4 md:px-6">
            <AdminTabBar
              tabs={tabs}
              activeTab={activeTab}
              onChange={(tab) => setActiveTab(tab as TabKey)}
              className="pb-4"
            />
          </div>
        )}

        {/* Collapsible filter panel */}
        {!tableMissing && showFilters && (
          <div className="border-b border-slate-100 px-4 py-4 md:px-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AdminSearchField
                value={search}
                onChange={setSearch}
                placeholder={
                  lang === "ar"
                    ? "ابحث بالمنتج أو الاسم أو الهاتف"
                    : "Search by product, name, or phone"
                }
                className="w-full sm:min-w-0"
              />
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
                {filteredRequests.length}{" "}
                {lang === "ar" ? "طلب مطابق" : "matching requests"}
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
                <AdminFilterChip
                  key={chip.key}
                  label={chip.label}
                  onRemove={chip.onRemove}
                  tone={chip.tone}
                />
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
                {lang === "ar"
                  ? "تاريخ البداية يجب أن يسبق تاريخ النهاية."
                  : "The start date must be before the end date."}
              </p>
            )}
          </div>
        )}

        {/* Content area */}
        <div className="px-4 pb-4 pt-4 md:px-6">
          {loading ? (
            <AdminTableSkeleton rows={5} />
          ) : tableMissing ? (
            <AdminEmptyState
              title={
                lang === "ar"
                  ? "جدول الطلبات الخاصة غير متوفر"
                  : "Special orders table not found"
              }
              description={
                lang === "ar"
                  ? "الرجاء إنشاء الجدول `special_orders` في مشروع Supabase لتفعيل هذه الميزة."
                  : "Please create the `special_orders` table in your Supabase project to enable this feature."
              }
            />
          ) : filteredRequests.length === 0 ? (
            <AdminEmptyState
              title={lang === "ar" ? "لا توجد طلبات مطابقة" : "No matching requests"}
              description={
                lang === "ar"
                  ? "جرّب تعديل التبويب أو التاريخ أو عبارة البحث."
                  : "Try a different tab, date range, or search term."
              }
            />
          ) : (
            <div className="grid gap-3">
              {filteredRequests.map((request) => {
                const accent = getStatusAccentColor(request.status);
                return (
                <article
                  key={request.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
                >
                  <div className="h-[3px]" style={{ background: accent }} />
                  <div className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black text-slate-950">
                          {request.product_name}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide",
                            getStatusClasses(request.status),
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              getStatusDot(request.status),
                            )}
                          />
                          {getStatusLabel(request.status, lang)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        {request.requester_name}
                        {" · "}
                        <span dir="ltr">{request.requester_phone}</span>
                        {request.requester_email ? ` · ${request.requester_email}` : ""}
                      </p>

                      {request.notes && (
                        <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                          <p className="text-sm font-medium leading-6 text-slate-500">
                            {request.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 space-y-1.5 text-sm font-semibold text-slate-500 md:text-end">
                      <p className="text-xs">{formatDate(request.created_at, lang)}</p>
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                        {lang === "ar" ? "الكمية" : "Qty"}:{" "}
                        <span dir="ltr">
                          {request.quantity ?? (lang === "ar" ? "غير محددة" : "—")}
                        </span>
                      </div>
                    </div>
                  </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </div>
      </AdminSectionCard>
    </div>
  );
}
