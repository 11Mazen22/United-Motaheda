/**
 * AdminSidebar — dark ink sidebar with per-section color accents
 * and an active-item preview card showing the current page context.
 */

import { type ComponentType, type CSSProperties, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  HeartIcon,
  HomeIcon,
  InboxStackIcon,

  ShieldCheckIcon,
  Squares2X2Icon,
  TruckIcon,
  UsersIcon,
  UserGroupIcon,
  BellIcon,
  TagIcon,
  VideoCameraIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "../components/UI";
import type { AdminRole } from "./adminShared";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const INK  = "#0A1220";

// ─── Per-section accent color map ─────────────────────────────────────────────
const SECTION_COLOR: Record<string, { accent: string; bg: string; border: string; text: string }> = {
  overview:      { accent: "#0E7E74", bg: "rgba(14,126,116,0.18)",  border: "rgba(14,126,116,0.30)",  text: "#5ee7c8" },
  orders:        { accent: "#0EA5E9", bg: "rgba(14,165,233,0.18)",  border: "rgba(14,165,233,0.30)",  text: "#7dd3fc" },
  inventory:     { accent: "#6366F1", bg: "rgba(99,102,241,0.18)",  border: "rgba(99,102,241,0.30)",  text: "#a5b4fc" },
  promotions:    { accent: "#D946EF", bg: "rgba(217,70,239,0.18)",  border: "rgba(217,70,239,0.30)",  text: "#f0abfc" },

  prescriptions: { accent: "#EF4444", bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.28)",   text: "#fca5a5" },
  users:         { accent: "#8B5CF6", bg: "rgba(139,92,246,0.18)", border: "rgba(139,92,246,0.30)",  text: "#c4b5fd" },
  notifications: { accent: "#EC4899", bg: "rgba(236,72,153,0.15)", border: "rgba(236,72,153,0.28)",  text: "#f9a8d4" },
  deliveries:    { accent: "#0EA5E9", bg: "rgba(14,165,233,0.18)",  border: "rgba(14,165,233,0.30)",  text: "#7dd3fc" },
};

// ─── Nav data ─────────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  end?: boolean;
  labelAr: string;
  labelEn: string;
  hintAr: string;
  hintEn: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  allowedRoles: AdminRole[];
}

interface NavSection {
  key: string;
  labelAr: string;
  labelEn: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  items: NavItem[];
}

const ALL_SECTIONS: NavSection[] = [
  {
    key: "overview",
    labelAr: "الرئيسية",
    labelEn: "Overview",
    icon: Squares2X2Icon,
    items: [
      { to: "/admin", end: true, labelAr: "لوحة المؤشرات", labelEn: "Dashboard", hintAr: "النبض اليومي والمؤشرات", hintEn: "Live KPIs and daily pulse", icon: HomeIcon, allowedRoles: ["admin", "manager", "pharmacist"] },
    ],
  },
  {
    key: "orders",
    labelAr: "معالجة الطلبات",
    labelEn: "Order Processing",
    icon: ClipboardDocumentListIcon,
    items: [
      { to: "/admin/orders", labelAr: "إدارة الطلبات", labelEn: "Orders", hintAr: "متابعة حالات الطلبات", hintEn: "Track and update order states", icon: ClipboardDocumentListIcon, allowedRoles: ["admin", "manager"] },
      { to: "/admin/special-orders", labelAr: "طلبات النواقص", labelEn: "Special Orders", hintAr: "طلبات تحتاج متابعة يدوية", hintEn: "Requests needing manual review", icon: InboxStackIcon, allowedRoles: ["admin", "manager", "pharmacist"] },
    ],
  },
  {
    key: "inventory",
    labelAr: "إدارة المخزون",
    labelEn: "Inventory",
    icon: CubeIcon,
    items: [
      { to: "/admin/products/fast-entry", labelAr: "الإدخال السريع", labelEn: "Fast Entry", hintAr: "باركود وصورة وحفظ سريع", hintEn: "Barcode scan, snapshot, save", icon: VideoCameraIcon, allowedRoles: ["admin", "manager", "pharmacist"] },
      { to: "/admin/products", end: true, labelAr: "كتالوج المنتجات", labelEn: "Product Catalog", hintAr: "الكتالوج والمخزون الكامل", hintEn: "Full catalog and stock levels", icon: CubeIcon, allowedRoles: ["admin", "manager", "pharmacist"] },
      { to: "/admin/promotions", labelAr: "العروض", labelEn: "Promotions", hintAr: "عروض مجدولة وأسعار محكمة", hintEn: "Scheduled, controlled discounts", icon: TagIcon, allowedRoles: ["admin", "manager"] },
    ],
  },

  {
    key: "prescriptions",
    labelAr: "الوصفات الطبية",
    labelEn: "Prescriptions",
    icon: HeartIcon,
    items: [
      { to: "/admin/prescriptions", labelAr: "مراجعة الوصفات", labelEn: "Prescription Review", hintAr: "مراجعة الوصفات وطلبات إعادة الصرف", hintEn: "Review prescriptions and refill requests", icon: HeartIcon, allowedRoles: ["admin", "manager", "pharmacist"] },
    ],
  },
  {
    key: "users",
    labelAr: "إدارة المستخدمين",
    labelEn: "User Management",
    icon: UsersIcon,
    items: [
      { to: "/admin/users",  labelAr: "إدارة المستخدمين",  labelEn: "Users",  hintAr: "حسابات العملاء والتعليق والحذف", hintEn: "Customer accounts, suspend, delete", icon: UserGroupIcon, allowedRoles: ["admin"] },
      { to: "/admin/staff",  labelAr: "إدارة الموظفين",    labelEn: "Staff",  hintAr: "الفريق والصلاحيات والأدوار",    hintEn: "Team, permissions, and roles",    icon: UsersIcon,     allowedRoles: ["admin"] },
    ],
  },
  {
    key: "notifications",
    labelAr: "الإشعارات",
    labelEn: "Notifications",
    icon: BellIcon,
    items: [
      { to: "/admin/notifications", labelAr: "إرسال الإشعارات", labelEn: "Send Notifications", hintAr: "إشعارات فورية عبر Supabase Realtime", hintEn: "Push real-time notifications via Supabase", icon: BellIcon, allowedRoles: ["admin", "manager"] },
    ],
  },
];

const DRIVER_SECTIONS: NavSection[] = [
  {
    key: "deliveries",
    labelAr: "طلباتي",
    labelEn: "My Deliveries",
    icon: TruckIcon,
    items: [
      { to: "/driver", end: false, labelAr: "طلباتي المسندة", labelEn: "My Assigned Orders", hintAr: "عرض الطلبات المسندة إليك", hintEn: "Orders assigned to you", icon: TruckIcon, allowedRoles: ["driver"] },
    ],
  },
];

function getAllowedSections(role: AdminRole): NavSection[] {
  if (role === "driver") return DRIVER_SECTIONS;
  return ALL_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => item.allowedRoles.includes(role)) }))
    .filter((section) => section.items.length > 0);
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────

function RoleBadge({ role, lang }: { role: AdminRole; lang: "ar" | "en" }) {
  const config: Record<AdminRole, { label: string; cls: string }> = {
    admin:      { label: lang === "ar" ? "مدير"  : "Admin",      cls: "border-teal-500/30 bg-teal-500/15 text-teal-300" },
    manager:    { label: lang === "ar" ? "مشرف"  : "Manager",    cls: "border-amber-500/30 bg-amber-500/15 text-amber-300" },
    pharmacist: { label: lang === "ar" ? "صيدلي" : "Pharmacist", cls: "border-violet-500/30 bg-violet-500/15 text-violet-300" },
    driver:     { label: lang === "ar" ? "سائق"  : "Driver",     cls: "border-sky-500/30 bg-sky-500/15 text-sky-300" },
    customer:   { label: lang === "ar" ? "عميل"  : "Customer",   cls: "border-slate-500/30 bg-slate-500/15 text-slate-300" },
  };
  const { label, cls } = config[role] ?? config.customer;
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

// ─── Active item preview card ─────────────────────────────────────────────────

function ActivePreviewCard({
  item,
  section,
  lang,
}: {
  item: NavItem;
  section: NavSection;
  lang: "ar" | "en";
}) {
  const colors = SECTION_COLOR[section.key] ?? SECTION_COLOR.overview;
  const Icon = item.icon;
  return (
    <div
      className="relative mx-3 mb-2 mt-1 overflow-hidden rounded-xl px-3 py-2.5"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: colors.accent + "33" }}
        >
          <Icon className="h-4 w-4" style={{ color: colors.text }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-white">
            {lang === "ar" ? item.labelAr : item.labelEn}
          </p>
          <p className="mt-0.5 truncate text-[9px] font-semibold" style={{ color: colors.text }}>
            {lang === "ar" ? item.hintAr : item.hintEn}
          </p>
        </div>
      </div>
      {/* Section label */}
      <div className="mt-2 flex items-center gap-1.5">
        <span
          className="h-1 w-4 rounded-full"
          style={{ background: colors.accent }}
        />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: colors.text, opacity: 0.7 }}>
          {lang === "ar" ? section.labelAr : section.labelEn}
        </span>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdminSidebarProps {
  lang: "ar" | "en";
  pathname: string;
  userFullName: string;
  userSecondary: string;
  userInitial: string;
  userRole?: AdminRole;
  mobile?: boolean;
  open?: boolean;
  collapsed?: boolean;
  onClose: () => void;
  onNavigateStore: () => void;
  onSignOut: () => void | Promise<void>;
  onToggleCollapse?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminSidebar({
  lang,
  pathname,
  userFullName,
  userSecondary,
  userInitial,
  userRole = "admin",
  mobile = false,
  open = false,
  collapsed = false,
  onClose,
  onNavigateStore,
  onSignOut,
  onToggleCollapse,
}: AdminSidebarProps) {
  const isRtl = lang === "ar";
  const desktopCollapsed = !mobile && collapsed;
  const hiddenTransform = isRtl ? "translate-x-full" : "-translate-x-full";

  const visibleSections = useMemo(() => getAllowedSections(userRole), [userRole]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(visibleSections.map((s) => [s.key, true])),
  );
  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Derive active item + its section for the preview card
  const { activeItem, activeSection } = useMemo(() => {
    for (const section of visibleSections) {
      for (const item of section.items) {
        const matches = item.end ? pathname === item.to : pathname.startsWith(item.to);
        if (matches) return { activeItem: item, activeSection: section };
      }
    }
    return { activeItem: null, activeSection: null };
  }, [pathname, visibleSections]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 z-50 transition-[width,transform] duration-300 ease-out",
        isRtl ? "right-0" : "left-0",
        mobile
          ? cn("w-72 max-w-[calc(100vw-1rem)] lg:hidden", open ? "translate-x-0" : hiddenTransform)
          : cn("hidden lg:block", desktopCollapsed ? "lg:w-[5.75rem]" : "lg:w-[17.5rem]"),
      )}
      aria-hidden={mobile ? !open : undefined}
    >
      <div
        className="flex h-screen flex-col overflow-hidden shadow-[4px_0_32px_rgba(0,0,0,0.22)]"
        style={{ backgroundColor: INK, borderInlineEnd: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* ── Logo header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 px-3 pb-3 pt-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className={cn("flex items-center gap-2", desktopCollapsed && "justify-center")}>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md"
              style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
            >
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>

            {!desktopCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-teal-400">
                  {lang === "ar" ? "لوحة الإدارة" : "Admin workspace"}
                </p>
                <h1 className="mt-0.5 text-sm font-black tracking-tight text-white">
                  {lang === "ar" ? "مركز التحكم" : "Control Center"}
                </h1>
              </div>
            )}

            <div className="shrink-0">
              {mobile ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={lang === "ar" ? "إغلاق" : "Close"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/8 hover:text-white"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              ) : onToggleCollapse ? (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label={lang === "ar" ? (desktopCollapsed ? "توسيع" : "طي") : (desktopCollapsed ? "Expand" : "Collapse")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/8 hover:text-white"
                >
                  {desktopCollapsed
                    ? isRtl ? <ChevronDoubleLeftIcon className="h-4 w-4" /> : <ChevronDoubleRightIcon className="h-4 w-4" />
                    : isRtl ? <ChevronDoubleRightIcon className="h-4 w-4" /> : <ChevronDoubleLeftIcon className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Active page preview card ─────────────────────────────────────── */}
        {!desktopCollapsed && activeItem && activeSection && (
          <ActivePreviewCard item={activeItem} section={activeSection} lang={lang} />
        )}

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <nav
          className={cn("relative flex-1 overflow-y-auto pb-2", !desktopCollapsed && !activeItem && "pt-2", desktopCollapsed ? "px-2" : "px-3")}
          aria-label={lang === "ar" ? "القائمة الرئيسية" : "Main navigation"}
        >
          <div className="space-y-3">
            {visibleSections.map((section) => {
              const colors = SECTION_COLOR[section.key] ?? SECTION_COLOR.overview;
              const sectionExpanded = desktopCollapsed ? true : openSections[section.key] !== false;

              return (
                <div key={section.key}>
                  {!desktopCollapsed && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/5"
                      aria-expanded={sectionExpanded}
                    >
                      {/* Section accent line */}
                      <span className="h-0.5 w-4 rounded-full" style={{ background: colors.accent }} />
                      <span className="flex-1 text-start text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: colors.text, opacity: 0.8 }}>
                        {lang === "ar" ? section.labelAr : section.labelEn}
                      </span>
                      <ChevronDownIcon className={cn("h-3 w-3 text-slate-500 transition-transform duration-200", sectionExpanded && "rotate-180")} />
                    </button>
                  )}

                  {sectionExpanded && (
                    <div className={cn("space-y-0.5", desktopCollapsed && "mt-1 space-y-1")}>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const itemLabel = lang === "ar" ? item.labelAr : item.labelEn;

                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={mobile ? onClose : undefined}
                            title={desktopCollapsed ? itemLabel : undefined}
                            className={({ isActive }) =>
                              cn(
                                "group relative flex items-center gap-2.5 rounded-xl px-2 py-2.5 transition-all duration-150",
                                desktopCollapsed && "justify-center",
                                isActive ? "text-white" : "text-slate-400 hover:text-slate-200",
                              )
                            }
                            style={({ isActive }) =>
                              isActive
                                ? { backgroundColor: colors.bg, boxShadow: `inset 0 0 0 1px ${colors.border}` }
                                : {}
                            }
                            aria-label={desktopCollapsed ? itemLabel : undefined}
                          >
                            {({ isActive }) => (
                              <>
                                {/* Section-colored active left bar */}
                                {isActive && !desktopCollapsed && (
                                  <span
                                    className="absolute inset-y-2 rounded-full"
                                    style={{ [isRtl ? "right" : "left"]: 0, width: "2px", background: colors.accent }}
                                  />
                                )}

                                <span
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150"
                                  style={isActive ? { backgroundColor: colors.accent } : { backgroundColor: "rgba(255,255,255,0.05)" }}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>

                                {!desktopCollapsed && (
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-semibold leading-tight">
                                      {itemLabel}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500 group-hover:text-slate-400">
                                      {lang === "ar" ? item.hintAr : item.hintEn}
                                    </span>
                                  </span>
                                )}
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* ── User footer ─────────────────────────────────────────────────── */}
        <div className="shrink-0 p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            className="rounded-xl p-2.5"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className={cn("flex items-center gap-2.5", desktopCollapsed && "justify-center")}>
              <div
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white shadow-sm"
                style={{ background: "linear-gradient(135deg, #0E7E74 0%, #0d6b62 100%)" }}
              >
                {userInitial}
              </div>

              {!desktopCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <RoleBadge role={userRole} lang={lang} />
                  </div>
                  <p className="mt-1 truncate text-[13px] font-semibold text-slate-200">
                    {userFullName || (lang === "ar" ? "مدير النظام" : "Administrator")}
                  </p>
                  <p className="truncate text-[10px] text-slate-500" dir="ltr">{userSecondary}</p>
                </div>
              )}
            </div>

            <div className={cn("mt-2.5 grid gap-1.5", desktopCollapsed ? "grid-cols-1" : "grid-cols-2")}>
              <button
                type="button"
                onClick={onNavigateStore}
                title={lang === "ar" ? "المتجر" : "Store"}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-slate-400 transition hover:bg-white/8 hover:text-slate-200"
              >
                <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
                {!desktopCollapsed && <span>{lang === "ar" ? "المتجر" : "Store"}</span>}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                title={lang === "ar" ? "خروج" : "Sign out"}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-rose-900/30 bg-rose-950/40 px-2 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-900/40 hover:text-rose-300"
              >
                <ArrowLeftOnRectangleIcon className="h-3 w-3 shrink-0" />
                {!desktopCollapsed && <span>{lang === "ar" ? "خروج" : "Sign out"}</span>}
              </button>
            </div>
          </div>

          {!desktopCollapsed && (
            <p className="mt-2 text-center text-[9px] text-slate-600">
              United Pharmacies · Admin
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
