/**
 * ProductGrid.tsx — Virtualized product grid with Infinite Scroll
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * THE PRIMARY PERFORMANCE FIX: VIRTUALIZATION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * With VirtuosoGrid, only the cards visible in the viewport (plus a small
 * overscan buffer) are ever in the DOM. For a 1080p screen showing 3 columns
 * of ~300px cards, that's 9–15 DOM nodes at any moment regardless of how many
 * products are loaded. The grid does not re-render non-visible cards on scroll.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * INFINITE SCROLL — how it works (for Bara'a)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  1. VirtuosoGrid renders the current `products` array.
 *  2. When the last item enters the viewport, VirtuosoGrid fires `endReached`.
 *  3. `endReached` calls `onEndReached()` which the parent (Products.tsx) wires
 *     to `useInfiniteProducts.fetchNextPage()`.
 *  4. `fetchNextPage` sends one Supabase request for the next 24 products.
 *  5. The new products are appended to the array, `totalCount` grows, and
 *     VirtuosoGrid smoothly extends the list without any layout shift.
 *
 * While the next page is loading, `isLoadingMore` is true. The <InfiniteScrollFooter>
 * renders a spinner below the grid so the user knows more items are coming.
 * It is positioned OUTSIDE VirtuosoGrid (below it) so it doesn't interfere with
 * the virtualizer's internal height calculations.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * STABLE COMPONENT REFERENCES (critical correctness requirement)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * VirtuosoGrid's `components.List` and `components.Item` MUST be defined
 * OUTSIDE the render function. If defined inline, React treats them as new
 * component types on every render, unmounting and remounting the entire
 * virtual DOM tree — defeating the purpose of virtualization.
 *
 * GridListContainer and GridItemContainer are module-level constants.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SKELETON LOADING STATES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   1. INITIAL LOAD (products.length === 0 && isLoading)
 *      Shows 12 skeleton cards — signals "search is running", not "no results".
 *
 *   2. SEARCH REFINEMENT (products.length > 0 && isSearching)
 *      Previous results stay visible with a translucent loading overlay.
 *      pointer-events-none so the user can still scroll during the transition.
 *
 *   3. NEXT PAGE LOADING (isLoadingMore)
 *      Spinner appears below the last row. Existing rows stay fully interactive.
 *
 *   4. EMPTY RESULTS (products.length === 0 && !isLoading)
 *      Clear empty-state message distinguishes "no results" from "loading".
 */

import {
  forwardRef,
  memo,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import { VirtuosoGrid, type GridComponents } from "react-virtuoso";
import { useLanguage } from "../../contexts/LanguageContext";
import type { CatalogProduct } from "../catalog";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { cn } from "./UI";

// ─── CSS grid classes ─────────────────────────────────────────────────────────
// Shared across the live grid, skeleton grid, and empty state so layout is
// always consistent regardless of which state is rendered.

// auto-rows-fr removed: in CSS grid, fr in grid-auto-rows is relative to the
// container's explicit height. When the container has no fixed height (which
// is always the case inside VirtuosoGrid's List component), fr resolves to
// auto. Keeping it caused VirtuosoGrid's row-height measurement to be
// non-deterministic on some browsers, producing subtle scroll jitter.
// Plain "auto" rows (the browser default) are measured once, stably.
const GRID_CLASSES = cn(
  // gap: 20px default, 24px on lg+ — cards need breathing room for hover shadows
  "catalog-products-grid grid gap-5 lg:gap-6",
  // Column count: 2 on mobile, 3 on md, auto-fill on xl+
  "grid-cols-2 md:grid-cols-3",
  // xl+: auto-fill with min 15rem per card — wider than the old 14.5rem
  "xl:[grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]",
  "2xl:[grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]",
  "min-[1920px]:[grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]",
);

// ─── Stable VirtuosoGrid component references ─────────────────────────────────
//
// CRITICAL: Must be at module scope — not inside any component.
// VirtuosoGrid compares component identity on each render. A new function
// reference causes the entire grid DOM tree to unmount and remount, which
// defeats the purpose of virtualization entirely.

const GridListContainer = forwardRef<
  HTMLDivElement,
  { style?: CSSProperties; children?: ReactNode; className?: string }
>(({ style, children, className }, ref) => (
  <div ref={ref} style={style} className={cn(GRID_CLASSES, className)}>
    {children}
  </div>
));
GridListContainer.displayName = "GridListContainer";

const GridItemContainer = forwardRef<
  HTMLDivElement,
  { children?: ReactNode; className?: string }
>(({ children, className }, ref) => (
  // `relative` creates a stacking context so `hover:z-10` on ProductCard
  // lifts the card above its siblings without being clipped.
  // `min-h-0` is kept to prevent grid items from collapsing in some flex contexts.
  <div ref={ref} className={cn("relative min-h-0", className)}>
    {children}
  </div>
));
GridItemContainer.displayName = "GridItemContainer";

// VirtuosoGrid components object — module-scoped for referential stability.
const VIRTUOSO_COMPONENTS: GridComponents = {
  List: GridListContainer,
  Item: GridItemContainer,
};

// ─── ProductGridSkeleton ──────────────────────────────────────────────────────

/**
 * A grid of skeleton cards shown while the initial page-1 response is in-flight.
 * Uses the same CSS grid classes as the live grid to prevent layout shift.
 */
export function ProductGridSkeleton({
  count = 12,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn(GRID_CLASSES, className)} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── SearchLoadingOverlay ─────────────────────────────────────────────────────

/**
 * Shown while a search refinement is in progress (results exist but are being
 * replaced). Keeps the grid visible and scrollable while the response arrives.
 * pointer-events-none prevents it from blocking scroll or tap events.
 */
function SearchLoadingOverlay({ lang }: { lang: "ar" | "en" }) {
  return (
    <div
      aria-live="polite"
      aria-label={lang === "ar" ? "جارٍ تحديث النتائج" : "Updating results"}
      className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center"
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/90 px-4 py-2.5 shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <span className="relative flex h-4 w-4 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-teal-500" />
        </span>
        <span className="text-xs font-black text-slate-600">
          {lang === "ar" ? "جارٍ البحث…" : "Searching…"}
        </span>
      </div>
    </div>
  );
}

// ─── InfiniteScrollFooter ─────────────────────────────────────────────────────

/**
 * Rendered BELOW the VirtuosoGrid when the next page of products is loading.
 *
 * Placed outside the virtualizer so it doesn't affect the internal height
 * measurements that VirtuosoGrid uses to decide which rows to render.
 * The user sees it as a natural continuation below the last card row.
 */
function InfiniteScrollFooter({ lang }: { lang: "ar" | "en" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={lang === "ar" ? "جارٍ تحميل المزيد" : "Loading more products"}
      className="mt-8 flex flex-col items-center gap-3 pb-10"
    >
      {/* Spinner row */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-teal-500" />
        </span>
        <span className="text-[12px] font-black text-slate-500">
          {lang === "ar" ? "جارٍ تحميل المزيد…" : "Loading more…"}
        </span>
      </div>

      {/* Skeleton row hint — shows 3 ghost cards so the user knows more are coming */}
      <div className={cn(GRID_CLASSES, "w-full opacity-60")}>
        {Array.from({ length: 3 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({
  activeQuery,
  lang,
}: {
  activeQuery: string;
  lang: "ar" | "en";
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-7 w-7 text-slate-300"
          aria-hidden
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 21 21" strokeLinecap="round" />
          <path d="M8 10.5h5M10.5 8v5" strokeLinecap="round" />
        </svg>
      </div>

      {activeQuery ? (
        <>
          <p className="text-base font-black text-slate-800">
            {lang === "ar"
              ? `لا توجد نتائج لـ "${activeQuery}"`
              : `No results for "${activeQuery}"`}
          </p>
          <p className="mt-1.5 max-w-xs text-sm font-semibold text-slate-400">
            {lang === "ar"
              ? "جرّب بحثاً مختلفاً أو تصفّح الأقسام"
              : "Try a different search or browse categories"}
          </p>
        </>
      ) : (
        <p className="text-base font-black text-slate-800">
          {lang === "ar" ? "لا توجد منتجات" : "No products found"}
        </p>
      )}
    </div>
  );
}

// ─── ProductGrid ──────────────────────────────────────────────────────────────

interface ProductGridProps {
  products: CatalogProduct[];

  /**
   * True while the initial page-1 response is in-flight.
   * Shows skeleton cards instead of an empty state.
   */
  isLoading?: boolean;

  /**
   * True while the search worker / server is processing a refinement query.
   * Shows a translucent overlay over the existing results.
   * Kept for backward compatibility with the search overlay pattern.
   */
  isSearching?: boolean;

  /**
   * True while fetching the next infinite-scroll page.
   * Shows InfiniteScrollFooter below the grid.
   */
  isLoadingMore?: boolean;

  /**
   * Called when the last visible item enters the viewport.
   * Wire this to `useInfiniteProducts.fetchNextPage`.
   *
   * VirtuosoGrid calls it with the index of the last rendered item.
   * We ignore the index — the hook knows which page to fetch next.
   */
  onEndReached?: () => void;

  /** The debounced query string — used in the empty-state message. */
  activeQuery?: string;

  className?: string;
}

export const ProductGrid = memo(function ProductGrid({
  products,
  isLoading = false,
  isSearching = false,
  isLoadingMore = false,
  onEndReached,
  activeQuery = "",
  className,
}: ProductGridProps) {
  const { lang } = useLanguage();

  // ── Case 1: Initial load — nothing to show yet ─────────────────────────
  // Display skeleton cards so the user knows content is coming.
  // Do NOT show an empty state here — that would be misleading.
  if (isLoading && products.length === 0) {
    return <ProductGridSkeleton className={className} />;
  }

  // ── Case 2: No results, not loading ────────────────────────────────────
  if (!isLoading && products.length === 0) {
    return <EmptyState activeQuery={activeQuery} lang={lang} />;
  }

  // ── Case 3: Results available ───────────────────────────────────────────
  //
  // `itemContent` is memoised so VirtuosoGrid receives a stable function
  // reference across renders, avoiding unnecessary internal re-renders of the
  // virtualizer's row-tracking logic.
  //
  // `animate={false}`: entrance animations are suppressed in the virtualised
  // context. When the user scrolls, DOM nodes are recycled for new products —
  // re-animating them on every scroll would be visually jarring.
  const itemContent = useCallback(
    (index: number) => (
      <ProductCard product={products[index]} animate={false} />
    ),
    [products],
  );

  return (
    <div className={cn("relative", className)}>
      {/* Refinement overlay — shown when the search query is changing but results exist */}
      {isSearching && products.length > 0 && (
        <SearchLoadingOverlay lang={lang} />
      )}

      {/**
       * VirtuosoGrid — the core virtualizer.
       *
       * useWindowScroll: uses the browser window as the scroll container.
       *   Keeps the native scrollbar, scroll restoration, and browser history
       *   working correctly. The alternative (internal div scroll) would need
       *   an explicit height and breaks the address bar scroll behavior on mobile.
       *
       * totalCount: the number of items in `products`. VirtuosoGrid derives
       *   row count from this + its measured column count.
       *
       * overscan: render items 400 px above/below the visible area.
       *   Prevents blank gaps when the user scrolls quickly.
       *   400 px ≈ one row of standard card heights.
       *
       * endReached: fired when the last rendered item enters the viewport.
       *   We wire this to `useInfiniteProducts.fetchNextPage` so infinite
       *   scroll triggers automatically without any button click.
       *   The `_index` parameter (last item's index) is intentionally ignored
       *   — the hook tracks the page number internally.
       *
       * components: module-scoped stable references (see top of file).
       */}
      <VirtuosoGrid
        useWindowScroll
        totalCount={products.length}
        // Increased from 400px → 800px: renders one extra card-row above and
        // below the viewport so rapid scrolling never shows a blank gap.
        overscan={800}
        components={VIRTUOSO_COMPONENTS}
        itemContent={itemContent}
        endReached={onEndReached ? (_index) => onEndReached() : undefined}
      />

      {/* Infinite scroll loading footer — rendered OUTSIDE the virtualizer */}
      {isLoadingMore && <InfiniteScrollFooter lang={lang} />}
    </div>
  );
});
