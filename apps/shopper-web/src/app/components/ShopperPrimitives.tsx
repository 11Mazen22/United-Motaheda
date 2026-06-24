import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Baby,
  CheckCircle2,
  ChevronRight,
  Droplets,
  HeartPulse,
  Package,
  Pill,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  ShoppingBag,
  Tag,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  getCatalogProductImage,
  getProductAvailabilityLabel,
  type CatalogCategory,
  type CatalogProduct,
} from "../catalog";
import { getLocalizedCategoryName, getLocalizedProductName } from "../localization";
import { FavoriteHeartButton } from "./FavoriteHeartButton";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { cn } from "./UI";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Package,
  Pill,
  HeartPulse,
  Sparkles,
  Droplets,
  Baby,
  Stethoscope,
};

function getCategoryIcon(iconName: string) {
  return CATEGORY_ICONS[iconName] || Package;
}

export function ShopperPage({
  children,
  className,
  docked = false,
}: {
  children: ReactNode;
  className?: string;
  docked?: boolean;
}) {
  return (
    <div className={cn("shopper-page", docked && "shopper-page--docked", className)}>
      {children}
    </div>
  );
}

export function ShopperSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ShopperSectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-[1.6rem] font-black tracking-tight text-slate-950 sm:text-[1.85rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type ShopperActionVariant = "primary" | "secondary" | "ghost";

export type ShopperActionItem = {
  to: string;
  label: ReactNode;
  icon?: LucideIcon;
  variant?: ShopperActionVariant;
  className?: string;
};

export function ShopperActionCluster({
  actions,
  className,
}: {
  actions: ShopperActionItem[];
  className?: string;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {actions.map(({ to, label, icon: Icon = ArrowUpRight, variant = "primary", className: itemClassName }) => (
        <Link
          key={`${to}-${String(label)}`}
          to={to}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.05rem] px-4 text-sm font-black transition-all active:scale-[0.98]",
            variant === "primary" && "bg-[var(--primary)] text-white shadow-[0_12px_28px_rgba(25,56,68,0.18)] hover:bg-[var(--primary-strong)]",
            variant === "secondary" && "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50",
            variant === "ghost" && "bg-transparent text-[var(--primary)] hover:bg-[var(--primary)]/5",
            itemClassName,
          )}
        >
          <span>{label}</span>
          <Icon className="h-4 w-4 shrink-0" />
        </Link>
      ))}
    </div>
  );
}

type ShopperStatusTone = "info" | "warning" | "error" | "success" | "offline" | "reconnecting";

const SHOPPER_STATUS_TONES: Record<
  ShopperStatusTone,
  {
    container: string;
    icon: string;
    title: string;
    description: string;
    Icon: LucideIcon;
  }
> = {
  info: {
    container: "border-sky-200 bg-sky-50/90",
    icon: "bg-white text-sky-600",
    title: "text-sky-900",
    description: "text-sky-700",
    Icon: Package,
  },
  warning: {
    container: "border-amber-200 bg-amber-50/90",
    icon: "bg-white text-amber-600",
    title: "text-amber-900",
    description: "text-amber-700",
    Icon: AlertCircle,
  },
  error: {
    container: "border-rose-200 bg-rose-50/95",
    icon: "bg-white text-rose-600",
    title: "text-rose-900",
    description: "text-rose-700",
    Icon: AlertCircle,
  },
  success: {
    container: "border-emerald-200 bg-emerald-50/95",
    icon: "bg-white text-emerald-600",
    title: "text-emerald-900",
    description: "text-emerald-700",
    Icon: CheckCircle2,
  },
  offline: {
    container: "border-slate-200 bg-slate-100/90",
    icon: "bg-white text-slate-700",
    title: "text-slate-900",
    description: "text-slate-600",
    Icon: WifiOff,
  },
  reconnecting: {
    container: "border-teal-200 bg-teal-50/95",
    icon: "bg-white text-teal-700",
    title: "text-teal-900",
    description: "text-teal-700",
    Icon: RefreshCw,
  },
};

export function ShopperStatusBanner({
  tone,
  title,
  description,
  icon,
  actions,
  className,
}: {
  tone: ShopperStatusTone;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  const toneStyles = SHOPPER_STATUS_TONES[tone];
  const Icon = icon ?? toneStyles.Icon;

  return (
    <div className={cn("rounded-[1.4rem] border p-4 shadow-sm", toneStyles.container, className)}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] shadow-sm", toneStyles.icon)}>
          <Icon className={cn("h-5 w-5", tone === "reconnecting" && "animate-spin")} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-black", toneStyles.title)}>{title}</p>
          {description ? (
            <div className={cn("mt-1 text-sm font-semibold leading-6", toneStyles.description)}>
              {description}
            </div>
          ) : null}
          {actions ? <div className="mt-3">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ShopperSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  lang,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  lang: "ar" | "en";
  className?: string;
}) {
  return (
    <form onSubmit={onSubmit} className={cn("relative", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
          lang === "ar" ? "right-4" : "left-4",
        )}
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir={lang === "ar" ? "rtl" : "ltr"}
        aria-label={placeholder}
        className={cn(
          "h-14 w-full rounded-[1.45rem] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_14px_32px_rgba(15,23,42,0.06)] outline-none transition-all placeholder:text-slate-400 focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10",
          lang === "ar" ? "pr-11 pl-14 text-right" : "pl-11 pr-14 text-left",
        )}
      />
      <button
        type="submit"
        className={cn(
          "absolute top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[1rem] bg-[var(--primary)] text-white shadow-[0_14px_28px_rgba(25,56,68,0.18)] transition-colors hover:bg-[var(--primary-strong)]",
          lang === "ar" ? "left-2" : "right-2",
        )}
        aria-label={lang === "ar" ? "Ø¨Ø­Ø«" : "Search"}
      >
        <ArrowUpRight className={cn("h-4 w-4", lang === "ar" && "rotate-180")} />
      </button>
    </form>
  );
}

export function ShopperPromoPanel({
  eyebrow,
  title,
  description,
  actionLabel,
  actionTo,
  image,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actionLabel: ReactNode;
  actionTo: string;
  image?: string;
  className?: string;
}) {
  return (
    <ShopperSurface
      className={cn(
        "relative overflow-hidden border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f6fbfb_58%,#eef7f7_100%)] p-5",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(36,184,181,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_30%)]"
      />
      <div className="relative z-10 grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-center">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-[1.75rem] font-black leading-[1.05] tracking-tight text-slate-950">
            {title}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
            {description}
          </p>
          <Link
            to={actionTo}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-[1.15rem] bg-[var(--primary)] px-5 text-sm font-black text-white shadow-[0_16px_32px_rgba(25,56,68,0.18)] transition-all hover:bg-[var(--primary-strong)]"
          >
            {actionLabel}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/75 p-2 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          {image ? (
            <img
              src={image}
              alt=""
              className="aspect-[4/5] w-full rounded-[1.1rem] object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[1.1rem] bg-[linear-gradient(180deg,#eef7f7_0%,#dfeeed_100%)]">
              <Sparkles className="h-9 w-9 text-[var(--primary)]" />
            </div>
          )}
        </div>
      </div>
    </ShopperSurface>
  );
}

export function ShopperCategoryTile({
  category,
  compact = false,
}: {
  category: CatalogCategory;
  compact?: boolean;
}) {
  const { lang } = useLanguage();
  const Icon = getCategoryIcon(category.icon);
  const displayName = getLocalizedCategoryName(category, lang);
  const countLabel =
    lang === "ar"
      ? `${category.inStockCount} متاح`
      : `${category.inStockCount} available`;

  return (
    <Link to={`/categories/${category.id}`} className="block h-full">
      <article
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-[1.3rem] border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_36px_rgba(15,23,42,0.1)]",
          compact ? "min-h-[12.25rem]" : "min-h-[13rem]",
        )}
      >
        <div className="overflow-hidden border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <ImageWithFallback
              src={category.imageUrl}
              alt={displayName}
              className={cn(
                "w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]",
                compact ? "aspect-[1.02]" : "aspect-[1.04]",
              )}
              style={category.imagePosition ? { objectPosition: category.imagePosition } : undefined}
              loading="lazy"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.05)_0%,rgba(15,23,42,0.4)_100%)]" />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
              <span className="rounded-full border border-white/80 bg-white/94 px-2.5 py-1 text-[10px] font-black text-slate-700 shadow-sm">
                {lang === "ar" ? "قسم" : "Section"}
              </span>
              <span className="rounded-full border border-white/20 bg-slate-950/78 px-2.5 py-1 text-[10px] font-black text-white shadow-sm backdrop-blur-sm">
                {category.inStockCount}
              </span>
            </div>
            <div className="absolute end-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/94 text-slate-700 shadow-sm">
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3
            className={cn(
              "line-clamp-2 font-black leading-6 text-slate-950",
              compact ? "min-h-[3rem] text-sm" : "min-h-[3.25rem] text-base",
            )}
          >
            {displayName}
          </h3>
          <p className="mt-2 text-xs font-semibold text-slate-500">{countLabel}</p>
          <div className="mt-auto pt-4 text-xs font-black text-[var(--primary)]">
            {lang === "ar" ? "استكشف القسم" : "Explore section"}
          </div>
        </div>
      </article>
    </Link>
  );
}
export function ShopperProductTile({
  product,
  badge,
  caption,
  showCategory = true,
  className,
}: {
  product: CatalogProduct;
  badge?: ReactNode;
  caption?: ReactNode;
  showCategory?: boolean;
  className?: string;
}) {
  const { lang, t } = useLanguage();
  const { addToCart } = useCart();
  const location = useLocation();
  const [isAdded, setIsAdded] = useState(false);
  const resetAddedTimeoutRef = useRef<number | null>(null);
  const displayName = getLocalizedProductName(product, lang);
  const displayCategoryName = lang === "ar" ? product.categoryName : product.categoryNameEn;
  const detailState = {
    from: `${location.pathname}${location.search}`,
  };

  useEffect(() => {
    return () => {
      if (resetAddedTimeoutRef.current !== null) {
        window.clearTimeout(resetAddedTimeoutRef.current);
      }
    };
  }, []);

  const handleAddToCart = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!product.inStock) {
      return;
    }

    await addToCart(product);
    setIsAdded(true);
    if (resetAddedTimeoutRef.current !== null) {
      window.clearTimeout(resetAddedTimeoutRef.current);
    }
    resetAddedTimeoutRef.current = window.setTimeout(() => {
      setIsAdded(false);
      resetAddedTimeoutRef.current = null;
    }, 1400);
  };

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_34px_rgba(15,23,42,0.1)]",
        className,
      )}
    >
      <div className="relative border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfb_100%)]">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-col gap-1">
            <span className="inline-flex max-w-[100px] items-center rounded-full border border-white/80 bg-white/95 px-2.5 py-1 text-[10px] font-black text-slate-700 shadow-sm">
              <span className="truncate">{badge || displayCategoryName}</span>
            </span>
            {product.isOffer && product.originalPrice ? (
              <span className="inline-flex items-center gap-1 self-start rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-md">
                <Tag className="h-2.5 w-2.5" />
                {`${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`}
              </span>
            ) : product.isOffer ? (
              <span className="inline-flex items-center gap-1 self-start rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-md">
                <Tag className="h-2.5 w-2.5" />
                {lang === "ar" ? "عرض" : "OFFER"}
              </span>
            ) : null}
          </div>
          <FavoriteHeartButton
            productId={product.id}
            size="sm"
            className="border-white/90 bg-white/95 shadow-[0_10px_22px_rgba(15,23,42,0.12)]"
          />
        </div>
        <Link to={`/products/${product.id}`} state={detailState} className="block">
          <div className="aspect-square p-4">
            <div className="h-full overflow-hidden rounded-[1rem] border border-slate-100 bg-white">
              <ImageWithFallback
                src={getCatalogProductImage(product)}
                alt={displayName}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 p-3">
          <span
            className={cn(
              "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black shadow-sm",
              product.inStock
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-700"
                : "border-rose-200 bg-rose-50/95 text-rose-600",
            )}
          >
            {product.inStock ? (lang === "ar" ? "متاح" : "In stock") : (lang === "ar" ? "غير متاح" : "Unavailable")}
          </span>
          <span className="rounded-full border border-slate-200/80 bg-white/95 px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm">
            {product.code || product.barcode || product.id}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <Link to={`/products/${product.id}`} state={detailState} className="block">
          {showCategory ? (
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {displayCategoryName}
            </p>
          ) : null}
          <h3 className="mt-1 line-clamp-2 min-h-[2.8rem] text-[0.95rem] font-black leading-5 text-slate-950">
            {displayName}
          </h3>
        </Link>

        {caption ? (
          <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-5 text-slate-500">
            {caption}
          </p>
        ) : null}

        <div className="mt-auto pt-3">
          {product.originalPrice && (
            <p className="text-[10px] font-bold text-slate-400 line-through">
              {product.originalPrice.toFixed(2)} <span className="text-[9px]">{t("currency")}</span>
            </p>
          )}
          <p className={cn("text-[1.05rem] font-black tracking-tight", product.isOffer && product.originalPrice ? "text-amber-600" : "text-slate-950")}>
            {product.price.toFixed(2)} <span className="text-xs text-slate-400">{t("currency")}</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">
            {getProductAvailabilityLabel(product, lang)}
          </p>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className={cn(
              "mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[0.95rem] text-xs font-black transition-all active:scale-[0.98]",
              product.inStock
                ? isAdded
                  ? "bg-slate-900 text-white"
                  : "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]"
                : "cursor-not-allowed bg-slate-100 text-slate-400",
            )}
            aria-label={lang === "ar" ? "إضافة إلى السلة" : "Add to cart"}
          >
            {isAdded ? <CheckCircle2 className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            <span>{isAdded ? (lang === "ar" ? "تمت الإضافة" : "Added") : t("add_to_cart")}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
export function ShopperActionDock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("shopper-dock", className)}>{children}</div>;
}

export function ShopperAccountLink({
  icon: Icon,
  title,
  subtitle,
  to,
  action,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  to?: string;
  action?: ReactNode;
  className?: string;
}) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition-all hover:border-slate-300 hover:bg-slate-50/80",
        className,
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-slate-950">{title}</p>
        {subtitle ? (
          <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {action || <ChevronRight className="h-4 w-4 text-slate-400" />}
    </div>
  );

  if (!to) {
    return content;
  }

  return <Link to={to}>{content}</Link>;
}
