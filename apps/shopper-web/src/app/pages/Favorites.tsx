import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Heart,
  Package,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCatalog } from "../../contexts/CatalogContext";
import { useFavorites } from "../../contexts/FavoritesContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchProductsByIds } from "../../services/shopperCatalogApi";
import type { CatalogProduct } from "../catalog";
import { ProductGrid, ProductGridSkeleton } from "../components/ProductGrid";
import { useIsShopperShell } from "../components/ui/use-mobile";
import { MobileFavoritesView } from "./ShopperMobileViews";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const TEAL = "#0E7E74";
const INK  = "#0A1220";

// ─── Route shell ─────────────────────────────────────────────────────────────

export default function Favorites() {
  const isShopperShell = useIsShopperShell();
  if (isShopperShell) return <MobileFavoritesView />;
  return <FavoritesDesktop />;
}

// ─── FavoritesDesktop ─────────────────────────────────────────────────────────

function FavoritesDesktop() {
  const { t, lang } = useLanguage();
  const { productsById } = useCatalog();
  const { favoriteIds, isBusy, errorMessage } = useFavorites();

  const [fetchedProducts, setFetchedProducts] = useState<Record<string, CatalogProduct>>({});
  const fetchedRef = useRef<Record<string, CatalogProduct>>({});
  const [isFetchingFavs, setIsFetchingFavs] = useState(false);

  useEffect(() => {
    if (favoriteIds.size === 0) return;

    const missingIds = Array.from(favoriteIds).filter(
      (id) => !productsById[id] && !fetchedRef.current[id],
    );
    if (missingIds.length === 0) return;

    setIsFetchingFavs(true);
    void fetchProductsByIds(missingIds).then((fetched) => {
      fetched.forEach((p) => { fetchedRef.current[p.id] = p; });
      setFetchedProducts({ ...fetchedRef.current });
      setIsFetchingFavs(false);
    });
  }, [favoriteIds, productsById]);

  const favoriteProducts = useMemo(() => {
    const allById: Record<string, CatalogProduct> = { ...fetchedProducts, ...productsById };
    return Array.from(favoriteIds)
      .map((id) => allById[id])
      .filter((p): p is CatalogProduct => Boolean(p));
  }, [favoriteIds, productsById, fetchedProducts]);

  const availableCount = favoriteProducts.filter((p) => p.inStock).length;
  const isResolving    = isBusy || isFetchingFavs;

  return (
    <div className="favorites-page min-h-screen bg-[#F8FAFB]">

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
              {lang === "ar" ? "المفضلة" : "Favourites"}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">
              {t("favorites_title")}
            </h1>
            <span
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-black text-white"
              style={{ backgroundColor: INK }}
            >
              <Heart className="h-3 w-3 fill-current" />
              {favoriteIds.size} {lang === "ar" ? "منتج" : favoriteIds.size === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Quick stats */}
          {favoriteProducts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-black text-slate-600">
                <Sparkles className="h-3 w-3" style={{ color: TEAL }} />
                {availableCount} {lang === "ar" ? "متاح الآن" : "available now"}
              </span>
              {favoriteProducts.length - availableCount > 0 && (
                <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[11px] font-black text-amber-700">
                  {favoriteProducts.length - availableCount} {lang === "ar" ? "غير متوفر" : "out of stock"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="page-section py-8 md:py-12">

        {/* Error banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skeleton loading */}
        {isResolving ? (
          <ProductGridSkeleton count={8} />
        ) : favoriteProducts.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div
              className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-slate-100 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)]"
            >
              <Heart className="h-10 w-10 text-slate-200" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">
              {t("favorites_empty")}
            </h2>
            <p className="mt-2 max-w-xs text-sm font-semibold leading-relaxed text-slate-400">
              {lang === "ar"
                ? "احفظ المنتجات للرجوع إليها لاحقاً من صفحات المنتجات والعروض."
                : "Save products from the catalog or offers to review them later."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/products"
                className="inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-black text-white shadow-[0_6px_20px_rgba(10,18,32,0.16)] transition-[background-color] duration-200 hover:bg-[#0E7E74]"
                style={{ backgroundColor: INK }}
              >
                <Package className="h-4 w-4" />
                {t("browse_products")}
              </Link>
              <Link
                to="/offers"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ShoppingBag className="h-4 w-4" />
                {lang === "ar" ? "العروض" : "Today's offers"}
              </Link>
            </div>
          </motion.div>
        ) : (
          /* Product grid */
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                {lang === "ar" ? "المنتجات المحفوظة" : "Saved products"} ({favoriteProducts.length})
              </span>
              <Link
                to="/products"
                className="text-[11px] font-black transition-colors hover:underline"
                style={{ color: TEAL }}
              >
                {lang === "ar" ? "متابعة التصفح" : "Continue browsing"}
              </Link>
            </div>

            <ProductGrid products={favoriteProducts} />
          </div>
        )}
      </div>
    </div>
  );
}
