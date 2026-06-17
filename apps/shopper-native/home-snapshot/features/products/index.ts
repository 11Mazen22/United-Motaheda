/**
 * Products feature — public barrel (snapshot).
 */

// Types
export type {
  NativeProduct,
  NativeCategory,
  ProductFilters,
  ProductPage,
  ProductSortMode,
} from "./types";
export { PRODUCT_SORT_OPTIONS } from "./types";

// API
export {
  fetchProductsPage,
  fetchProductById,
  fetchFeaturedProducts,
  fetchCategories,
  fetchCatalogStats,
  type CatalogStats,
} from "./api/productsApi";
export { productKeys, categoryKeys } from "./api/queryKeys";

// Hooks
export { useInfiniteProducts } from "./hooks/useInfiniteProducts";
export type { UseInfiniteProductsArgs, UseInfiniteProductsResult } from "./hooks/useInfiniteProducts";
export { useProduct } from "./hooks/useProduct";
export { useProductSearch } from "./hooks/useProductSearch";
export { usePrefetchCategory } from "./hooks/usePrefetchCategory";

// Stores
export {
  useFiltersStore,
  selectSearch,
  selectCategory,
  selectInStock,
  selectSort,
  selectViewMode,
} from "./stores/filtersStore";
export { useRecentlyViewedStore, type RecentProduct } from "./stores/recentlyViewedStore";

// Components
export { ProductGrid, type ProductGridProps } from "./components/ProductGrid";
