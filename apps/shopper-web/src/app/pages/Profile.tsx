import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  LogOut,
  MapPin,
  Package,
  Pencil,
  Phone,
  Settings,
  Shield,
  ShoppingBag,
  User,
  X,
  Star,
  TrendingUp,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { EmptyState } from "../components/BrandPrimitives";
import { readOrders, syncRemoteOrders, type StoredOrder } from "../orders";
import { cn } from "../components/UI";
import { useIsShopperShell } from "../components/ui/use-mobile";
import {
  getCachedCustomerOrders,
  getCustomerOrders,
} from "../../services/shopperOrdersApi";
import { MobileProfileView } from "./ShopperMobileViews";
import { supabase } from "../../lib/supabaseClient";

const TEAL = "#0E7E74";
const INK = "#0A1220";

const PROFILE_PREFERENCES_KEY = "united-pharmacies-profile-preferences-v1";

function readPreferences() {
  if (typeof window === "undefined") {
    return { orders: true, offers: true, news: false };
  }
  try {
    const rawValue = window.localStorage.getItem(PROFILE_PREFERENCES_KEY);
    if (!rawValue) return { orders: true, offers: true, news: false };
    const parsed = JSON.parse(rawValue) as Record<string, boolean>;
    return {
      orders: Boolean(parsed.orders),
      offers: Boolean(parsed.offers),
      news: Boolean(parsed.news),
    };
  } catch {
    return { orders: true, offers: true, news: false };
  }
}

function getStatusLabel(status: string, lang: "ar" | "en") {
  if (status.toLowerCase() === "pending") return lang === "ar" ? "قيد المراجعة" : "Pending";
  if (status.toLowerCase() === "delivered") return lang === "ar" ? "تم التسليم" : "Delivered";
  if (status.toLowerCase() === "cancelled") return lang === "ar" ? "ملغى" : "Cancelled";
  return lang === "ar" ? "تم الاستلام" : "Received";
}

function getStatusColors(status: string): { bg: string; text: string; border: string; dot: string } {
  const s = status.toLowerCase();
  if (s === "delivered") return { bg: "#F0FDF9", text: TEAL, border: "rgba(14,126,116,0.2)", dot: TEAL };
  if (s === "cancelled") return { bg: "#FFF1F2", text: "#E11D48", border: "rgba(225,29,72,0.2)", dot: "#E11D48" };
  return { bg: "#FFFBEB", text: "#D97706", border: "rgba(217,119,6,0.2)", dot: "#D97706" };
}

export default function Profile() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <MobileProfileView />;
  return <ProfileDesktop />;
}

function ProfileDesktop() {
  const { user, signOut } = useAuth();
  const { cart } = useCart();
  const { lang, t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"info" | "orders" | "preferences">("info");
  const [notifications, setNotifications] = useState(readPreferences);
  const [orders, setOrders] = useState<StoredOrder[]>(() => {
    if (!user) return [];
    const cachedOrders = getCachedCustomerOrders();
    if (cachedOrders?.length) return syncRemoteOrders(cachedOrders, user.phone);
    return readOrders().filter((order) => user.role !== "customer" || order.phone === user.phone);
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState(user?.fullName ?? "");
  const [editAddress, setEditAddress] = useState(user?.address ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [orderCancelState, setOrderCancelState] = useState<Record<string, "confirming" | "requested">>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROFILE_PREFERENCES_KEY, JSON.stringify(notifications));
    }
  }, [notifications]);

  useEffect(() => {
    if (!user || user.role !== "customer") {
      setOrders(user ? readOrders() : []);
      return;
    }
    setOrders(readOrders().filter((order) => order.phone === user.phone));
    let active = true;
    void getCustomerOrders(true)
      .then((remoteOrders) => {
        if (!active) return;
        setOrders(syncRemoteOrders(remoteOrders, user.phone));
      })
      .catch(() => {
        if (!active) return;
        setOrders(readOrders().filter((order) => order.phone === user.phone));
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) return;
    const channel = supabase
      .channel("user-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + user.id },
        (payload) => {
          const row = payload.new as { type?: string; title?: string; body?: string };
          const type = row.type ?? "";
          if (type === "order" && notifications.orders) toast.info(row.title ?? "", { description: row.body });
          else if (type === "offer" && notifications.offers) toast.info(row.title ?? "", { description: row.body });
          else if (type === "news" && notifications.news) toast.info(row.title ?? "", { description: row.body });
        })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, notifications.orders, notifications.offers, notifications.news]);

  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const memberSince = user?.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear();
  const userInitial = user?.fullName?.charAt(0).toUpperCase() || user?.phone?.charAt(0).toUpperCase() || "U";
  const formatDate = useMemo(
    () => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" }),
    [lang],
  );

  if (!user) return null;

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const handleSaveProfile = async () => {
    if (!supabase) { toast.error(lang === "ar" ? "خدمة قاعدة البيانات غير متاحة" : "Database service unavailable"); return; }
    setIsSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: editFullName, address: editAddress } });
      if (authError) throw authError;
      const { error: profileError } = await supabase.from("profiles").update({ full_name: editFullName, address: editAddress }).eq("id", user.id);
      if (profileError) throw profileError;
      toast.success(lang === "ar" ? "تم حفظ البيانات" : "Profile saved");
      setIsEditing(false);
    } catch {
      toast.error(lang === "ar" ? "فشل الحفظ، حاول مرة أخرى" : "Save failed, please try again");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditFullName(user.fullName ?? "");
    setEditAddress(user.address ?? "");
    setIsEditing(false);
  };

  const handleRequestCancellation = async (order: StoredOrder) => {
    if (!orderCancelState[order.id]) { setOrderCancelState((s) => ({ ...s, [order.id]: "confirming" })); return; }
    if (!supabase) { toast.error(lang === "ar" ? "خدمة قاعدة البيانات غير متاحة" : "Database service unavailable"); return; }
    try {
      const { error } = await supabase.from("order_deletion_requests").insert({ order_id: order.id, user_phone: user.phone, requested_at: new Date().toISOString(), status: "pending" });
      if (error) throw error;
      setOrderCancelState((s) => ({ ...s, [order.id]: "requested" }));
      toast.success(lang === "ar" ? "تم إرسال طلب الإلغاء" : "Cancellation request submitted", { description: lang === "ar" ? "سيتم مراجعة الطلب قريباً" : "We'll review it shortly" });
    } catch {
      toast.error(lang === "ar" ? "فشل الإرسال، حاول مرة أخرى" : "Failed to submit, please try again");
    }
  };

  const tabs = [
    { id: "info",        icon: Settings, labelAr: "بيانات الحساب",   labelEn: "Account Info" },
    { id: "orders",      icon: Package,  labelAr: "طلباتي",          labelEn: "My Orders" },
    { id: "preferences", icon: Bell,     labelAr: "تفضيلات الإشعار", labelEn: "Preferences" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F8FAFB]">

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, ${INK} 0%, #162032 60%, #1A2A40 100%)` }}>
        {/* Breadcrumb */}
        <div className="page-section pb-0 pt-5">
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Link to="/" className="transition-colors hover:text-slate-200">
              {t("home")}
            </Link>
            <ChevronRight className={cn("h-3.5 w-3.5", lang === "ar" && "rotate-180")} />
            <span className="text-slate-200">{lang === "ar" ? "حسابي" : "My Account"}</span>
          </nav>
        </div>

        {/* Profile identity row */}
        <div className="page-section py-8">
          <div className="flex flex-wrap items-center gap-6">
            {/* Avatar with teal ring */}
            <div className="relative shrink-0">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-black text-white shadow-[0_0_0_4px_rgba(14,126,116,0.5),0_0_0_8px_rgba(14,126,116,0.18)]"
                style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #0d6b62 100%)` }}
              >
                {userInitial}
              </div>
              {/* Online pulse dot */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#162032] bg-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </div>

            {/* Name & role */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">
                {user.fullName || (lang === "ar" ? "المستخدم" : "User")}
              </h1>
              <p className="mt-1 font-bold text-slate-400" dir="ltr">{user.phone}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
                  style={{ background: "rgba(14,126,116,0.22)", color: "#5ecea7", border: "1px solid rgba(14,126,116,0.35)" }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {user.role === "admin" ? (lang === "ar" ? "حساب موظف" : "Staff account") : (lang === "ar" ? "عميل موثّق" : "Verified customer")}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <Clock className="h-3 w-3" />
                  {lang === "ar" ? `عضو منذ ${memberSince}` : `Member since ${memberSince}`}
                </span>
              </div>
            </div>

            {/* Quick stats strip */}
            <div className="ms-auto flex shrink-0 items-center divide-x divide-slate-700 rounded-2xl border border-slate-700 bg-white/5 px-2 py-2 backdrop-blur-sm">
              {[
                { icon: Package, value: orders.length, labelAr: "طلب", labelEn: "Orders" },
                { icon: ShoppingBag, value: cartCount, labelAr: "سلة", labelEn: "Cart" },
                { icon: TrendingUp, value: `${totalSpent.toFixed(0)} ${t("currency")}`, labelAr: "مصروف", labelEn: "Spent" },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-1">
                  <stat.icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-sm font-black leading-none text-white">{stat.value}</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {lang === "ar" ? stat.labelAr : stat.labelEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body layout ─────────────────────────────────────────────────────── */}
      <div className="page-section py-8">
        <div className="flex flex-col gap-6 xl:flex-row">

          {/* ── Sidebar ── */}
          <div className="w-full shrink-0 space-y-3 xl:w-[17rem]">

            {/* Navigation */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {lang === "ar" ? "التنقل" : "Navigate"}
                </p>
              </div>
              <div className="p-2">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="group mb-0.5 flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-black transition-all"
                      style={active ? { background: INK, color: "#fff" } : { color: "#64748B" }}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                        style={active ? { background: "rgba(255,255,255,0.12)" } : { background: "#F1F5F9" }}
                      >
                        <tab.icon className="h-4 w-4" style={active ? { color: "#fff" } : { color: "#94A3B8" }} />
                      </span>
                      {lang === "ar" ? tab.labelAr : tab.labelEn}
                      {active && (
                        <ChevronRight className={cn("ms-auto h-3.5 w-3.5 text-slate-400", lang === "ar" && "rotate-180")} />
                      )}
                    </button>
                  );
                })}

                <div className="mx-2 my-2 h-px bg-slate-100" />

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-black text-rose-500 transition-all hover:bg-rose-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                    <LogOut className="h-4 w-4 text-rose-400" />
                  </span>
                  {t("logout")}
                </button>
              </div>
            </div>

            {/* Quick links */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {lang === "ar" ? "روابط سريعة" : "Quick links"}
                </p>
              </div>
              <div className="p-2">
                {[
                  { to: "/products", icon: ShoppingBag, labelAr: "تصفح المنتجات", labelEn: "Browse Products" },
                  { to: "/offers",   icon: Star,        labelAr: "العروض الحالية", labelEn: "Current Offers" },
                  { to: "/cart",     icon: Package,     labelAr: "مراجعة السلة",  labelEn: "Review Cart" },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 rounded-xl p-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                      <item.icon className="h-3.5 w-3.5 text-slate-400" />
                    </span>
                    {lang === "ar" ? item.labelAr : item.labelEn}
                    <ChevronRight className={cn("ms-auto h-3.5 w-3.5 text-slate-300", lang === "ar" && "rotate-180")} />
                  </Link>
                ))}
              </div>
            </div>

            {/* Total spent highlight card */}
            <div
              className="overflow-hidden rounded-2xl p-5"
              style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #0d6b62 100%)` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-100/80">
                    {lang === "ar" ? "إجمالي مشترياتك" : "Total purchases"}
                  </p>
                  <p className="text-xl font-black text-white">
                    {totalSpent.toFixed(2)} <span className="text-sm font-bold text-emerald-200">{t("currency")}</span>
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                {lang === "ar" ? `عبر ${orders.length} طلب` : `Across ${orders.length} order${orders.length !== 1 ? "s" : ""}`}
              </div>
            </div>
          </div>

          {/* ── Main content ── */}
          <div className="min-h-[500px] flex-1">

            {/* ── Account Info tab ── */}
            {activeTab === "info" && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Section header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: "rgba(14,126,116,0.08)" }}
                    >
                      <Settings className="h-5 w-5" style={{ color: TEAL }} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">{t("personal_info")}</h2>
                      <p className="text-xs font-semibold text-slate-400">
                        {lang === "ar" ? "بيانات حسابك الشخصي" : "Your personal account information"}
                      </p>
                    </div>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => { setEditFullName(user.fullName ?? ""); setEditAddress(user.address ?? ""); setIsEditing(true); }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {lang === "ar" ? "تعديل البيانات" : "Edit profile"}
                    </button>
                  )}
                </div>

                <div className="p-6">
                  {isEditing ? (
                    <div className="space-y-5 rounded-2xl border border-teal-100 bg-teal-50/40 p-6">
                      <p className="text-sm font-black text-teal-700">
                        {lang === "ar" ? "وضع التعديل" : "Edit mode"}
                      </p>
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">{t("full_name")}</label>
                        <input
                          type="text"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-[#0E7E74] focus:ring-2 focus:ring-[rgba(14,126,116,0.15)]"
                          placeholder={lang === "ar" ? "الاسم الكامل" : "Full name"}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">
                          {lang === "ar" ? "العنوان" : "Address"}
                        </label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-[#0E7E74] focus:ring-2 focus:ring-[rgba(14,126,116,0.15)]"
                          placeholder={lang === "ar" ? "العنوان الكامل" : "Full address"}
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={handleSaveProfile}
                          disabled={isSaving}
                          className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                          style={{ background: TEAL }}
                        >
                          {isSaving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ التغييرات" : "Save changes")}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          {lang === "ar" ? "إلغاء" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoCard icon={User}    label={t("full_name")}                        value={user.fullName || (lang === "ar" ? "غير متوفر" : "Not available")} />
                      <InfoCard icon={Phone}   label={t("phone")}                            value={user.phone || "--"}                                               dir="ltr" />
                      <InfoCard icon={Shield}  label={lang === "ar" ? "الدور" : "Role"}      value={user.role === "admin" ? (lang === "ar" ? "موظف / مدير" : "Admin / Staff") : (lang === "ar" ? "عميل" : "Customer")} />
                      <InfoCard icon={User}    label={lang === "ar" ? "اسم المستخدم" : "Username"} value={user.username || (lang === "ar" ? "غير محدد" : "Not set")} dir="ltr" />
                      <InfoCard icon={MapPin}  label={lang === "ar" ? "العنوان" : "Address"} value={user.address || (lang === "ar" ? "لا يوجد عنوان محفوظ" : "No address saved")} />
                      <InfoCard icon={CheckCircle2} label={lang === "ar" ? "حالة الحساب" : "Account status"} value={lang === "ar" ? "نشط ومتصل" : "Active"} accent />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── My Orders tab ── */}
            {activeTab === "orders" && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(14,126,116,0.08)" }}>
                      <Package className="h-5 w-5" style={{ color: TEAL }} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">{t("my_orders")}</h2>
                      <p className="text-xs font-semibold text-slate-400">
                        {orders.length} {lang === "ar" ? "طلب محفوظ" : "saved orders"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-end">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{lang === "ar" ? "الإجمالي" : "Total"}</p>
                    <p className="text-sm font-black" style={{ color: TEAL }}>{totalSpent.toFixed(2)} {t("currency")}</p>
                  </div>
                </div>

                <div className="p-6">
                  {orders.length > 0 ? (
                    <div className="space-y-3">
                      {orders.map((order) => {
                        const statusColors = getStatusColors(order.status);
                        const cancelState = orderCancelState[order.id];
                        return (
                          <div
                            key={order.id}
                            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(15,23,42,0.1)]"
                          >
                            {/* Status accent bar */}
                            <div className="h-1 w-full" style={{ background: statusColors.dot }} />
                            <div className="p-5">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="font-black text-slate-900 tabular-nums" dir="ltr">{order.id}</p>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatDate.format(new Date(order.createdAt))}
                                    </span>
                                    <span>·</span>
                                    <span>{order.itemCount} {lang === "ar" ? "قطعة" : "items"}</span>
                                  </div>
                                  {order.address && (
                                    <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      {order.address}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                  <span
                                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
                                    style={{ background: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}` }}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColors.dot }} />
                                    {getStatusLabel(order.status, lang)}
                                  </span>
                                  <p className="text-lg font-black" style={{ color: TEAL }}>
                                    {order.total.toFixed(2)} <span className="text-xs font-bold text-slate-400">{t("currency")}</span>
                                  </p>
                                </div>
                              </div>

                              {!["cancelled", "delivered"].includes(order.status.toLowerCase()) && (
                                <div className="mt-4 border-t border-slate-100 pt-3">
                                  {cancelState === "requested" ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {lang === "ar" ? "تم إرسال طلب الإلغاء" : "Cancellation requested"}
                                    </span>
                                  ) : cancelState === "confirming" ? (
                                    <div className="flex flex-wrap items-center gap-3">
                                      <p className="text-xs font-bold text-slate-500">
                                        {lang === "ar" ? "هل أنت متأكد؟" : "Confirm cancellation?"}
                                      </p>
                                      <button
                                        onClick={() => handleRequestCancellation(order)}
                                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black text-rose-600 transition-colors hover:bg-rose-100"
                                      >
                                        {lang === "ar" ? "نعم، أرسل الطلب" : "Yes, submit"}
                                      </button>
                                      <button
                                        onClick={() => setOrderCancelState((s) => { const next = { ...s }; delete next[order.id]; return next; })}
                                        className="text-xs font-bold text-slate-400 transition-colors hover:text-slate-600"
                                      >
                                        {lang === "ar" ? "لا" : "No"}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleRequestCancellation(order)}
                                      className="text-xs font-bold text-slate-400 transition-colors hover:text-rose-500"
                                    >
                                      {lang === "ar" ? "طلب إلغاء الطلب" : "Request cancellation"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Package}
                      title={t("no_orders")}
                      description={t("no_orders_desc")}
                      action={
                        <Link to="/products">
                          <button
                            className="inline-flex h-11 items-center gap-2 rounded-2xl px-8 text-sm font-black text-white shadow-sm transition-opacity hover:opacity-90"
                            style={{ background: INK }}
                          >
                            <ShoppingBag className="h-4 w-4" />
                            {t("start_shopping")}
                            <ArrowRight className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
                          </button>
                        </Link>
                      }
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── Preferences tab ── */}
            {activeTab === "preferences" && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3.5 border-b border-slate-100 px-6 py-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(14,126,116,0.08)" }}>
                    <Bell className="h-5 w-5" style={{ color: TEAL }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      {lang === "ar" ? "تفضيلات الإشعارات" : "Notification Preferences"}
                    </h2>
                    <p className="text-xs font-semibold text-slate-400">
                      {lang === "ar" ? "محفوظة محلياً في المتصفح" : "Saved locally in your browser"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 p-3">
                  {[
                    { key: "orders", icon: Package, labelAr: "تحديثات الطلبات", labelEn: "Order Updates",  descAr: "إشعارات تحديث الطلبات والتسليم", descEn: "Order and delivery status updates" },
                    { key: "offers", icon: Star,    labelAr: "العروض والخصومات", labelEn: "Offers & Deals", descAr: "تنبيه عند توفر عروض وخصومات جديدة", descEn: "Alerts when new offers are available" },
                    { key: "news",   icon: Bell,    labelAr: "أخبار المتجر",     labelEn: "Store News",    descAr: "تحديثات عامة من المتجر",           descEn: "General updates from the store" },
                  ].map((item) => {
                    const enabled = notifications[item.key as keyof typeof notifications];
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-5 py-4 transition-colors",
                          enabled ? "bg-teal-50/60" : "bg-slate-50/60",
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                            style={enabled ? { background: "rgba(14,126,116,0.12)" } : { background: "#F1F5F9" }}
                          >
                            <item.icon className="h-5 w-5" style={{ color: enabled ? TEAL : "#94A3B8" }} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              {lang === "ar" ? item.labelAr : item.labelEn}
                            </p>
                            <p className="text-xs font-semibold text-slate-400">
                              {lang === "ar" ? item.descAr : item.descEn}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => setNotifications((c) => ({ ...c, [item.key]: !c[item.key as keyof typeof c] }))}
                          className="relative h-7 w-14 shrink-0 rounded-full transition-all duration-200"
                          style={{ background: enabled ? TEAL : "#E2E8F0" }}
                          aria-checked={enabled}
                          role="switch"
                        >
                          <span
                            className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200"
                            style={enabled
                              ? lang === "ar" ? { right: "0.25rem" } : { left: "calc(100% - 1.5rem)" }
                              : lang === "ar" ? { right: "calc(100% - 1.5rem)" } : { left: "0.25rem" }}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 px-6 py-4">
                  <p className="text-xs font-semibold text-slate-400">
                    {lang === "ar"
                      ? "الإشعارات الموسومة تصلك تلقائياً عبر Supabase Realtime عند إرسالها من لوحة الإدارة."
                      : "Enabled notification types are delivered in real-time via Supabase when sent from the admin panel."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  dir,
  accent,
}: {
  icon: typeof User;
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3.5 rounded-2xl border p-4 transition-colors",
      accent ? "border-teal-100 bg-teal-50/60" : "border-slate-100 bg-white",
    )}>
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        accent ? "bg-teal-100/80" : "bg-slate-50",
      )}>
        <Icon className="h-4 w-4" style={{ color: accent ? TEAL : "#94A3B8" }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-black text-slate-900" dir={dir}>{value}</p>
      </div>
    </div>
  );
}
