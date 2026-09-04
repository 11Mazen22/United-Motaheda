import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Home,
  LayoutGrid,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";
import {
  getCachedCustomerOrders,
  getCustomerOrdersWithMeta,
} from "../../services/shopperOrdersApi";
import type { RemoteOrderSnapshot } from "../../app/orders";
import { BrandActionGroup, EmptyState, StatusPanel } from "../components/BrandPrimitives";
import {
  ShopperActionCluster,
  ShopperPage,
  ShopperSectionHeader,
  ShopperStatusBanner,
  ShopperSurface,
} from "../components/ShopperPrimitives";
import { cn } from "../components/UI";
import { useIsShopperShell } from "../components/ui/use-mobile";

// ─── Status configuration ─────────────────────────────────────────────────────

type StatusCfg = {
  labelAr: string;
  labelEn: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ElementType;
};

const STATUS_MAP: Record<string, StatusCfg> = {
  pending: {
    labelAr: "قيد الانتظار",
    labelEn: "Pending",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    Icon: Clock,
  },
  confirmed: {
    labelAr: "تم التحقق",
    labelEn: "Confirmed",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    Icon: CheckCircle2,
  },
  preparing: {
    labelAr: "قيد التجهيز",
    labelEn: "Preparing",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    Icon: Package,
  },
  ready: {
    labelAr: "جاهز للإرسال",
    labelEn: "Ready",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    Icon: ShoppingBag,
  },
  picked_up: {
    labelAr: "خارج للتسليم",
    labelEn: "Out for delivery",
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    Icon: Truck,
  },
  delivered: {
    labelAr: "تم التسليم",
    labelEn: "Delivered",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    Icon: CheckCircle2,
  },
  cancelled: {
    labelAr: "ملغي",
    labelEn: "Cancelled",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    Icon: XCircle,
  },
};

function getStatusCfg(status: string): StatusCfg {
  return (
    STATUS_MAP[status.toLowerCase()] ?? {
      labelAr: status,
      labelEn: status,
      color: "text-slate-700",
      bg: "bg-slate-50",
      border: "border-slate-200",
      Icon: Package,
    }
  );
}

function isLiveStatus(status: string) {
  return status === "picked_up" || status === "ready";
}

function formatDate(iso: string, lang: "ar" | "en"): string {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatSyncStamp(iso: string | null, lang: "ar" | "en") {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, lang }: { status: string; lang: "ar" | "en" }) {
  const cfg = getStatusCfg(status);
  const Icon = cfg.Icon;
  const live = isLiveStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-black",
        cfg.bg,
        cfg.border,
        cfg.color,
      )}
    >
      {live && (
        <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-500" />
        </span>
      )}
      <Icon className="h-3 w-3 shrink-0" />
      {lang === "ar" ? cfg.labelAr : cfg.labelEn}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OrderSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2.5">
          <div className="h-4 w-36 rounded-full bg-slate-200" />
          <div className="h-3 w-24 rounded-full bg-slate-100" />
        </div>
        <div className="h-7 w-28 rounded-xl bg-slate-100" />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-3 w-full rounded-full bg-slate-100" />
        ))}
      </div>
      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
        <div className="h-9 w-28 rounded-xl bg-slate-100" />
        <div className="h-9 w-24 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, lang }: { order: RemoteOrderSnapshot; lang: "ar" | "en" }) {
  const live = isLiveStatus(order.status);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-[1.6rem] border bg-white shadow-sm transition-all duration-200 hover:shadow-[0_8px_28px_rgba(15,23,42,0.10)]",
        live
          ? "border-teal-200/80 shadow-[0_4px_18px_rgba(20,184,166,0.10)]"
          : "border-slate-200/80",
      )}
    >
      {/* Live delivery banner */}
      {live && (
        <div className="flex items-center gap-2.5 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50/60 px-5 py-2.5">
          <span className="relative inline-flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
          </span>
          <span className="text-[11px] font-black text-teal-700">
            {lang === "ar"
              ? "طلبك في الطريق — تتبع موقع السائق الآن"
              : "Your order is on the way — track your driver now"}
          </span>
        </div>
      )}

      <div className="p-5">
        {/* Row 1: ID + status */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {lang === "ar" ? "رقم الطلب" : "Order ID"}
            </p>
            <p className="mt-0.5 font-black text-slate-900" dir="ltr">
              {order.id.slice(0, 8).toUpperCase()}…
            </p>
          </div>
          <StatusBadge status={order.status} lang={lang} />
        </div>

        {/* Row 2: meta grid */}
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="text-[12px] font-semibold text-slate-500">
              {formatDate(order.orderDate, lang)}
            </span>
          </div>
          {order.address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate text-[12px] font-semibold text-slate-500">
                {order.address}
              </span>
            </div>
          )}
          {order.customerPhone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="text-[12px] font-semibold text-slate-500" dir="ltr">
                {order.customerPhone}
              </span>
            </div>
          )}
        </div>

        {/* Row 3: items + total */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Package className="h-3.5 w-3.5" />
            </div>
            <span className="text-[12px] font-black text-slate-600">
              {order.productCodes.length}{" "}
              {lang === "ar"
                ? "صنف"
                : order.productCodes.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              {lang === "ar" ? "الإجمالي" : "Total"}
            </span>
            <span className="text-base font-black text-slate-900" dir="ltr">
              {order.totalPrice.toLocaleString()}{" "}
              <span className="text-sm font-semibold text-slate-500">
                {lang === "ar" ? "ج.م" : "EGP"}
              </span>
            </span>
          </div>
        </div>

        {/* Row 4: actions */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Link
            to={
              order.qrToken
                ? `/track/${order.id}?token=${encodeURIComponent(order.qrToken)}`
                : `/track/${order.id}`
            }
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[12px] font-black transition-all",
              live
                ? "bg-teal-500 text-white shadow-[0_4px_14px_rgba(20,184,166,0.3)] hover:bg-teal-600"
                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:shadow-sm",
            )}
          >
            {live ? (
              <Navigation className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {lang === "ar" ? "تتبع الطلب" : "Track order"}
            <ArrowRight className={cn("h-3.5 w-3.5", lang === "ar" && "rotate-180")} />
          </Link>

          {order.note && (
            <div className="inline-flex h-9 max-w-[18rem] items-center gap-1.5 truncate rounded-xl border border-slate-100 bg-slate-50 px-3 text-[11px] font-semibold italic text-slate-400">
              {order.note}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ orders, lang }: { orders: RemoteOrderSnapshot[]; lang: "ar" | "en" }) {
  const liveCount = orders.filter((o) => isLiveStatus(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const totalSpent = orders.reduce((s, o) => s + o.totalPrice, 0);

  const stats = [
    { label: lang === "ar" ? "إجمالي الطلبات" : "Total orders", value: orders.length, accent: false },
    { label: lang === "ar" ? "في الطريق" : "Active", value: liveCount, accent: liveCount > 0 },
    { label: lang === "ar" ? "تم التسليم" : "Delivered", value: deliveredCount, accent: false },
    {
      label: lang === "ar" ? "إجمالي الإنفاق" : "Total spent",
      value: `${totalSpent.toLocaleString()} ${lang === "ar" ? "ج.م" : "EGP"}`,
      accent: false,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className={cn(
            "rounded-2xl border px-4 py-3",
            s.accent
              ? "border-teal-200/80 bg-gradient-to-br from-teal-50 to-emerald-50/60 shadow-[0_4px_16px_rgba(20,184,166,0.12)]"
              : "border-slate-200/70 bg-white shadow-sm",
          )}
        >
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{s.label}</p>
          <p className={cn("mt-1 text-lg font-black", s.accent ? "text-teal-700" : "text-slate-900")}>
            {s.value}
          </p>
        </div>
      ))}
    </motion.div>
  );
}

type OrdersMetaState = {
  isOffline: boolean;
  isStale: boolean;
  cachedAt: string | null;
  hasQueuedMutations: boolean;
  isReconnecting: boolean;
};

export default function Orders() {
  const isShopperShell = useIsShopperShell();
  const { lang, t } = useLanguage();
  const { user } = useAuth();
  const cachedOrders = useMemo(() => getCachedCustomerOrders() ?? [], []);
  const [orders, setOrders] = useState<RemoteOrderSnapshot[]>(cachedOrders);
  const [loading, setLoading] = useState(cachedOrders.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<OrdersMetaState>(() => ({
    isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
    isStale: false,
    cachedAt: null,
    hasQueuedMutations: false,
    isReconnecting: false,
  }));
  const shouldReduceMotion = useReducedMotion();

  const load = useCallback(async (force = false, triggeredByReconnect = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const result = await getCustomerOrdersWithMeta(force);
      setOrders(result.orders);
      setMeta({
        isOffline: result.isOffline,
        isStale: result.isStale,
        cachedAt: result.cachedAt,
        hasQueuedMutations: result.hasQueuedMutations,
        isReconnecting: false,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === "ar" ? "تعذر تحميل الطلبات." : "Failed to load orders.",
      );
      setMeta((current) => ({
        ...current,
        isOffline: typeof navigator !== "undefined" ? !navigator.onLine : current.isOffline,
        isReconnecting: triggeredByReconnect ? false : current.isReconnecting,
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lang]);

  useEffect(() => {
    void load();

    const handleOffline = () => {
      setMeta((current) => ({
        ...current,
        isOffline: true,
        isStale: current.isStale || orders.length > 0,
        isReconnecting: false,
      }));
    };

    const handleOnline = () => {
      setMeta((current) => ({
        ...current,
        isOffline: false,
        isReconnecting: true,
      }));
      void load(true, true);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [load, orders.length]);

  // Live sync -- a status change (pharmacist accepting/preparing, driver
  // picking up) shows up here the moment it happens instead of waiting on
  // this page's own manual refresh. Scoped to the signed-in customer's own
  // rows via `filter`, matching orders' RLS (auth.uid() = user_id) exactly,
  // so the subscription only ever receives what a direct SELECT already
  // would.
  useRealtimeSync("orders", () => void load(true), {
    enabled: Boolean(user?.id),
    filter: user?.id ? `user_id=eq.${user.id}` : undefined,
  });

  const liveOrders = orders.filter((o) => isLiveStatus(o.status));
  const pastOrders = orders.filter((o) => !isLiveStatus(o.status));
  const primaryLiveOrder = liveOrders[0] ?? null;
  const lastUpdatedLabel = formatSyncStamp(meta.cachedAt, lang);
  const noVisibleData = orders.length === 0 && !loading;

  const trackingTarget = primaryLiveOrder
    ? (primaryLiveOrder.qrToken
      ? `/track/${primaryLiveOrder.id}?token=${encodeURIComponent(primaryLiveOrder.qrToken)}`
      : `/track/${primaryLiveOrder.id}`)
    : "/products";

  const mainActions = primaryLiveOrder
    ? [
        {
          to: trackingTarget,
          label: lang === "ar" ? "تتبع الطلب النشط" : "Track Active Order",
          icon: Navigation,
          variant: "primary" as const,
        },
        {
          to: "/products",
          label: t("continue_shopping_short"),
          icon: ShoppingBag,
          variant: "secondary" as const,
        },
        {
          to: "/categories",
          label: t("browse_categories_short"),
          icon: LayoutGrid,
          variant: "secondary" as const,
        },
        {
          to: "/",
          label: t("browse_home"),
          icon: Home,
          variant: "ghost" as const,
        },
      ]
    : [
        {
          to: "/products",
          label: t("browse_products"),
          icon: ShoppingBag,
          variant: "primary" as const,
        },
        {
          to: "/categories",
          label: t("browse_categories_short"),
          icon: LayoutGrid,
          variant: "secondary" as const,
        },
        {
          to: "/special-orders",
          label: t("request_unavailable_medicine"),
          icon: ClipboardList,
          variant: "secondary" as const,
        },
        {
          to: "/",
          label: t("browse_home"),
          icon: Home,
          variant: "ghost" as const,
        },
      ];

  const emptyActions = [
    {
      to: "/products",
      label: t("browse_products"),
      icon: ShoppingBag,
      variant: "primary" as const,
    },
    {
      to: "/categories",
      label: t("browse_categories_short"),
      icon: LayoutGrid,
      variant: "secondary" as const,
    },
    {
      to: "/special-orders",
      label: t("request_unavailable_medicine"),
      icon: ClipboardList,
      variant: "secondary" as const,
    },
  ];

  const reconnectActions = [
    {
      to: "/products",
      label: t("browse_products"),
      icon: ShoppingBag,
      variant: "secondary" as const,
    },
    {
      to: "/categories",
      label: t("browse_categories_short"),
      icon: LayoutGrid,
      variant: "ghost" as const,
    },
  ];

  const renderMetaBanner = () => {
    if (meta.isReconnecting) {
      const description = (
        <div className="space-y-1">
          <p>{t("reconnecting")}</p>
          {lastUpdatedLabel ? (
            <p>
              {t("last_updated_label")}: <span dir="ltr">{lastUpdatedLabel}</span>
            </p>
          ) : null}
        </div>
      );

      return isShopperShell ? (
        <ShopperStatusBanner
          tone="reconnecting"
          title={t("reconnect_now")}
          description={description}
        />
      ) : (
        <StatusPanel
          tone="reconnecting"
          title={t("reconnect_now")}
          description={description}
        />
      );
    }

    if (meta.isOffline && orders.length > 0) {
      const description = (
        <div className="space-y-1">
          <p>{t("viewing_saved_orders")}</p>
          {lastUpdatedLabel ? (
            <p>
              {t("last_updated_label")}: <span dir="ltr">{lastUpdatedLabel}</span>
            </p>
          ) : null}
        </div>
      );

      return isShopperShell ? (
        <ShopperStatusBanner
          tone="offline"
          title={lang === "ar" ? "أنت غير متصل حالياً" : "You Are Offline Right Now"}
          description={description}
          actions={<ShopperActionCluster actions={reconnectActions} />}
        />
      ) : (
        <StatusPanel
          tone="offline"
          title={lang === "ar" ? "أنت غير متصل حالياً" : "You Are Offline Right Now"}
          description={description}
          actions={<BrandActionGroup actions={reconnectActions} />}
        />
      );
    }

    if (meta.isStale && orders.length > 0) {
      const description = (
        <div className="space-y-1">
          <p>{lang === "ar" ? "يتم عرض آخر نسخة متاحة من طلباتك." : "Showing the latest available copy of your orders."}</p>
          {lastUpdatedLabel ? (
            <p>
              {t("last_updated_label")}: <span dir="ltr">{lastUpdatedLabel}</span>
            </p>
          ) : null}
        </div>
      );

      return isShopperShell ? (
        <ShopperStatusBanner
          tone="warning"
          title={lang === "ar" ? "يتم عرض بيانات محفوظة" : "Showing Saved Order Data"}
          description={description}
        />
      ) : (
        <StatusPanel
          tone="warning"
          title={lang === "ar" ? "يتم عرض بيانات محفوظة" : "Showing Saved Order Data"}
          description={description}
        />
      );
    }

    if (meta.hasQueuedMutations && orders.length > 0) {
      return isShopperShell ? (
        <ShopperStatusBanner
          tone="info"
          title={lang === "ar" ? "تحديثات الطلبات محفوظة" : "Order Updates Are Saved"}
          description={t("queued_updates_pending")}
        />
      ) : (
        <StatusPanel
          tone="info"
          title={lang === "ar" ? "تحديثات الطلبات محفوظة" : "Order Updates Are Saved"}
          description={t("queued_updates_pending")}
        />
      );
    }

    return null;
  };

  const heroBlock = (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-[2rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm",
        isShopperShell && "rounded-[1.6rem] p-4 shadow-sm",
      )}
    >
      {isShopperShell ? (
        <ShopperSectionHeader
          eyebrow={lang === "ar" ? "رحلة الطلبات" : "Order Journey"}
          title={lang === "ar" ? "طلباتي" : "My Orders"}
          description={
            user
              ? (lang === "ar"
                ? `أهلاً ${user.fullName || ""}، راجع أحدث طلباتك وتابع حالة التوصيل بسرعة.`
                : `Welcome back${user.fullName ? `, ${user.fullName}` : ""}. Review recent orders and jump back into shopping.`)
              : undefined
          }
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-teal-200/80 bg-teal-50 px-3 py-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-teal-600" />
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">
                {lang === "ar" ? "سجل الطلبات" : "Order Journey"}
              </span>
            </div>
            <h1 className="text-[1.8rem] font-black tracking-tight text-slate-950">
              {lang === "ar" ? "طلباتي" : "My Orders"}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {user
                ? (lang === "ar"
                  ? `مرحباً ${user.fullName || ""}${user.fullName ? "،" : ""} راجع طلباتك أو عد للتسوق في أي وقت.`
                  : `Welcome back${user.fullName ? `, ${user.fullName}` : ""}. Review your orders or jump back into shopping anytime.`)
                : (lang === "ar"
                  ? "راجع طلباتك السابقة وتحكم في رحلتك الشرائية بسهولة."
                  : "Review your order history and move smoothly back into the storefront.")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", (refreshing || meta.isReconnecting) && "animate-spin")} />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </button>
        </div>
      )}

      <div className="mt-4">
        {isShopperShell ? (
          <ShopperActionCluster actions={mainActions} />
        ) : (
          <BrandActionGroup actions={mainActions} />
        )}
      </div>
    </motion.div>
  );

  const contentBlock = loading ? (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => <OrderSkeleton key={i} />)}
    </div>
  ) : noVisibleData && meta.isOffline ? (
    isShopperShell ? (
      <ShopperSurface className="p-0">
        <div className="p-5">
          <ShopperStatusBanner
            tone="offline"
            title={lang === "ar" ? "لا توجد طلبات محفوظة حالياً" : "No Saved Orders Available"}
            description={t("offline_no_saved_orders")}
            actions={<ShopperActionCluster actions={emptyActions} />}
          />
        </div>
      </ShopperSurface>
    ) : (
      <StatusPanel
        tone="offline"
        title={lang === "ar" ? "لا توجد طلبات محفوظة حالياً" : "No Saved Orders Available"}
        description={t("offline_no_saved_orders")}
        actions={<BrandActionGroup actions={emptyActions} />}
      />
    )
  ) : noVisibleData && error ? (
    <StatusPanel
      tone="error"
      title={lang === "ar" ? "تعذر تحميل الطلبات" : "Could Not Load Orders"}
      description={error}
      actions={
        <button
          onClick={() => load(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.1rem] bg-[#0d9488] px-5 text-sm font-black text-white shadow-[0_12px_28px_rgba(13,148,136,0.25)] transition-all hover:bg-[#0f766e] active:scale-[0.98]"
        >
          {lang === "ar" ? "إعادة المحاولة" : "Retry"}
        </button>
      }
    />
  ) : orders.length === 0 ? (
    isShopperShell ? (
      <ShopperSurface className="p-5">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-teal-50 text-teal-600">
            <ClipboardList className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-950">{t("no_orders_yet_title")}</h2>
          <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">{t("no_orders_yet_desc")}</p>
          <div className="mt-5">
            <ShopperActionCluster actions={emptyActions} className="justify-center" />
          </div>
        </div>
      </ShopperSurface>
    ) : (
      <EmptyState
        icon={ClipboardList}
        title={t("no_orders_yet_title")}
        description={t("no_orders_yet_desc")}
        action={<BrandActionGroup actions={emptyActions} className="justify-center" />}
      />
    )
  ) : (
    <div className="space-y-6">
      {orders.length > 0 && <StatsBar orders={orders} lang={lang} />}

      {liveOrders.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className={cn("relative inline-flex h-2 w-2 shrink-0", shouldReduceMotion && "h-2.5 w-2.5")}>
              {!shouldReduceMotion ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              ) : null}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
            </span>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-teal-600">
              {lang === "ar" ? "الطلبات النشطة" : "Active Deliveries"}
            </h2>
          </div>
          <div className="space-y-4">
            {liveOrders.map((order) => <OrderCard key={order.id} order={order} lang={lang} />)}
          </div>
        </section>
      ) : null}

      {pastOrders.length > 0 ? (
        <section>
          <div className="mb-3">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              {liveOrders.length > 0
                ? (lang === "ar" ? "الطلبات السابقة" : "Past Orders")
                : (lang === "ar" ? "كل الطلبات" : "All Orders")}
            </h2>
          </div>
          <div className="space-y-4">
            {pastOrders.map((order) => <OrderCard key={order.id} order={order} lang={lang} />)}
          </div>
        </section>
      ) : null}
    </div>
  );

  if (isShopperShell) {
    return (
      <ShopperPage docked={false} className="space-y-4 pb-8 pt-2">
        {heroBlock}
        {renderMetaBanner()}
        {error && orders.length > 0 ? (
          <ShopperStatusBanner tone="error" title={lang === "ar" ? "تعذر تحديث الطلبات" : "Could Not Refresh Orders"} description={error} />
        ) : null}
        {contentBlock}
      </ShopperPage>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(165deg,#f0fafa_0%,#f7fafb_50%,#fafafa_100%)]">
      <div className="page-section py-8 pb-16">
        {heroBlock}
        <div className="mt-6">{renderMetaBanner()}</div>

        <AnimatePresence>
          {error && orders.length > 0 ? (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-6">{contentBlock}</div>
      </div>
    </div>
  );
}
