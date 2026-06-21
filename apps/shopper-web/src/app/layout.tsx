// ─────────────────────────────────────────────────────────────────────────────
//  Layout.tsx — United Pharmacies · Root Shell
//  Handles: routing, SEO metadata, scroll management, header, footer, overlays
// ─────────────────────────────────────────────────────────────────────────────

import { Link, Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { MobileBottomNav } from "./components/MobileBottomNav";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Facebook,
  Globe,
  HelpCircle,
  Heart,
  Home,
  Info,
  Instagram,
  LayoutGrid,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Menu,
  Music2,
  Package,
  Phone,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  User,
  X,
  Youtube,
  LayoutDashboard,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useCatalog } from "../contexts/CatalogContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useSearchInput } from "../contexts/SearchContext";
import { CartDrawer } from "./components/CartDrawer";
import { FloatingCartButton } from "./components/FloatingCartButton";
import { ShopperMobileLayout } from "./components/ShopperMobileLayout";
import { SiteFooter } from "./components/SiteFooter";
import { WhatsAppFloat } from "./components/WhatsAppFloat";
import { resolveSiteSearchSubmitPath, SiteSearchField } from "./components/SiteSearchField";
import { cn } from "./components/UI";
import { useIsShopperShell } from "./components/ui/use-mobile";
import { getLocalizedCategoryName } from "./localization";
import {
  getDeliveryWindowCompactLabel,
  getServiceHoursLabel,
} from "./config";
import { images, locations, siteContact, siteSocials } from "./data";

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_NAME_AR        = "صيدليات المتحدة";
const BRAND_NAME_EN        = "United Pharmacies";
const MOBILE_NAV_HINT_AR   = "بحث وتنقل";
const DESKTOP_BREAKPOINT   = 1024;

// ─────────────────────────────────────────────────────────────────────────────
//  Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function withInstantScroll(callback: () => void) {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  callback();
  root.style.scrollBehavior = previousBehavior;
}

function getHashTarget(hash: string) {
  if (!hash) return null;
  try {
    return document.querySelector(decodeURIComponent(hash));
  } catch {
    return document.getElementById(decodeURIComponent(hash).replace(/^#/, ""));
  }
}

function upsertMetaTag(attributes: Record<string, string>, content: string) {
  const selector = `meta${Object.entries(attributes)
    .map(([key, value]) => `[${key}="${value}"]`)
    .join("")}`;
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => node!.setAttribute(key, value));
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function upsertLinkTag(rel: string, href: string) {
  let node = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", rel);
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function upsertScriptJsonLd(id: string, data: object) {
  let node = document.head.querySelector<HTMLScriptElement>(`script[data-ld="${id}"]`);
  if (!node) {
    node = document.createElement("script");
    node.setAttribute("type", "application/ld+json");
    node.setAttribute("data-ld", id);
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(data);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Route metadata map
// ─────────────────────────────────────────────────────────────────────────────

function getRouteMeta(pathname: string, lang: "ar" | "en") {
  const isAr = lang === "ar";
  const homeMeta = {
    title: isAr ? BRAND_NAME_AR : BRAND_NAME_EN,
    description: isAr
      ? "صيدلية رقمية موثوقة في القاهرة — منتجات، عروض، ودعم مباشر على مدار الساعة."
      : "A trusted digital pharmacy in Cairo for products, offers, and direct support.",
  };

  const metaMap = {
    products: {
      title: isAr ? "المنتجات" : "Products",
      description: isAr
        ? "تصفّح كتالوج منظّم من الأدوية والفيتامينات ومنتجات العناية بفلاتر أوضح واكتشاف أسرع."
        : "Browse an organized catalog of medicines, vitamins, and personal care with clearer filters and faster discovery.",
    },
    productDetails: {
      title: isAr ? "تفاصيل المنتج" : "Product Details",
      description: isAr
        ? "راجع تفاصيل المنتج والسعر والمعلومات الأساسية بوضوح قبل إضافته إلى السلة."
        : "Review product details, pricing, and key information clearly before adding the item to your cart.",
    },
    categories: {
      title: isAr ? "الأقسام" : "Categories",
      description: isAr
        ? "استكشف أقسام الصيدلية حسب الاحتياج للوصول إلى المنتجات المناسبة بشكل أسرع."
        : "Explore pharmacy categories by need so customers can reach the right products faster.",
    },
    categoryDetails: {
      title: isAr ? "تفاصيل القسم" : "Category Details",
      description: isAr
        ? "تصفّح القسم المحدد مع ترتيب أوضح ومسار أسرع نحو الشراء."
        : "Browse the selected category with a cleaner sort flow and faster path to purchase.",
    },
    offers: {
      title: isAr ? "العروض" : "Offers",
      description: isAr
        ? "راجع العروض الحالية ومنتجات الصيدلية المميزة في مكان واحد."
        : "Review current offers and featured pharmacy products in one place.",
    },
    orders: {
      title: isAr ? "طلباتي" : "My Orders",
      description: isAr
        ? "اطّلع على سجل طلباتك وتتبّع حالة التوصيل وأدِر طلبات صيدليتك في مكان واحد."
        : "View your order history, track delivery status, and manage your pharmacy orders in one place.",
    },
    wishlist: {
      title: isAr ? "المحفوظات" : "Wishlist",
      description: isAr
        ? "راجع المنتجات المحفوظة وعُد إليها بسرعة حين تصبح مستعداً للطلب."
        : "Review saved products and return to them quickly when you are ready to order.",
    },
    returns: {
      title: isAr ? "الإرجاع" : "Returns",
      description: isAr
        ? "قدّم طلب إرجاع مرتبطاً بطلبك واطّلع على شروط إرجاع المنتجات الطبية."
        : "Submit a return request linked to your order and review the medical-product return terms.",
    },
    about: {
      title: isAr ? "من نحن" : "About Us",
      description: isAr
        ? "تعرّف على كيفية تقديم صيدليات المتحدة تجربة أكثر تنظيماً وموثوقية لعملائها في القاهرة."
        : "Learn how United Pharmacies delivers a more organized and trusted experience for customers in Cairo.",
    },
    contact: {
      title: isAr ? "تواصل معنا" : "Contact",
      description: isAr
        ? "تواصل مع صيدليات المتحدة عبر الهاتف أو بيانات الفروع أو نموذج الاتصال للدعم المباشر."
        : "Reach United Pharmacies through phone, branch details, or the contact form for direct support.",
    },
    profile: {
      title: isAr ? "ملفي الشخصي" : "My Profile",
      description: isAr
        ? "راجع بيانات حسابك وسجل طلباتك في منطقة شخصية أنظف."
        : "Review your account details and order history in a cleaner personal area.",
    },
    checkout: {
      title: isAr ? "الدفع" : "Checkout",
      description: isAr
        ? "أكمل بيانات الشحن والدفع ومراجعة الطلب في تجربة دفع أوضح."
        : "Complete shipping, payment, and order review in a clearer checkout experience.",
    },
    support: {
      title: isAr ? "الدعم والسياسات" : "Support & Policies",
      description: isAr
        ? "راجع الأسئلة الشائعة والشحن والإرجاع والخصوصية والشروط في منطقة دعم أكثر تنظيماً."
        : "Review FAQ, shipping, returns, privacy, and terms in a more structured support area.",
    },
  } as const;

  if (pathname === "/") return homeMeta;
  if (pathname.startsWith("/products/")) return metaMap.productDetails;
  if (pathname === "/products") return metaMap.products;
  if (pathname.startsWith("/categories/")) return metaMap.categoryDetails;
  if (pathname === "/categories") return metaMap.categories;
  if (pathname === "/offers") return metaMap.offers;
  if (pathname === "/orders") return metaMap.orders;
  if (pathname === "/wishlist" || pathname === "/favorites") return metaMap.wishlist;
  if (pathname === "/about") return metaMap.about;
  if (pathname === "/contact") return metaMap.contact;
  if (pathname === "/profile") return metaMap.profile;
  if (pathname === "/checkout") return metaMap.checkout;
  if (pathname === "/returns") return metaMap.returns;
  if (["/shipping", "/returns", "/faq", "/terms", "/privacy"].includes(pathname))
    return metaMap.support;

  return homeMeta;
}

// ─────────────────────────────────────────────────────────────────────────────
//  RouteMetaManager — updates <head> on every navigation
// ─────────────────────────────────────────────────────────────────────────────

function RouteMetaManager() {
  const location = useLocation();
  const { lang } = useLanguage();

  useEffect(() => {
    const meta = getRouteMeta(location.pathname, lang);
    const siteName = lang === "ar" ? BRAND_NAME_AR : BRAND_NAME_EN;
    const title = meta.title === siteName ? siteName : `${meta.title} | ${siteName}`;
    const origin = window.location.origin;
    const absoluteUrl = `${origin}${location.pathname}${location.search}`;
    const absoluteImageUrl = new URL(images.logo, origin).toString();

    // ── Standard meta ──────────────────────────────────────────────────────
    document.title = title;
    upsertMetaTag({ name: "description" }, meta.description);
    upsertMetaTag({ property: "og:title" }, title);
    upsertMetaTag({ property: "og:description" }, meta.description);
    upsertMetaTag({ property: "og:url" }, absoluteUrl);
    upsertMetaTag({ property: "og:type" }, "website");
    upsertMetaTag({ property: "og:site_name" }, siteName);
    upsertMetaTag({ property: "og:locale" }, lang === "ar" ? "ar_EG" : "en_US");
    upsertMetaTag({ property: "og:image" }, absoluteImageUrl);
    upsertMetaTag({ name: "twitter:card" }, "summary_large_image");
    upsertMetaTag({ name: "twitter:title" }, title);
    upsertMetaTag({ name: "twitter:description" }, meta.description);
    upsertMetaTag({ name: "twitter:image" }, absoluteImageUrl);
    upsertMetaTag({ name: "theme-color" }, "#0f766e");
    upsertMetaTag({ name: "apple-mobile-web-app-title" }, siteName);
    upsertLinkTag("canonical", absoluteUrl);

    // ── JSON-LD structured data ────────────────────────────────────────────
    // Organization — present on every page
    upsertScriptJsonLd("org", {
      "@context": "https://schema.org",
      "@type": ["Organization", "Pharmacy"],
      "@id": `${origin}/#organization`,
      "name": BRAND_NAME_EN,
      "alternateName": BRAND_NAME_AR,
      "url": origin,
      "logo": {
        "@type": "ImageObject",
        "url": absoluteImageUrl,
      },
      "telephone": siteContact.phoneHref.replace("tel:", ""),
      "email": siteContact.email,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Cairo",
        "addressCountry": "EG",
      },
      "sameAs": siteSocials.map((s) => s.href),
    });

    // WebSite + sitelinks search — home page only
    if (location.pathname === "/") {
      upsertScriptJsonLd("website", {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        "name": BRAND_NAME_EN,
        "alternateName": BRAND_NAME_AR,
        "url": origin,
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": `${origin}/products?search={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      });
    }

    // BreadcrumbList — product / category detail pages
    if (location.pathname.startsWith("/products/") && location.pathname.length > "/products/".length) {
      upsertScriptJsonLd("breadcrumb", {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": BRAND_NAME_EN, "item": origin },
          { "@type": "ListItem", "position": 2, "name": "Products", "item": `${origin}/products` },
          { "@type": "ListItem", "position": 3, "name": "Product Details", "item": absoluteUrl },
        ],
      });
    } else if (location.pathname.startsWith("/categories/") && location.pathname.length > "/categories/".length) {
      upsertScriptJsonLd("breadcrumb", {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": BRAND_NAME_EN, "item": origin },
          { "@type": "ListItem", "position": 2, "name": "Categories", "item": `${origin}/categories` },
          { "@type": "ListItem", "position": 3, "name": "Category", "item": absoluteUrl },
        ],
      });
    }
  }, [lang, location.pathname, location.search]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  RouteViewportManager — scroll restoration & route transition class
// ─────────────────────────────────────────────────────────────────────────────

function RouteViewportManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const storedPositionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = "auto";
      document.documentElement.classList.remove("route-transitioning");
    };
  }, []);

  useEffect(() => {
    return () => {
      storedPositionsRef.current[location.key] = window.scrollY;
    };
  }, [location.key]);

  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    const transitionTimer = prefersReducedMotion
      ? null
      : window.setTimeout(() => { root.classList.remove("route-transitioning"); }, 460);

    if (!prefersReducedMotion) {
      root.classList.remove("route-transitioning");
      void root.offsetHeight;
      root.classList.add("route-transitioning");
    }

    if (location.hash) {
      const frame = window.requestAnimationFrame(() => {
        const target = getHashTarget(location.hash);
        if (target) {
          target.scrollIntoView({
            block: "start",
            behavior: prefersReducedMotion ? "auto" : "smooth",
          });
        }
      });
      return () => {
        if (transitionTimer !== null) window.clearTimeout(transitionTimer);
        window.cancelAnimationFrame(frame);
      };
    }

    if (navigationType === "POP") {
      const savedY = storedPositionsRef.current[location.key] ?? 0;
      withInstantScroll(() => { window.scrollTo(0, savedY); });
      return () => { if (transitionTimer !== null) window.clearTimeout(transitionTimer); };
    }

    withInstantScroll(() => { window.scrollTo(0, 0); });
    return () => { if (transitionTimer !== null) window.clearTimeout(transitionTimer); };
  }, [location.hash, location.key, navigationType, location.pathname, location.search]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Layout — root shell component
// ─────────────────────────────────────────────────────────────────────────────

export default function Layout() {
  // ── State ────────────────────────────────────────────────────────────────
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen]  = useState(false);
  const [scrolled, setScrolled]              = useState(false);
  const [searchOpen, setSearchOpen]          = useState(false);
  const [userMenuOpen, setUserMenuOpen]      = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);

  // ── Hooks ────────────────────────────────────────────────────────────────
  const location      = useLocation();
  const navigate      = useNavigate();
  const isShopperShell = useIsShopperShell();
  const { categories }       = useCatalog();
  const { user, signOut }     = useAuth();
  const { cart }              = useCart();
  const { lang, toggleLanguage, t } = useLanguage();
  const { searchQuery }       = useSearchInput();

  const isStaffPortalVisible = Boolean(
    user && ["admin", "manager", "pharmacist"].includes(user.role),
  );

  // ── Derived values ───────────────────────────────────────────────────────
  const primaryPhone         = siteContact.phoneHref;
  const primaryPhoneDisplay  = siteContact.phoneDisplay;
  const primaryLocation      = locations.find((b) => b.isPrimary) ?? locations[0];
  const locationLabelAr      = primaryLocation.nameAr;
  const locationLabelEn      = primaryLocation.nameEn;
  const cartItemsCount       = cart.reduce((total, item) => total + item.quantity, 0);
  const deliveryWindowCompact = getDeliveryWindowCompactLabel(lang);
  const serviceHoursLabel    = getServiceHoursLabel(lang);
  const whatsappUrl          = siteContact.whatsappUrl;
  const overlayOpen          = mobileMenuOpen || cartDrawerOpen;
  const mobileNavHint        = lang === "ar" ? MOBILE_NAV_HINT_AR : "Search and navigation";
  const userInitial          = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : user?.phone?.charAt(0).toUpperCase() || "U";
  const accountRoute         = user?.role === "admin" ? "/admin" : "/profile";
  const headerCategories     = categories.slice(0, 6);

  // ── Nav link definitions ─────────────────────────────────────────────────

  const browseLinks = useMemo(
    () => [
      {
        name: t("home"),
        path: "/",
        icon: Home,
        helperAr: "الصفحة الرئيسية",
        helperEn: "Home page",
      },
      {
        name: t("products"),
        path: "/products",
        icon: Package,
        helperAr: "جميع المنتجات",
        helperEn: "Full product catalog",
      },
      {
        name: t("categories"),
        path: "/categories",
        icon: LayoutGrid,
        helperAr: "الأقسام الرئيسية",
        helperEn: "Main categories",
      },
      {
        name: t("offers"),
        path: "/offers",
        icon: Tag,
        helperAr: "العروض الحالية",
        helperEn: "Current offers",
      },
    ],
    [t],
  );

  const supportLinks = useMemo(
    () => [
      {
        name: lang === "ar" ? "الطلبات" : "Orders",
        path: "/orders",
        icon: Package,
        helperAr: "تتبع طلباتك",
        helperEn: "Track your orders",
      },
      {
        name: t("favorites_nav"),
        path: "/wishlist",
        icon: Heart,
        helperAr: "المنتجات المحفوظة",
        helperEn: "Saved products",
      },
      {
        name: t("special_orders_nav"),
        path: "/special-orders",
        icon: ClipboardList,
        helperAr: "طلب صنف غير متوفر",
        helperEn: "Request an unavailable item",
      },
      {
        name: t("about"),
        path: "/about",
        icon: Info,
        helperAr: "عن الصيدلية",
        helperEn: "About the pharmacy",
      },
      {
        name: t("contact"),
        path: "/contact",
        icon: Mail,
        helperAr: "الدعم وبيانات الفروع",
        helperEn: "Support and branch details",
      },
    ],
    [t],
  );

  const mobileSupportLinks = useMemo(
    () => [
      {
        name: lang === "ar" ? "الأسئلة الشائعة" : "FAQ",
        path: "/faq",
        icon: HelpCircle,
        helperAr: "إجابات سريعة",
        helperEn: "Quick answers",
      },
      {
        name: lang === "ar" ? "سياسة التوصيل" : "Delivery policy",
        path: "/shipping",
        icon: Truck,
        helperAr: "رسوم توصيل داخل القاهرة",
        helperEn: "Delivery fee in Cairo",
      },
      {
        name: lang === "ar" ? "الإرجاع" : "Returns",
        path: "/returns",
        icon: RefreshCcw,
        helperAr: "طلب إرجاع وشروطه",
        helperEn: "Return requests and terms",
      },
    ],
    [lang],
  );

  // Footer quick-links: browse pages + About + Contact (excludes Orders/Wishlist/etc.)
  const footerNavLinks = useMemo(() => [...browseLinks, ...supportLinks.slice(-2)], [browseLinks, supportLinks]);
  const headerLinks = useMemo(
    () => [
      { name: t("home"), path: "/", icon: Home },
      { name: t("products"), path: "/products", icon: Package },
      { name: t("offers"), path: "/offers", icon: Tag },
      { name: t("favorites_nav"), path: "/wishlist", icon: Heart },
    ],
    [t],
  );
  const mobilePrimaryLinks   = browseLinks;
  const mobileSecondaryLinks = supportLinks;

  const socialLinks = useMemo(
    () =>
      siteSocials.map((social) => ({
        href: social.href,
        label: social.label,
        Icon:
          social.id === "facebook"  ? Facebook  :
          social.id === "instagram" ? Instagram :
          social.id === "youtube"   ? Youtube   : Music2,
      })),
    [],
  );

  // ── Side effects ─────────────────────────────────────────────────────────

  /** Track scroll depth for header shadow transition */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** Close all overlays on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setUserMenuOpen(false);
    setCartDrawerOpen(false);
  }, [location.pathname]);

  /** Signal body when any overlay is open (prevents scroll-through) */
  useEffect(() => {
    document.body.dataset.overlayOpen = overlayOpen ? "true" : "false";
    return () => { delete document.body.dataset.overlayOpen; };
  }, [overlayOpen]);

  /** Sync HTML lang + dir with active language */
  useEffect(() => {
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
    document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr";
    document.body.dir             = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  /** Close user dropdown on outside click */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /** Auto-focus search input when panel opens */
  useEffect(() => {
    if (searchOpen) {
      window.setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [searchOpen]);

  /** Collapse search & user menu when mobile menu opens */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    setSearchOpen(false);
    setUserMenuOpen(false);
  }, [mobileMenuOpen]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isActive = (path: string) => {
    if (path === "/wishlist") {
      return location.pathname === "/wishlist" || location.pathname === "/favorites";
    }

    return location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    const nextPath = resolveSiteSearchSubmitPath(location.pathname, query);
    if (!query || !nextPath) return;
    navigate(nextPath);
    setSearchOpen(false);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    navigate("/");
  };

  const handleCartAction = () => {
    if (window.innerWidth > DESKTOP_BREAKPOINT) {
      navigate("/cart");
      return;
    }
    setCartDrawerOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Shopper shell (embedded mode — no chrome)
  // ─────────────────────────────────────────────────────────────────────────

  if (isShopperShell) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-slate-900">
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(20,184,166,0.24)] focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {lang === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
        </a>
        <RouteViewportManager />
        <RouteMetaManager />
        <ShopperMobileLayout />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Full shell render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--background)] text-slate-900">

      {/* Skip-to-content link (accessibility) */}
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(20,184,166,0.24)] focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {lang === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
      </a>

      <RouteViewportManager />
      <RouteMetaManager />

      <div className="app-shell flex min-h-screen flex-col">

        {/* ── Top utility strip (desktop) ── */}
        <div className="hidden border-b border-slate-100 bg-[#f8fafb] xl:block">
          <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-6 py-1.5 text-[11.5px] font-bold text-slate-500">
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-[#0E7E74]" />
                {deliveryWindowCompact}
              </span>
              <span className="h-3 w-px bg-slate-200" />
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#0E7E74]" />
                {serviceHoursLabel}
              </span>
            </div>
            <div className="flex items-center gap-5">
              <a
                href={`tel:${primaryPhone}`}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#0E7E74]"
              >
                <Phone className="h-3.5 w-3.5 text-[#0E7E74]" />
                <span dir="ltr">{primaryPhoneDisplay}</span>
              </a>
              <span className="h-3 w-px bg-slate-200" />
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#0E7E74]" />
                {lang === "ar" ? locationLabelAr : locationLabelEn}
              </span>
              <span className="h-3 w-px bg-slate-200" />
              <button
                type="button"
                onClick={toggleLanguage}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#0E7E74]"
              >
                <Globe className="h-3.5 w-3.5 text-[#0E7E74]" />
                {lang === "ar" ? "English" : "العربية"}
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            STICKY HEADER — logo · search · action cluster
        ══════════════════════════════════════════════════════════════════ */}
        <header
          className={cn(
            "sticky top-0 z-40 bg-white transition-all duration-300",
            scrolled
              ? "border-b border-slate-200 shadow-[0_4px_24px_rgba(10,18,32,0.08)] backdrop-blur-md"
              : "border-b border-slate-100",
          )}
        >
          {/* ── Main bar ────────────────────────────────────────────────── */}
          <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-2.5 md:gap-4 md:px-6 md:py-3">

            {/* ── Brand / Logo ─────────────────────────────────────────── */}
            <Link
              to="/"
              className="group flex shrink-0 items-center gap-3 transition-opacity duration-200 hover:opacity-85"
            >
              <img
                src={images.logoMark}
                alt={lang === "ar" ? BRAND_NAME_AR : BRAND_NAME_EN}
                className="h-10 w-10 object-contain md:h-11 md:w-11"
              />
              <div className="hidden sm:block">
                <p
                  className={cn(
                    "font-black leading-tight text-[#0A1220]",
                    lang === "ar"
                      ? "text-[0.95rem] md:text-[1.05rem]"
                      : "text-[0.9rem] tracking-[-0.03em] md:text-[1.05rem]",
                  )}
                >
                  {lang === "ar" ? BRAND_NAME_AR : BRAND_NAME_EN}
                </p>
                <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.28em] text-[#0E7E74]">
                  {t("slogan")}
                </p>
              </div>
            </Link>

            {/* ── Desktop Search ─ grows to fill available space ────────── */}
            <div className="hidden flex-1 xl:block xl:px-4 2xl:px-8">
              <form onSubmit={handleSearch} className="relative h-11 w-full">
                <Search
                  className={cn(
                    "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
                    lang === "ar" ? "right-4" : "left-4",
                  )}
                />
                <SiteSearchField
                  className="h-11 w-full"
                  inputClassName={cn(
                    "h-11 w-full rounded-full border border-slate-200 bg-[#f7f9fc] text-[13px] placeholder:text-slate-400",
                    "focus:border-[#0E7E74]/50 focus:bg-white focus:ring-2 focus:ring-[#0E7E74]/12 focus:shadow-[0_4px_20px_rgba(14,126,116,0.10)] transition-all",
                    lang === "ar" ? "pr-11 pl-12" : "pl-11 pr-12",
                  )}
                />
                <button
                  type="submit"
                  aria-label={lang === "ar" ? "بحث" : "Search"}
                  className={cn(
                    "absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[#0E7E74] text-white transition-all hover:bg-[#0A6B62] hover:shadow-[0_4px_14px_rgba(14,126,116,0.30)]",
                    lang === "ar" ? "left-1.5" : "right-1.5",
                  )}
                >
                  <Search className="mx-auto h-3.5 w-3.5" />
                </button>
              </form>
            </div>

            {/* ── Action Cluster ───────────────────────────────────────── */}
            <div className="ml-auto flex shrink-0 items-center gap-2">

              {/* Admin portal — compact icon+label, desktop only */}
              {isStaffPortalVisible ? (
                <Link
                  to="/admin"
                  className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-black text-slate-600 transition-all hover:border-[#0E7E74]/40 hover:bg-[#0E7E74]/[0.05] hover:text-[#0E7E74] xl:inline-flex"
                  aria-label={lang === "ar" ? "لوحة الإدارة" : "Admin portal"}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  {lang === "ar" ? "الإدارة" : "Admin"}
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0E7E74]" />
                </Link>
              ) : null}

              {/* Search toggle — mobile / tablet only */}
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-expanded={searchOpen}
                aria-controls="mobile-search-panel"
                aria-label={lang === "ar" ? "فتح البحث" : "Open search"}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all xl:hidden",
                  "hover:border-[#0E7E74]/40 hover:bg-[#0E7E74]/[0.05] hover:text-[#0E7E74]",
                  searchOpen && "border-[#0E7E74]/40 bg-[#0E7E74]/[0.05] text-[#0E7E74]",
                )}
              >
                {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>

              {/* User menu / Login — desktop only */}
              <div className="relative hidden xl:block" ref={userMenuRef}>
                {user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((v) => !v)}
                      aria-expanded={userMenuOpen}
                      aria-haspopup="menu"
                      aria-controls="user-dropdown-menu"
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] font-black transition-all duration-200",
                        userMenuOpen
                          ? "border-[#0E7E74]/40 bg-[#0E7E74]/[0.06] text-[#0E7E74]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#0E7E74]/40 hover:bg-[#0E7E74]/[0.05] hover:text-[#0E7E74]",
                      )}
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0E7E74] text-[11px] font-black text-white">
                        {userInitial}
                      </span>
                      <span className="hidden max-w-[7rem] truncate 2xl:block">
                        {user.role === "admin"
                          ? lang === "ar" ? "المدير" : "Admin"
                          : user.fullName?.split(" ")[0] || (lang === "ar" ? "حسابي" : "Account")}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          userMenuOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {/* User dropdown */}
                    {userMenuOpen && (
                      <div
                        id="user-dropdown-menu"
                        role="menu"
                        aria-label={lang === "ar" ? "قائمة المستخدم" : "User menu"}
                        className={cn(
                          "absolute top-[calc(100%+0.5rem)] z-50 w-60 rounded-2xl border border-slate-200/80 bg-white p-2",
                          "shadow-[0_20px_48px_rgba(10,18,32,0.12)]",
                          "animate-in fade-in slide-in-from-top-2 duration-150",
                          lang === "ar" ? "left-0" : "right-0",
                        )}
                      >
                        <div className="mb-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0E7E74] text-sm font-black text-white">
                              {userInitial}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-black text-slate-900">
                                {user.fullName || (lang === "ar" ? "المستخدم" : "User")}
                              </p>
                              <p className="truncate text-[11px] font-semibold text-slate-500" dir="ltr">
                                {user.phone || user.email}
                              </p>
                            </div>
                          </div>
                        </div>

                        {user.role === "admin" && (
                          <Link
                            to="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-black text-[#0E7E74] transition-colors hover:bg-[#0E7E74]/[0.06]"
                          >
                            <LayoutDashboard className="h-4 w-4" />
                            {lang === "ar" ? "لوحة الإدارة" : "Admin Dashboard"}
                          </Link>
                        )}

                        <Link
                          to={accountRoute}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Settings className="h-4 w-4 text-slate-400" />
                          {t("personal_info")}
                        </Link>

                        <Link
                          to="/offers"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Tag className="h-4 w-4 text-slate-400" />
                          {lang === "ar" ? "العروض" : "Offers"}
                        </Link>

                        <div className="my-1 h-px bg-slate-100" />

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold text-rose-600 transition-colors hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4" />
                          {t("logout")}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#0E7E74]/30 bg-[#0E7E74]/[0.06] px-4 text-[13px] font-black text-[#0E7E74] transition-all hover:bg-[#0E7E74] hover:border-transparent hover:text-white hover:shadow-[0_4px_16px_rgba(14,126,116,0.28)]"
                  >
                    <User className="h-4 w-4" />
                    <span>{t("login")}</span>
                  </button>
                )}
              </div>

              {/* Cart button */}
              <button
                type="button"
                onClick={handleCartAction}
                aria-label={
                  lang === "ar"
                    ? `فتح السلة، ${cartItemsCount} عنصر`
                    : `Open cart, ${cartItemsCount} items`
                }
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-xl bg-[#0A1220] px-3 text-[13px] font-black text-white xl:px-4",
                  "shadow-[0_4px_16px_rgba(10,18,32,0.18)] transition-all duration-200",
                  "hover:bg-[#1a2535] hover:shadow-[0_6px_22px_rgba(10,18,32,0.26)]",
                )}
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden xl:inline">{t("cart")}</span>
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0E7E74] px-1.5 text-[10px] font-black text-white",
                    cartItemsCount === 0 && "opacity-50",
                  )}
                >
                  {cartItemsCount}
                </span>
              </button>

              {/* Hamburger — mobile / tablet only */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
                aria-label={lang === "ar" ? "فتح القائمة" : "Open menu"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 xl:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Mobile Search Panel ──────────────────────────────────────── */}
          {searchOpen && (
            <div
              id="mobile-search-panel"
              className="xl:hidden animate-in slide-in-from-top-1 duration-200 border-t border-slate-100 bg-white px-4 pb-3 pt-2.5"
            >
              <form onSubmit={handleSearch} className="relative h-11 w-full">
                <SiteSearchField
                  inputRef={searchRef}
                  className="h-11 w-full"
                  inputClassName="h-11 rounded-full border-slate-200 bg-slate-50"
                  mobileSubmitPadding
                />
                <button
                  type="submit"
                  aria-label={lang === "ar" ? "بحث" : "Search"}
                  className={cn(
                    "absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[#0E7E74] text-white transition-colors hover:bg-[#0A6B62]",
                    lang === "ar" ? "left-1.5" : "right-1.5",
                  )}
                >
                  <Search className="mx-auto h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {/* ── Desktop Navigation Bar ───────────────────────────────────── */}
          <div className="hidden border-t border-slate-100 xl:block">
            <div
              className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-6"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              {/* Primary nav links — teal underline on active */}
              <nav className="flex items-center">
                {headerLinks.map(({ path, name, icon: Icon }) => {
                  const active = isActive(path);
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={cn(
                        "relative inline-flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-black transition-all duration-150",
                        active
                          ? "text-[#0E7E74]"
                          : "text-slate-500 hover:text-[#0A1220]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 flex-shrink-0",
                          active ? "text-[#0E7E74]" : "text-slate-400",
                        )}
                      />
                      {name}
                      {active && (
                        <span className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-t-full bg-[#0E7E74]" />
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Right side: category chips + call */}
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 py-2">
                {headerCategories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/categories/${category.id}`}
                    className="inline-flex min-w-0 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-bold text-slate-600 transition-all hover:border-[#0E7E74]/30 hover:bg-[#0E7E74]/[0.05] hover:text-[#0E7E74]"
                  >
                    <span className="truncate">
                      {getLocalizedCategoryName(category, lang)}
                    </span>
                  </Link>
                ))}

                <div className="mx-1 h-4 w-px bg-slate-200" />

                <Link
                  to="/categories"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#0E7E74]/30 bg-[#0E7E74]/[0.06] px-3.5 py-1 text-[11.5px] font-black text-[#0E7E74] transition-all hover:bg-[#0E7E74]/[0.12]"
                >
                  <LayoutGrid className="h-3 w-3" />
                  {lang === "ar" ? "كل الأقسام" : "All categories"}
                </Link>

                <a
                  href={`tel:${primaryPhone}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0E7E74] px-4 py-1 text-[11.5px] font-black text-white shadow-[0_3px_12px_rgba(14,126,116,0.28)] transition-all hover:bg-[#0A6B62] hover:shadow-[0_5px_16px_rgba(14,126,116,0.38)]"
                >
                  <Phone className="h-3 w-3" />
                  {lang === "ar" ? "اتصال" : "Call"}
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════════════════
            MAIN CONTENT AREA
        ══════════════════════════════════════════════════════════════════ */}
        <main id="main-content" tabIndex={-1} className="app-main flex-1 outline-none">
          <div className="route-shell">
            <Outlet />
          </div>
        </main>

        {/* ══════════════════════════════════════════════════════════════════
            WHATSAPP FLOAT — bottom-center morphing line
        ══════════════════════════════════════════════════════════════════ */}
        <WhatsAppFloat
          url={whatsappUrl}
          isArabic={lang === "ar"}
          hidden={overlayOpen}
        />

        {/* ══════════════════════════════════════════════════════════════════
            SITE FOOTER
        ══════════════════════════════════════════════════════════════════ */}
        <SiteFooter
          lang={lang}
          t={t as (key: string) => string}
          brandNameAr={BRAND_NAME_AR}
          brandNameEn={BRAND_NAME_EN}
          phoneDisplay={siteContact.phoneDisplay}
          phoneHref={siteContact.phoneHref}
          whatsappUrl={siteContact.whatsappUrl}
          email={siteContact.email}
          navLinks={footerNavLinks}
          socialLinks={socialLinks}
        />

        {/* ══════════════════════════════════════════════════════════════════
            MOBILE SLIDE-IN MENU
        ══════════════════════════════════════════════════════════════════ */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop overlay */}
            <div
              className="mobile-menu-overlay open animate-fade-in fixed inset-0 z-[88] bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
              onKeyDown={(e) => e.key === "Escape" && setMobileMenuOpen(false)}
              role="button"
              tabIndex={-1}
              aria-label={lang === "ar" ? "إغلاق القائمة" : "Close menu"}
            />

            {/* Menu panel */}
            <div
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label={lang === "ar" ? "القائمة الرئيسية" : "Main menu"}
              className={cn(
                "mobile-menu open fixed inset-y-0 z-[89] flex w-[90%] max-w-[24rem] animate-slide-up flex-col bg-[#f5faf9] shadow-[0_30px_60px_rgba(15,23,42,0.20)]",
                lang === "ar" ? "right-0 rounded-l-[2rem]" : "left-0 rounded-r-[2rem]",
              )}
            >

              {/* ── Menu header ─────────────────────────────────────────── */}
              <div className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#f0faf8_0%,#e8f7f5_100%)] px-4 pb-5 pt-4">
                <span
                  className="mobile-menu-handle mx-auto mb-3 block h-1.5 w-14 rounded-full bg-teal-200/80"
                  aria-hidden="true"
                />

                <div className="mobile-menu-brand-card rounded-[1.7rem] border border-teal-100/60 bg-white/95 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
                  <div className="flex items-start justify-between gap-3">
                    {/* Brand identity */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="site-logo-frame relative flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-[1.2rem] border border-teal-200/60 bg-gradient-to-br from-white to-teal-50 shadow-[0_4px_14px_rgba(13,148,136,0.10)]">
                        <img
                          src={images.logoMark}
                          alt={lang === "ar" ? BRAND_NAME_AR : BRAND_NAME_EN}
                          className="site-logo-image relative z-10"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-slate-950">
                          {lang === "ar" ? BRAND_NAME_AR : BRAND_NAME_EN}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--primary)]">
                          {t("slogan")}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {mobileNavHint}
                        </p>
                      </div>
                    </div>

                    {/* Close button */}
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label={lang === "ar" ? "إغلاق القائمة" : "Close menu"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* In-menu search */}
                  <form onSubmit={handleSearch} className="site-search relative mt-4 h-11 w-full">
                    <SiteSearchField
                      className="h-11 w-full"
                      inputClassName="h-11 rounded-full"
                      mobileSubmitPadding
                    />
                    <button
                      type="submit"
                      aria-label={lang === "ar" ? "بحث" : "Search"}
                      className={cn(
                        "absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[var(--primary)] text-white transition-colors hover:bg-[var(--primary-strong)]",
                        lang === "ar" ? "left-1.5" : "right-1.5",
                      )}
                    >
                      <Search className="mx-auto h-4 w-4" />
                    </button>
                  </form>

                  {/* Quick action grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a
                      href={`tel:${primaryPhone}`}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.2rem] border border-slate-200 bg-slate-50 text-sm font-black text-slate-700 transition-all hover:border-teal-300/50 hover:bg-teal-50 hover:text-teal-800"
                    >
                      <Phone className="h-4 w-4 text-[var(--primary)]" />
                      {lang === "ar" ? "دعم مباشر" : "Support"}
                    </a>
                    <Link
                      to="/offers"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-[1.2rem] border border-amber-200/60 bg-amber-50 text-sm font-black text-amber-700 transition-all hover:bg-amber-100"
                    >
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      {lang === "ar" ? "العروض" : "Offers"}
                    </Link>
                  </div>
                </div>
              </div>

              {/* ── Scrollable menu body ─────────────────────────────────── */}
              <div className="mobile-menu-scroll flex-1 overflow-y-auto px-4 py-4">

                {/* Admin quick-access — admin role only */}
                {user?.role === "admin" && (
                  <section className="mb-4">
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-[1.4rem] px-4 py-3.5",
                        "bg-[linear-gradient(135deg,#0f2027_0%,#134e4a_55%,#0d9488_100%)]",
                        "shadow-[0_0_18px_rgba(20,184,166,0.28),0_6px_16px_rgba(15,23,42,0.14)]",
                        "text-white",
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                        <LayoutDashboard className="h-[1.125rem] w-[1.125rem] text-teal-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black">
                          {lang === "ar" ? "لوحة الإدارة" : "Admin Dashboard"}
                        </p>
                        <p className="text-xs font-semibold text-teal-300/80">
                          {lang === "ar" ? "إدارة المتجر والطلبات" : "Manage store & orders"}
                        </p>
                      </div>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-400" />
                    </Link>
                  </section>
                )}

                {/* Primary browse links */}
                <section className="mobile-menu-section">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                      {lang === "ar" ? "التصفح" : "Browse"}
                    </p>
                    <span className="text-xs font-semibold text-slate-400">
                      {lang === "ar" ? "الصفحات الرئيسية" : "Main pages"}
                    </span>
                  </div>

                  <div className="mobile-menu-primary-grid grid grid-cols-2 gap-3">
                    {mobilePrimaryLinks.map((link) => {
                      const active = isActive(link.path);
                      const Icon   = link.icon;
                      return (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "mobile-menu-primary-link rounded-[1.4rem] border px-3.5 py-4 transition-all",
                            active
                              ? "border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--primary-strong)] shadow-[0_14px_28px_rgba(13,148,136,0.12)]"
                              : "border-slate-200 bg-white text-slate-800 hover:border-teal-200/60 hover:bg-teal-50/60",
                          )}
                        >
                          <div
                            className={cn(
                              "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
                              active ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-600",
                            )}
                          >
                            <Icon className="h-[1.125rem] w-[1.125rem]" />
                          </div>
                          <p className="mt-3 text-sm font-black">{link.name}</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                            {lang === "ar" ? link.helperAr : link.helperEn}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </section>

                {/* Secondary links (saved + support) */}
                <section className="mobile-menu-section mt-5">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                    {lang === "ar" ? "الحساب والخدمات" : "Account and saved"}
                  </p>

                  <nav className="space-y-2">
                    {mobileSecondaryLinks.map((link) => {
                      const active = isActive(link.path);
                      const Icon   = link.icon;
                      return (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "mobile-menu-item flex items-center gap-3 rounded-[1.35rem] px-4 py-3 text-sm font-black transition-all",
                            active
                              ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]"
                              : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                          )}
                        >
                          <div
                            className={cn(
                              "inline-flex h-9 w-9 items-center justify-center rounded-xl",
                              active ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-500",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p>{link.name}</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                              {lang === "ar" ? link.helperAr : link.helperEn}
                            </p>
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 flex-shrink-0 text-slate-400",
                              lang === "ar" && "rotate-180",
                            )}
                          />
                        </Link>
                      );
                    })}
                  </nav>
                </section>

                {/* Support & policies */}
                <section className="mobile-menu-section mt-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                      {lang === "ar" ? "الدعم والسياسات" : "Support and policies"}
                    </p>
                    <span className="text-xs font-semibold text-slate-400">
                      {lang === "ar" ? "معلومات الطلب والخدمة" : "Order and service info"}
                    </span>
                  </div>

                  <nav className="space-y-2">
                    {mobileSupportLinks.map((link) => {
                      const active = isActive(link.path);
                      const Icon   = link.icon;
                      return (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "mobile-menu-item flex items-center gap-3 rounded-[1.35rem] px-4 py-3 text-sm font-black transition-all",
                            active
                              ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]"
                              : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                          )}
                        >
                          <div
                            className={cn(
                              "inline-flex h-9 w-9 items-center justify-center rounded-xl",
                              active ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-500",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p>{link.name}</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                              {lang === "ar" ? link.helperAr : link.helperEn}
                            </p>
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 flex-shrink-0 text-slate-400",
                              lang === "ar" && "rotate-180",
                            )}
                          />
                        </Link>
                      );
                    })}
                  </nav>
                </section>
              </div>

              {/* ── Sticky menu footer actions ───────────────────────────── */}
              <div className="mobile-menu-actions sticky bottom-0 border-t border-slate-200/80 bg-white/96 px-4 py-4 backdrop-blur-sm">
                {user ? (
                  <div className="space-y-3">
                    {/* User identity card */}
                    <Link
                      to={accountRoute}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block"
                    >
                      <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 transition-colors hover:border-teal-200/60 hover:bg-teal-50/40">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-black text-white shadow-[0_4px_12px_rgba(13,148,136,0.28)]">
                          {userInitial}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-slate-900">
                            {user.fullName || (lang === "ar" ? "المستخدم" : "User")}
                          </p>
                          <p className="truncate text-xs font-semibold text-slate-500" dir="ltr">
                            {user.phone || user.email}
                          </p>
                        </div>
                        <ChevronRight
                          className={cn("h-4 w-4 text-slate-400", lang === "ar" && "rotate-180")}
                        />
                      </div>
                    </Link>

                    {/* Logout */}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-[1.25rem] border border-rose-200 bg-rose-50 text-sm font-black text-rose-600 transition-colors hover:bg-rose-100"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("logout")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-[var(--primary)] text-sm font-black text-white shadow-[0_8px_20px_rgba(13,148,136,0.28)] transition-all hover:bg-[var(--primary-strong)]"
                  >
                    <User className="h-4 w-4" />
                    {t("login")}
                  </button>
                )}

                {/* Language + Call */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-[1.25rem] border border-slate-200 bg-white text-sm font-black text-slate-700 transition-colors hover:border-teal-200/60 hover:bg-teal-50"
                  >
                    <Globe className="h-4 w-4 text-[var(--primary)]" />
                    {lang === "ar" ? "English" : "العربية"}
                  </button>
                  <a
                    href={`tel:${primaryPhone}`}
                    className="flex h-11 items-center justify-center gap-2 rounded-[1.25rem] bg-[var(--primary)] text-sm font-black text-white shadow-[0_8px_20px_rgba(13,148,136,0.22)] transition-all hover:bg-[var(--primary-strong)]"
                  >
                    <Phone className="h-4 w-4" />
                    {lang === "ar" ? "اتصال" : "Call"}
                  </a>
                </div>

                {/* Contact strip */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-600">
                  <a
                    href={`tel:${siteContact.phoneHref}`}
                    className="inline-flex items-center gap-1.5"
                    dir="ltr"
                  >
                    <Phone className="h-3.5 w-3.5 text-[var(--primary)]" />
                    {siteContact.phoneDisplay}
                  </a>
                  <a
                    href={siteContact.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5"
                    dir="ltr"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                    {siteContact.whatsappDisplay}
                  </a>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Drawers & persistent floating elements ───────────────────────── */}
        <CartDrawer isOpen={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
        <FloatingCartButton onClick={() => setCartDrawerOpen(true)} hidden={mobileMenuOpen} />
        <MobileBottomNav hidden={mobileMenuOpen} />
      </div>
    </div>
  );
}
