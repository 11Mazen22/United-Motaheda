import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdminStore } from '@/stores/admin.store';
import { adminSocket } from '@/lib/socket';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { MapPage } from '@/pages/MapPage';
import { DriversPage } from '@/pages/DriversPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MarketingPage } from '@/pages/MarketingPage';
import { BranchesPage } from '@/pages/BranchesPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { CustomersPage } from '@/pages/CustomersPage';

import { Toast } from '@/components/Toast';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { isAuthenticated, isDark } = useAdminStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (isAuthenticated) {
      adminSocket.connect();
    } else {
      adminSocket.disconnect();
    }
  }, [isAuthenticated]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="branches" element={<BranchesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="marketing" element={<MarketingPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  );
}
