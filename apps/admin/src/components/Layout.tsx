import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminStore } from '@/stores/admin.store';
import { adminSocket } from '@/lib/socket';

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',     icon: '📊', exact: true  },
  { to: '/map',          label: 'Live Map',       icon: '🗺️', exact: false },
  { to: '/drivers',      label: 'Drivers',        icon: '🚗', exact: false },
  { to: '/orders',       label: 'Orders',         icon: '📦', exact: false },
  { to: '/notifications',label: 'Notifications',  icon: '🔔', exact: false },
  { to: '/marketing',    label: 'Marketing',      icon: '📣', exact: false },
];

export function Layout() {
  const navigate = useNavigate();
  const { user, logout, isDark, toggleDark } = useAdminStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    adminSocket.disconnect();
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? 'w-60' : 'w-16'} flex-shrink-0
          flex flex-col bg-white dark:bg-slate-800
          border-r border-gray-100 dark:border-slate-700
          transition-all duration-300
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-slate-700">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            U
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                United Pharmacy
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Admin Panel</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${
                  isActive
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`
              }
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-700 space-y-2">
          {sidebarOpen && (
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.fullName?.[0] ?? 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {user?.fullName ?? 'Admin'}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            {sidebarOpen && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <span>🚪</span>
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-4 px-6 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
            United Pharmacy — Driver Operations
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
