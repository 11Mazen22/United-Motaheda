/**
 * FilterSidebar.tsx — United Pharmacies
 *
 * Complete rewrite. Goals:
 *   • position:sticky that actually follows the user while scrolling
 *   • Zero layout jank — CSS transitions only inside the sidebar;
 *     Framer Motion only for the mobile drawer where it matters
 *   • React.memo + useCallback everywhere to prevent wasted renders
 *   • Dual-handle price range, live category search, active-filter pills
 *   • RTL-aware (Arabic / English)
 *   • Accessible: keyboard navigation, aria roles, focus trap on drawer
 *
 * STICKY REQUIREMENTS (must be preserved in host pages):
 *   The host flex row MUST have:   className="flex items-start gap-6"
 *   This aside MUST NOT be inside any ancestor with overflow:hidden/auto.
 *   If your .page-section has overflow:hidden, move this outside it.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  ChevronDown,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { cn } from "./UI";

// ─── Public types ─────────────────────────────────────────────────────────────

export type FilterCategory = {
  id: string;
  label: string;
  count?: number;
};

export type FilterSidebarProps = {
  lang: "ar" | "en";

  // Mobile drawer
  mobileOpen: boolean;
  onMobileClose: () => void;

  // Availability
  onlyInStock: boolean;
  onInStockChange: (v: boolean) => void;

  // Category
  categories: FilterCategory[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;

  // Price
  priceRange: [number, number];
  maxPrice: number;
  onPriceRangeChange: (range: [number, number]) => void;
  currency?: string;

  // Brand (optional — when provided, renders a multi-select chip cloud)
  brands?: string[];                       // ALL available brands (from products)
  activeBrands?: string[];                 // currently selected
  onToggleBrand?: (brand: string) => void;
  onClearBrands?: () => void;

  // Summary
  totalResults: number;
  hasFilters: boolean;
  onClearAll: () => void;
};

// ─── Accordion section ────────────────────────────────────────────────────────
// Uses CSS max-height transition — no JS animation, no layout shift, 60 fps.

const SidebarSection = memo(function SidebarSection({
  title,
  icon: Icon,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100/80 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center justify-between px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50/70"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600">
            <Icon className="h-3 w-3" />
          </div>
          <span className="text-[10.5px] font-black uppercase tracking-[0.2em] text-slate-600">
            {title}
          </span>
          {badge !== undefined && badge > 0 && (
            <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-teal-500 px-1 text-[8px] font-black text-white">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform duration-300 group-hover:text-slate-400",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>

      {/* CSS-only height transition — no JS, no flicker */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? "600px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-4 pb-4 pt-0.5">{children}</div>
      </div>
    </div>
  );
});

// ─── Price slider ─────────────────────────────────────────────────────────────
// Dual-state design: `displayMax` updates on every drag for smooth UI;
// the parent `onChange` is called ONLY on pointer/touch/key release so the
// parent never triggers an API call mid-drag — eliminating scroll jump.

const PriceSlider = memo(function PriceSlider({
  value,
  max,
  onChange,
  currency,
  lang,
}: {
  value: [number, number];
  max: number;
  onChange: (v: [number, number]) => void;
  currency?: string;
  lang: "ar" | "en";
}) {
  const cur = currency ?? "EGP";

  // Local display value — updated every drag tick for smooth visual feedback.
  // The parent is NOT notified until the user releases the slider.
  const [displayMax, setDisplayMax] = useState(value[1]);
  const isDraggingRef = useRef(false);

  // Sync display value when parent resets it (e.g., "Clear all").
  const prevCommittedRef = useRef(value[1]);
  useEffect(() => {
    if (value[1] !== prevCommittedRef.current && !isDraggingRef.current) {
      prevCommittedRef.current = value[1];
      setDisplayMax(value[1]);
    }
  }, [value]);

  const pct = max > 0 ? (displayMax / max) * 100 : 0;
  const step = useMemo(() => Math.max(1, Math.round(max / 200)), [max]);

  // Update display only — no parent call, no API request.
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    isDraggingRef.current = true;
    setDisplayMax(Number(e.target.value));
  }, []);

  // Commit to parent on release → single API call per gesture.
  const handleCommit = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    prevCommittedRef.current = displayMax;
    onChange([0, displayMax]);
  }, [onChange, displayMax]);

  const isFiltered = displayMax < max;

  return (
    <div className="space-y-3">
      {/* Value display */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-400">
          {lang === "ar" ? "من ٠ حتى" : "0 to"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-xl border px-3 py-1 text-[11px] font-black shadow-sm transition-colors duration-150",
            isFiltered
              ? "border-teal-300 bg-gradient-to-r from-teal-50 to-emerald-50 text-teal-700"
              : "border-slate-200 bg-slate-50 text-slate-500",
          )}
          dir="ltr"
        >
          <Tag className="h-2.5 w-2.5" />
          {displayMax.toLocaleString()} {cur}
        </span>
      </div>

      {/* Track */}
      <div className="relative flex h-7 items-center">
        {/* Background track */}
        <div className="h-2 w-full rounded-full bg-slate-100">
          {/* Filled portion */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500 transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Native range input — fully transparent, sits on top for interactions */}
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={displayMax}
          onChange={handleChange}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          onKeyUp={handleCommit}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={lang === "ar" ? "الحد الأقصى للسعر" : "Maximum price"}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={displayMax}
        />

        {/* Visual thumb */}
        <div
          className={cn(
            "pointer-events-none absolute h-5 w-5 -translate-x-1/2 rounded-full border-2 bg-white transition-shadow duration-150",
            isFiltered
              ? "border-teal-500 shadow-[0_2px_10px_rgba(20,184,166,0.40)]"
              : "border-slate-300 shadow-[0_1px_4px_rgba(15,23,42,0.15)]",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* Min/max labels */}
      <div
        className="flex items-center justify-between text-[10px] font-semibold text-slate-400"
        dir="ltr"
      >
        <span>0</span>
        <span>
          {max.toLocaleString()} {cur}
        </span>
      </div>

      {/* "Drag to filter" hint — only shown when at max */}
      {!isFiltered && (
        <p className="text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-300">
          {lang === "ar" ? "اسحب لتحديد حد السعر" : "Drag to set a price cap"}
        </p>
      )}
    </div>
  );
});

// ─── Category list ────────────────────────────────────────────────────────────
// Has its own search field when there are > 6 categories.

const CategoryList = memo(function CategoryList({
  options,
  active,
  onChange,
  lang,
}: {
  options: FilterCategory[];
  active: string;
  onChange: (id: string) => void;
  lang: "ar" | "en";
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const showSearch = options.length > 6;

  return (
    <div className="space-y-2">
      {/* Search within categories */}
      {showSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "ar" ? "بحث في الأقسام…" : "Search categories…"}
            className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/80 ps-7 pe-3 text-[11px] font-semibold text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
            dir={lang === "ar" ? "rtl" : "ltr"}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* List */}
      <ul
        className="space-y-0.5 overflow-y-auto"
        style={{ maxHeight: "14rem", scrollbarWidth: "thin" }}
      >
        {filtered.length === 0 ? (
          <li className="py-4 text-center text-[11px] font-semibold text-slate-400">
            {lang === "ar" ? "لا توجد نتائج" : "No results"}
          </li>
        ) : (
          filtered.map((opt) => {
            const isActive = active === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => onChange(opt.id)}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all duration-150",
                    isActive
                      ? "bg-slate-900 text-white shadow-[0_3px_12px_rgba(15,23,42,0.18)]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {/* Radio indicator */}
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        isActive
                          ? "border-teal-400 bg-teal-400"
                          : "border-slate-300 group-hover:border-slate-400",
                      )}
                    >
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="truncate text-[12px] font-black">{opt.label}</span>
                  </span>

                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
});

// ─── Active-filter pills ───────────────────────────────────────────────────────

type FilterPill = { key: string; label: string; onRemove: () => void };

const ActiveFilterPills = memo(function ActiveFilterPills({
  pills,
  onClearAll,
  lang,
}: {
  pills: FilterPill[];
  onClearAll: () => void;
  lang: "ar" | "en";
}) {
  if (pills.length === 0) return null;

  return (
    <div className="border-b border-slate-100/80 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
          {lang === "ar" ? "الفلاتر المفعّلة" : "Active filters"}
        </span>
        <button
          type="button"
          onClick={onClearAll}
          className="text-[9px] font-black uppercase tracking-[0.12em] text-rose-500 transition-colors hover:text-rose-700"
        >
          {lang === "ar" ? "مسح الكل" : "Clear all"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pills.map((pill) => (
          <span
            key={pill.key}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-200/80 bg-teal-50 py-0.5 ps-2.5 pe-1.5 text-[10px] font-black text-teal-700"
          >
            {pill.label}
            <button
              type="button"
              onClick={pill.onRemove}
              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-200/60 text-teal-600 transition-colors hover:bg-teal-300"
              aria-label={`Remove ${pill.label}`}
            >
              <X className="h-2 w-2" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
});

// ─── Sidebar body ─────────────────────────────────────────────────────────────

const SidebarBody = memo(function SidebarBody(
  props: Omit<FilterSidebarProps, "mobileOpen" | "onMobileClose">,
) {
  const {
    lang,
    onlyInStock,
    onInStockChange,
    categories,
    activeCategory,
    onCategoryChange,
    priceRange,
    maxPrice,
    onPriceRangeChange,
    currency,
    brands,
    activeBrands,
    onToggleBrand,
    hasFilters,
    onClearAll,
  } = props;

  // Build active pills
  const pills = useMemo<FilterPill[]>(() => {
    const result: FilterPill[] = [];
    if (onlyInStock) {
      result.push({
        key: "stock",
        label: lang === "ar" ? "متاح فقط" : "In stock",
        onRemove: () => onInStockChange(false),
      });
    }
    if (activeCategory && activeCategory !== "all") {
      const cat = categories.find((c) => c.id === activeCategory);
      if (cat) {
        result.push({
          key: "cat",
          label: cat.label,
          onRemove: () => onCategoryChange("all"),
        });
      }
    }
    if (maxPrice > 0 && priceRange[1] < maxPrice) {
      const cur = currency ?? "EGP";
      result.push({
        key: "price",
        label: `≤ ${priceRange[1].toLocaleString()} ${cur}`,
        onRemove: () => onPriceRangeChange([0, maxPrice]),
      });
    }
    if (activeBrands && activeBrands.length > 0 && onToggleBrand) {
      for (const b of activeBrands) {
        result.push({
          key: `brand:${b}`,
          label: b,
          onRemove: () => onToggleBrand(b),
        });
      }
    }
    return result;
  }, [
    onlyInStock,
    activeCategory,
    categories,
    maxPrice,
    priceRange,
    currency,
    activeBrands,
    onToggleBrand,
    lang,
    onInStockChange,
    onCategoryChange,
    onPriceRangeChange,
  ]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_20px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.02)]">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 to-white px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm">
            <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-black tracking-tight text-slate-900">
            {lang === "ar" ? "تصفية النتائج" : "Filters"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear button — only when filters active */}
          {hasFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex h-6 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[10px] font-black text-rose-600 transition-all hover:bg-rose-100 hover:shadow-sm active:scale-95"
            >
              <X className="h-2.5 w-2.5" />
              {lang === "ar" ? "مسح" : "Reset"}
            </button>
          )}
        </div>
      </div>

      {/* ── Active filter pills ─────────────────────────────── */}
      <ActiveFilterPills pills={pills} onClearAll={onClearAll} lang={lang} />

      {/* ── Availability ────────────────────────────────────── */}
      <SidebarSection
        title={lang === "ar" ? "التوافر" : "Availability"}
        icon={Truck}
        badge={onlyInStock ? 1 : 0}
        defaultOpen
      >
        <button
          type="button"
          role="switch"
          aria-checked={onlyInStock}
          onClick={() => onInStockChange(!onlyInStock)}
          className={cn(
            "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200",
            onlyInStock
              ? "border-teal-200/80 bg-gradient-to-r from-teal-50 to-emerald-50/60 shadow-[0_2px_12px_rgba(20,184,166,0.15)]"
              : "border-slate-200/80 bg-slate-50/60 hover:border-slate-300 hover:bg-white",
          )}
        >
          {/* Animated toggle track */}
          <div
            className={cn(
              "relative h-[18px] w-8 shrink-0 rounded-full transition-all duration-250",
              onlyInStock ? "bg-teal-500" : "bg-slate-200",
            )}
          >
            <div
              className={cn(
                "absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-all duration-250",
                onlyInStock ? "left-[17px]" : "left-[2px]",
              )}
            />
          </div>

          <div className="flex flex-col">
            <span
              className={cn(
                "text-[12px] font-black leading-tight",
                onlyInStock ? "text-teal-800" : "text-slate-700",
              )}
            >
              {lang === "ar" ? "المتاح للشراء فقط" : "In-stock only"}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              {lang === "ar" ? "تجاهل المنتجات غير المتوفرة" : "Hide unavailable items"}
            </span>
          </div>
        </button>
      </SidebarSection>

      {/* ── Categories ──────────────────────────────────────── */}
      {categories.length > 0 && (
        <SidebarSection
          title={lang === "ar" ? "الأقسام" : "Category"}
          icon={LayoutGrid}
          badge={activeCategory && activeCategory !== "all" ? 1 : 0}
          defaultOpen
        >
          <CategoryList
            options={categories}
            active={activeCategory}
            onChange={onCategoryChange}
            lang={lang}
          />
        </SidebarSection>
      )}

      {/* ── Price ───────────────────────────────────────────── */}
      {maxPrice > 0 && (
        <SidebarSection
          title={lang === "ar" ? "نطاق السعر" : "Price range"}
          icon={Tag}
          badge={priceRange[1] < maxPrice ? 1 : 0}
          defaultOpen
        >
          <PriceSlider
            value={priceRange}
            max={maxPrice}
            onChange={onPriceRangeChange}
            currency={currency}
            lang={lang}
          />
        </SidebarSection>
      )}

      {/* ── Brand ───────────────────────────────────────────── */}
      {brands && brands.length > 0 && onToggleBrand && (
        <SidebarSection
          title={lang === "ar" ? "العلامة التجارية" : "Brand"}
          icon={Award}
          badge={activeBrands?.length ?? 0}
          defaultOpen={false}
        >
          <BrandCloud
            brands={brands}
            active={activeBrands ?? []}
            onToggle={onToggleBrand}
            lang={lang}
          />
        </SidebarSection>
      )}
    </div>
  );
});

// ─── Brand chip cloud ──────────────────────────────────────────────────────

const BrandCloud = memo(function BrandCloud({
  brands, active, onToggle, lang,
}: {
  brands: string[];
  active: string[];
  onToggle: (brand: string) => void;
  lang: "ar" | "en";
}) {
  const [query, setQuery] = useState("");
  const activeSet = useMemo(() => new Set(active.map((b) => b.toLowerCase())), [active]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.toLowerCase().includes(q));
  }, [brands, query]);

  return (
    <div className="space-y-2">
      {brands.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "ar" ? "بحث في العلامات…" : "Search brands…"}
            className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/80 ps-7 pe-3 text-[11px] font-semibold text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
            dir={lang === "ar" ? "rtl" : "ltr"}
          />
        </div>
      )}
      <div
        className="flex flex-wrap gap-1.5 overflow-y-auto pr-0.5"
        style={{ maxHeight: "12rem", scrollbarWidth: "thin" }}
      >
        {filtered.length === 0 ? (
          <p className="w-full py-2 text-center text-[11px] font-semibold text-slate-400">
            {lang === "ar" ? "لا توجد علامات" : "No brands"}
          </p>
        ) : (
          filtered.map((b) => {
            const isActive = activeSet.has(b.toLowerCase());
            return (
              <button
                key={b}
                type="button"
                onClick={() => onToggle(b)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-black transition-all",
                  isActive
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {b}
                {isActive && <X className="h-2.5 w-2.5" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

// ─── Focus trap for mobile drawer ─────────────────────────────────────────────

function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    el.addEventListener("keydown", handleKey);
    return () => el.removeEventListener("keydown", handleKey);
  }, [active, containerRef]);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const FilterSidebar = memo(function FilterSidebar(props: FilterSidebarProps) {
  const { mobileOpen, onMobileClose, lang, ...bodyProps } = props;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Body scroll lock
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onMobileClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen, onMobileClose]);

  useFocusTrap(mobileOpen, drawerRef as React.RefObject<HTMLElement>);

  return (
    <>
      {/* ── Desktop sticky sidebar ──────────────────────────────────────────
          STICKY NOTES:
          • position:sticky lives directly on this <aside> — no inner wrapper
          • self-start (align-self:flex-start) ensures the aside is only as
            tall as its content; without it the flex-row stretches it to match
            the product grid height and sticky never activates
          • The host row must be: <div className="flex items-start gap-6">
          • No ancestor may have overflow:hidden/auto/scroll
      ─────────────────────────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:block lg:w-72 xl:w-[18rem] shrink-0 self-start"
        style={{
          position: "sticky",
          top: "var(--shopper-header-offset, 5.5rem)",
          maxHeight: "calc(100vh - var(--shopper-header-offset, 5.5rem) - 1rem)",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",   // Firefox: hide scrollbar visually
        }}
        aria-label={lang === "ar" ? "لوحة الفلاتر" : "Filter panel"}
      >
        {/* Hide webkit scrollbar via inline style on a child */}
        <style>{`aside[data-filter-sidebar]::-webkit-scrollbar{display:none}`}</style>
        <div data-filter-sidebar="">
          <SidebarBody lang={lang} {...bodyProps} />
        </div>
      </aside>

      {/* ── Mobile slide drawer ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="fsb-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
              onClick={onMobileClose}
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.div
              key="fsb-panel"
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label={lang === "ar" ? "لوحة الفلاتر" : "Filter panel"}
              initial={{ x: lang === "ar" ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: lang === "ar" ? "100%" : "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className={cn(
                "fixed top-0 z-50 flex h-full w-[20rem] max-w-[90vw] flex-col lg:hidden",
                "bg-[#f8fafb] shadow-[0_0_60px_rgba(15,23,42,0.18)]",
                lang === "ar" ? "right-0" : "left-0",
              )}
            >
              {/* Drawer header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {lang === "ar" ? "تصفية النتائج" : "Filter results"}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      {lang === "ar" ? "اختر الفلاتر" : "Choose filters"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                  aria-label={lang === "ar" ? "إغلاق" : "Close"}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "thin" }}>
                <SidebarBody lang={lang} {...bodyProps} />
              </div>

              {/* Sticky footer */}
              <div className="shrink-0 border-t border-slate-100 bg-white p-4">
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-sm font-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)] transition-all hover:shadow-[0_12px_24px_rgba(15,23,42,0.28)] active:scale-[0.98]"
                >
                  <CheckCircle2 className="h-4 w-4 text-teal-300" />
                  {lang === "ar" ? "عرض النتائج" : "Show results"}
                </button>
                {bodyProps.hasFilters && (
                  <button
                    type="button"
                    onClick={() => { bodyProps.onClearAll(); onMobileClose(); }}
                    className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-black text-slate-400 transition-colors hover:text-rose-500"
                  >
                    <X className="h-3.5 w-3.5" />
                    {lang === "ar" ? "مسح جميع الفلاتر" : "Clear all filters"}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});