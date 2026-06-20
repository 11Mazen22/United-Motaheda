/**
 * AdminLayout.tsx – Refined sticky header, role-aware routing, RTL/LTR support.
 * Modern clean design with light gradients, crisp typography, and subtle shadows.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { prefetchAdminData } from "../../services/googleSheetsApi";
import AdminSidebar from "./AdminSidebar";

const SIDEBAR_STORAGE_KEY = "united_admin_sidebar_collapsed";

function getAdminRouteMeta(pathname: string, lang: "ar" | "en") {
  if (pathname.startsWith("/admin/orders"))
    return {
      title: lang === "ar" ? "إدارة الطلبات" : "Orders",
      subtitle: lang === "ar"
        ? "متابعة الحالات اليومية وتحديث الطلبات بسرعة من شاشة واحدة."
        : "Track daily order states and update them quickly from one place.",
    };

  if (pathname.startsWith("/admin/special-orders"))
    return {
      title: lang === "ar" ? "طلبات النواقص" : "Special orders",
      subtitle: lang === "ar"
        ? "طابور موحّد لطلبات العملاء الخاصة التي تحتاج مراجعة أو متابعة."
        : "A single queue for customer special-order requests that need review or follow-up.",
    };

  if (pathname.startsWith("/admin/operations"))
    return {
      title: lang === "ar" ? "مركز العمليات" : "Operations",
      subtitle: lang === "ar"
        ? "تعيين السائقين وتتبع تسليم الطلبات من مكان واحد."
        : "Assign drivers and track delivery progress from one place.",
    };

  if (pathname.startsWith("/admin/products/fast-entry"))
    return {
      title: lang === "ar" ? "الإدخال السريع" : "Fast product entry",
      subtitle: lang === "ar"
        ? "تدفق سريع لالتقاط الباركود والصورة ثم حفظ مسودة منظمة للمراجعة."
        : "A fast workflow for barcode capture, image intake, and structured draft saving.",
    };

  if (pathname.startsWith("/admin/products"))
    return {
      title: lang === "ar" ? "إدارة المنتجات" : "Product catalog",
      subtitle: lang === "ar"
        ? "تحكم مباشر في الكتالوج والمخزون والتنبيهات المرتبطة بالمنتجات."
        : "Direct control over the catalog, stock levels, and product alerts.",
    };

  if (pathname.startsWith("/admin/staff"))
    return {
      title: lang === "ar" ? "إدارة الموظفين" : "Staff",
      subtitle: lang === "ar"
        ? "تنظيم الفريق والصلاحيات وحالة التشغيل من لوحة واضحة."
        : "Organize the team, permissions, and operating status from a cleaner panel.",
    };

  if (pathname.startsWith("/admin/notifications"))
    return {
      title: lang === "ar" ? "الإشعارات" : "Notifications",
      subtitle: lang === "ar"
        ? "أرسل إشعارات فورية لجميع المستخدمين أو مستخدم محدد عبر Supabase Realtime."
        : "Push real-time notifications to all users or a specific user via Supabase Realtime.",
    };

  return {
    title: lang === "ar" ? "لوحة التحكم" : "Overview",
    subtitle: lang === "ar"
      ? "ملخص تشغيلي سريع للمبيعات والطلبات وصحة الكتالوج والفريق."
      : "A quick operating summary for sales, orders, catalog health, and team activity.",
  };
}

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // ── All hooks must run unconditionally before any early return ────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const routeMeta = useMemo(
    () => getAdminRouteMeta(location.pathname, lang),
    [lang, location.pathname],
  );

  const userInitial = (user?.fullName || user?.username || user?.phone || "A")
    .slice(0, 1)
    .toUpperCase();

  // Sidebar persistence
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  // Auto-close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Escape key closes mobile sidebar
  useEffect(() => {
    if (typeof window === "undefined" || !sidebarOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarOpen]);

  // Page title
  useEffect(() => {
    document.title = `${routeMeta.title} | ${lang === "ar" ? "لوحة الإدارة" : "United Admin"}`;
  }, [lang, routeMeta.title]);

  // Prefetch admin data
  useEffect(() => {
    if (user?.role !== "admin") return;
    void prefetchAdminData();
  }, [user?.role]);

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
      weekday: "long", month: "long", day: "numeric",
    }).format(new Date()),
    [lang],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const layoutStyle = {
    "--admin-sidebar-width": sidebarCollapsed ? "5.75rem" : "17.5rem",
  } as CSSProperties;

  // ── Authorization guard — AFTER all hooks (Rules of Hooks) ───────────────
  if (!user || user.role === "customer" || !["admin", "manager", "pharmacist"].includes(user.role)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div
      style={layoutStyle}
      className="admin-layout flex min-h-screen flex-col bg-[var(--admin-bg)] text-[var(--admin-text)]"
    >
      {/* Clean, soft background gradient */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(13,148,136,0.04),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(15,23,42,0.02),transparent_24%)]" />

      {/* Desktop sidebar */}
      <AdminSidebar
        lang={lang}
        pathname={location.pathname}
        userFullName={user?.fullName || ""}
        userSecondary={user?.username || user?.phone || ""}
        userInitial={userInitial}
        userRole={user?.role ?? "customer"}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onNavigateStore={() => navigate("/")}
        onSignOut={handleSignOut}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[3px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={lang === "ar" ? "إغلاق القائمة" : "Close navigation"}
          />
          <AdminSidebar
            mobile
            open={sidebarOpen}
            lang={lang}
            pathname={location.pathname}
            userFullName={user?.fullName || ""}
            userSecondary={user?.username || user?.phone || ""}
            userInitial={userInitial}
            userRole={user?.role ?? "customer"}
            onClose={() => setSidebarOpen(false)}
            onNavigateStore={() => navigate("/")}
            onSignOut={handleSignOut}
          />
        </>
      )}

      {/* Main content area */}
      <div className="relative min-h-screen transition-[padding-inline-start] duration-300 lg:ps-[var(--admin-sidebar-width)]">
        {/* Sticky header – refined with softer bg */}
        <header className="sticky top-0 z-30 border-b border-[var(--admin-border)] bg-white/95 backdrop-blur-md shadow-sm">
          <div className="mx-auto flex max-w-[112rem] items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-8">
            {/* Left: menu toggle + title */}
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 active:scale-95 lg:hidden"
                aria-label={lang === "ar" ? "فتح القائمة" : "Open navigation"}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--admin-accent)]">
                  {lang === "ar" ? "لوحة الإدارة" : "Admin panel"}
                </p>
                <h2 className="truncate text-xl font-bold tracking-tight text-[var(--admin-heading)] sm:text-2xl">
                  {routeMeta.title}
                </h2>
                <p className="mt-0.5 hidden text-sm font-medium leading-5 text-[var(--admin-text-muted)] md:block">
                  {routeMeta.subtitle}
                </p>
              </div>
            </div>

            {/* Right: date + user + actions */}
            <div className="flex shrink-0 items-center gap-2 md:gap-2.5">
              {/* Date pill */}
              <div className="hidden rounded-xl border border-[var(--admin-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--admin-text-muted)] shadow-sm md:block">
                {todayLabel}
              </div>

              {/* User chip */}
              <div className="hidden items-center gap-2.5 rounded-xl border border-[var(--admin-border)] bg-white px-3 py-2 shadow-sm md:flex">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-sm font-extrabold text-teal-700">
                  {userInitial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {user?.fullName || (lang === "ar" ? "مدير النظام" : "Administrator")}
                  </p>
                  <p className="truncate text-xs font-medium text-slate-500" dir="ltr">
                    {user?.username || user?.phone}
                  </p>
                </div>
              </div>

              {/* Store link */}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-teal-600" />
                <span className="hidden sm:inline">{lang === "ar" ? "المتجر" : "Store"}</span>
              </button>

              {/* Sign out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-800 active:scale-95"
              >
                <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{lang === "ar" ? "خروج" : "Logout"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-[112rem] px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}