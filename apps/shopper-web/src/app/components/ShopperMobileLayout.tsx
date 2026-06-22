import { ArrowUpRight, Globe2, MapPin, MessageCircle, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSearchInput } from "../../contexts/SearchContext";
import { locations, siteContact } from "../data";
import { getDeliveryWindowCompactLabel } from "../config";
import { MobileBottomNav } from "./MobileBottomNav";
import { resolveSiteSearchSubmitPath, SiteSearchField } from "./SiteSearchField";
import { cn } from "./UI";

const SUPPORT_ROUTES = new Set([
  "/about",
  "/contact",
  "/shipping",
  "/returns",
  "/faq",
  "/terms",
  "/privacy",
]);

const FOCUSED_TASK_ROUTES = new Set([
  "/orders",
  "/special-orders",
]);

export function ShopperMobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, t, toggleLanguage } = useLanguage();
  const { user } = useAuth();
  const { searchQuery } = useSearchInput();
  const shellRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const [headerShadow, setHeaderShadow] = useState(false);

  const primaryLocation = locations.find((branch) => branch.isPrimary) ?? locations[0];
  const isProductDetails = /^\/products\/[^/]+$/.test(location.pathname);
  const isCheckout = location.pathname === "/checkout";
  const isCart = location.pathname === "/cart";
  const isProfile = location.pathname === "/profile";
  const isSupportRoute = SUPPORT_ROUTES.has(location.pathname);
  const isFocusedTaskRoute = FOCUSED_TASK_ROUTES.has(location.pathname);
  const isCatalogBrowseRoute =
    location.pathname === "/products"
    || location.pathname === "/categories"
    || /^\/categories\/[^/]+$/.test(location.pathname);
  const showSearchBar =
    !isCheckout
    && !isCart
    && !isProfile
    && !isSupportRoute
    && !isProductDetails
    && !isFocusedTaskRoute;
  const showBottomNav = !isCheckout;
  const deliveryLabel = getDeliveryWindowCompactLabel(lang);
  const displayLocation =
    lang === "ar" ? primaryLocation.fullNameAr : primaryLocation.fullNameEn;
  const displayAddress =
    lang === "ar" ? primaryLocation.addressAr : primaryLocation.addressEn;

  // ── Compute header offset for sticky filter bars ──────────────────────────
  useEffect(() => {
    if (!shellRef.current || !headerRef.current) return;
    const shell = shellRef.current;
    const header = headerRef.current;

    const updateOffset = () => {
      shell.style.setProperty(
        "--shopper-header-offset",
        `${Math.ceil(header.getBoundingClientRect().height + 8)}px`,
      );
    };

    updateOffset();
    const ro = new ResizeObserver(updateOffset);
    ro.observe(header);
    window.addEventListener("resize", updateOffset);
    return () => { ro.disconnect(); window.removeEventListener("resize", updateOffset); };
  }, [lang, location.pathname, showSearchBar]);

  // ── Subtle shadow on scroll ───────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      setHeaderShadow(window.scrollY > 8);
      lastScrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    const nextPath = resolveSiteSearchSubmitPath(location.pathname, trimmed);
    if (!trimmed || !nextPath) return;
    navigate(nextPath);
  };

  return (
    <div
      ref={shellRef}
      className="shopper-shell w-full"
      style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    >
      {!isCheckout ? (
        <header
          ref={headerRef}
          className={cn(
            "shopper-shell__header sticky top-0 z-30 w-full",
            "bg-white transition-shadow duration-300",
            headerShadow && "shadow-[0_4px_24px_rgba(10,18,32,0.10)]",
          )}
        >
          {/* ── Dark cap: location + language + profile ── */}
          <div
            className="bg-[#0A1220] px-4 pb-3"
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
            } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              {/* Location */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-black text-white">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#2DD4C0]" />
                  <span className="truncate">{displayLocation}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-white/50">
                  {displayAddress}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.16] bg-white/[0.07] px-3 text-[11px] font-black text-white/75 transition-all active:scale-95 hover:border-white/[0.30] hover:bg-white/[0.13] hover:text-white"
                  style={{ WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
                  aria-label={lang === "ar" ? "تغيير اللغة إلى الإنجليزية" : "Switch to Arabic"}
                >
                  <Globe2 className="h-3 w-3" />
                  <span>{lang === "ar" ? "EN" : "AR"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate(user ? "/profile" : "/login")}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full",
                    "border border-white/[0.16] bg-white/[0.07] text-white/75",
                    "transition-all active:scale-95 hover:border-white/[0.30] hover:bg-white/[0.13]",
                    user && "border-[#2DD4C0]/40 bg-[#2DD4C0]/[0.12] text-[#2DD4C0]",
                  )}
                  style={{ WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
                  aria-label={user ? t("profile") : t("login")}
                >
                  {user ? (
                    <span className="text-[11px] font-black">
                      {(user.fullName || user.phone || "U").charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── White section: search bar + meta rail ── */}
          {showSearchBar ? (
            <div className={cn("px-4 pt-2.5", isCatalogBrowseRoute ? "pb-2" : "pb-3")}>
              <form onSubmit={handleSearchSubmit} className="relative h-13 w-full">
                <SiteSearchField
                  className="h-13 w-full"
                  inputClassName={cn(
                    "!rounded-[1.5rem] h-13 border border-[#0A1220]/[0.14] bg-white",
                    "text-sm font-semibold text-[#0A1220]",
                    "shadow-[0_2px_12px_rgba(10,18,32,0.05)]",
                    "focus:border-[#0E7E74] focus:ring-4 focus:ring-[#0E7E74]/10",
                    "transition-all duration-200",
                  )}
                  mobileSubmitPadding
                />
                <button
                  type="submit"
                  className={cn(
                    "absolute top-1/2 inline-flex h-9 w-9 -translate-y-1/2",
                    "items-center justify-center rounded-[1.1rem]",
                    "bg-[#0E7E74] text-white",
                    "shadow-[0_4px_16px_rgba(14,126,116,0.32)]",
                    "transition-all hover:bg-[#0A6B62] active:scale-95",
                    lang === "ar" ? "left-2" : "right-2",
                  )}
                  style={{ WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
                  aria-label={lang === "ar" ? "بحث" : "Search"}
                >
                  <ArrowUpRight
                    className={cn("h-4 w-4", lang === "ar" && "rotate-180")}
                  />
                </button>
              </form>

              {!isCatalogBrowseRoute ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[#0A1220]/[0.18] px-3 py-1 text-[11px] font-black text-[#0A1220]/65">
                    {deliveryLabel}
                  </span>
                  <a
                    href={siteContact.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full",
                      "bg-[#0E7E74] px-3 py-1 text-[11px] font-black text-white",
                      "shadow-[0_4px_14px_rgba(14,126,116,0.32)]",
                      "transition-all active:scale-95",
                    )}
                    style={{ WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>{lang === "ar" ? "مساعدة مباشرة" : "Direct support"}</span>
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Bottom ink hairline */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px bg-[#0A1220]/[0.10]"
          />
        </header>
      ) : null}

      {/* ── Main content ── */}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "shopper-shell__main w-full outline-none",
          !showBottomNav && "shopper-shell__main--checkout",
        )}
        style={{
          paddingBottom: showBottomNav
            ? "calc(6.5rem + env(safe-area-inset-bottom, 0px))"
            : undefined,
          paddingTop: isFocusedTaskRoute ? "0.25rem" : undefined,
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        <div className={cn("route-shell w-full px-4", isFocusedTaskRoute ? "pt-1" : "pt-2")}>
          <Outlet />
        </div>
      </main>

      {showBottomNav ? <MobileBottomNav /> : null}
    </div>
  );
}
