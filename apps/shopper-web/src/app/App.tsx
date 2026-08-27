import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "./layout";
import { CatalogProvider, useCatalog } from "../contexts/CatalogContext";
import { CartProvider } from "../contexts/CartContext";
import { SearchProvider } from "../contexts/SearchContext";
import { AdminOnly, ManagerAndAbove, PharmacistAndAbove } from "./admin/AdminRouteProtection";
import { useAuth } from "../contexts/AuthContext";
import AppBootstrapOverlay from "./components/AppBootstrapOverlay";
import { BootstrapBlockingProvider } from "./components/BootstrapBlockingContext";
import TopProgressBar from "./components/TopProgressBar";
import RouteLoadingSkeleton from "./components/RouteLoadingSkeleton";

const AdminLayout          = lazy(() => import("./admin/AdminLayout"));
const DriverApp            = lazy(() => import("./driver/DriverApp"));
const DashboardOverview    = lazy(() => import("./admin/DashboardOverview"));
const FastProductEntry     = lazy(() => import("./admin/FastProductEntry"));

const OrdersManager        = lazy(() => import("./admin/OrdersManager"));
const OrderTracking        = lazy(() => import("./pages/OrderTracking"));
const PrescriptionsManager = lazy(() => import("./admin/PrescriptionsManager"));
const ProductManager       = lazy(() => import("./admin/ProductManager"));
const PromotionsManager    = lazy(() => import("./admin/PromotionsManager"));
const SpecialOrdersManager = lazy(() => import("./admin/SpecialOrdersManager"));
const StaffManager         = lazy(() => import("./admin/StaffManager"));
const UsersManager         = lazy(() => import("./admin/UsersManager"));
const NotificationsManager = lazy(() => import("./admin/NotificationsManager"));
const SuspendedPage        = lazy(() => import("./pages/SuspendedPage"));
const SuspensionLearnMore  = lazy(() => import("./pages/SuspensionLearnMore"));
const About                = lazy(() => import("./pages/About"));
const Cart                 = lazy(() => import("./pages/Cart"));
const Categories           = lazy(() => import("./pages/Categories"));
const CategoryDetails      = lazy(() => import("./pages/CategoryDetails"));
const AuthCallback          = lazy(() => import("./pages/AuthCallback"));
const Checkout             = lazy(() => import("./pages/Checkout"));
const Contact              = lazy(() => import("./pages/Contact"));
const Favorites            = lazy(() => import("./pages/Favorites"));
const ForgotPassword       = lazy(() => import("./pages/ForgotPassword"));
const Home                 = lazy(() => import("./pages/Home"));
const Login                = lazy(() => import("./pages/Login"));
const Offers               = lazy(() => import("./pages/Offers"));
const Orders               = lazy(() => import("./pages/Orders"));
const ProductDetails       = lazy(() => import("./pages/ProductDetails"));
const Products             = lazy(() => import("./pages/Products"));
const Profile              = lazy(() => import("./pages/Profile"));
const Register             = lazy(() => import("./pages/Register"));
const Notifications       = lazy(() => import("./pages/Notifications"));
const Returns              = lazy(() => import("./pages/Returns"));
const ResetPassword        = lazy(() => import("./pages/ResetPassword"));
const SpecialOrders        = lazy(() => import("./pages/SpecialOrders"));
const SupportPage          = lazy(() => import("./pages/SupportPage"));

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoadingSkeleton />}>{element}</Suspense>;
}

/**
 * Reads catalog + auth state from inside CatalogProvider and drives the
 * full-screen bootstrap overlay.  Separated so useCatalog() is called only
 * where CatalogProvider is mounted.
 */
function CatalogBootstrapOverlay() {
  const { error, refreshCatalog } = useCatalog();
  const { loading: authLoading } = useAuth();
  // Only block on auth loading (capped at 12 s by AuthContext's emergency timer).
  // Catalog errors must NOT block the UI — categories always render from
  // CATEGORY_SEEDS even when Supabase is unreachable, and each page shows its
  // own inline error / skeleton while products are loading or unavailable.
  const active = authLoading;
  return (
    <AppBootstrapOverlay
      active={active}
      error={error}
      onRetry={() => void refreshCatalog(true)}
    />
  );
}

/** Mounts CatalogProvider + CartProvider for all catalog-requiring routes. */
function CatalogShell() {
  return (
    <CatalogProvider>
      <CartProvider>
        <CatalogBootstrapOverlay />
        <Outlet />
      </CartProvider>
    </CatalogProvider>
  );
}

function AppShell() {
  const { loading: authLoading } = useAuth();
  const location = useLocation();
  const [navigationActive, setNavigationActive] = useState(false);
  const prevKeyRef = useRef(location.key);

  useEffect(() => {
    if (location.key === prevKeyRef.current) return;
    prevKeyRef.current = location.key;
    setNavigationActive(true);
    const t = setTimeout(() => setNavigationActive(false), 350);
    return () => clearTimeout(t);
  }, [location.key]);

  return (
    <BootstrapBlockingProvider isBlocking={authLoading}>
      <TopProgressBar navigationActive={navigationActive} disabled={authLoading} />
      <Routes>
        {/* ── Catalog-independent routes (no product fetch) ── */}
        <Route path="/login"            element={withSuspense(<Login />)} />
        <Route path="/register"         element={withSuspense(<Register />)} />
        <Route path="/forgot-password"  element={withSuspense(<ForgotPassword />)} />
        <Route path="/reset-password"   element={withSuspense(<ResetPassword />)} />
        <Route path="/auth/callback"    element={withSuspense(<AuthCallback />)} />
        <Route path="/suspended"        element={withSuspense(<SuspendedPage />)} />
        <Route path="/suspension-info"  element={withSuspense(<SuspensionLearnMore />)} />
        <Route path="/track/:orderId" element={withSuspense(<OrderTracking />)} />

        {/* ── Catalog-requiring routes — CatalogProvider mounted here ── */}
        <Route element={<CatalogShell />}>

          {/* Legacy operations URLs now resolve to the single order workspace. */}
          <Route path="/ops" element={<Navigate to="/admin/orders" replace />} />

          {/* ── Driver ── */}
          <Route path="/driver" element={withSuspense(
            <ProtectedRoute requireRole={["driver"]}>
              <DriverApp />
            </ProtectedRoute>,
          )} />

          {/* ── Admin ── */}
          <Route
            path="/admin"
            element={withSuspense(
              <ProtectedRoute requireRole={["admin", "manager", "pharmacist"]}>
                <AdminLayout />
              </ProtectedRoute>,
            )}
          >
            <Route index element={withSuspense(<DashboardOverview />)} />
            <Route path="orders"              element={withSuspense(<ManagerAndAbove><OrdersManager /></ManagerAndAbove>)} />
            <Route path="special-orders"      element={withSuspense(<SpecialOrdersManager />)} />
            <Route path="products/fast-entry" element={withSuspense(<FastProductEntry />)} />
            <Route path="products"            element={withSuspense(<ProductManager />)} />
            <Route path="promotions"          element={withSuspense(<ManagerAndAbove><PromotionsManager /></ManagerAndAbove>)} />
            <Route path="operations"          element={<Navigate to="/admin/orders" replace />} />
            <Route path="prescriptions"       element={withSuspense(<PharmacistAndAbove><PrescriptionsManager /></PharmacistAndAbove>)} />
            <Route path="staff"               element={withSuspense(<AdminOnly><StaffManager /></AdminOnly>)} />
            <Route path="users"               element={withSuspense(<AdminOnly><UsersManager /></AdminOnly>)} />
            <Route path="notifications"       element={withSuspense(<NotificationsManager />)} />
            <Route path="*"                   element={<Navigate to="/admin" replace />} />
          </Route>

          {/* ── Shopper shell — SearchProvider scoped here only ── */}
          <Route path="/" element={<SearchProvider><Layout /></SearchProvider>}>
            <Route index                         element={withSuspense(<Home />)} />
            <Route path="products"               element={withSuspense(<Products />)} />
            <Route path="products/:id"           element={withSuspense(<ProductDetails />)} />
            <Route path="categories"             element={withSuspense(<Categories />)} />
            <Route path="categories/:id"         element={withSuspense(<CategoryDetails />)} />
            <Route path="offers"                 element={withSuspense(<Offers />)} />
            <Route path="about"                  element={withSuspense(<About />)} />
            <Route path="contact"                element={withSuspense(<Contact />)} />
            <Route path="cart"                   element={withSuspense(<Cart />)} />
            <Route path="checkout"               element={withSuspense(<Checkout />)} />
            <Route path="shipping"               element={withSuspense(<SupportPage type="shipping" />)} />
            <Route path="returns"                element={withSuspense(<Returns />)} />
            <Route path="faq"                    element={withSuspense(<SupportPage type="faq" />)} />
            <Route path="terms"                  element={withSuspense(<SupportPage type="terms" />)} />
            <Route path="privacy"                element={withSuspense(<SupportPage type="privacy" />)} />
            <Route path="special-orders"         element={withSuspense(<SpecialOrders />)} />

            <Route path="profile"  element={withSuspense(<ProtectedRoute><Profile /></ProtectedRoute>)} />
            <Route path="notifications" element={withSuspense(<ProtectedRoute><Notifications /></ProtectedRoute>)} />
            <Route path="orders"   element={withSuspense(<ProtectedRoute><Orders /></ProtectedRoute>)} />
            <Route path="favorites" element={withSuspense(<ProtectedRoute><Favorites /></ProtectedRoute>)} />
            <Route path="wishlist"  element={withSuspense(<ProtectedRoute><Favorites /></ProtectedRoute>)} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

        </Route>{/* end CatalogShell */}
      </Routes>
    </BootstrapBlockingProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <AppShell />
      </MotionConfig>
    </BrowserRouter>
  );
}
