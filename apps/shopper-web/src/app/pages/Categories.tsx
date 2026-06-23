import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes,
  ChevronRight,
  LayoutGrid,
  PackageSearch,
  X,
} from "lucide-react";
import { useCatalog } from "../../contexts/CatalogContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useSearchInput } from "../../contexts/SearchContext";
import { CategoryGrid } from "../components/CategoryGrid";
import { CatalogSkeletonGrid } from "../components/CatalogPrimitives";
import { useCatalogCategorySearch } from "../hooks/useCatalogCategorySearch";
import { useIsShopperShell } from "../components/ui/use-mobile";
import { MobileCategoriesView } from "./ShopperMobileViews";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const TEAL = "#0E7E74";
const INK  = "#0A1220";

/* ─── Empty State ────────────────────────────────────────────── */
function CategoryEmptyState({
  lang,
  hasSearch,
  onClear,
}: {
  lang: "ar" | "en";
  hasSearch: boolean;
  onClear?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-slate-100 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)]">
        <PackageSearch className="h-10 w-10 text-slate-200" />
      </div>
      <h2 className="text-2xl font-black text-slate-900">
        {lang === "ar" ? "لا توجد أقسام مطابقة" : "No matching categories"}
      </h2>
      <p className="mt-2 max-w-xs text-sm font-semibold leading-relaxed text-slate-400">
        {lang === "ar"
          ? "جرّب مصطلحًا آخر أو امسح البحث الحالي."
          : "Try a different term or clear the current search."}
      </p>
      {hasSearch && onClear && (
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={onClear}
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-black text-white shadow-[0_6px_20px_rgba(10,18,32,0.16)] transition-[background-color] duration-200 hover:bg-[#0E7E74]"
          style={{ backgroundColor: INK }}
        >
          <X className="h-3.5 w-3.5" />
          {lang === "ar" ? "مسح البحث" : "Clear search"}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ─── Main Export ───────────────────────────────────────────── */
export default function Categories() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <MobileCategoriesView />;
  return <CategoriesDesktop />;
}

/* ─── Desktop View ──────────────────────────────────────────── */
function CategoriesDesktop() {
  const { categories, isLoading } = useCatalog();
  const { lang } = useLanguage();
  const { searchQuery, setSearchQuery } = useSearchInput();

  const isInitialLoading = isLoading && categories.length === 0;
  const filteredCategories = useCatalogCategorySearch(categories, searchQuery);

  return (
    <div className="categories-page min-h-screen bg-[#F8FAFB]">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="page-section py-6">
          {/* Breadcrumb */}
          <nav className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Link to="/" className="transition-colors hover:text-slate-600">
              {lang === "ar" ? "الرئيسية" : "Home"}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-600">
              {lang === "ar" ? "الأقسام" : "Categories"}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">
              {lang === "ar" ? "تصفح الأقسام" : "Browse by category"}
            </h1>
            <span
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-black text-white"
              style={{ backgroundColor: INK }}
            >
              <Boxes className="h-3 w-3" />
              {categories.length} {lang === "ar" ? "قسم" : categories.length === 1 ? "section" : "sections"}
            </span>
          </div>

          {/* Quick chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to="/products"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-black text-slate-600 transition-colors hover:bg-slate-100"
            >
              <LayoutGrid className="h-3 w-3" style={{ color: TEAL }} />
              {lang === "ar" ? "كل المنتجات" : "All products"}
            </Link>

            <AnimatePresence>
              {searchQuery.trim() && (
                <motion.button
                  key="search-chip"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 pl-3 pr-2 text-[11px] font-black text-teal-700 transition-colors hover:bg-teal-100"
                >
                  {searchQuery.trim()}
                  <X className="h-3 w-3" />
                </motion.button>
              )}
            </AnimatePresence>

            {!searchQuery.trim() && (
              <span className="text-[11px] font-semibold text-slate-400">
                {lang === "ar"
                  ? "ابحث من الشريط العلوي وستُحدَّث الخريطة فوراً"
                  : "Search from the top bar — this map updates instantly"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="page-section py-8 md:py-12">

        {/* Results label */}
        {!isInitialLoading && categories.length > 0 && (
          <div className="mb-6 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              {searchQuery.trim()
                ? lang === "ar"
                  ? `${filteredCategories.length} نتيجة`
                  : `${filteredCategories.length} result${filteredCategories.length !== 1 ? "s" : ""}`
                : lang === "ar"
                  ? `جميع الأقسام (${categories.length})`
                  : `All sections (${categories.length})`}
            </span>
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[11px] font-black transition-colors hover:underline"
                style={{ color: TEAL }}
              >
                {lang === "ar" ? "عرض الكل" : "Show all"}
              </button>
            )}
          </div>
        )}

        {isInitialLoading ? (
          <CatalogSkeletonGrid variant="category" count={8} />
        ) : categories.length === 0 ? (
          <CategoryEmptyState lang={lang} hasSearch={false} />
        ) : filteredCategories.length > 0 ? (
          <CategoryGrid categories={filteredCategories} />
        ) : (
          <CategoryEmptyState
            lang={lang}
            hasSearch={searchQuery.trim().length > 0}
            onClear={() => setSearchQuery("")}
          />
        )}
      </div>
    </div>
  );
}
