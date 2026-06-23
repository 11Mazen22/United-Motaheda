/**
 * DashboardOverview.tsx
 * Role-aware dashboard with KPI metrics, trend chart,
 * inventory alerts, and recent orders.
 *
 * Roles:
 *   admin      – full view (revenue, orders, products, staff)
 *   manager    – revenue, orders, products (no staff snapshot)
 *   pharmacist – orders, products only (no revenue totals, no staff)
 *   driver     – redirected to /admin/my-deliveries
 *   customer   – should never reach this page (router guard)
 */

import {
  Suspense,
  lazy,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BellAlertIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useCatalog, useFullCatalog } from "../../contexts/CatalogContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  type AdminOrder,
  type DashboardStats,
  type StaffMember,
  getAdminOrders,
  getCachedAdminOrders,
  getCachedDashboardStats,
  getCachedStaff,
  getDashboardStats,
  getStaff,
} from "../../services/googleSheetsApi";
import { cn } from "../components/UI";
import { Skeleton } from "../components/ui/skeleton";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminMetricCard,
  AdminSectionCard,
  type AdminRole,
} from "./adminShared";

const DashboardTrendChart = lazy(() => import("./DashboardTrendChart"));

type Language = "ar" | "en";

// ─── Seed from cache ──────────────────────────────────────────────────────────

const initialStats = getCachedDashboardStats();
const initialOrders = getCachedAdminOrders() ?? [];
const initialStaff = getCachedStaff() ?? [];

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatCurrency(value: number, lang: Language): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactNumber(value: number, lang: Language): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string, lang: Language): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function formatDayLabel(value: string, lang: Language): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    weekday: "short",
  }).format(d);
}

function calculateTrend(
  points: DashboardStats["ordersByDay"],
  key: "orders" | "sales",
): number | null {
  if (points.length < 4) return null;
  const split = Math.floor(points.length / 2);
  const prev = points.slice(0, split).reduce((s, p) => s + p[key], 0);
  const curr = points.slice(split).reduce((s, p) => s + p[key], 0);
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function formatTrend(trend: number | null, lang: Language): string {
  if (trend === null)
    return lang === "ar" ? "لا توجد مقارنة كافية" : "Not enough data yet";
  const prefix = trend > 0 ? "+" : "";
  return lang === "ar"
    ? `${prefix}${trend.toFixed(1)}% مقارنة بالفترة السابقة`
    : `${prefix}${trend.toFixed(1)}% vs previous period`;
}

function getOrderStatusLabel(status: AdminOrder["status"], lang: Language): string {
  if (status === "Delivered") return lang === "ar" ? "تم التسليم" : "Delivered";
  if (status === "Cancelled") return lang === "ar" ? "ملغي" : "Cancelled";
  return lang === "ar" ? "قيد المعالجة" : "Pending";
}

function getOrderStatusTone(status: AdminOrder["status"]): string {
  if (status === "Delivered") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getOrderStatusAccent(status: AdminOrder["status"]): string {
  if (status === "Delivered") return "#10b981";
  if (status === "Cancelled") return "#f43f5e";
  if (status === "Out for Delivery") return "#0ea5e9";
  if (status === "Processing") return "#8b5cf6";
  return "#f59e0b";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const OverviewOrderCard = memo(function OverviewOrderCard({
  order,
  lang,
  showTotal,
}: {
  order: AdminOrder;
  lang: Language;
  showTotal: boolean;
}) {
  const accent = getOrderStatusAccent(order.status);
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
    >
      <div className="h-[3px]" style={{ background: accent }} />
      <div className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900" dir="ltr">
              #{order.id.slice(-8).toUpperCase()}
            </p>
            <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-600">
              {order.customerName || (lang === "ar" ? "عميل بدون اسم" : "Unnamed customer")}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500" dir="ltr">
              {order.customerPhone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide", getOrderStatusTone(order.status))}>
              {getOrderStatusLabel(order.status, lang)}
            </span>
            {showTotal && (
              <span className="text-sm font-black text-slate-900">
                {formatCurrency(order.totalPrice, lang)}
              </span>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          {formatDate(order.orderDate, lang)}
        </p>
      </div>
    </div>
  );
});

const InventoryAlertRow = memo(function InventoryAlertRow({
  name,
  categoryName,
  stock,
  lang,
}: {
  name: string;
  categoryName: string;
  stock: number;
  lang: Language;
}) {
  const accentColor = stock === 0 ? "#f43f5e" : stock < 5 ? "#f97316" : "#f59e0b";
  const badgeClass = stock === 0
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : stock < 5
    ? "border-orange-200 bg-orange-50 text-orange-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div
      className="relative overflow-hidden flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
    >
      <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-2xl" style={{ background: accentColor }} />
      <div className="min-w-0 ps-2">
        <p className="truncate text-sm font-bold text-slate-900">{name}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">{categoryName}</p>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${badgeClass}`}>
        <BellAlertIcon className="h-3.5 w-3.5" />
        {lang === "ar" ? `${stock} متبقي` : `${stock} left`}
      </span>
    </div>
  );
});

// ─── MetricSkeleton ───────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="admin-card p-5 space-y-3">
      <Skeleton className="h-4 w-28 rounded-full bg-slate-100" />
      <Skeleton className="h-8 w-36 rounded-2xl bg-slate-100" />
      <Skeleton className="h-3 w-44 rounded-full bg-slate-100" />
      <Skeleton className="h-5 w-24 rounded-full bg-slate-100" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardOverview() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const userRole = (user?.role ?? "customer") as AdminRole;

  // Drivers should not see the dashboard – redirect immediately
  useEffect(() => {
    if (userRole === "driver") {
      navigate("/admin/my-deliveries", { replace: true });
    }
  }, [userRole, navigate]);

  const {
    metrics,
    lastUpdated,
    isLoading: catalogLoading,
    error: catalogError,
  } = useCatalog();

  // Use full catalog for accurate low-stock alerts (not the paginated view)
  const { allProducts } = useFullCatalog();

  const hasCached =
    Boolean(initialStats) ||
    Boolean(initialOrders.length) ||
    Boolean(initialStaff.length);

  const [stats, setStats] = useState<DashboardStats | null>(initialStats);
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [loading, setLoading] = useState(!hasCached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOverview = useCallback(
    async (force = false) => {
      if (hasCached || force) setRefreshing(true);
      else setLoading(true);

      const results = await Promise.allSettled([
        getDashboardStats(force),
        getAdminOrders(force),
        userRole === "admin" ? getStaff(force) : Promise.resolve([]),
      ]);

      const errors: string[] = [];
      const [statsRes, ordersRes, staffRes] = results;

      startTransition(() => {
        if (statsRes.status === "fulfilled") {
          setStats(statsRes.value);
        } else {
          errors.push(
            statsRes.reason instanceof Error
              ? statsRes.reason.message
              : "Unable to load stats.",
          );
        }
        if (ordersRes.status === "fulfilled") {
          setOrders(ordersRes.value);
        } else {
          errors.push(
            ordersRes.reason instanceof Error
              ? ordersRes.reason.message
              : "Unable to load orders.",
          );
        }
        if (staffRes.status === "fulfilled") {
          setStaff(staffRes.value as StaffMember[]);
        }
        setError(errors[0] ?? "");
        setLoading(false);
        setRefreshing(false);
      });
    },
    [hasCached, userRole],
  );

  useEffect(() => {
    void loadOverview(false);
  }, [loadOverview]);

  const chartData = useMemo(
    () =>
      (stats?.ordersByDay ?? []).slice(-7).map((p) => ({
        ...p,
        label: formatDayLabel(p.day || p.label, lang),
      })),
    [lang, stats?.ordersByDay],
  );

  const salesTrend = useMemo(
    () => formatTrend(calculateTrend(stats?.ordersByDay ?? [], "sales"), lang),
    [lang, stats?.ordersByDay],
  );

  const ordersTrend = useMemo(
    () => formatTrend(calculateTrend(stats?.ordersByDay ?? [], "orders"), lang),
    [lang, stats?.ordersByDay],
  );

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
        .slice(0, 5),
    [orders],
  );

  const lowStockItems = useMemo(
    () =>
      allProducts
        .filter((p) => p.stock < 10)
        .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, lang === "ar" ? "ar" : "en"))
        .slice(0, 5),
    [lang, allProducts],
  );

  const activeEmployees = useMemo(
    () => staff.filter((m) => m.status === "Active").length,
    [staff],
  );

  const inventoryCoverage = metrics.totalProducts
    ? Math.round((metrics.inStockProducts / metrics.totalProducts) * 100)
    : 0;

  const barcodeCoverage = metrics.totalProducts
    ? Math.round((metrics.barcodedProducts / metrics.totalProducts) * 100)
    : 0;

  const isInitialLoading = loading && !stats && !orders.length;

  // Role helpers
  const showRevenue = userRole === "admin" || userRole === "manager";
  const showStaff = userRole === "admin";

  if (userRole === "driver") return null; // redirect already fired

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void loadOverview(true)}
          disabled={refreshing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.25rem] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowPathIcon className={cn("h-4 w-4 text-teal-600", refreshing && "animate-spin")} />
          {lang === "ar" ? "تحديث اللوحة" : "Refresh dashboard"}
        </button>
      </div>

      <AdminErrorBanner message={error || catalogError || ""} />

      {/* ── KPI Metrics ── */}
      <section className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isInitialLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
        ) : (
          <>
            {showRevenue && (
              <AdminMetricCard
                label={lang === "ar" ? "الإيراد" : "Revenue"}
                value={formatCurrency(stats?.totalSales ?? 0, lang)}
                note={lang === "ar" ? "إجمالي قيمة الطلبات المسجلة" : "Total recorded order value"}
                trend={salesTrend}
                icon={ArrowTrendingUpIcon}
                tone="teal"
              />
            )}
            <AdminMetricCard
              label={lang === "ar" ? "الطلبات" : "Orders"}
              value={formatCompactNumber(stats?.totalOrders ?? orders.length, lang)}
              note={lang === "ar" ? "عدد الطلبات في النظام" : "Total orders in the system"}
              trend={ordersTrend}
              icon={ClipboardDocumentListIcon}
              tone="sky"
            />
            <AdminMetricCard
              label={lang === "ar" ? "المنتجات" : "Products"}
              value={formatCompactNumber(metrics.totalProducts, lang)}
              note={lang === "ar" ? `${metrics.inStockProducts} متاح الآن` : `${metrics.inStockProducts} currently in stock`}
              trend={lang === "ar" ? `${inventoryCoverage}% تغطية مخزون` : `${inventoryCoverage}% stock coverage`}
              icon={CubeIcon}
              tone="violet"
            />
            {showStaff && (
              <AdminMetricCard
                label={lang === "ar" ? "الموظفون" : "Employees"}
                value={formatCompactNumber(staff.length, lang)}
                note={lang === "ar" ? `${activeEmployees} موظف نشط` : `${activeEmployees} active employees`}
                trend={lang === "ar"
                  ? `${Math.round((activeEmployees / Math.max(staff.length, 1)) * 100)}% وصول نشط`
                  : `${Math.round((activeEmployees / Math.max(staff.length, 1)) * 100)}% active access`}
                icon={UsersIcon}
                tone="amber"
              />
            )}
            {/* Fill 4th slot for non-admin roles */}
            {!showStaff && (
              <AdminMetricCard
                label={lang === "ar" ? "تغطية الباركود" : "Barcode coverage"}
                value={`${barcodeCoverage}%`}
                note={lang === "ar" ? `${metrics.barcodedProducts} منتج مربوط` : `${metrics.barcodedProducts} products linked`}
                tone="emerald"
              />
            )}
          </>
        )}
      </section>

      {/* ── Trend chart + Catalog health ── */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,0.95fr)]">
        <AdminSectionCard
          eyebrow={lang === "ar" ? "الطلبات حسب اليوم" : "Orders per day"}
          title={lang === "ar" ? "نبض الطلبات والإيراد" : "Order & revenue pulse"}
          description={lang === "ar"
            ? "متابعة يومية لحجم الطلبات وقيمة الإيراد خلال آخر سبعة أيام."
            : "A daily view of order volume and revenue across the latest seven days."}
        >
          {isInitialLoading ? (
            <Skeleton className="h-[22rem] rounded-[1.6rem] bg-slate-100" />
          ) : chartData.length ? (
            <Suspense fallback={<Skeleton className="h-[22rem] rounded-[1.6rem] bg-slate-100" />}>
              <DashboardTrendChart
                data={chartData}
                lang={lang}
                formatCompactNumber={formatCompactNumber}
              />
            </Suspense>
          ) : (
            <AdminEmptyState
              title={lang === "ar" ? "لا توجد بيانات يومية كافية" : "No daily series available yet"}
              description={lang === "ar"
                ? "ستظهر حركة الطلبات والإيراد بمجرد وجود سجل زمني كافٍ."
                : "Activity will appear here once enough dated order history is available."}
            />
          )}
        </AdminSectionCard>

        {/* Catalog health */}
        <div className="grid gap-6">
          <AdminSectionCard
            eyebrow={lang === "ar" ? "نبض الكتالوج" : "Catalog pulse"}
            title={lang === "ar" ? "صحة الكتالوج" : "Catalog health"}
          >
            <div className="grid gap-3">
              {[
                {
                  label: lang === "ar" ? "إجمالي المنتجات" : "Total products",
                  value: formatCompactNumber(metrics.totalProducts, lang),
                  note: lang === "ar" ? `${metrics.totalCategories} قسم نشط` : `${metrics.totalCategories} active categories`,
                  accent: "#0E7E74",
                },
                {
                  label: lang === "ar" ? "المنتجات المتاحة" : "In-stock products",
                  value: formatCompactNumber(metrics.inStockProducts, lang),
                  note: lang === "ar" ? `${inventoryCoverage}% من الكتالوج` : `${inventoryCoverage}% of catalog`,
                  accent: "#10b981",
                },
                {
                  label: lang === "ar" ? "تغطية الباركود" : "Barcode coverage",
                  value: `${barcodeCoverage}%`,
                  note: lang === "ar" ? `${metrics.barcodedProducts} منتج مربوط` : `${metrics.barcodedProducts} linked products`,
                  accent: "#8b5cf6",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="relative overflow-hidden flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
                >
                  <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-2xl" style={{ background: item.accent }} />
                  <p className="ps-2 text-sm font-bold text-slate-700">{item.label}</p>
                  <div className="text-end">
                    <p className="text-xl font-black" style={{ color: item.accent }}>{item.value}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{item.note}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
              {lang === "ar"
                ? `آخر مزامنة: ${lastUpdated ? formatDate(lastUpdated, lang) : "غير متاحة"}`
                : `Last sync: ${lastUpdated ? formatDate(lastUpdated, lang) : "Not available"}`}
            </div>
          </AdminSectionCard>

          {/* Inventory alerts */}
          <AdminSectionCard
            eyebrow={lang === "ar" ? "المخزون" : "Inventory"}
            title={lang === "ar" ? "تنبيهات المخزون" : "Inventory alerts"}
          >
            {catalogLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : lowStockItems.length ? (
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <InventoryAlertRow
                    key={item.id}
                    name={item.name}
                    categoryName={item.categoryName}
                    stock={item.stock}
                    lang={lang}
                  />
                ))}
              </div>
            ) : (
              <AdminEmptyState
                title={lang === "ar" ? "لا توجد تنبيهات مخزون" : "No low-stock alerts"}
                description={lang === "ar"
                  ? "جميع المنتجات ضمن مستوى مخزون آمن."
                  : "All tracked products are within a safe stock range."}
              />
            )}
          </AdminSectionCard>
        </div>
      </section>

      {/* ── Recent orders + Staff snapshot ── */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <AdminSectionCard
          eyebrow={lang === "ar" ? "النشاط الأخير" : "Recent activity"}
          title={lang === "ar" ? "آخر الطلبات" : "Latest orders"}
          description={lang === "ar"
            ? "متابعة سريعة لآخر الطلبات التي دخلت النظام."
            : "A quick operational list of the most recent orders."}
        >
          {isInitialLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : recentOrders.length ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <OverviewOrderCard
                  key={order.id}
                  order={order}
                  lang={lang}
                  showTotal={showRevenue}
                />
              ))}
            </div>
          ) : (
            <AdminEmptyState
              title={lang === "ar" ? "لا توجد طلبات حديثة" : "No recent orders"}
              description={lang === "ar"
                ? "ستظهر أحدث الطلبات هنا بعد وصولها."
                : "Recent orders will appear here once they arrive."}
            />
          )}
        </AdminSectionCard>

        {/* Staff snapshot – admin only */}
        {showStaff && (
          <AdminSectionCard
            eyebrow={lang === "ar" ? "حالة الفريق" : "Team health"}
            title={lang === "ar" ? "الوصول والصلاحيات" : "Access snapshot"}
          >
            {isInitialLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {[
                  { label: lang === "ar" ? "إجمالي الموظفين" : "Total employees", value: staff.length, accent: "#64748b" },
                  { label: lang === "ar" ? "الموظفون النشطون" : "Active employees", value: activeEmployees, accent: "#10b981" },
                  {
                    label: lang === "ar" ? "الوصول الموقوف" : "Suspended access",
                    value: staff.filter((m) => m.status === "Suspended").length,
                    accent: "#f43f5e",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="relative overflow-hidden flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)" }}
                  >
                    <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-2xl" style={{ background: item.accent }} />
                    <p className="ps-2 text-sm font-bold text-slate-700">{item.label}</p>
                    <p className="text-xl font-black" style={{ color: item.accent }}>
                      {formatCompactNumber(item.value, lang)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </AdminSectionCard>
        )}
      </section>
    </div>
  );
}