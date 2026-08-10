import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Phone,
  Radio,
  RefreshCw,
  ShieldCheck,
  Truck,
  User,
  Zap,
} from "lucide-react";
import { fetchTrackingSnapshot } from "../../services/logisticsApi";
import { normalizeOrderStatus } from "@pharmacy/contracts";
import { useLanguage } from "../../contexts/LanguageContext";
import { BrandActionGroup, StatusPanel } from "../components/BrandPrimitives";
import { cn } from "../components/UI";

const STATUS_TIMELINE = [
  {
    key: "pending",
    labelEn: "Order placed",
    labelAr: "تم تقديم الطلب",
    descEn: "Your order has been received",
    descAr: "تم استلام طلبك",
    Icon: Package,
    color: "slate",
  },
  {
    key: "confirmed",
    labelEn: "Order confirmed",
    labelAr: "تم تأكيد الطلب",
    descEn: "Items confirmed and available",
    descAr: "تم التأكد من توفر الأصناف",
    Icon: CheckCircle2,
    color: "blue",
  },
  {
    key: "preparing",
    labelEn: "Preparing",
    labelAr: "قيد التجهيز",
    descEn: "Order is being prepared",
    descAr: "جاري تجهيز الطلب",
    Icon: Package,
    color: "violet",
  },
  {
    key: "ready",
    labelEn: "Ready for dispatch",
    labelAr: "جاهز للإرسال",
    descEn: "Waiting for driver pickup",
    descAr: "في انتظار استلام السائق",
    Icon: Clock,
    color: "amber",
  },
  {
    key: "out_for_delivery",
    labelEn: "Out for delivery",
    labelAr: "خارج للتسليم",
    descEn: "Driver is on the way",
    descAr: "السائق في الطريق",
    Icon: Truck,
    color: "teal",
  },
  {
    key: "delivered",
    labelEn: "Delivered",
    labelAr: "تم التسليم",
    descEn: "Order delivered successfully",
    descAr: "تم تسليم الطلب بنجاح",
    Icon: CheckCircle2,
    color: "emerald",
  },
] as const;

const COLOR_CLASSES = {
  slate: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: "text-slate-500",
    ring: "ring-slate-200",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: "text-blue-500",
    ring: "ring-blue-200",
  },
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    icon: "text-violet-500",
    ring: "ring-violet-200",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: "text-amber-500",
    ring: "ring-amber-200",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    icon: "text-teal-500",
    ring: "ring-teal-200",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: "text-emerald-500",
    ring: "ring-emerald-200",
  },
};

function getStatusIndex(status: string): number {
  const index = STATUS_TIMELINE.findIndex((step) => step.key === status);
  return index === -1 ? 0 : index;
}

function labelForStatus(status: string, lang: "ar" | "en") {
  const found = STATUS_TIMELINE.find((step) => step.key === status);
  if (!found) return status.replace(/_/g, " ");
  return lang === "ar" ? found.labelAr : found.labelEn;
}

function descriptionForStatus(status: string, lang: "ar" | "en") {
  const found = STATUS_TIMELINE.find((step) => step.key === status);
  if (!found) return status.replace(/_/g, " ");
  return lang === "ar" ? found.descAr : found.descEn;
}

function LivePulse({
  active = true,
  reducedMotion = false,
}: {
  active?: boolean;
  reducedMotion?: boolean;
}) {
  if (!active) return null;

  if (reducedMotion) {
    return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />;
  }

  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
    </span>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-teal-500" /> : null}
        <p className="text-base font-black capitalize text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function CoordinateCard({
  label,
  value,
  unavailableLabel,
}: {
  label: string;
  value: number | string | null;
  unavailableLabel: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/60 bg-white/78 px-4 py-3.5">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 font-black text-slate-950" dir="ltr">
        {value ?? <span className="text-sm font-semibold text-slate-400">{unavailableLabel}</span>}
      </p>
    </div>
  );
}

function MapSnapshot({
  destLat,
  destLng,
  driverLat,
  driverLng,
  lang,
  liveEnabled,
  reducedMotion,
}: {
  destLat: number | null;
  destLng: number | null;
  driverLat?: number | null;
  driverLng?: number | null;
  lang: "ar" | "en";
  liveEnabled: boolean;
  reducedMotion: boolean;
}) {
  const hasDriver = driverLat != null && driverLng != null;

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(160deg,#e0f2fe_0%,#ecfdf5_50%,#f0fdf4_100%)] p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(15,23,42,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.07) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-teal-600" />
            <p className="text-sm font-black text-slate-900">
              {lang === "ar" ? "لقطة الخريطة" : "Map Snapshot"}
            </p>
          </div>
          <LivePulse active={hasDriver && liveEnabled} reducedMotion={reducedMotion} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <CoordinateCard
            label={lang === "ar" ? "خط عرض الوجهة" : "Destination Lat"}
            value={destLat}
            unavailableLabel={lang === "ar" ? "غير متاح" : "Unavailable"}
          />
          <CoordinateCard
            label={lang === "ar" ? "خط طول الوجهة" : "Destination Lng"}
            value={destLng}
            unavailableLabel={lang === "ar" ? "غير متاح" : "Unavailable"}
          />
          <CoordinateCard
            label={lang === "ar" ? "موقع السائق" : "Driver Position"}
            value={
              hasDriver
                ? `${driverLat?.toFixed(4)}, ${driverLng?.toFixed(4)}`
                : liveEnabled
                  ? (lang === "ar" ? "بانتظار بدء المسار" : "Waiting for route start")
                  : (lang === "ar" ? "عرض الحالة فقط" : "Status-only view")
            }
            unavailableLabel={lang === "ar" ? "غير متاح" : "Unavailable"}
          />
        </div>

        {hasDriver && liveEnabled ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3">
            <Navigation className="h-4 w-4 text-teal-600" />
            <p className="text-sm font-black text-teal-800">
              {lang === "ar"
                ? "يتم تحديث موقع السائق كل 20 ثانية"
                : "Driver location is broadcasting and refreshes every 20 seconds"}
            </p>
          </div>
        ) : null}

        {!hasDriver ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <MapPin className="h-4 w-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-500">
              {liveEnabled
                ? (lang === "ar"
                  ? "سيظهر موقع السائق هنا عند بدء البث المباشر"
                  : "Driver location will appear here once live broadcasting starts")
                : (lang === "ar"
                  ? "هذا العرض يوضح حالة الطلب فقط وقد لا يتضمن موقع السائق المباشر"
                  : "This view shows order status only and may not include live driver location")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusTimeline({
  currentStatus,
  lang,
  reducedMotion,
}: {
  currentStatus: string;
  lang: "ar" | "en";
  reducedMotion: boolean;
}) {
  const currentIndex = getStatusIndex(currentStatus);

  return (
    <div className="space-y-2">
      {STATUS_TIMELINE.map((step, index) => {
        const state: "done" | "active" | "upcoming" =
          index < currentIndex ? "done" : index === currentIndex ? "active" : "upcoming";
        const colors = COLOR_CLASSES[step.color];
        const StepIcon = step.Icon;

        return (
          <motion.div
            key={step.key}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: lang === "ar" ? 8 : -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06, duration: 0.22 }}
            className={cn(
              "flex items-center gap-4 rounded-[1.2rem] border px-4 py-3.5 transition-all duration-300",
              state === "active" && cn(colors.bg, colors.border, "shadow-sm ring-1", colors.ring),
              state === "done" && "border-slate-100 bg-slate-50/60",
              state === "upcoming" && "border-slate-100 bg-white/50",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                state === "active" && cn("bg-white shadow-sm", colors.icon),
                state === "done" && "bg-emerald-100 text-emerald-600",
                state === "upcoming" && "bg-slate-100 text-slate-400",
              )}
            >
              {state === "done" ? (
                <CheckCircle2 className="h-4.5 w-4.5" />
              ) : state === "active" ? (
                <StepIcon className="h-4.5 w-4.5" />
              ) : (
                <StepIcon className="h-4 w-4 opacity-50" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-black capitalize",
                  state === "active" ? colors.text : state === "done" ? "text-emerald-700" : "text-slate-400",
                )}
              >
                {lang === "ar" ? step.labelAr : step.labelEn}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] font-semibold",
                  state === "active" ? "text-slate-600" : "text-slate-400",
                )}
              >
                {lang === "ar" ? step.descAr : step.descEn}
              </p>
            </div>

            {state === "active" ? (
              <div className="flex items-center gap-1.5">
                <LivePulse reducedMotion={reducedMotion} />
                <span className={cn("text-[10px] font-black uppercase tracking-[0.14em]", colors.text)}>
                  {lang === "ar" ? "الآن" : "Now"}
                </span>
              </div>
            ) : null}
            {state === "done" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      {[0, 1].map((index) => (
        <div key={index} className="rounded-[2rem] border border-slate-200 bg-white p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-[1.2rem] bg-slate-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrderTracking() {
  const { orderId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof fetchTrackingSnapshot>> | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [reconnecting, setReconnecting] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const token = searchParams.get("token") ?? "";

  async function load(isManual = false) {
    if (isManual) {
      setRefreshing(true);
    }

    try {
      const data = await fetchTrackingSnapshot(orderId, token);
      setSnapshot(data);
      setLastUpdated(new Date(data.connection.refreshedAt));
      setSecondsAgo(0);
      setError("");
      setOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);
      setReconnecting(false);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : lang === "ar"
            ? "تعذر تحميل بيانات التتبع."
            : "Unable to load tracking details.",
      );
      setReconnecting(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!orderId) {
      setError(t("invalid_tracking_link"));
      setLoading(false);
      return;
    }

    void load();

    intervalRef.current = window.setInterval(() => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOffline(true);
        return;
      }
      void load();
    }, 20_000);

    tickRef.current = window.setInterval(() => {
      setSecondsAgo((value) => value + 1);
    }, 1000);

    const handleOffline = () => {
      setOffline(true);
      setReconnecting(false);
    };

    const handleOnline = () => {
      setOffline(false);
      setReconnecting(true);
      void load(true);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
      }
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [orderId, token, t, lang]);

  const currentStatus = snapshot?.order.status
    ? normalizeOrderStatus(snapshot.order.status)
    : "";
  const isDelivered = currentStatus === "delivered";
  const isOutForDelivery = currentStatus === "out_for_delivery";
  const connectionState = snapshot?.connection.state ?? "order_lookup_fallback";
  const liveEnabled = !offline && connectionState === "token_live";
  const showLiveBadge = liveEnabled && !loading && !error;
  const progressPercent = Math.round(((getStatusIndex(currentStatus) + 1) / STATUS_TIMELINE.length) * 100);

  const recoveryActions = [
    {
      to: "/products",
      label: t("browse_products"),
      icon: Package,
      variant: "primary" as const,
    },
    {
      to: "/special-orders",
      label: t("request_unavailable_medicine"),
      icon: ClipboardList,
      variant: "secondary" as const,
    },
  ];

  const connectionPanel = (() => {
    if (reconnecting) {
      return (
        <StatusPanel
          tone="reconnecting"
          title={t("reconnect_now")}
          description={
            lang === "ar"
              ? "نحاول استعادة الاتصال بالتتبع وتحميل آخر حالة للطلب."
              : "Reconnecting to tracking and loading the latest order state."
          }
        />
      );
    }

    if (offline) {
      return (
        <StatusPanel
          tone="offline"
          title={lang === "ar" ? "التحديثات المباشرة متوقفة مؤقتاً" : "Live Updates Are Paused"}
          description={
            <div className="space-y-1">
              <p>{t("live_updates_paused")}</p>
              <p>{t("live_updates_resume")}</p>
            </div>
          }
          actions={<BrandActionGroup actions={recoveryActions} />}
        />
      );
    }

    if (connectionState === "network_fallback") {
      return (
        <StatusPanel
          tone="warning"
          title={lang === "ar" ? "تم فقد الاتصال بالتتبع المباشر" : "Live Tracking Connection Lost"}
          description={
            <div className="space-y-1">
              <p>{t("tracking_connection_lost")}</p>
              <p>{t("latest_snapshot_shown")}</p>
            </div>
          }
          actions={<BrandActionGroup actions={recoveryActions} />}
        />
      );
    }

    if (connectionState === "order_lookup_fallback") {
      return (
        <StatusPanel
          tone="info"
          title={t("status_only_tracking")}
          description={
            lang === "ar"
              ? "يمكنك متابعة حالة الطلب هنا، لكن بيانات السائق والموقع المباشر قد لا تكون متاحة."
              : "You can still follow the order status here, but live driver and location data may be unavailable."
          }
        />
      );
    }

    return null;
  })();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbfc_0%,#eef7f5_100%)] px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {connectionPanel}

        <motion.section
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-600">
                  {liveEnabled ? t("live_tracking") : t("status_only_tracking")}
                </p>
                <LivePulse active={showLiveBadge} reducedMotion={shouldReduceMotion} />
              </div>
              <h1 className="mt-2 text-3xl font-black text-slate-950">
                {lang === "ar" ? "تتبع الطلب" : "Order Tracking"}
              </h1>
              <p className="mt-1.5 text-sm font-semibold text-slate-500">
                {connectionState === "token_live"
                  ? (lang === "ar"
                    ? "عرض مباشر مرتبط برابط التتبع فقط دون كشف أي بيانات تشغيلية أخرى."
                    : "Token-scoped live view with no broader fleet data exposed.")
                  : (lang === "ar"
                    ? "يعرض هذا الرابط حالة الطلب الحالية مع أقل قدر ممكن من البيانات."
                    : "This link shows the current order state with the minimum data necessary.")}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {lastUpdated ? (
                <span className="text-[11px] font-semibold text-slate-400">
                  {lang === "ar"
                    ? `تم التحديث ${secondsAgo < 5 ? "الآن" : `منذ ${secondsAgo} ثانية`}`
                    : `Updated ${secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}`}
                </span>
              ) : null}
              <motion.button
                whileTap={shouldReduceMotion ? undefined : { scale: 0.94, rotate: -15 }}
                type="button"
                onClick={() => void load(true)}
                disabled={loading || refreshing}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-600 disabled:opacity-50"
                aria-label={lang === "ar" ? "تحديث التتبع" : "Refresh tracking"}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </motion.button>
            </div>
          </div>

          {orderId ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
                <Package className="h-3.5 w-3.5 text-teal-500" />
                {lang === "ar" ? "رقم الطلب:" : "Order ID:"} <span dir="ltr">{orderId.slice(0, 16)}…</span>
              </span>
              {currentStatus && !loading && !error ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-black",
                    isDelivered
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : isOutForDelivery
                        ? "border-teal-200 bg-teal-50 text-teal-700"
                        : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  <Zap className="h-3.5 w-3.5" />
                  {labelForStatus(currentStatus, lang)}
                </span>
              ) : null}
            </div>
          ) : null}
        </motion.section>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.section
              key="error"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-14 text-center shadow-sm"
            >
              <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
              <p className="mt-4 text-base font-black text-rose-700">
                {token ? error : t("invalid_tracking_link")}
              </p>
              <p className="mt-2 text-sm font-semibold text-rose-500">
                {lang === "ar"
                  ? "تأكد من فتح الصفحة من رابط تتبع صحيح أو عد إلى المتجر للمتابعة."
                  : "Make sure you opened this page from a valid tracking link or return to the storefront."}
              </p>
              <div className="mt-5 flex justify-center">
                <BrandActionGroup actions={recoveryActions} />
              </div>
            </motion.section>
          ) : snapshot ? (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"
            >
              <div className="space-y-5">
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "rounded-[1.8rem] border p-5 shadow-sm",
                    isDelivered
                      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/60"
                      : isOutForDelivery && liveEnabled
                        ? "border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50/60"
                        : "border-slate-200 bg-white",
                  )}
                >
                  {isDelivered ? (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-100/60 px-4 py-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <p className="text-sm font-black text-emerald-800">
                        {lang === "ar" ? "تم تسليم طلبك بنجاح." : "Your order has been delivered successfully."}
                      </p>
                    </div>
                  ) : null}
                  {isOutForDelivery && liveEnabled ? (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-100/60 px-4 py-3">
                      <Truck className="h-5 w-5 text-teal-600" />
                      <p className="text-sm font-black text-teal-800">
                        {lang === "ar"
                          ? "السائق في الطريق إليك ويمكنك متابعة الموقع أدناه."
                          : "Your driver is on the way and you can follow the location below."}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <InfoCard
                      label={lang === "ar" ? "الحالة الحالية" : "Current Status"}
                      value={labelForStatus(snapshot.order.status, lang)}
                      icon={ShieldCheck}
                    />
                    <InfoCard
                      label={lang === "ar" ? "السائق" : "Driver"}
                      value={snapshot.driver?.first_name || (lang === "ar" ? "سيتم التعيين قريباً" : "Dispatching soon")}
                      icon={User}
                    />
                    <InfoCard
                      label={lang === "ar" ? "رقم المتابعة" : "Support Line"}
                      value={snapshot.driver?.phone || (lang === "ar" ? "متاح عند الحاجة" : "Available when needed")}
                      icon={Phone}
                    />
                  </div>
                </motion.div>

                <MapSnapshot
                  destLat={snapshot.order.customer_lat}
                  destLng={snapshot.order.customer_lng}
                  driverLat={snapshot.location?.lat}
                  driverLng={snapshot.location?.lng}
                  lang={lang}
                  liveEnabled={liveEnabled}
                  reducedMotion={shouldReduceMotion}
                />

                <div className="rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {lang === "ar" ? "ملخص الحالة" : "Status Summary"}
                  </p>
                  <p className="mt-2 text-sm font-black text-slate-900">
                    {descriptionForStatus(currentStatus, lang)}
                  </p>
                </div>

                {snapshot.location?.captured_at ? (
                  <div className="flex items-center gap-3 rounded-[1.3rem] border border-slate-200 bg-white px-5 py-4">
                    <Clock className="h-4 w-4 shrink-0 text-teal-500" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {lang === "ar" ? "آخر إشارة من السائق" : "Last Driver Ping"}
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900" dir="ltr">
                        {snapshot.location.captured_at}
                      </p>
                    </div>
                    <LivePulse active={liveEnabled} reducedMotion={shouldReduceMotion} />
                  </div>
                ) : null}
              </div>

              <div className="space-y-5">
                <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-600">
                        {lang === "ar" ? "التقدم" : "Progress"}
                      </p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">
                        {lang === "ar" ? "التسلسل الزمني للحالة" : "Status Timeline"}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <LivePulse active={liveEnabled} reducedMotion={shouldReduceMotion} />
                      <span className="text-[11px] font-semibold text-slate-400">
                        {liveEnabled ? t("live_tracking") : t("status_only_tracking")}
                      </span>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] font-black text-slate-400">
                      <span>{lang === "ar" ? "تم الطلب" : "Placed"}</span>
                      <span>{progressPercent}%</span>
                      <span>{lang === "ar" ? "تم التسليم" : "Delivered"}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          isDelivered
                            ? "bg-emerald-500"
                            : isOutForDelivery && liveEnabled
                              ? "bg-teal-500"
                              : "bg-amber-400",
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                      />
                    </div>
                  </div>

                  <StatusTimeline currentStatus={currentStatus} lang={lang} reducedMotion={shouldReduceMotion} />
                </section>

                <div className="flex items-center gap-3 rounded-[1.3rem] border border-slate-200 bg-white px-5 py-4">
                  <Loader2 className={cn("h-4 w-4 shrink-0 text-teal-500", !shouldReduceMotion && "animate-spin")} />
                  <p className="text-[11px] font-semibold text-slate-500">
                    {liveEnabled
                      ? (lang === "ar"
                        ? "يتم تحديث الصفحة كل 20 ثانية ويمكنك التحديث يدوياً في أي وقت."
                        : "This page refreshes every 20 seconds and you can also refresh it manually.")
                      : (lang === "ar"
                        ? "يتم تحديث الصفحة دورياً لإظهار آخر حالة متاحة للطلب."
                        : "This page refreshes periodically to show the latest available order status.")}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
